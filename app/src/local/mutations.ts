/**
 * Local mutation engine.
 *
 * A pure port of `EditorRoom.applyMutation` (overlap resolution, id
 * allocation, split maths) from the server room into a
 * synchronous browser reducer. Every mutation returns a brand new document so
 * the history stack can keep plain snapshots.
 */

import type { Overlay } from "@/components/editor/types";
import type { OverlayMutation, ProjectDoc } from "./types";
import { buildOverlay } from "./overlay-factory";

export class MutationError extends Error {}

/**
 * Shifts later clips on a row so no two clips on the same row overlap.
 * One uniform shift is used so pre-existing gaps survive.
 */
function resolveOverlaps(overlays: any[]): any[] {
  const byRow = new Map<number, any[]>();
  for (const o of overlays) {
    const row = o.row ?? 0;
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row)!.push(o);
  }

  const result: any[] = [];
  for (const [, rowOverlays] of byRow) {
    rowOverlays.sort((a: any, b: any) => a.from - b.from || a.id - b.id);
    let shiftAmount = 0;
    for (let i = 1; i < rowOverlays.length; i++) {
      const prev = rowOverlays[i - 1];
      const curr = rowOverlays[i];
      const prevEnd = prev.from + prev.durationInFrames;
      if (shiftAmount === 0 && curr.from < prevEnd) {
        shiftAmount = prevEnd - curr.from;
      }
      if (shiftAmount > 0) {
        curr.from = curr.from + shiftAmount;
      }
    }
    result.push(...rowOverlays);
  }
  return result;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export interface MutationOutcome {
  doc: ProjectDoc;
  result: any;
}

function applySingle(doc: ProjectDoc, mutation: OverlayMutation, skipResolve = false): MutationOutcome {
  const overlays = doc.overlays as any[];

  switch (mutation.action) {
    case "add-overlay": {
      const overlay = buildOverlay(mutation.payload);
      overlay.id = doc.nextOverlayId;
      const next = [...overlays, overlay];
      return {
        doc: {
          ...doc,
          overlays: (skipResolve ? next : resolveOverlaps(next)) as Overlay[],
          nextOverlayId: doc.nextOverlayId + 1,
        },
        result: overlay,
      };
    }

    case "update-overlay": {
      const idx = overlays.findIndex((o) => o.id === mutation.overlayId);
      if (idx === -1) throw new MutationError(`Overlay ${mutation.overlayId} not found`);
      const existing = overlays[idx];
      const { styles: styleUpdates, ...topLevelUpdates } = mutation.updates || {};
      const updated: any = { ...existing, ...topLevelUpdates };
      if (styleUpdates) {
        updated.styles = { ...existing.styles, ...styleUpdates };
        for (const key of Object.keys(updated.styles)) {
          if (updated.styles[key] === null) delete updated.styles[key];
        }
      }
      const next = [...overlays];
      next[idx] = updated;
      return {
        doc: { ...doc, overlays: (skipResolve ? next : resolveOverlaps(next)) as Overlay[] },
        result: updated,
      };
    }

    case "delete-overlay": {
      const idx = overlays.findIndex((o) => o.id === mutation.overlayId);
      if (idx === -1) throw new MutationError(`Overlay ${mutation.overlayId} not found`);
      return {
        doc: { ...doc, overlays: overlays.filter((_, i) => i !== idx) as Overlay[] },
        result: { success: true },
      };
    }

    case "duplicate-overlay": {
      const original = overlays.find((o) => o.id === mutation.overlayId);
      if (!original) throw new MutationError(`Overlay ${mutation.overlayId} not found`);
      const copy: any = {
        ...clone(original),
        id: doc.nextOverlayId,
        from: original.from + original.durationInFrames,
      };
      const next = [...overlays, copy];
      return {
        doc: {
          ...doc,
          overlays: (skipResolve ? next : resolveOverlaps(next)) as Overlay[],
          nextOverlayId: doc.nextOverlayId + 1,
        },
        result: copy,
      };
    }

    case "split-overlay": {
      const idx = overlays.findIndex((o) => o.id === mutation.overlayId);
      if (idx === -1) throw new MutationError(`Overlay ${mutation.overlayId} not found`);
      const orig: any = clone(overlays[idx]);
      const relSplit = mutation.splitFrame - orig.from;
      if (relSplit <= 0 || relSplit >= orig.durationInFrames) {
        throw new MutationError("Split frame must be within the overlay range");
      }
      const origDur = orig.durationInFrames;
      orig.durationInFrames = relSplit;

      // Zoom effects straddling the cut are divided between both halves.
      const origZooms: any[] = orig.styles?.zoomEffects || [];
      const firstZooms: any[] = [];
      const secondZooms: any[] = [];
      for (const ef of origZooms) {
        if (ef.endFrame <= relSplit) {
          firstZooms.push({ ...ef });
        } else if (ef.startFrame >= relSplit) {
          secondZooms.push({ ...ef, startFrame: ef.startFrame - relSplit, endFrame: ef.endFrame - relSplit });
        } else {
          const fallback = ef.snapDuration ?? 20;
          firstZooms.push({
            ...ef, id: ef.id + "-a", endFrame: relSplit,
            snapInDuration: ef.snapInDuration ?? fallback, snapOutDuration: 0,
          });
          secondZooms.push({
            ...ef, id: ef.id + "-b", startFrame: 0, endFrame: ef.endFrame - relSplit,
            snapInDuration: 0, snapOutDuration: ef.snapOutDuration ?? fallback,
          });
        }
      }
      if (orig.styles) orig.styles = { ...orig.styles, zoomEffects: firstZooms };

      const second: any = {
        ...clone(orig),
        id: doc.nextOverlayId,
        from: mutation.splitFrame,
        durationInFrames: origDur - relSplit,
      };
      if (orig.styles) second.styles = { ...orig.styles, zoomEffects: secondZooms };

      const speed = orig.styles?.speed ?? 1;
      if (orig.videoStartTime !== undefined || orig.type === "clip") {
        second.videoStartTime = (orig.videoStartTime || 0) + Math.round(relSplit * speed);
      }
      if (orig.startFromSound !== undefined || orig.type === "sound") {
        second.startFromSound = (orig.startFromSound || 0) + relSplit;
      }

      const next = [...overlays];
      next[idx] = orig;
      next.splice(idx + 1, 0, second);
      return {
        doc: {
          ...doc,
          overlays: (skipResolve ? next : resolveOverlaps(next)) as Overlay[],
          nextOverlayId: doc.nextOverlayId + 1,
        },
        result: { first: orig, second },
      };
    }

    case "set-background":
      return { doc: { ...doc, background: mutation.payload }, result: mutation.payload };

    case "set-aspect-ratio":
      return { doc: { ...doc, aspectRatio: mutation.ratio }, result: { aspectRatio: mutation.ratio } };

    default:
      throw new MutationError(`Unsupported mutation: ${(mutation as any).action}`);
  }
}

export function applyMutation(doc: ProjectDoc, mutation: OverlayMutation): MutationOutcome {
  if (mutation.action === "batch") {
    let working = doc;
    const results: any[] = [];
    for (const sub of mutation.mutations) {
      const outcome = applySingle(working, sub, true);
      working = outcome.doc;
      results.push(outcome.result);
    }
    // Overlaps are resolved once, after the whole batch, so row moves within a
    // batch do not cascade into each other.
    return {
      doc: { ...working, overlays: resolveOverlaps(working.overlays as any[]) as Overlay[] },
      result: { batchResults: results },
    };
  }
  return applySingle(doc, mutation);
}
