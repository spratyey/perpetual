/**
 * Kinetic captions.
 *
 * The deterministic half of the effect: turn speech into timed, typeset,
 * placed caption cues. Gemini is asked only for what a model is good at — the
 * words, the phrase boundaries and which span carries the line. Everything
 * that has to be exact is worked out here.
 *
 * Word timing is the interesting part. A model's word-level timestamps drift,
 * so only the line's start and end are trusted; the words inside it are spread
 * across that span in proportion to their length, warped by where the audio
 * actually has energy. Pauses inside a line are therefore skipped rather than
 * padded, without any peak picking to tune.
 */

import { z } from "zod";

import type { CaptionCue, CaptionMatte, CaptionRole, CaptionToken } from "@/components/editor/types";
import {
  ensureCaptionFonts,
  layoutCue,
  tokenBounds,
  type CaptionTypography,
  type PlacedToken,
} from "@/components/editor/components/overlays/captions/caption-layout";
import { analyzeMedia } from "./gemini";
import { buildSubjectMatte, subjectCoverage, type SubjectOccupancy } from "./subject-matte";

/** How long a line stays up after its last word lands. */
const HOLD_FRAMES = 16;
const MIN_CUE_FRAMES = 20;
/** Silhouettes are sampled no finer than this; the rest is interpolation and smoothing. */
const MAX_MATTE_SAMPLES = 360;
const MIN_MATTE_STEP = 2;

/** Tasteful resting places, in reading order of preference. */
const ANCHORS: { x: number; y: number }[] = [
  { x: 0.5, y: 0.2 },
  { x: 0.5, y: 0.78 },
  { x: 0.34, y: 0.22 },
  { x: 0.66, y: 0.22 },
  { x: 0.34, y: 0.76 },
  { x: 0.66, y: 0.76 },
  { x: 0.5, y: 0.49 },
];

/**
 * The effect lives in partial occlusion, so placement chases it rather than
 * avoiding the subject. A word grazed by a head or a shoulder reads as depth; a
 * word the subject would swallow reads as a mistake, and comes to the front
 * instead. Coverage is therefore measured per word, not over the whole line.
 */
const GRAZE_MIN = 0.06;
const FRONT_LIMIT = 0.5;
const REWARD_GRAZE = 0.5;
const WEIGHT_BURIED = 1.2;
const WEIGHT_COLLISION = 3;
const WEIGHT_REPEAT = 0.4;
const WEIGHT_ORDER = 0.02;

export const CAPTION_SCHEMA = {
  type: "object",
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          startSeconds: { type: "number" },
          endSeconds: { type: "number" },
          text: { type: "string" },
          emphasis: { type: "string" },
        },
        required: ["startSeconds", "endSeconds", "text", "emphasis"],
      },
    },
  },
  required: ["lines"],
} as const;

const transcriptSchema = z.object({
  lines: z
    .array(
      z.object({
        startSeconds: z.number().finite().nonnegative(),
        endSeconds: z.number().finite().nonnegative(),
        text: z.string().min(1).max(160),
        emphasis: z.string().max(160).optional(),
      })
    )
    .max(400)
    .optional(),
});

export function captionPrompt(fromSeconds: number, toSeconds: number): string {
  return (
    `Transcribe the speech in this video between ${fromSeconds.toFixed(1)} and ${toSeconds.toFixed(1)} ` +
    "seconds, as on-screen kinetic captions. Split it into short lines of two to six words that break " +
    "at natural phrase boundaries, never mid-phrase. Give each line the exact start and end time in " +
    "seconds from the start of the file, measured from the first and last word of that line. " +
    "`emphasis` must be one to three consecutive words copied verbatim from `text` — the words a " +
    "viewer should read first. Transcribe only what is actually said, skip stretches with no speech, " +
    "and never invent words. Reply only with the JSON described by the schema."
  );
}

export interface CaptionBuildRequest {
  blob: Blob;
  mimeType: string;
  videoSrc: string;
  /** Overlay-relative frame to seconds into the source file. */
  sourceTimeAt: (frame: number) => number;
  /** Seconds into the source file to overlay-relative frame. */
  frameAtSource: (seconds: number) => number;
  durationInFrames: number;
  canvas: { width: number; height: number };
  typography: CaptionTypography;
  maskSubject: boolean;
  signal?: AbortSignal;
  onProgress?: (stage: string) => void;
}

export interface CaptionBuildResult {
  cues: CaptionCue[];
  matte?: CaptionMatte;
  transcript: string;
}

