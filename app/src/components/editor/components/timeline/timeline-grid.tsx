/**
 * TimelineGrid Component
 * Renders a grid-based timeline view for managing overlay items across multiple rows.
 * Supports drag and drop, resizing, and various item management operations.
 */

import React, { useMemo } from "react";
import { ROW_HEIGHT } from "../../constants";
import { Overlay } from "../../types";
import type { DisplacementPreview } from "../../hooks/use-timeline-state";
import GapIndicator from "./timeline-gap-indicator";
import TimelineItem from "./timeline-item";

/**
 * Props for the TimelineGrid component
 * @interface TimelineGridProps
 */
interface TimelineGridProps {
  /** Array of overlay items to display in the timeline */
  overlays: Overlay[];
  /** Number of visible rows to render */
  visibleRows: number;
  /** Total height of the timeline grid in pixels */
  timelineHeight: number;
  /** Indicates if an item is currently being dragged */
  isDragging: boolean;
  /** The overlay item currently being dragged, if any */
  draggedItem: Overlay | null;
  /** ID of the currently selected overlay */
  selectedOverlayId: number | null;
  /** Callback to update the selected overlay ID */
  setSelectedOverlayId: (id: number | null) => void;
  /** Callback triggered when dragging starts */
  handleDragStart: (
    overlay: Overlay,
    clientX: number,
    clientY: number,
    action: "move" | "resize-start" | "resize-end"
  ) => void;
  /** Total duration of the timeline in seconds */
  totalDuration: number;
  /** Visual element showing drag preview */
  ghostElement: {
    left: number; // Position from left as percentage
    width: number; // Width as percentage
    top: number; // Vertical position
  } | null;
  /** Callback to delete an overlay item */
  onDeleteItem: (id: number) => void;
  /** Callback to duplicate an overlay item */
  onDuplicateItem: (id: number) => void;
  /** Callback to split an overlay item at current position */
  onSplitItem: (id: number) => void;
  /** Callback to edit an overlay item */
  /** Callback when hovering over an item */
  onHover: (itemId: number, position: number) => void;
  /** Callback when context menu state changes */
  onContextMenuChange: (open: boolean) => void;
  /** Callback to remove gap between items */
  onRemoveGap?: (rowIndex: number, gapStart: number, gapEnd: number) => void;
  /** Current frame of the timeline */
  currentFrame: number;
  /** Zoom scale of the timeline */
  zoomScale: number;
  /** Callback when rows are reordered */
  onReorderRows?: (fromIndex: number, toIndex: number) => void;
  /** Index of the row being dragged */
  draggedRowIndex: number | null;
  /** Index of the row being hovered over */
  dragOverRowIndex: number | null;
  /** Callback when asset loading state changes */
  onAssetLoadingChange?: (overlayId: number, isLoading: boolean) => void;
  /** Preview indicator for asset being dragged from sidebar */
  assetDropPreview?: {
    row: number;
    fromFrame: number;
    durationFrames: number;
  } | null;
  /** Live displacement preview positions during move-drag */
  displacementPreview?: DisplacementPreview;
  /** Active snap line indicators with row scoping */
  snapLines?: import("../../contexts/timeline-context").SnapLine[];
}

/**
 * TimelineGrid component that displays overlay items in a row-based timeline view
 */
