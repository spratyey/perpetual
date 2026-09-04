/**
 * Content index.
 *
 * The local half of Gemini media understanding: the shape an analysis takes
 * once it has been validated, and the search that runs over it. Nothing here
 * touches the network — a stored analysis is an ordinary local document, so
 * search stays free, instant and deterministic.
 */

import { z } from "zod";
import type { AssetKind } from "./persistence";

export const ANALYSIS_VERSION = 1;

/** What the model is asked to return. Times are seconds from the file start. */
const rawSegment = z.object({
  startSeconds: z.number().finite().nonnegative(),
  endSeconds: z.number().finite().nonnegative(),
  description: z.string().max(600),
  transcript: z.string().max(2000).optional(),
  speaker: z.string().max(80).optional(),
  tags: z.array(z.string().max(40)).max(12).optional(),
});

export const rawAnalysisSchema = z.object({
  summary: z.string().max(1200),
  tags: z.array(z.string().max(40)).max(20).optional(),
  segments: z.array(rawSegment).max(120).optional(),
});

/** The JSON Schema sent to Gemini. Kept by hand: the API accepts only a subset. */
export const GEMINI_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          startSeconds: { type: "number" },
          endSeconds: { type: "number" },
          description: { type: "string" },
          transcript: { type: "string" },
          speaker: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["startSeconds", "endSeconds", "description"],
      },
    },
  },
  required: ["summary", "tags", "segments"],
} as const;

export interface AnalysisSegment {
  /** Assigned locally. The model never chooses an id it could later cite wrongly. */
  id: string;
  startSeconds: number;
  endSeconds: number;
  description: string;
  transcript?: string;
  speaker?: string;
  tags: string[];
}

export interface AssetAnalysis {
  version: number;
  assetId: string;
  model: string;
  createdAt: number;
  summary: string;
  tags: string[];
  segments: AnalysisSegment[];
}

export function analysisPrompt(kind: AssetKind): string {
  const shared =
    "Reply only with the JSON described by the schema. Use plain descriptive language. " +
    "Tags must be lowercase single words or short phrases.";

  if (kind === "image") {
    return (
      "Index this image for a video editor. Describe what it shows, where it appears to be, " +
      "the mood and any readable text. Return an empty segments list. " + shared
    );
  }

  if (kind === "audio") {
    return (
      "Index this audio for a video editor. Split it into consecutive spoken or musical passages. " +
      "For each passage give the exact start and end time in seconds from the start of the file, " +
      "a short description, the speech transcribed verbatim when there is any, the speaker when " +
      "you can tell them apart, and a few tags. Cover the file in order without overlapping. " + shared
    );
  }

  return (
    "Index this video for a video editor. Split it into consecutive shots or distinct moments. " +
    "For each one give the exact start and end time in seconds from the start of the file, a short " +
    "description of what is visible, any speech transcribed verbatim, and a few tags naming the " +
    "subject, setting and action. Cover the whole file in order without overlapping segments. " + shared
  );
}

/**
 * Turns a model reply into a stored analysis: times clamped to the real
 * duration, segments ordered, ids assigned here rather than by the model.
 */
export function normalizeAnalysis(
  assetId: string,
  model: string,
  raw: unknown,
  durationInSeconds?: number
): AssetAnalysis {
  const parsed = rawAnalysisSchema.parse(raw);
  const limit = durationInSeconds && durationInSeconds > 0 ? durationInSeconds : undefined;

  const segments = (parsed.segments ?? [])
    .map((segment) => {
      const start = limit ? Math.min(segment.startSeconds, limit) : segment.startSeconds;
      const end = limit ? Math.min(segment.endSeconds, limit) : segment.endSeconds;
      return { ...segment, startSeconds: start, endSeconds: Math.max(end, start) };
    })
    .filter((segment) => segment.endSeconds > segment.startSeconds)
    .sort((a, b) => a.startSeconds - b.startSeconds)
    .map((segment, index) => ({
      id: `s${index + 1}`,
      startSeconds: +segment.startSeconds.toFixed(2),
      endSeconds: +segment.endSeconds.toFixed(2),
      description: segment.description,
      transcript: segment.transcript || undefined,
      speaker: segment.speaker || undefined,
      tags: segment.tags ?? [],
    }));

  return {
    version: ANALYSIS_VERSION,
    assetId,
    model,
    createdAt: Date.now(),
    summary: parsed.summary,
    tags: parsed.tags ?? [],
    segments,
  };
}

export interface ContentHit {
  assetId: string;
  assetName: string;
  assetType: AssetKind;
  /** Absent when the whole asset matched, which is the normal case for images. */
  segmentId?: string;
  startSeconds?: number;
  endSeconds?: number;
  text: string;
  score: number;
}

const STOP_WORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "with", "and", "or",
  "is", "are", "was", "were", "it", "its", "that", "this", "me", "my", "show",
  "find", "clip", "clips", "shot", "shots", "part", "parts", "where", "when",
  "from", "over", "into", "any", "all", "some",
]);

function terms(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    )
  );
}

/**
 * Counts how many query terms a piece of text carries. Terms match at a word
 * start, so "car" finds "car" and "cargo" but not "oscar" — matching anywhere
 * inside a word made unrelated media score alike.
 */
function score(haystack: string, queryTerms: string[], phrase: string): number {
  const text = haystack.toLowerCase();
  let total = queryTerms.reduce(
    (sum, term) => (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text) ? sum + 1 : sum),
    0
  );
  if (phrase.length > 3 && text.includes(phrase)) total += 2;
  return total;
}

export interface SearchableAsset {
  id: string;
  name: string;
  type: AssetKind;
}

export function searchAnalyses(
  assets: SearchableAsset[],
  analyses: Record<string, AssetAnalysis>,
  query: string,
  limit = 12
): ContentHit[] {
  const queryTerms = terms(query);
  const phrase = query.trim().toLowerCase();
  if (!queryTerms.length && !phrase) return [];

  const hits: ContentHit[] = [];

  for (const asset of assets) {
    const analysis = analyses[asset.id];
    if (!analysis) continue;

    const assetContext = `${asset.name} ${analysis.summary} ${analysis.tags.join(" ")}`;
    const assetScore = score(assetContext, queryTerms, phrase);

    // A still has no segments, so the asset itself is the unit. Scoring both
    // kinds the same way keeps photos and video moments comparable.
    const units = analysis.segments.length
      ? analysis.segments.map((segment) => ({
          segment,
          text: [segment.description, segment.transcript, segment.speaker, segment.tags.join(" ")]
            .filter(Boolean)
            .join(" "),
        }))
      : [{ segment: undefined, text: `${analysis.summary} ${analysis.tags.join(" ")}` }];

    for (const unit of units) {
      const total = score(unit.text, queryTerms, phrase) * 2 + assetScore;
      if (total <= 0) continue;
      hits.push({
        assetId: asset.id,
        assetName: asset.name,
        assetType: asset.type,
        segmentId: unit.segment?.id,
        startSeconds: unit.segment?.startSeconds,
        endSeconds: unit.segment?.endSeconds,
        text: unit.segment
          ? unit.segment.transcript
            ? `${unit.segment.description} — “${unit.segment.transcript}”`
            : unit.segment.description
          : analysis.summary,
        score: total,
      });
    }
  }

  return hits.sort((a, b) => b.score - a.score || (a.startSeconds ?? 0) - (b.startSeconds ?? 0)).slice(0, limit);
}