export async function buildKineticCaptions(request: CaptionBuildRequest): Promise<CaptionBuildResult> {
  const { durationInFrames, sourceTimeAt, frameAtSource, signal, onProgress } = request;
  const fromSeconds = sourceTimeAt(0);
  const toSeconds = sourceTimeAt(durationInFrames);

  onProgress?.("Transcribing the speech");
  const raw = await analyzeMedia(
    request.blob,
    request.mimeType,
    captionPrompt(fromSeconds, toSeconds),
    CAPTION_SCHEMA,
    signal
  );

  const lines = (transcriptSchema.parse(raw).lines ?? [])
    .filter((line) => line.endSeconds > line.startSeconds)
    .filter((line) => line.endSeconds > fromSeconds && line.startSeconds < toSeconds)
    .sort((a, b) => a.startSeconds - b.startSeconds);
  if (!lines.length) throw new Error("Gemini found no speech in that part of the clip.");

  onProgress?.("Reading the audio");
  const envelope = await speechEnvelope(request.blob);

  const cues = lines
    .map((line) => buildCue(line, envelope, frameAtSource, durationInFrames))
    .filter((cue): cue is CaptionCue => cue !== null);
  if (!cues.length) throw new Error("The speech found does not fall inside that part of the clip.");

  let occupancy: SubjectOccupancy | undefined;
  let matte: CaptionMatte | undefined;
  if (request.maskSubject) {
    onProgress?.("Separating the subject");
    const first = Math.min(...cues.map((cue) => cue.from));
    const last = Math.max(...cues.map((cue) => cue.from + cue.durationInFrames));
    const span = Math.max(1, last - first);
    const frameStep = Math.max(MIN_MATTE_STEP, Math.ceil(span / MAX_MATTE_SAMPLES));
    const built = await buildSubjectMatte({
      src: request.videoSrc,
      width: request.canvas.width,
      height: request.canvas.height,
      startFrame: first,
      frameStep,
      frameCount: Math.floor(span / frameStep) + 1,
      sourceTimeAt,
      signal,
      onProgress: (done, total) => onProgress?.(`Separating the subject (${done}/${total})`),
    });
    matte = built.matte;
    occupancy = built.occupancy;
  }

  onProgress?.("Placing the words");
  await ensureCaptionFonts();
  placeCues(cues, request.canvas, request.typography, occupancy);

  return { cues, matte, transcript: lines.map((line) => line.text).join(" ") };
}

/* ------------------------------------------------------------------ */
/*  Words                                                              */
/* ------------------------------------------------------------------ */

const WORD = /\S+/g;

function normalize(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9']/g, "");
}

/** Length and syllable count together track how long a word is held better than either alone. */
function weigh(word: string): number {
  const syllables = (word.match(/[aeiouy]+/gi) ?? []).length || 1;
  return word.length * 0.5 + syllables * 1.5;
}

function assignRoles(text: string, emphasis: string | undefined): { text: string; role: CaptionRole }[] {
  const words = text.match(WORD) ?? [];
  if (!words.length) return [];

  const keys = words.map(normalize);
  const target = (emphasis?.match(WORD) ?? []).map(normalize).filter(Boolean);

  let start = -1;
  for (let i = 0; target.length && i + target.length <= keys.length; i++) {
    if (target.every((word, k) => keys[i + k] === word)) {
      start = i;
      break;
    }
  }
  // An emphasis the model did not copy verbatim is not worth guessing at:
  // the whole line becomes the display phrase instead.
  const end = start === -1 ? words.length : start + target.length;
  if (start === -1) start = 0;

  return words.map((word, index) => ({
    text: word,
    role: index < start ? "lead" : index < end ? "display" : "tail",
  }));
}

interface TranscriptLine {
  startSeconds: number;
  endSeconds: number;
  text: string;
  emphasis?: string;
}

function buildCue(
  line: TranscriptLine,
  envelope: SpeechEnvelope | null,
  frameAtSource: (seconds: number) => number,
  durationInFrames: number
): CaptionCue | null {
  const words = assignRoles(line.text, line.emphasis);
  if (!words.length) return null;

  const times = distribute(envelope, line.startSeconds, line.endSeconds, words.map((w) => weigh(w.text)));
  const from = Math.round(frameAtSource(times[0]));
  const end = Math.round(frameAtSource(line.endSeconds)) + HOLD_FRAMES;
  if (end <= 0 || from >= durationInFrames) return null;

  let previous = -1;
  const tokens: CaptionToken[] = words.map((word, index) => {
    const at = Math.max(previous + 1, Math.round(frameAtSource(times[index])) - from);
    previous = at;
    return { text: word.text, role: word.role, from: at };
  });

  const start = Math.max(0, from);
  const duration = Math.max(MIN_CUE_FRAMES, Math.min(durationInFrames, end) - start);
  return { from: start, durationInFrames: duration, tokens, anchor: ANCHORS[0] };
}

/* ------------------------------------------------------------------ */
/*  Timing                                                             */
/* ------------------------------------------------------------------ */

export interface SpeechEnvelope {
  hz: number;
  values: Float32Array;
}

/** A coarse RMS envelope of the audio track, used only to find where sound is. */
export async function speechEnvelope(blob: Blob, hz = 100): Promise<SpeechEnvelope | null> {
  let context: AudioContext | undefined;
  try {
    context = new AudioContext();
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const channel = buffer.getChannelData(0);
    const window = Math.max(1, Math.round(buffer.sampleRate / hz));
    const values = new Float32Array(Math.ceil(channel.length / window));

    for (let i = 0; i < values.length; i++) {
      const start = i * window;
      const end = Math.min(channel.length, start + window);
      let sum = 0;
      for (let s = start; s < end; s++) sum += channel[s] * channel[s];
      values[i] = Math.sqrt(sum / Math.max(1, end - start));
    }
    return { hz, values };
  } catch {
    return null;
  } finally {
    void context?.close().catch(() => undefined);
  }
}

