import { Overlay, OverlayType } from "../types";
import { MAX_ROWS, SNAP_THRESHOLD_FRAMES } from "../constants";

/** Threshold: if the drop point falls within the first 70% of a clip,
 *  the new clip takes that clip's start position; otherwise it snaps after. */
const DISPLACEMENT_THRESHOLD = 0.7;

/* ─── Snap-to-edges helpers ─────────────────────────────────────────── */

export interface SnapResult {
  /** The frame to use (snapped or original) */
  frame: number;
  /** Snap line indicators to draw (empty = no snap) */
  snapLines: { frame: number; rows: number[] }[];
}

/**
 * Pure function: given a clip being moved, check if its left or right edge
 * is within SNAP_THRESHOLD_FRAMES of any clip edge on the same row or
 * adjacent rows (row ± 1). This lets users line up clips across rows
 * (e.g. video + audio alignment).
 *
 * Returns the closest snap and the frame positions to draw snap lines.
 * Only the single best snap (smallest delta) wins.
 */
export function computeEdgeSnap(
  allOverlays: Overlay[],
  draggedId: number,
  proposedFrom: number,
  duration: number,
  targetRow: number,
): SnapResult {
  // Check same row + adjacent rows
  const rowsToCheck = [targetRow - 1, targetRow, targetRow + 1];
  const nearbyClips = allOverlays.filter(
    (o) => o.id !== draggedId && rowsToCheck.includes(o.row)
  );

  const leftEdge = proposedFrom;
  const rightEdge = proposedFrom + duration;

  let bestDelta = Infinity;
  let bestSnappedFrom = proposedFrom;
  let bestSnapLine = -1;
  let bestSnapSourceRow = targetRow;

  for (const clip of nearbyClips) {
    const clipStart = clip.from;
    const clipEnd = clip.from + clip.durationInFrames;

    // My left edge → their right edge (end-to-start)
    const d1 = Math.abs(leftEdge - clipEnd);
    if (d1 < bestDelta && d1 <= SNAP_THRESHOLD_FRAMES) {
      bestDelta = d1;
      bestSnappedFrom = clipEnd;
      bestSnapLine = clipEnd;
      bestSnapSourceRow = clip.row;
    }

    // My left edge → their left edge (align starts)
    const d2 = Math.abs(leftEdge - clipStart);
    if (d2 < bestDelta && d2 <= SNAP_THRESHOLD_FRAMES) {
      bestDelta = d2;
      bestSnappedFrom = clipStart;
      bestSnapLine = clipStart;
      bestSnapSourceRow = clip.row;
    }

    // My right edge → their left edge (end-to-start)
    const d3 = Math.abs(rightEdge - clipStart);
    if (d3 < bestDelta && d3 <= SNAP_THRESHOLD_FRAMES) {
      bestDelta = d3;
      bestSnappedFrom = clipStart - duration;
      bestSnapLine = clipStart;
      bestSnapSourceRow = clip.row;
    }

    // My right edge → their right edge (align ends)
    const d4 = Math.abs(rightEdge - clipEnd);
    if (d4 < bestDelta && d4 <= SNAP_THRESHOLD_FRAMES) {
      bestDelta = d4;
      bestSnappedFrom = clipEnd - duration;
      bestSnapLine = clipEnd;
      bestSnapSourceRow = clip.row;
    }
  }

  if (bestDelta <= SNAP_THRESHOLD_FRAMES) {
    // Rows to highlight: dragged clip's row + the source clip's row (deduplicated)
    const rows = bestSnapSourceRow === targetRow
      ? [targetRow]
      : [Math.min(targetRow, bestSnapSourceRow), Math.max(targetRow, bestSnapSourceRow)];
    return { frame: Math.max(0, bestSnappedFrom), snapLines: [{ frame: bestSnapLine, rows }] };
  }
  return { frame: proposedFrom, snapLines: [] };
}

/**
 * Pure function: given overlays on a row, compute where a new/dropped clip
 * should land and which existing clips need to be pushed right.
 *
 * Works for both in-timeline moves (pass draggedId to exclude) and fresh
 * drops from the sidebar (pass draggedId = -1 so nothing is excluded).
 */
