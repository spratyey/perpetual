import { useRef, useState, useCallback } from "react";
import { Overlay } from "../types";

/** Map of overlay ID → preview "from" frame during a live displacement drag */
export type DisplacementPreview = Record<number, number> | null;

// Interfaces for managing drag and drop functionality
interface GhostElement {
  left: number; // Percentage from left edge
  width: number; // Percentage of total width
  top: number; // Percentage from top edge
}

interface DragInfo {
  id: number;
  action: "move" | "resize-start" | "resize-end"; // Type of drag operation
  startX: number; // Initial mouse X position
  startY: number; // Initial mouse Y position
  startPosition: number; // Initial overlay position
  startDuration: number; // Initial overlay duration
  startRow: number; // Initial row number
}

export const useTimelineState = (
  totalDuration: number,
  maxRows: number,
  timelineRef: React.RefObject<HTMLDivElement>
) => {
  // States to manage dragging behavior
  // States to manage dragging behavior
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItem, setDraggedItem] = useState<Overlay | null>(null);

  // Visual feedback states during drag operations
  const [ghostElement, setGhostElement] = useState<GhostElement | null>(null);
  const [ghostMarkerPosition, setGhostMarkerPosition] = useState<number | null>(
    null
  );

  // Persistent reference to current drag operation details
  const dragInfo = useRef<DragInfo | null>(null);

  // Live displacement preview: overlay-id → preview start-frame
  const [displacementPreview, setDisplacementPreview] =
    useState<DisplacementPreview>(null);

  const handleDragStart = useCallback(
    (
      overlay: Overlay,
      clientX: number,
      clientY: number,
      action: "move" | "resize-start" | "resize-end"
    ) => {
      if (timelineRef.current) {
        // Store initial drag state
        dragInfo.current = {
          id: overlay.id,
          action,
          startX: clientX,
          startY: clientY,
          startPosition: overlay.from,
          startDuration: overlay.durationInFrames,
          startRow: overlay.row || 0,
        };

        // Update UI states for drag operation
        setIsDragging(true);
        setDraggedItem(overlay);

        // Calculate ghost element position as percentages
        setGhostElement({
          left: (overlay.from / totalDuration) * 100,
          width: (overlay.durationInFrames / totalDuration) * 100,
          top: (overlay.row || 0) * (100 / maxRows),
        });
      }
    },
    [totalDuration, maxRows]
  );

  // Updates the visual position of the ghost element during drag
  const updateGhostElement = useCallback(
    (newLeft: number, newWidth: number, newTop: number) => {
      setGhostElement({ left: newLeft, width: newWidth, top: newTop });
    },
    []
  );

  // Cleans up all drag-related states
  const resetDragState = useCallback(() => {
    setIsDragging(false);
    setDraggedItem(null);
    setGhostElement(null);
    setDisplacementPreview(null);
    dragInfo.current = null;
  }, []);

  return {
    isDragging,
    draggedItem,
    ghostElement,
    ghostMarkerPosition,
    dragInfo,
    handleDragStart,
    updateGhostElement,
    resetDragState,
    setGhostMarkerPosition,
    displacementPreview,
    setDisplacementPreview,
  };
};
