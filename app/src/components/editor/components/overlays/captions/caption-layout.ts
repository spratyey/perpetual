/**
 * Kinetic caption typesetting.
 *
 * One line becomes a small composition rather than a row of words: the phrase
 * the viewer should read first is set large in caps, the run-up sits above its
 * left edge, and the trailing words hang off the ends below it.
 *
 * The layout is measured, not guessed, because two callers need the same
 * answer — the renderer draws from it, and the placement pass scores anchors
 * against the box it reports.
 */

import { loadFont as loadInstrumentSans } from "@remotion/google-fonts/InstrumentSans";
import { loadFont as loadInstrumentSerif } from "@remotion/google-fonts/InstrumentSerif";

import type { CaptionCue, CaptionOverlay, CaptionToken } from "../../../types";

const { fontFamily: serifFamily } = loadInstrumentSerif();
const { fontFamily: sansFamily } = loadInstrumentSans();
loadInstrumentSerif("italic");
loadInstrumentSans("italic");

export const CAPTION_FAMILIES = { serif: serifFamily, sans: sansFamily } as const;

/** Fraction of the canvas kept clear at each edge. */
const SAFE_X = 0.055;
const SAFE_Y = 0.07;
/** Widest the display phrase may run, as a fraction of the canvas. */
const DISPLAY_MAX_WIDTH = 0.86;
const LEAD_RATIO = 0.3;
const TAIL_RATIO = 0.285;

export const DEFAULT_DISPLAY_SCALE = 0.155;
export const DEFAULT_CAPTION_COLOR = "#ffffff";

export interface CaptionTypography {
  color: string;
  displayScale: number;
  family: string;
}

export interface PlacedToken {
  token: CaptionToken;
  /** As drawn: the display phrase is set in caps. */
  text: string;
  x: number;
  baseline: number;
  width: number;
  size: number;
  italic: boolean;
}