/**
 * Spreads words across a span by weight, but through the cumulative energy of
 * the audio rather than through time, so a pause mid-line costs no words.
 */
function distribute(
  envelope: SpeechEnvelope | null,
  from: number,
  to: number,
  weights: number[]
): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  let running = 0;
  const fractions = weights.map((weight) => {
    const at = running / total;
    running += weight;
    return at;
  });
  const linear = () => fractions.map((fraction) => from + fraction * (to - from));
  if (!envelope) return linear();

  const first = Math.max(0, Math.floor(from * envelope.hz));
  const last = Math.min(envelope.values.length, Math.ceil(to * envelope.hz));
  const count = last - first;
  if (count < 4) return linear();

  let mean = 0;
  for (let i = first; i < last; i++) mean += envelope.values[i];
  mean /= count;

  // A floor relative to the line's own loudness: silence is compressed, not erased.
  const floor = mean * 0.2;
  const cumulative = new Float32Array(count + 1);
  for (let i = 0; i < count; i++) cumulative[i + 1] = cumulative[i] + envelope.values[first + i] + floor;
  const energy = cumulative[count];
  if (energy <= 0) return linear();

  return fractions.map((fraction) => {
    const target = fraction * energy;
    let low = 0;
    let high = count;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (cumulative[mid] < target) low = mid + 1;
      else high = mid;
    }
    return Math.min(to, Math.max(from, (first + low) / envelope.hz));
  });
}

/* ------------------------------------------------------------------ */
/*  Placement                                                          */
/* ------------------------------------------------------------------ */

function overlapArea(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number }
): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

/** How much of each word the subject covers, over the frames the cue is up. */
function wordCoverage(
  tokens: PlacedToken[],
  canvas: { width: number; height: number },
  occupancy: SubjectOccupancy | undefined,
  from: number,
  to: number
): number[] {
  if (!occupancy) return tokens.map(() => 0);
  return tokens.map((token) => {
    const box = tokenBounds(token);
    return subjectCoverage(occupancy, from, to, {
      left: box.left / canvas.width,
      top: box.top / canvas.height,
      right: box.right / canvas.width,
      bottom: box.bottom / canvas.height,
    });
  });
}

/**
 * Each cue takes the resting place that grazes the subject best: clear of any
 * cue still on screen, preferably not where the last one was, and with as many
 * words as possible clipped by the subject rather than hidden behind them.
 */
function placeCues(
  cues: CaptionCue[],
  canvas: { width: number; height: number },
  typography: CaptionTypography,
  occupancy: SubjectOccupancy | undefined
): void {
  type Box = { left: number; top: number; right: number; bottom: number };
  const placed: { cue: CaptionCue; box: Box }[] = [];

  for (const cue of cues) {
    const end = cue.from + cue.durationInFrames;
    const live = placed.filter((other) => other.cue.from < end && other.cue.from + other.cue.durationInFrames > cue.from);
    const previous = placed[placed.length - 1]?.cue.anchor;

    let best: { anchor: { x: number; y: number }; box: Box; tokens: PlacedToken[]; coverage: number[]; score: number } | null = null;
    for (let index = 0; index < ANCHORS.length; index++) {
      const anchor = ANCHORS[index];
      const layout = layoutCue({ ...cue, anchor }, canvas.width, canvas.height, typography);
      const box = {
        left: layout.left / canvas.width,
        top: layout.top / canvas.height,
        right: layout.right / canvas.width,
        bottom: layout.bottom / canvas.height,
      };

      const coverage = wordCoverage(layout.tokens, canvas, occupancy, cue.from, end);
      const buried = coverage.filter((c) => c > FRONT_LIMIT).length / coverage.length;
      const grazing = coverage.filter((c) => c > GRAZE_MIN && c <= FRONT_LIMIT).length / coverage.length;

      const area = Math.max(1e-6, (box.right - box.left) * (box.bottom - box.top));
      const collision = live.reduce((sum, other) => sum + overlapArea(box, other.box), 0) / area;
      const repeat = previous && previous.x === anchor.x && previous.y === anchor.y ? WEIGHT_REPEAT : 0;
      const score =
        buried * WEIGHT_BURIED -
        grazing * REWARD_GRAZE +
        collision * WEIGHT_COLLISION +
        repeat +
        index * WEIGHT_ORDER;

      if (!best || score < best.score) best = { anchor, box, tokens: layout.tokens, coverage, score };
    }

    cue.anchor = best!.anchor;
    best!.tokens.forEach((token, index) => {
      token.token.inFront = best!.coverage[index] > FRONT_LIMIT;
    });
    placed.push({ cue, box: best!.box });
  }
}
