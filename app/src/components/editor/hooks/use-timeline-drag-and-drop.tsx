import { useCallback, useMemo, useRef } from "react";
import { Overlay, OverlayType } from "../types";
import { computeDropDisplacement, computeResizeDisplacement, computeEdgeSnap } from "./use-timeline-positioning";
import type { DisplacementPreview } from "./use-timeline-state";

interface DragInfo {
  id: number;
  action: "move" | "resize-start" | "resize-end";
  startX: number;
  startY: number;
  startPosition: number;
  startDuration: number;
  startRow: number;
  ghostLeft?: number;
  ghostWidth?: number;
  ghostTop?: number;
}

interface UseTimelineDragAndDropProps {
  overlays: Overlay[];
  durationInFrames: number;
  onOverlayChange: (updatedOverlay: Overlay) => void;
  batchUpdate?: (updates: Array<{ id: number; overlay: Partial<Overlay> }>) => void;
  updateGhostElement: (
    newLeft: number,
    newWidth: number,
    newTop: number
  ) => void;
  resetDragState: () => void;
  timelineRef: React.RefObject<HTMLDivElement>;
  dragInfo: React.MutableRefObject<DragInfo | null>;
  maxRows: number;
  setDisplacementPreview: (preview: DisplacementPreview) => void;
  snapEnabled: boolean;
  setSnapLines: (lines: { frame: number; rows: number[] }[]) => void;
}

/**
 * Hook to handle drag and drop functionality for timeline overlays.
 * Manages overlay positioning, resizing, and collision detection.
 *
 * MOVE behaviour (the "dragged clip is king" model):
 * ─────────────────────────────────────────────────
 * When a clip is moved the gap it leaves behind stays open (no auto-
 * collapse).  At the drop target row the following rules apply:
 *
 * 1. Drop lands in a gap / on the first 70 % of an existing clip →
 *    dragged clip is placed at the EXACT drop frame.  Any clips
 *    that overlap are pushed right and chained.
 *
 * 2. Drop lands in the last 30 % of an existing clip →
 *    dragged clip snaps to that clip's END.  Every subsequent clip
 *    on the row chains tightly after the dragged clip.
 *
 * @param props.overlays - Array of overlay items to manage
 * @param props.durationInFrames - Total duration of the timeline in frames
 * @param props.onOverlayChange - Callback when an overlay is modified
 * @param props.updateGhostElement - Function to update the ghost element's position during drag
 * @param props.resetDragState - Function to reset the drag state
 * @param props.timelineRef - Reference to the timeline DOM element
 * @param props.dragInfo - Mutable reference holding the current drag state
 * @param props.maxRows - Maximum number of rows in the timeline
 * @returns Object containing drag handler functions
 */