export interface CueLayout {
  tokens: PlacedToken[];
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function resolveTypography(overlay: CaptionOverlay): CaptionTypography {
  return {
    color: overlay.styles?.color ?? DEFAULT_CAPTION_COLOR,
    displayScale: overlay.styles?.displayScale ?? DEFAULT_DISPLAY_SCALE,
    family: CAPTION_FAMILIES[overlay.styles?.fontFamily ?? "serif"],
  };
}

/**
 * Canvas silently falls back to a default face when a webfont has not arrived,
 * which would measure and draw the wrong shapes.
 */
export async function ensureCaptionFonts(): Promise<void> {
  const specs = [serifFamily, sansFamily].flatMap((family) => [
    `400 100px "${family}"`,
    `italic 400 100px "${family}"`,
  ]);
  await Promise.all(specs.map((spec) => document.fonts.load(spec).catch(() => undefined)));
}

let scratch: CanvasRenderingContext2D | null = null;

function measureContext(): CanvasRenderingContext2D {
  if (!scratch) {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    scratch = canvas.getContext("2d")!;
  }
  return scratch;
}

export function captionFont(size: number, italic: boolean, family: string): string {
  return `${italic ? "italic " : ""}400 ${size}px "${family}"`;
}

function displayText(token: CaptionToken): string {
  return token.text.toUpperCase();
}

interface Run {
  tokens: CaptionToken[];
  size: number;
  italic: boolean;
  transform?: (token: CaptionToken) => string;
}

/** Lays a run of words left to right from `startX`, sharing one baseline. */
function place(
  ctx: CanvasRenderingContext2D,
  run: Run,
  family: string,
  startX: number,
  baseline: number
): PlacedToken[] {
  ctx.font = captionFont(run.size, run.italic, family);
  const space = ctx.measureText(" ").width;
  let x = startX;
  return run.tokens.map((token, index) => {
    const text = run.transform ? run.transform(token) : token.text;
    const width = ctx.measureText(text).width;
    const placed: PlacedToken = {
      token,
      text,
      x: index === 0 ? x : (x += space),
      baseline,
      width,
      size: run.size,
      italic: run.italic,
    };
    x += width;
    return placed;
  });
}

function runWidth(ctx: CanvasRenderingContext2D, run: Run, family: string): number {
  ctx.font = captionFont(run.size, run.italic, family);
  const space = ctx.measureText(" ").width;
  const words = run.tokens.map((t) => ctx.measureText(run.transform ? run.transform(t) : t.text).width);
  return words.reduce((sum, w) => sum + w, 0) + space * Math.max(0, words.length - 1);
}

export function layoutCue(
  cue: CaptionCue,
  width: number,
  height: number,
  type: CaptionTypography
): CueLayout {
  const ctx = measureContext();
  const lead = cue.tokens.filter((t) => t.role === "lead");
  const tail = cue.tokens.filter((t) => t.role === "tail");
  let display = cue.tokens.filter((t) => t.role === "display");
  if (!display.length) display = cue.tokens;

  const displayRun: Run = { tokens: display, size: height * type.displayScale, italic: false, transform: displayText };
  const maxWidth = width * DISPLAY_MAX_WIDTH;
  const naturalWidth = runWidth(ctx, displayRun, type.family);
  if (naturalWidth > maxWidth) displayRun.size *= maxWidth / naturalWidth;

  const size = displayRun.size;
  const leadRun: Run = { tokens: lead, size: size * LEAD_RATIO, italic: false };
  const tailSize = size * TAIL_RATIO;

  ctx.font = captionFont(size, false, type.family);
  const capHeight = ctx.measureText(displayText(display[0])).actualBoundingBoxAscent || size * 0.7;
  const displayWidth = runWidth(ctx, displayRun, type.family);

  const leadGap = leadRun.size * 0.5;
  const tailGap = tailSize * 0.7;
  const leadBand = lead.length ? leadRun.size + leadGap : 0;
  const tailBand = tail.length ? tailGap + tailSize : 0;

  const blockTop = cue.anchor.y * height - (leadBand + capHeight + tailBand) / 2;
  const displayBaseline = blockTop + leadBand + capHeight;
  const displayLeft = cue.anchor.x * width - displayWidth / 2;

  const tokens: PlacedToken[] = [];
  if (lead.length) {
    tokens.push(...place(ctx, leadRun, type.family, displayLeft + size * 0.05, blockTop + leadRun.size));
  }
  tokens.push(...place(ctx, displayRun, type.family, displayLeft, displayBaseline));

  if (tail.length) {
    const baseline = displayBaseline + tailGap + tailSize;
    // Two or more trailing words hang off both ends of the display phrase.
    const splitAt = tail.length >= 2 ? Math.ceil(tail.length / 2) : 0;
    const rightRun: Run = { tokens: tail.slice(splitAt), size: tailSize, italic: true };
    if (splitAt) {
      const leftRun: Run = { tokens: tail.slice(0, splitAt), size: tailSize, italic: true };
      tokens.push(...place(ctx, leftRun, type.family, displayLeft + size * 0.04, baseline));
    }
    const right = displayLeft + displayWidth - size * 0.02;
    tokens.push(...place(ctx, rightRun, type.family, right - runWidth(ctx, rightRun, type.family), baseline));
  }

  const left = Math.min(...tokens.map((t) => t.x));
  const right = Math.max(...tokens.map((t) => t.x + t.width));
  const lastBaseline = Math.max(...tokens.map((t) => t.baseline));
  const bottom = lastBaseline + (tail.length ? tailSize : size) * 0.24;

  let dx = 0;
  if (left < width * SAFE_X) dx = width * SAFE_X - left;
  else if (right > width * (1 - SAFE_X)) dx = width * (1 - SAFE_X) - right;

  let dy = 0;
  if (blockTop < height * SAFE_Y) dy = height * SAFE_Y - blockTop;
  else if (bottom > height * (1 - SAFE_Y)) dy = height * (1 - SAFE_Y) - bottom;

  if (dx || dy) {
    for (const token of tokens) {
      token.x += dx;
      token.baseline += dy;
    }
  }

  return { tokens, left: left + dx, top: blockTop + dy, right: right + dx, bottom: bottom + dy };
}

/** The ink of one word, which is what decides whether the subject would swallow it. */
export function tokenBounds(token: PlacedToken) {
  return {
    left: token.x,
    top: token.baseline - token.size * 0.74,
    right: token.x + token.width,
    bottom: token.baseline + token.size * 0.2,
  };
}