const TimelineGrid: React.FC<TimelineGridProps> = ({
  overlays,
  visibleRows,
  timelineHeight,
  isDragging,
  draggedItem,
  selectedOverlayId,
  setSelectedOverlayId,
  handleDragStart,
  totalDuration,
  ghostElement,
  onDeleteItem,
  onDuplicateItem,
  onSplitItem,
  onHover,
  onContextMenuChange,
  onRemoveGap,
  currentFrame,
  zoomScale,
  draggedRowIndex,
  dragOverRowIndex,
  onAssetLoadingChange,
  assetDropPreview,
  displacementPreview,
  snapLines,
}) => {

  // Create a memoized selectedItem object
  const selectedItem = useMemo(
    () => (selectedOverlayId !== null ? { id: selectedOverlayId } : null),
    [selectedOverlayId]
  );

  /**
   * Finds gaps between overlay items in a single timeline row
   * @param rowItems - Array of Overlay items in the current row
   * @returns Array of gap objects, each containing start and end times
   *
   * @example
   * // For a row with items: [0-30], [50-80], [100-120]
   * // Returns: [{start: 30, end: 50}, {start: 80, end: 100}]
   *
   * @description
   * This function identifies empty spaces (gaps) between overlay items in a timeline row:
   * 1. Converts each item into start and end time points
   * 2. Sorts all time points chronologically
   * 3. Identifies three types of gaps:
   *    - Gaps at the start (if first item doesn't start at 0)
   *    - Gaps between items
   *    - Gaps at the end are not included as they're considered infinite
   */
  const findGapsInRow = (rowItems: Overlay[]) => {
    if (rowItems.length === 0) return [];

    const timePoints = rowItems
      .flatMap((item) => [
        { time: item.from, type: "start" },
        { time: item.from + item.durationInFrames, type: "end" },
      ])
      .sort((a, b) => a.time - b.time);

    return timePoints.reduce((gaps, point, index, points) => {
      // Handle gap at the start
      if (index === 0 && point.time > 0) {
        gaps.push({ start: 0, end: point.time });
      }

      // Handle gaps between items
      if (index < points.length - 1) {
        const currentTime = point.type === "end" ? point.time : null;
        const nextTime = points[index + 1].time;

        if (currentTime !== null && nextTime - currentTime > 0) {
          gaps.push({ start: currentTime, end: nextTime });
        }
      }

      return gaps;
    }, [] as { start: number; end: number }[]);
  };

  return (
    <div
      className="relative overflow-x-auto overflow-y-hidden bg-white dark:bg-zinc-950 h-full"
      style={{ height: `${timelineHeight}px` }}
    >
      <div className="absolute inset-0 flex flex-col gap-2 pt-2 pb-2">
        {Array.from({ length: visibleRows }).map((_, rowIndex) => {
          const rowItems = overlays.filter(
            (overlay) => overlay.row === rowIndex
          );
          const gaps = findGapsInRow(rowItems);

          return (
            <div
              key={rowIndex}
              className={`flex-1 bg-zinc-50 dark:bg-zinc-900/50 rounded-[3px] relative
                transition-all duration-150
                ${draggedRowIndex === rowIndex ? "opacity-40" : ""}`}
              style={{
                borderTop: dragOverRowIndex === rowIndex ? "2px solid rgba(161,161,170,0.5)" : undefined,
                borderBottom: dragOverRowIndex === rowIndex + 1 && rowIndex === (visibleRows - 1) ? "2px solid rgba(161,161,170,0.5)" : undefined,
              }}
            >
              {rowItems.map((overlay) => (
                <TimelineItem
                  key={overlay.id}
                  item={overlay}
                  isDragging={isDragging}
                  draggedItem={draggedItem}
                  selectedItem={selectedItem}
                  setSelectedItem={(item) => setSelectedOverlayId(item.id)}
                  handleMouseDown={(action, e) =>
                    handleDragStart(overlay, e.clientX, e.clientY, action)
                  }
                  handleTouchStart={(action, e) => {
                    const touch = e.touches[0];
                    handleDragStart(
                      overlay,
                      touch.clientX,
                      touch.clientY,
                      action
                    );
                  }}
                  totalDuration={totalDuration}
                  onDeleteItem={onDeleteItem}
                  onDuplicateItem={onDuplicateItem}
                  onSplitItem={onSplitItem}
                  onHover={onHover}
                  onContextMenuChange={onContextMenuChange}
                  currentFrame={currentFrame}
                  zoomScale={zoomScale}
                  onAssetLoadingChange={onAssetLoadingChange}
                  previewFrom={
                    displacementPreview
                      ? displacementPreview[overlay.id]
                      : undefined
                  }
                />
              ))}

              {/* Gap indicators */}
              {!isDragging &&
                gaps.map((gap, gapIndex) => (
                  <GapIndicator
                    key={`gap-${rowIndex}-${gapIndex}`}
                    gap={gap}
                    rowIndex={rowIndex}
                    totalDuration={totalDuration}
                    onRemoveGap={onRemoveGap}
                  />
                ))}

              {/* Ghost element for moving existing overlays */}
              {ghostElement &&
                Math.floor(ghostElement.top / (100 / visibleRows)) ===
                  rowIndex && (
                  <div
                    className="absolute inset-y-0 rounded-[3px] border-2 border-dashed border-primary/60 bg-primary/15 dark:bg-primary/10 pointer-events-none"
                    style={{
                      left: `${ghostElement.left}%`,
                      width: `${Math.max(ghostElement.width, 1)}%`,
                      minWidth: "8px",
                      zIndex: 50,
                    }}
                  />
                )}

              {/* Ghost element for asset drop preview (dragging from sidebar) */}
              {assetDropPreview && assetDropPreview.row === rowIndex && (
                <div
                  className="absolute inset-y-0 rounded-[3px] border-2 border-dashed border-primary/60 bg-primary/15 dark:bg-primary/10 pointer-events-none"
                  style={{
                    left: `${(assetDropPreview.fromFrame / totalDuration) * 100}%`,
                    width: `${Math.max((assetDropPreview.durationFrames / totalDuration) * 100, 0.5)}%`,
                    minWidth: "8px",
                    zIndex: 50,
                  }}
                />
              )}

              {/* Snap line indicators — scoped to relevant rows */}
              {snapLines && snapLines.map((snap) =>
                snap.rows.includes(rowIndex) ? (
                  <div
                    key={`snap-${snap.frame}`}
                    className="absolute inset-y-[1px] pointer-events-none z-[60]"
                    style={{
                      left: `${(snap.frame / totalDuration) * 100}%`,
                      width: '1px',
                    }}
                  >
                    {/* Main line */}
                    <div className="absolute inset-0 w-px bg-primary/90" style={{ boxShadow: '0 0 6px hsl(var(--primary) / 0.35)' }} />
                    {/* Top diamond */}
                    <div className="absolute -top-[2px] left-1/2 -translate-x-1/2 w-[5px] h-[5px] rotate-45 bg-primary rounded-[1px]" />
                    {/* Bottom diamond */}
                    <div className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 w-[5px] h-[5px] rotate-45 bg-primary rounded-[1px]" />
                  </div>
                ) : null
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimelineGrid;