export const useTimelineDragAndDrop = ({
  overlays,
  durationInFrames,
  onOverlayChange,
  batchUpdate,
  updateGhostElement,
  resetDragState,
  timelineRef,
  dragInfo,
  maxRows,
  setDisplacementPreview,
  snapEnabled,
  setSnapLines,
}: UseTimelineDragAndDropProps) => {
  const snapToGrid = useCallback((value: number) => {
    const GRID_SIZE = 1;
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }, []);

  // Memoize sorted overlays to avoid sorting on every render
  const sortedOverlays = useMemo(() => {
    return [...overlays].sort((a, b) => a.from - b.from);
  }, [overlays]);

  // Ref to deduplicate displacement preview updates
  const lastPreviewKey = useRef<string>("");

  // Dwell timer: only show displacement preview after 250ms at the same position
  const dwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPreviewKey = useRef<string>("");

  // ── Displacement logic for MOVE operations ───────────────────────────
  /**
   * Compute where the dragged clip should land and which other clips on
   * the same row need to be pushed right.
   *
   * Returns the final `from` for the dragged clip and an array of
   * `{ id, from }` updates for every displaced neighbour.
   */
  const computeDisplacement = useCallback(
    (
      draggedId: number,
      dropFrame: number,
      draggedDuration: number,
      targetRow: number
    ) => computeDropDisplacement(sortedOverlays, draggedId, dropFrame, draggedDuration, targetRow),
    [sortedOverlays]
  );

  const handleDragStart = useCallback(
    (
      overlay: Overlay,
      clientX: number,
      clientY: number,
      action: "move" | "resize-start" | "resize-end"
    ) => {
      if (timelineRef.current) {
        dragInfo.current = {
          id: overlay.id,
          action,
          startX: clientX,
          startY: clientY,
          startPosition: overlay.from,
          startDuration: overlay.durationInFrames,
          startRow: overlay.row || 0,
        };

        updateGhostElement(
          (overlay.from / durationInFrames) * 100,
          (overlay.durationInFrames / durationInFrames) * 100,
          (overlay.row || 0) * (100 / maxRows)
        );
      }
    },
    [durationInFrames, maxRows, updateGhostElement]
  );

  const handleDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragInfo.current || !timelineRef.current) return;

      const timelineRect = timelineRef.current.getBoundingClientRect();
      const deltaX = clientX - dragInfo.current.startX;
      const deltaY = clientY - dragInfo.current.startY;
      const deltaTime = snapToGrid(
        (deltaX / timelineRect.width) * durationInFrames
      );

      const rowHeight = timelineRect.height / maxRows;
      const deltaRow = Math.round(deltaY / rowHeight);

      let newLeft = (dragInfo.current.startPosition / durationInFrames) * 100;
      let newWidth = (dragInfo.current.startDuration / durationInFrames) * 100;
      let newRow = dragInfo.current.startRow + deltaRow;

      // Clamp the row within bounds
      newRow = Math.max(0, Math.min(maxRows - 1, newRow));

      switch (dragInfo.current.action) {
        case "move": {
          let newPosition = Math.max(
            0,
            dragInfo.current.startPosition + deltaTime
          );

          // Apply snap-to-edges if enabled
          if (snapEnabled) {
            const { frame: snappedFrame, snapLines } = computeEdgeSnap(
              sortedOverlays,
              dragInfo.current.id,
              newPosition,
              dragInfo.current.startDuration,
              newRow
            );
            newPosition = snappedFrame;
            setSnapLines(snapLines);
          } else {
            setSnapLines([]);
          }

          newLeft = (newPosition / durationInFrames) * 100;
          break;
        }
        case "resize-start": {
          // Keep the end position fixed and adjust start position and width
          const originalEnd =
            dragInfo.current.startPosition + dragInfo.current.startDuration;

          // For video/sound, don't allow expanding before content start (videoStartTime/startFromSound can't go below 0)
          const resizeOverlay = overlays.find(o => o.id === dragInfo.current!.id);
          let minStart = 0;
          if (resizeOverlay?.maxDuration) {
            const contentStart = resizeOverlay.type === OverlayType.VIDEO
              ? ((resizeOverlay as any).videoStartTime || 0)
              : resizeOverlay.type === OverlayType.SOUND
              ? ((resizeOverlay as any).startFromSound || 0)
              : 0;
            // Can only expand left by contentStart frames
            minStart = dragInfo.current.startPosition - contentStart;
          }

          // Clamp at the end of the nearest left-neighbor clip on the target row
          // so that left-expansion can't overlap with previous clips
          const prevClipEnd = sortedOverlays
            .filter(o => o.id !== dragInfo.current!.id && o.row === newRow)
            .filter(o => o.from + o.durationInFrames <= dragInfo.current!.startPosition)
            .reduce((max, o) => Math.max(max, o.from + o.durationInFrames), 0);
          if (prevClipEnd > 0) {
            minStart = Math.max(minStart, prevClipEnd);
          }

          const newStart = Math.max(
            minStart,
            Math.min(
              originalEnd - 1,
              dragInfo.current.startPosition + deltaTime
            )
          );

          newLeft = (newStart / durationInFrames) * 100;
          newWidth = ((originalEnd - newStart) / durationInFrames) * 100;
          break;
        }
        case "resize-end": {
          // Keep the start position fixed and only adjust width
          const overlay = overlays.find(o => o.id === dragInfo.current!.id);
          let maxAllowed = Infinity;
          if (overlay?.maxDuration) {
            const contentStart = overlay.type === OverlayType.VIDEO
              ? ((overlay as any).videoStartTime || 0)
              : overlay.type === OverlayType.SOUND
              ? ((overlay as any).startFromSound || 0)
              : 0;
            maxAllowed = overlay.maxDuration - contentStart;
          }
          const newDuration = Math.min(
            maxAllowed,
            Math.max(1, dragInfo.current.startDuration + deltaTime)
          );
          newWidth = (newDuration / durationInFrames) * 100;
          break;
        }
      }

      // Ensure values are within valid ranges
      newLeft = Math.max(0, newLeft);
      newWidth = Math.max(0, newWidth);

      // Update ghost element directly without overlap checking
      updateGhostElement(newLeft, newWidth, newRow * (100 / maxRows));

      // Update dragInfo with new ghost position
      dragInfo.current.ghostLeft = newLeft;
      dragInfo.current.ghostWidth = newWidth;
      dragInfo.current.ghostTop = newRow * (100 / maxRows);

      // ── Live displacement preview (move + resize, with dwell timer) ────
      {
        let displaced: { id: number; from: number }[];
        if (dragInfo.current.action === "move") {
          const dropFrame = Math.max(
            0,
            snapToGrid((newLeft / 100) * durationInFrames)
          );
          ({ displaced } = computeDropDisplacement(
            sortedOverlays,
            dragInfo.current.id,
            dropFrame,
            dragInfo.current.startDuration,
            newRow
          ));
        } else {
          // resize-start or resize-end
          const resizeFrom = Math.max(0, snapToGrid((newLeft / 100) * durationInFrames));
          const resizeDuration = Math.max(1, snapToGrid((newWidth / 100) * durationInFrames));
          ({ displaced } = computeResizeDisplacement(
            sortedOverlays,
            dragInfo.current.id,
            resizeFrom,
            resizeDuration,
            newRow
          ));
        }

        // Build a stable key so we only trigger a state update when
        // the preview actually changes.
        const key = displaced.map((d) => `${d.id}:${d.from}`).join(",");

        if (key !== pendingPreviewKey.current) {
          // Position changed — reset dwell timer
          pendingPreviewKey.current = key;
          if (dwellTimer.current) clearTimeout(dwellTimer.current);

          // If we're moving away from a displacement, clear preview immediately
          if (key === "" && lastPreviewKey.current !== "") {
            lastPreviewKey.current = "";
            setDisplacementPreview(null);
          } else {
            // Start dwell: only commit preview after 250ms at this position
            dwellTimer.current = setTimeout(() => {
              if (pendingPreviewKey.current !== lastPreviewKey.current) {
                lastPreviewKey.current = pendingPreviewKey.current;
                if (displaced.length > 0) {
                  const preview: Record<number, number> = {};
                  for (const d of displaced) {
                    preview[d.id] = d.from;
                  }
                  setDisplacementPreview(preview);
                } else {
                  setDisplacementPreview(null);
                }
              }
            }, 200);
          }
        }
      }
    },
    [overlays, sortedOverlays, durationInFrames, maxRows, snapToGrid, updateGhostElement, setDisplacementPreview, snapEnabled, setSnapLines]
  );

  const handleDragEnd = useCallback(() => {
    // Clear snap lines
    setSnapLines([]);
    // Clear any pending dwell timer
    if (dwellTimer.current) {
      clearTimeout(dwellTimer.current);
      dwellTimer.current = null;
    }
    pendingPreviewKey.current = "";
    lastPreviewKey.current = "";

    if (
      dragInfo.current &&
      dragInfo.current.ghostLeft !== undefined &&
      dragInfo.current.ghostWidth !== undefined &&
      dragInfo.current.ghostTop !== undefined
    ) {
      const updatedOverlay = overlays.find(
        (overlay) => overlay.id === dragInfo.current!.id
      );
      if (updatedOverlay) {
        const newFrom = Math.max(
          0,
          snapToGrid((dragInfo.current.ghostLeft / 100) * durationInFrames)
        );
        let newDuration = Math.max(
          1,
          snapToGrid((dragInfo.current.ghostWidth / 100) * durationInFrames)
        );

        const newRow = Math.round(dragInfo.current.ghostTop / (100 / maxRows));

        // ── RESIZE operations: use displacement to push neighbours ─────
        if (dragInfo.current.action !== "move") {
          let additionalUpdates = {};
          if (dragInfo.current.action === "resize-start") {
            // trimmedFrames is positive when contracting (dragging right),
            // negative when expanding (dragging left) — both must update the media offset
            const trimmedFrames = newFrom - dragInfo.current.startPosition;
            const trimmedMs = (trimmedFrames / 30) * 1000; // Assuming 30fps

            if (updatedOverlay.type === OverlayType.VIDEO) {
              const newVideoStartTime = Math.max(
                0,
                (updatedOverlay.videoStartTime || 0) + trimmedFrames
              );
              additionalUpdates = { videoStartTime: newVideoStartTime };
              // Cap duration using the NEW videoStartTime
              if (updatedOverlay.maxDuration) {
                newDuration = Math.min(newDuration, updatedOverlay.maxDuration - newVideoStartTime);
              }
            } else if (updatedOverlay.type === OverlayType.SOUND) {
              const newStartFromSound = Math.max(
                0,
                (updatedOverlay.startFromSound || 0) + trimmedFrames
              );
              additionalUpdates = { startFromSound: newStartFromSound };
              // Cap duration using the NEW startFromSound
              if (updatedOverlay.maxDuration) {
                newDuration = Math.min(newDuration, updatedOverlay.maxDuration - newStartFromSound);
              }
              if ((updatedOverlay as any).captions) {
                const adjustTiming = (time: number) =>
                  Math.max(0, time - trimmedMs);
                additionalUpdates = {
                  ...additionalUpdates,
                  captions: (updatedOverlay as any).captions.map(
                    (caption: any) => ({
                      ...caption,
                      startMs: adjustTiming(caption.startMs),
                      endMs: adjustTiming(caption.endMs),
                      words: caption.words.map((word: any) => ({
                        ...word,
                        startMs: adjustTiming(word.startMs),
                        endMs: adjustTiming(word.endMs),
                      })),
                    })
                  ),
                };
              }
            }
          } else {
            // resize-end: cap at maxDuration using current contentStart
            if (updatedOverlay.maxDuration) {
              const contentStart = updatedOverlay.type === OverlayType.VIDEO
                ? ((updatedOverlay as any).videoStartTime || 0)
                : updatedOverlay.type === OverlayType.SOUND
                ? ((updatedOverlay as any).startFromSound || 0)
                : 0;
              newDuration = Math.min(newDuration, updatedOverlay.maxDuration - contentStart);
            }
          }

          // Use displacement to push overlapping clips on the same row
          const { displaced } = computeResizeDisplacement(
            sortedOverlays,
            updatedOverlay.id,
            newFrom,
            newDuration,
            newRow
          );

          if (displaced.length > 0 && batchUpdate) {
            // Atomic batch: resized overlay + all displaced neighbours
            const updates: Array<{ id: number; overlay: Partial<Overlay> }> = [
              {
                id: updatedOverlay.id,
                overlay: {
                  ...additionalUpdates,
                  from: newFrom,
                  durationInFrames: newDuration,
                  row: newRow,
                },
              },
            ];
            for (const d of displaced) {
              updates.push({ id: d.id, overlay: { from: d.from } });
            }
            batchUpdate(updates);
          } else {
            onOverlayChange({
              ...updatedOverlay,
              ...additionalUpdates,
              from: newFrom,
              durationInFrames: newDuration,
              row: newRow,
            });
          }
        } else {
          // ── MOVE operation: use displacement algorithm ───────────────
          const { finalFrom, displaced } = computeDisplacement(
            updatedOverlay.id,
            newFrom,
            newDuration,
            newRow
          );

          if (batchUpdate) {
            // Single atomic batch: dragged overlay + all displaced neighbours
            const updates: Array<{ id: number; overlay: Partial<Overlay> }> = [
              {
                id: updatedOverlay.id,
                overlay: { from: finalFrom, durationInFrames: newDuration, row: newRow },
              },
            ];
            for (const d of displaced) {
              updates.push({ id: d.id, overlay: { from: d.from } });
            }
            batchUpdate(updates);
          } else {
            // Fallback: N+1 individual calls (legacy)
            onOverlayChange({
              ...updatedOverlay,
              from: finalFrom,
              durationInFrames: newDuration,
              row: newRow,
            });
            for (const d of displaced) {
              const neighbour = overlays.find((o) => o.id === d.id);
              if (neighbour) {
                onOverlayChange({ ...neighbour, from: d.from });
              }
            }
          }
        }
      }
    }

    resetDragState();
  }, [
    overlays,
    sortedOverlays,
    durationInFrames,
    maxRows,
    snapToGrid,
    computeDisplacement,
    onOverlayChange,
    batchUpdate,
    resetDragState,
    setSnapLines,
  ]);

  return {
    /**
     * Initializes drag operation for an overlay
     * @param overlay - The overlay being dragged
     * @param clientX - Initial mouse X position
     * @param clientY - Initial mouse Y position
     * @param action - Type of drag operation: 'move', 'resize-start', or 'resize-end'
     */
    handleDragStart,

    /**
     * Updates overlay position/size during drag
     * @param clientX - Current mouse X position
     * @param clientY - Current mouse Y position
     */
    handleDrag,

    /**
     * Finalizes drag operation and updates overlay state
     * Handles collision detection and adjusts position if needed
     */
    handleDragEnd,
  };
};
