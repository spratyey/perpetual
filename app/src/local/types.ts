/**
 * Local editor protocol.
 *
 * Ported from the original WebSocket protocol and EditorRoom state so the
 * mutation vocabulary stays identical. The transport is gone: mutations are
 * applied synchronously in the browser instead of on a Durable Object.
 */

import type { Overlay } from "@/components/editor/types";

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";

export interface BackgroundConfig {
  type: "color" | "gradient" | "image";
  color?: string;
  gradient?: { direction: string; colors: string[] };
  image?: { src: string; fit: string };
}

/** Catalogue entry for a project. The document itself lives under the same id. */
export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/** The whole persisted project. One project, one timeline. */
export interface ProjectDoc {
  version: 1;
  name: string;
  overlays: Overlay[];
  background: BackgroundConfig;
  aspectRatio: AspectRatio;
  nextOverlayId: number;
}

/** A durable record of one action, in the WebMCP tool vocabulary. */
export interface LoggedEvent {
  projectId: string;
  seq: number;
  ts: number;
  source: ActorSource;
  /** Tool name, or "unknown" when a human command was not annotated. */
  tool: string;
  input: Record<string, unknown>;
  /** Overlay ids this action created, so extraction can follow them. */
  producedOverlayIds?: number[];
  revision: number;
}

// ─── Workflows ───

/**
 * One action from the log, normalised so it is comparable across projects:
 * geometry as a fraction of the canvas, timing relative to the previous action.
 * This is the faithful record the model analyses — and it is kept on the workflow
 * so an agent can see ground truth next to the prose.
 */
export interface DistilledAction {
  order: number;
  tool: string;
  by: ActorSource;
  /** Seconds from the start of the timeline. */
  atSeconds?: number;
  durationSeconds?: number;
  /** 0 = top layer. */
  row?: number;
  /** Fractions of canvas width/height, so a 9:16 project can reuse them. */
  box?: { x: number; y: number; w: number; h: number };
  /** What the element was, not its literal id. */
  kind?: string;
  text?: string;
  style?: Record<string, string | number>;
  /** Refers to the element created by this earlier action. */
  targets?: number;
}

/**
 * A workflow is an *encapsulation*, not a script.
 *
 * It records what the user did, why, and how — so an agent asked to "do what
 * was done in that project" can read the pattern and apply it in the context of
 * whatever project is open now. There is deliberately no replay: the states
 * differ, so re-deriving is the point. See PLANS/workflows.md.
 */
export interface Workflow {
  version: 2;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  sourceProjectId?: string;
  sourceProjectName?: string;

  // ── The model's analysis ──
  /** One line an agent can scan in a list. */
  summary: string;
  /** WHY — what the user was trying to achieve. */
  intent: string;
  /** HOW — the approach they took, in prose. */
  method: string;
  /** The action pattern, described in order and in terms of roles. */
  pattern: string[];
  /** Invariants worth preserving: placement habits, colours, timing rhythm. */
  conventions: string[];
  /** What to keep fixed and what to vary when the project differs. */
  adaptation: string;

  // ── Deterministic ground truth ──
  observed: {
    actionCount: number;
    aspectRatio: AspectRatio;
    timelineSeconds: number;
    elementKinds: string[];
    colours: string[];
    actions: DistilledAction[];
    /** True when the earliest actions were dropped from the log. */
    logWasTrimmed: boolean;
  };
}

export type OverlayMutation =
  | { action: "add-overlay"; payload: any }
  | { action: "update-overlay"; overlayId: number; updates: any }
  | { action: "delete-overlay"; overlayId: number }
  | { action: "duplicate-overlay"; overlayId: number }
  | { action: "split-overlay"; overlayId: number; splitFrame: number }
  | { action: "set-background"; payload: BackgroundConfig }
  | { action: "set-aspect-ratio"; ratio: AspectRatio }
  | { action: "batch"; mutations: OverlayMutation[] };

/** Who caused a change. Drives the activity panel and the undo labels. */
export type ActorSource = "human" | "agent";

export interface ActivityEntry {
  id: string;
  source: ActorSource;
  /** Tool name for agent actions, action verb for human actions. */
  label: string;
  detail?: string;
  ts: number;
  status: "ok" | "error" | "pending";
  /** Index into the history stack, used to restore this exact point. */
  revision: number;
}

export const DEFAULT_BACKGROUND: BackgroundConfig = { type: "color", color: "#000000" };

export function createEmptyDoc(): ProjectDoc {
  return {
    version: 1,
    name: "Untitled",
    overlays: [],
    background: { ...DEFAULT_BACKGROUND },
    aspectRatio: "16:9",
    nextOverlayId: 1,
  };
}
