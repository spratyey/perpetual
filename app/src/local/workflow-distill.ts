/**
 * Deterministic distillation of an event log.
 *
 * Produces a faithful, *normalised* account of what happened, which is then
 * handed to the model for analysis. Doing this in code rather than in the prompt
 * matters for two reasons: it is exact bookkeeping an LLM gets subtly wrong
 * (which actions survived, which ids refer to which element), and it keeps the
 * prompt small and comparable across projects.
 *
 * The normalisation is the important part. A recorded action holds absolute
 * pixels in a 1920×1080 canvas and absolute seconds — meaningless in a 9:16
 * project with different footage. Geometry becomes a fraction of the canvas and
 * timing becomes relative, so the *shape* of the edit survives the move.
 */

import { VIDEO_HEIGHT, VIDEO_WIDTH } from "@/components/editor/constants";
import type { AspectRatio, DistilledAction, LoggedEvent } from "./types";

/** Actions that change the document. Everything else is navigation or reads. */
const MEANINGFUL = new Set([
  "add_text", "add_shape", "add_asset", "update_overlay", "arrange_timeline",
  "duplicate_overlay", "delete_overlay", "split_overlay",
  "set_background", "set_aspect_ratio", "generate_image",
  "generate_video", "add_kinetic_captions",
]);

export interface Distillation {
  actions: DistilledAction[];
  actionCount: number;
  timelineSeconds: number;
  elementKinds: string[];
  colours: string[];
  /** Plain-language notes about what was discarded and why. */
  notes: string[];
}

export function distill(
  events: LoggedEvent[],
  context: { aspectRatio: AspectRatio; assetKindById?: Record<string, string> }
): Distillation {
  const notes: string[] = [];

  // 1. Only document changes matter.
  const meaningful = events.filter((e) => MEANINGFUL.has(e.tool));
  const skipped = events.length - meaningful.length;
  if (skipped > 0) notes.push(`${skipped} logged action(s) were reads or navigation.`);

  // 2. Anything whose element was later deleted did not survive — a workflow
  //    should describe the outcome, not the false starts.
  const deleted = new Set<number>();
  for (const e of meaningful) {
    if (e.tool === "delete_overlay") {
      const id = num(e.input.overlayId);
      if (id !== undefined) deleted.add(id);
    }
  }
  const surviving = meaningful.filter((e) => {
    if (e.tool === "delete_overlay") return false;
    const created = e.producedOverlayIds ?? [];
    if (created.length > 0 && created.every((id) => deleted.has(id))) return false;
    const target = num(e.input.overlayId);
    return !(target !== undefined && deleted.has(target));
  });
  const dropped = meaningful.length - surviving.length;
  if (dropped > 0) notes.push(`${dropped} action(s) affected elements that were later deleted.`);

  // 3. Only the last edit to an element describes where it ended up.
  const lastEdit = new Map<number, number>();
  surviving.forEach((e, i) => {
    if (e.tool !== "update_overlay") return;
    const id = num(e.input.overlayId);
    if (id !== undefined) lastEdit.set(id, i);
  });
  const kept = surviving.filter((e, i) => {
    if (e.tool !== "update_overlay") return true;
    const id = num(e.input.overlayId);
    return id === undefined || lastEdit.get(id) === i;
  });
  const collapsed = surviving.length - kept.length;
  if (collapsed > 0) notes.push(`${collapsed} intermediate adjustment(s) were collapsed into final positions.`);

  // 4. Normalise.
  const orderByOverlayId = new Map<number, number>();
  const actions: DistilledAction[] = [];
  const kinds = new Set<string>();
  const colours = new Set<string>();
  let timelineSeconds = 0;

  kept.forEach((e, index) => {
    const input = e.input as Record<string, unknown>;
    const action: DistilledAction = { order: index + 1, tool: e.tool, by: e.source };

    const at = numOf(input.fromSeconds);
    const dur = numOf(input.durationSeconds);
    if (at !== undefined) action.atSeconds = round(at);
    if (dur !== undefined) action.durationSeconds = round(dur);
    if (at !== undefined && dur !== undefined) timelineSeconds = Math.max(timelineSeconds, at + dur);
    const row = numOf(input.row);
    if (row !== undefined) action.row = row;

    // Geometry as a fraction of the canvas, so another aspect ratio can reuse it.
    const left = numOf(input.left), top = numOf(input.top);
    const w = numOf(input.width), h = numOf(input.height);
    if (left !== undefined || w !== undefined) {
      action.box = {
        x: round((left ?? 0) / VIDEO_WIDTH),
        y: round((top ?? 0) / VIDEO_HEIGHT),
        w: round((w ?? 0) / VIDEO_WIDTH),
        h: round((h ?? 0) / VIDEO_HEIGHT),
      };
    }

    // What it was, never a literal asset id.
    if (e.tool === "add_text") action.kind = "text";
    else if (e.tool === "add_shape") action.kind = `shape:${str(input.shape) ?? "unknown"}`;
    else if (e.tool === "add_asset") {
      const id = str(input.assetId);
      action.kind = `media:${(id && context.assetKindById?.[id]) ?? "unknown"}`;
    } else if (e.tool === "generate_image") action.kind = "generated-image";
    else if (e.tool === "generate_video") action.kind = "generated-video";
    else if (e.tool === "add_kinetic_captions") action.kind = "captions";
    else if (e.tool === "set_background") action.kind = `background:${str(input.type) ?? "colour"}`;
    if (action.kind) kinds.add(action.kind);

    const text = str(input.content) ?? str(input.prompt);
    if (text && !text.startsWith("data:")) action.text = text.slice(0, 200);

    const style: Record<string, string | number> = {};
    for (const key of ["color", "fill", "fontSize", "textAlign", "opacity", "speed", "volume", "aspectRatio"]) {
      const v = input[key];
      if (typeof v === "string" || typeof v === "number") style[key] = v;
      if (typeof v === "string" && /^#|^rgb/.test(v)) colours.add(v);
    }
    if (Object.keys(style).length) action.style = style;

    // Point at the earlier action that created this element, not at its id.
    const target = num(input.overlayId);
    if (target !== undefined && orderByOverlayId.has(target)) {
      action.targets = orderByOverlayId.get(target);
    }
    for (const id of e.producedOverlayIds ?? []) orderByOverlayId.set(id, action.order);

    actions.push(action);
  });

  return {
    actions,
    actionCount: actions.length,
    timelineSeconds: round(timelineSeconds),
    elementKinds: [...kinds],
    colours: [...colours],
    notes,
  };
}

const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const numOf = num;
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const round = (n: number) => Math.round(n * 1000) / 1000;