export function computeDropDisplacement(
  allOverlays: Overlay[],
  draggedId: number,
  dropFrame: number,
  draggedDuration: number,
  targetRow: number
): { finalFrom: number; displaced: { id: number; from: number }[] } {
  // All other clips on the target row, sorted by start position
  const rowClips = [...allOverlays]
    .filter((o) => o.id !== draggedId && o.row === targetRow)
    .sort((a, b) => a.from - b.from);

  // 1. Determine final position for the dropped clip
  //    "Dragged clip is king" — it goes exactly where the user drops it,
  //    EXCEPT when we land in the last 30% of an existing clip, in which
  //    case we snap to right after that clip (so the hit clip is not displaced).
  let finalFrom = dropFrame;

  const hitClip = rowClips.find(
    (c) => dropFrame >= c.from && dropFrame < c.from + c.durationInFrames
  );

  if (hitClip) {
    const relPos = (dropFrame - hitClip.from) / hitClip.durationInFrames;
    if (relPos < DISPLACEMENT_THRESHOLD) {
      // First 70%: dragged clip stays at exact drop position.
      // The hit clip (and any subsequent clips) will be pushed right.
      finalFrom = dropFrame;
    } else {
      // Last 30%: snap right after the hit clip (the exception).
      finalFrom = hitClip.from + hitClip.durationInFrames;
    }
  }

  // 2. Compute displacement chain — uniform shift preserves gaps
  const draggedEnd = finalFrom + draggedDuration;
  const displaced: { id: number; from: number }[] = [];

  let shiftAmount = 0;
  for (const clip of rowClips) {
    const clipEnd = clip.from + clip.durationInFrames;
    if (clipEnd <= finalFrom) continue; // entirely before → leave

    if (shiftAmount === 0) {
      // First clip that could overlap with the dragged clip
      if (clip.from >= draggedEnd) break; // no overlap → nothing to displace
      shiftAmount = draggedEnd - clip.from;
    }

    // Shift this clip and all subsequent clips by the same amount
    // so pre-existing gaps between them are preserved
    displaced.push({ id: clip.id, from: clip.from + shiftAmount });
  }

  return { finalFrom, displaced };
}

/**
 * Pure function: given a clip that's being resized, compute which
 * existing clips on the same row overlap with its new bounds and
 * need to be pushed right.
 *
 * Unlike computeDropDisplacement, there's no 70/30 snap logic —
 * the resized clip's position is fixed by the resize handle.
 */
export function computeResizeDisplacement(
  allOverlays: Overlay[],
  resizedId: number,
  newFrom: number,
  newDuration: number,
  row: number
): { displaced: { id: number; from: number }[] } {
  const rowClips = [...allOverlays]
    .filter((o) => o.id !== resizedId && o.row === row)
    .sort((a, b) => a.from - b.from);

  const resizedEnd = newFrom + newDuration;
  const displaced: { id: number; from: number }[] = [];

  let shiftAmount = 0;
  for (const clip of rowClips) {
    const clipEnd = clip.from + clip.durationInFrames;
    if (clipEnd <= newFrom) continue; // entirely before → leave

    if (shiftAmount === 0) {
      if (clip.from >= resizedEnd) break; // no overlap → nothing to displace
      shiftAmount = resizedEnd - clip.from;
    }

    // Uniform shift preserves pre-existing gaps
    displaced.push({ id: clip.id, from: clip.from + shiftAmount });
  }

  return { displaced };
}

export const useTimelinePositioning = () => {
  /**
   * Smart placement for the '+' button: picks the row with the most
   * pre-existing overlays of the same type, places just after the
   * rightmost overlay in that row.
   *
   * Scans ALL rows where overlays actually live so reordered / expanded rows are always found.
   *
   * Tie-breaking rules (zero of this type anywhere):
   *   - If timeline is completely empty:
   *       visual (VIDEO/IMAGE/SHAPE) → row 1, text → row 0, audio → row 2
   *   - If timeline has content but none of this type:
   *       audio → first empty row after the last occupied row
   *       visual/text → row 1 / row 0 (same defaults)
   * Non-zero tie → topmost (lowest index) tied row
   */
  const findSmartPositionForType = (
    existingOverlays: Overlay[],
    newDuration: number,
    overlayType: OverlayType,
    seekFrame?: number,
  ): { from: number; row: number; rowShifts: Array<{ id: number; newRow: number }> } => {
    // Determine the effective row range: cover every row that has an
    // overlay, up to MAX_ROWS.
    const maxOverlayRow = existingOverlays.reduce(
      (mx, o) => Math.max(mx, o.row),
      -1
    );
    const rowCount = Math.max(maxOverlayRow + 1, 1);

    // 1. Count same-type overlays per row (full range)
    // Text and shapes are treated as the same content type —
    // adding a shape when text exists (or vice versa) should reuse the text/shape row.
    const isTextOrShapeType = overlayType === OverlayType.TEXT || overlayType === OverlayType.SHAPE;
    const countPerRow = new Array(rowCount).fill(0) as number[];
    for (const o of existingOverlays) {
      const matches = isTextOrShapeType
        ? (o.type === OverlayType.TEXT || o.type === OverlayType.SHAPE)
        : o.type === overlayType;
      if (matches && o.row >= 0 && o.row < rowCount) {
        countPerRow[o.row]++;
      }
    }

    const maxCount = Math.max(...countPerRow, 0);
    let chosenRow: number;
    let rowShifts: Array<{ id: number; newRow: number }> = [];
    let useSeekAsFrom = false;

    if (maxCount === 0) {
      // First asset of this type (or type group for text/shape)
      const timelineEmpty = existingOverlays.length === 0;
      const isVisual = (
        [OverlayType.VIDEO, OverlayType.IMAGE, OverlayType.SHAPE] as string[]
      ).includes(overlayType);

      if (timelineEmpty) {
        // Completely empty timeline → fixed defaults
        if (overlayType === OverlayType.TEXT) {
          chosenRow = 0;
        } else if (overlayType === OverlayType.SOUND) {
          chosenRow = 2;
        } else if (isVisual) {
          chosenRow = 1;
        } else {
          chosenRow = 0;
        }
      } else if (isTextOrShapeType) {
        // Timeline has content, no text/shapes yet → dynamic row placement
        const minOccupiedRow = existingOverlays.reduce(
          (mn, o) => Math.min(mn, o.row),
          Infinity
        );

        if (minOccupiedRow > 0) {
          // There's empty space above the lowest occupied row
          chosenRow = minOccupiedRow - 1;
        } else {
          // Row 0 is occupied → shift everything down by 1 to free row 0
          if (maxOverlayRow + 1 < MAX_ROWS) {
            // Safe to shift — won't exceed MAX_ROWS
            rowShifts = existingOverlays.map((o) => ({
              id: o.id,
              newRow: o.row + 1,
            }));
            chosenRow = 0;
          } else {
            // Can't shift (would exceed MAX_ROWS) — coexist on row 0
            chosenRow = 0;
          }
        }
        // Use seek position for text/shapes in this case
        useSeekAsFrom = true;
      } else {
        // Timeline has content but none of this type (non-text/shape)
        if (overlayType === OverlayType.SOUND) {
          // Audio → next row after the last occupied row
          chosenRow = maxOverlayRow + 1;
        } else if (isVisual) {
          chosenRow = 1;
        } else {
          chosenRow = 0;
        }
      }
      // Clamp to MAX_ROWS (8)
      chosenRow = Math.min(chosenRow, MAX_ROWS - 1);
    } else {
      // Topmost row (lowest index) that has the max count
      chosenRow = countPerRow.indexOf(maxCount);
    }

    // 2. Determine `from` position
    let from: number;
    if (isTextOrShapeType && seekFrame !== undefined) {
      // Text/shape: prefer seek position, but avoid overlaps on the chosen row
      const seekPos = Math.max(0, Math.round(seekFrame));
      const rowOverlays = existingOverlays
        .filter((o) => {
          const effectiveRow = rowShifts.length > 0
            ? (rowShifts.find((s) => s.id === o.id)?.newRow ?? o.row)
            : o.row;
          return effectiveRow === chosenRow;
        })
        .sort((a, b) => a.from - b.from);

      // Check if seek position fits without overlapping any existing overlay
      const seekEnd = seekPos + newDuration;
      const conflict = rowOverlays.find(
        (o) => o.from < seekEnd && (o.from + o.durationInFrames) > seekPos
      );

      if (!conflict) {
        from = seekPos;
      } else {
        // Find the first gap in the row that can fit newDuration.
        // Walk the sorted overlay chain and find a position after conflicts.
        let insertAt = seekPos;
        for (const o of rowOverlays) {
          const oEnd = o.from + o.durationInFrames;
          // Skip overlays entirely before our candidate position
          if (oEnd <= insertAt) continue;
          // If there's a gap before this overlay that fits, use it
          if (o.from >= insertAt + newDuration) break;
          // Otherwise, push past this overlay
          insertAt = oEnd;
        }
        from = insertAt;
      }
    } else {
      // Default: place just after the rightmost overlay (any type) in the chosen row
      // (use post-shift row values when rowShifts apply — the chosen row will be empty)
      let rowEnd = 0;
      for (const o of existingOverlays) {
        // If we shifted rows, the chosen row (0) is now empty, so rowEnd stays 0
        const effectiveRow = rowShifts.length > 0
          ? (rowShifts.find((s) => s.id === o.id)?.newRow ?? o.row)
          : o.row;
        if (effectiveRow === chosenRow) {
          rowEnd = Math.max(rowEnd, o.from + o.durationInFrames);
        }
      }
      from = rowEnd;
    }

    return { from, row: chosenRow, rowShifts };
  };

  return { findSmartPositionForType };
};
