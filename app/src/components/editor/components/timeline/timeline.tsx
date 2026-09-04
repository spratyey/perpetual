/**
 * Timeline Component
 *
 * A complex timeline interface that allows users to manage video overlays through
 * drag-and-drop interactions, splitting, duplicating, and deletion operations.
 * The timeline visualizes overlay positions and durations across video frames.
 */


import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTimeline } from "../../contexts/timeline-context";
import { useTimelineDragAndDrop } from "../../hooks/use-timeline-drag-and-drop";
import { useTimelineEventHandlers } from "../../hooks/use-timeline-event-handlers";
import { useTimelineState } from "../../hooks/use-timeline-state";
import { useEditorContext } from "../../contexts/editor-context";
import { useTimelinePositioning, computeDropDisplacement } from "../../hooks/use-timeline-positioning";
import { useAspectRatio } from "../../hooks/use-aspect-ratio";
import { Overlay, OverlayType } from "../../types";
import GhostMarker from "./ghost-marker";
import TimelineGrid from "./timeline-grid";
import TimelineMarker from "./timeline-marker";
import TimeMarkers from "./timeline-markers";
import { Grip, Loader2 } from "lucide-react";
import { ROW_HEIGHT, MIN_DISPLAY_ROWS, MAX_ROWS, SHOW_LOADING_PROJECT_ALERT } from "../../constants";
import { useAssetLoading } from "../../contexts/asset-loading-context";

interface TimelineProps {
  /** Array of overlay objects to be displayed on the timeline */
  overlays: Overlay[];
  /** Total duration of the video in frames */
  durationInFrames: number;
  /** ID of the currently selected overlay */
  selectedOverlayId: number | null;
  /** Callback to update the selected overlay */
  setSelectedOverlayId: (id: number | null) => void;
  /** Current playhead position in frames */
  currentFrame: number;
  /** Callback when an overlay is modified */
  onOverlayChange: (updatedOverlay: Overlay) => void;
  /** Callback to update the current frame position */
  setCurrentFrame: (frame: number) => void;
  /** Callback for timeline click events */
  onTimelineClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Callback to delete an overlay */
  onOverlayDelete: (id: number) => void;
  /** Callback to duplicate an overlay */
  onOverlayDuplicate: (id: number) => void;
  /** Callback to split an overlay at a specific position */
  onSplitOverlay: (id: number, splitPosition: number) => void;
  /** Callback to set the overlays state */
  setOverlays: (overlays: Overlay[]) => void;
  /** Extra rows added via resize handle */
  extraRows?: number;
}

const Timeline: React.FC<TimelineProps> = ({
  overlays,
  durationInFrames,
  selectedOverlayId,
  setSelectedOverlayId,
  currentFrame,
  onOverlayChange,
  setCurrentFrame,
  onTimelineClick,
  onOverlayDelete,
  onOverlayDuplicate,
  onSplitOverlay,
  setOverlays,
  extraRows = 0,
}) => {
  const { timelineRef, zoomScale, handleWheelZoom, snapEnabled, snapLines, setSnapLines } =
    useTimeline();
  const { addOverlay, batchUpdate } = useEditorContext();
  const { findSmartPositionForType } = useTimelinePositioning();
  const { getAspectRatioDimensions } = useAspectRatio();

  // Dynamic row count: always show at least MIN_DISPLAY_ROWS,
  // and always one empty row beyond the highest occupied row
  // (moved above drag handlers so they can reference totalVisibleRows)
  const visibleRows = useMemo(() => {
    const maxOccupiedRow = overlays.reduce((max, o) => Math.max(max, o.row || 0), -1);
    return Math.max(maxOccupiedRow + 2, MIN_DISPLAY_ROWS);
  }, [overlays]);

  // Total visible rows including extra from resize handle
  const totalVisibleRows = Math.min(visibleRows + extraRows, MAX_ROWS);
  const timelineHeight = totalVisibleRows * ROW_HEIGHT;

  const [isAssetDragOver, setIsAssetDragOver] = useState(false);

  // Track the preview position for asset drops (row + frame + duration)
  const [assetDropPreview, setAssetDropPreview] = useState<{
    row: number;
    fromFrame: number;
    durationFrames: number;
  } | null>(null);

  // Duration of the asset being dragged (communicated via custom event from panels)
  const assetDragDurationRef = useRef<number>(90);

  // Listen for asset drag start events from sidebar panels to get actual duration
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.durationFrames) {
        assetDragDurationRef.current = detail.durationFrames;
      }
    };
    window.addEventListener("perpetual-asset-drag-start", handler);
    return () => window.removeEventListener("perpetual-asset-drag-start", handler);
  }, []);

  // Compute the drop target row and frame from mouse coordinates
  const getDropTargetFromEvent = useCallback(
    (e: React.DragEvent) => {
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return null;

      // X → frame: use full rect width (matches existing overlay drag behaviour)
      const relX = Math.max(0, (e.clientX - rect.left) / rect.width);
      const frame = Math.round(relX * durationInFrames);

      // Y → row: header is h-[1.3rem] ≈ 20.8px, then rows start
      const headerPx = 20.8;
      const gridY = e.clientY - rect.top - headerPx;
      const row = Math.max(
        0,
        Math.min(Math.floor(gridY / ROW_HEIGHT), totalVisibleRows - 1)
      );

      return { frame: Math.max(0, frame), row };
    },
    [durationInFrames, totalVisibleRows, timelineRef]
  );

  const handleAssetDragOver = useCallback(
    (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes("application/x-perpetual-asset")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setIsAssetDragOver(true);

        const target = getDropTargetFromEvent(e);
        if (target) {
          setAssetDropPreview({
            row: target.row,
            fromFrame: target.frame,
            durationFrames: assetDragDurationRef.current,
          });
        }
      }
    },
    [getDropTargetFromEvent]
  );

  const handleAssetDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if we're actually leaving the timeline (not entering a child)
    const related = e.relatedTarget as Node | null;
    if (related && timelineRef.current?.contains(related)) return;
    setIsAssetDragOver(false);
    setAssetDropPreview(null);
  }, [timelineRef]);

  const handleAssetDrop = useCallback((e: React.DragEvent) => {
    setIsAssetDragOver(false);
    setAssetDropPreview(null);
    const raw = e.dataTransfer.getData("application/x-perpetual-asset");
    if (!raw) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      const asset = JSON.parse(raw);
      const canvas = getAspectRatioDimensions();

      // Determine duration in frames based on asset type
      let durFrames: number;
      if (asset.type === "video" || asset.type === "audio") {
        durFrames = asset.duration ? Math.round(asset.duration * 30) : 150;
      } else if (asset.type === "text") {
        durFrames = 90;
      } else if (asset.type === "shape") {
        durFrames = 150;
      } else {
        durFrames = 200; // image default
      }

      // Use cursor position to determine placement (row + frame)
      const target = getDropTargetFromEvent(e);
      let from: number;
      let row: number;

      if (target) {
        // Apply displacement logic: snap to existing clips and push them aside
        const { finalFrom, displaced } = computeDropDisplacement(
          overlays, -1, target.frame, durFrames, target.row
        );
        from = finalFrom;
        row = target.row;

        // Push displaced overlays out of the way (atomic batch)
        if (displaced.length > 0 && batchUpdate) {
          batchUpdate(displaced.map((d) => ({ id: d.id, overlay: { from: d.from } })));
        } else {
          for (const d of displaced) {
            const existing = overlays.find((o) => o.id === d.id);
            if (existing) {
              onOverlayChange({ ...existing, from: d.from });
            }
          }
        }
      } else {
        // Fallback: auto-position if we couldn't determine cursor target
        const typeMap: Record<string, OverlayType> = {
          video: OverlayType.VIDEO, image: OverlayType.IMAGE,
          audio: OverlayType.SOUND,
          text: OverlayType.TEXT, shape: OverlayType.SHAPE,
        };
        const pos = findSmartPositionForType(overlays, durFrames, typeMap[asset.type] || OverlayType.VIDEO);
        from = pos.from;
        row = pos.row;
      }

      if (asset.type === "image") {
        const img = new window.Image();
        img.onload = () => {
          const natW = img.naturalWidth || canvas.width;
          const natH = img.naturalHeight || canvas.height;
          const scale = Math.min(canvas.width / natW, canvas.height / natH, 1);
          const w = Math.round(natW * scale);
          const h = Math.round(natH * scale);
          addOverlay({
            left: Math.round((canvas.width - w) / 2), top: Math.round((canvas.height - h) / 2),
            width: w, height: h, durationInFrames: durFrames, from,
            id: Date.now(), rotation: 0, row, isDragging: false,
            type: OverlayType.IMAGE, src: asset.src,
            styles: { objectFit: "cover", animation: { enter: "fadeIn", exit: "fadeOut" } },
          });
        };
        img.onerror = () => {
          addOverlay({
            left: 0, top: 0, width: canvas.width, height: canvas.height,
            durationInFrames: durFrames, from, id: Date.now(),
            rotation: 0, row, isDragging: false,
            type: OverlayType.IMAGE, src: asset.src,
            styles: { objectFit: "cover", animation: { enter: "fadeIn", exit: "fadeOut" } },
          });
        };
        img.src = asset.src;
      } else if (asset.type === "video") {
        addOverlay({
          left: 0, top: 0, width: canvas.width, height: canvas.height,
          durationInFrames: durFrames, maxDuration: durFrames,
          from, id: Date.now(), rotation: 0, row, isDragging: false,
          type: OverlayType.VIDEO, content: asset.name || 'Video', src: asset.src, videoStartTime: 0,
          styles: { opacity: 1, zIndex: 100, transform: "none", objectFit: "cover" },
        });
      } else if (asset.type === "audio") {
        addOverlay({
          id: Date.now(), type: OverlayType.SOUND, content: asset.name, src: asset.src,
          from, row, left: 0, top: 0, width: 1920, height: 100,
          rotation: 0, isDragging: false, durationInFrames: durFrames,
          maxDuration: durFrames, styles: { opacity: 1 },
        });
      } else if (asset.type === "text") {
        const textWidth = Math.round(canvas.width * 0.8);
        const textHeight = Math.round(canvas.height * 0.15);
        const textLeft = Math.round((canvas.width - textWidth) / 2);
        const textTop = Math.round((canvas.height - textHeight) / 2);
        addOverlay({
          left: textLeft, top: textTop, width: textWidth, height: textHeight,
          durationInFrames: durFrames, from, id: Date.now(),
          rotation: 0, row, isDragging: false, type: OverlayType.TEXT,
          content: asset.content ?? "Text",
          styles: {
            ...asset.styles,
            fontSize: "3rem",
            opacity: 1,
            zIndex: 1,
            transform: "none",
            textAlign: asset.styles?.textAlign || "center",
          },
        });
      } else if (asset.type === "shape") {
        const isLine = asset.isLine === true;
        addOverlay({
          left: 100, top: 100,
          width: asset.defaultW || 200, height: asset.defaultH || 150,
          aspectRatioLocked: false,
          durationInFrames: durFrames, from, id: Date.now(),
          rotation: 0, row, isDragging: false, type: OverlayType.SHAPE,
          content: asset.shapeKey,
          styles: isLine
            ? { fill: "none", stroke: "#a78bfa", strokeWidth: 4, strokeLinecap: "round", opacity: 1 }
            : { fill: "#a78bfa", stroke: "none", strokeWidth: 0, opacity: 1, ...(asset.shapeKey === "rounded-rect" ? { cornerRadius: 15 } : {}) },
        });
      }
    } catch (err) {
      console.error("Failed to handle asset drop:", err);
    }
  }, [addOverlay, overlays, durationInFrames, getAspectRatioDimensions, totalVisibleRows, findSmartPositionForType, getDropTargetFromEvent, onOverlayChange]);

  // State for tracking hover position during split operations
  const [lastKnownHoverInfo, setLastKnownHoverInfo] = useState<{
    itemId: number;
    position: number;
  } | null>(null);

  // Ref to track if a timeline item was clicked (to prevent playhead from moving)
  const clickedOnItemRef = useRef(false);

  // State for context menu visibility
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);

  // Custom hooks for timeline functionality
  const {
    isDragging,
    draggedItem,
    ghostElement,
    ghostMarkerPosition,
    dragInfo,
    handleDragStart: timelineStateHandleDragStart,
    updateGhostElement,
    resetDragState,
    setGhostMarkerPosition,
    displacementPreview,
    setDisplacementPreview,
  } = useTimelineState(durationInFrames, totalVisibleRows, timelineRef);

  const { handleDragStart, handleDrag, handleDragEnd } = useTimelineDragAndDrop(
    {
      overlays,
      durationInFrames,
      onOverlayChange,
      batchUpdate,
      updateGhostElement,
      resetDragState,
      timelineRef,
      dragInfo,
      maxRows: totalVisibleRows,
      setDisplacementPreview,
      snapEnabled,
      setSnapLines,
    }
  );

  // Ref for the ticks/ruler area — ghost marker + seeking limited to this zone
  const ticksRef = useRef<HTMLDivElement>(null);

  const { handleMouseMove, handleTouchMove, handleTimelineMouseLeave } =
    useTimelineEventHandlers({
      handleDrag,
      handleDragEnd,
      isDragging,
      timelineRef,
      ticksRef,
      setGhostMarkerPosition,
    });

  // Event Handlers
  const combinedHandleDragStart = useCallback(
    (
      overlay: Overlay,
      clientX: number,
      clientY: number,
      action: "move" | "resize-start" | "resize-end"
    ) => {
      timelineStateHandleDragStart(overlay, clientX, clientY, action);
      handleDragStart(overlay, clientX, clientY, action);
    },
    [timelineStateHandleDragStart, handleDragStart]
  );

  const handleTimelineClick = useCallback(
    (clickPosition: number) => {
      const newFrame = Math.round(clickPosition * durationInFrames);
      setCurrentFrame(newFrame);
    },
    [durationInFrames, setCurrentFrame]
  );

  const handleDeleteItem = useCallback(
    (id: number) => onOverlayDelete(id),
    [onOverlayDelete]
  );

  const handleDuplicateItem = useCallback(
    (id: number) => onOverlayDuplicate(id),
    [onOverlayDuplicate]
  );

  const handleItemHover = useCallback(
    (itemId: number, hoverPosition: number) => {
      setLastKnownHoverInfo({
        itemId,
        position: Math.round(hoverPosition),
      });
    },
    []
  );

  const handleSplitItem = useCallback(
    (id: number) => {
      if (lastKnownHoverInfo?.itemId === id) {
        onSplitOverlay(id, lastKnownHoverInfo.position);
      }
    },
    [lastKnownHoverInfo, onSplitOverlay]
  );

  const handleContextMenuChange = useCallback(
    (isOpen: boolean) => setIsContextMenuOpen(isOpen),
    []
  );

  const handleRemoveGap = useCallback(
    (rowIndex: number, gapStart: number) => {
      // Find all items that come after the gap in the same row
      const overlaysToShift = overlays
        .filter(
          (overlay) => overlay.row === rowIndex && overlay.from > gapStart
        )
        .sort((a, b) => a.from - b.from);

      if (overlaysToShift.length === 0) return;

      // Calculate the gap size based on the first overlay after the gap
      const firstOverlayAfterGap = overlaysToShift[0];
      const gapSize = firstOverlayAfterGap.from - gapStart;

      // Create all updates at once
      const updates = overlaysToShift.map((overlay) => ({
        ...overlay,
        from: overlay.from - gapSize,
      }));

      // Apply all updates (atomic batch)
      if (batchUpdate) {
        batchUpdate(updates.map((u) => ({ id: u.id, overlay: { from: u.from } })));
      } else {
        updates.forEach((update) => onOverlayChange(update));
      }
    },
    [overlays, onOverlayChange, batchUpdate]
  );

  // Track which rows have content (for drag handle visibility)
  const occupiedRows = useMemo(() => {
    const rows = new Set<number>();
    overlays.forEach((o) => rows.add(o.row ?? 0));
    return rows;
  }, [overlays]);

  const handleReorderRows = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    // Only reorder if the source row has content
    if (!occupiedRows.has(fromIndex)) return;

    // Insert-based reorder: move fromIndex row to toIndex, shifting others
    const updatedOverlays = overlays.map((overlay) => {
      const row = overlay.row ?? 0;
      if (row === fromIndex) {
        return { ...overlay, row: toIndex };
      }
      // Shift rows between from and to
      if (fromIndex < toIndex) {
        // Moving down: rows between (from, to] shift up by 1
        if (row > fromIndex && row <= toIndex) {
          return { ...overlay, row: row - 1 };
        }
      } else {
        // Moving up: rows between [to, from) shift down by 1
        if (row >= toIndex && row < fromIndex) {
          return { ...overlay, row: row + 1 };
        }
      }
      return overlay;
    });

    setOverlays(updatedOverlays);
  };

  // Add state for row dragging
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);

  // Add visual feedback state
  const [isDraggingRow, setIsDraggingRow] = useState(false);

  const handleRowDragStart = (_e: React.DragEvent, rowIndex: number) => {
    // Only allow dragging rows that have content
    if (!occupiedRows.has(rowIndex)) {
      _e.preventDefault();
      return;
    }
    setDraggedRowIndex(rowIndex);
    setIsDraggingRow(true);
  };

  const handleRowDragOver = (e: React.DragEvent, rowIndex: number) => {
    e.preventDefault();
    if (draggedRowIndex === null) return;
    // Determine if we're in the top or bottom half of the row
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertIndex = e.clientY < midY ? rowIndex : rowIndex + 1;
    setDragOverRowIndex(insertIndex);
  };

  const handleRowDrop = () => {
    if (draggedRowIndex === null || dragOverRowIndex === null) {
      setDraggedRowIndex(null);
      setDragOverRowIndex(null);
      setIsDraggingRow(false);
      return;
    }
    // Adjust target: if inserting after the dragged row, account for the shift
    const target = dragOverRowIndex > draggedRowIndex ? dragOverRowIndex - 1 : dragOverRowIndex;
    // Clamp target to valid range
    const clampedTarget = Math.max(0, Math.min(target, totalVisibleRows - 1));
    handleReorderRows(draggedRowIndex, clampedTarget);
    setDraggedRowIndex(null);
    setDragOverRowIndex(null);
    setIsDraggingRow(false);
  };

  const handleRowDragEnd = () => {
    setDraggedRowIndex(null);
    setDragOverRowIndex(null);
    setIsDraggingRow(false);
  };

  useEffect(() => {
    const element = timelineRef.current;
    if (!element) return;

    element.addEventListener("wheel", handleWheelZoom, { passive: false });
    return () => element.removeEventListener("wheel", handleWheelZoom);
  }, [handleWheelZoom]);

  // Replace the loading state management with context
  const {
    isLoadingAssets,
    isInitialLoad,
    handleAssetLoadingChange,
    setInitialLoadComplete,
  } = useAssetLoading();

  // Effect to handle initial load completion
  const [shouldShowInitialLoader, setShouldShowInitialLoader] = useState(false);

  useEffect(() => {
    const hasVideoOverlay = overlays.some(
      (overlay) => overlay.type === OverlayType.VIDEO
    );

    if (!shouldShowInitialLoader && hasVideoOverlay && isInitialLoad) {
      setShouldShowInitialLoader(true);
    }

    if (overlays.length > 0 && !isLoadingAssets) {
      setInitialLoadComplete();
    }
  }, [
    overlays,
    isInitialLoad,
    isLoadingAssets,
    shouldShowInitialLoader,
    setInitialLoadComplete,
  ]);

  // Render
  return (
    <div className="flex flex-col">
      <div className="flex ">
        {/* Row Drag Handles Column */}
        <div className="w-5 flex-shrink-0 border-r border-zinc-200/50 dark:border-zinc-800">
          {/* Match TimeMarkers height */}
          <div className="h-[30px]" />

          {/* Match the grid layout exactly */}
          <div
            className="flex flex-col gap-2 pt-2 pb-2"
            style={{ height: `${timelineHeight}px` }}
          >
            {Array.from({ length: totalVisibleRows }).map((_, rowIndex) => {
              const hasContent = occupiedRows.has(rowIndex);
              return (
                <div
                  key={`drag-${rowIndex}`}
                  className={`flex-1 flex items-center justify-center transition-all duration-200
                    ${draggedRowIndex === rowIndex ? "opacity-40" : ""}
                    ${isDraggingRow ? "cursor-grabbing" : ""}`}
                  onDragOver={(e) => handleRowDragOver(e, rowIndex)}
                  onDrop={() => handleRowDrop()}
                >
                  {hasContent ? (
                    <div
                      className={`w-4 h-4 flex items-center justify-center rounded
                        transition-opacity duration-150
                        ${isDraggingRow ? "cursor-grabbing" : "cursor-grab"}
                        group`}
                      draggable
                      onDragStart={(e) => handleRowDragStart(e, rowIndex)}
                      onDragEnd={handleRowDragEnd}
                    >
                      <Grip
                        className="w-2.5 h-2.5 text-zinc-300 dark:text-zinc-600
                        group-hover:text-zinc-500 dark:group-hover:text-zinc-400
                        transition-colors duration-150"
                      />
                    </div>
                  ) : (
                    <div className="w-4 h-4" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline Content */}
        <div
          className="relative overflow-x-auto scrollbar-hide flex-1"
          style={{
            scrollbarWidth: "none" /* Firefox */,
            msOverflowStyle: "none" /* IE and Edge */,
          }}
        >
          <div
            ref={timelineRef}
            className="pr-2 pb-2 relative bg-white dark:bg-zinc-950"
            style={{
              width: `${100 * zoomScale}%`,
              minWidth: "100%",
            }}
            onMouseMove={handleMouseMove}
            onTouchMove={handleTouchMove}
            onMouseUp={handleDragEnd}
            onTouchEnd={handleDragEnd}
            onMouseLeave={handleTimelineMouseLeave}
            onDragOver={handleAssetDragOver}
            onDragLeave={handleAssetDragLeave}
            onDrop={handleAssetDrop}
            onClick={(e) => {
              // Clip selection is handled by TimelineItem's own click handler
              // which sets clickedOnItemRef. Seeking is only via the ticks area
              // (TimeMarkers has its own onClick), so we just reset the ref here.
              if (clickedOnItemRef.current) {
                clickedOnItemRef.current = false;
                return;
              }
              // Don't seek when clicking on clip rows — seeking is limited to ticks area
            }}
          >
            <div className="relative h-full">
              {/* Timeline header with frame markers — taller for easy click target, seeking only here */}
              {/* pb-2 extends the clickable area into the gap above the first row */}
              <div ref={ticksRef} className="h-[30px] pb-2 box-content relative cursor-pointer" onClick={onTimelineClick}>
                <TimeMarkers
                  durationInFrames={durationInFrames}
                  zoomScale={zoomScale}
                />
              </div>

              {/* Current frame indicator */}
              <TimelineMarker
                currentFrame={currentFrame}
                totalDuration={durationInFrames}
              />

              {/* Drag operation visual feedback */}
              <GhostMarker
                position={ghostMarkerPosition}
                isDragging={isDragging}
                isContextMenuOpen={isContextMenuOpen}
              />

              {/* Main timeline grid with overlays */}
              <TimelineGrid
                overlays={overlays}
                visibleRows={totalVisibleRows}
                timelineHeight={timelineHeight}
                currentFrame={currentFrame}
                isDragging={isDragging}
                draggedItem={draggedItem}
                selectedOverlayId={selectedOverlayId}
                setSelectedOverlayId={(id) => {
                  clickedOnItemRef.current = true;
                  setSelectedOverlayId(id);
                }}
                handleDragStart={combinedHandleDragStart}
                totalDuration={durationInFrames}
                ghostElement={ghostElement}
                onDeleteItem={handleDeleteItem}
                onDuplicateItem={handleDuplicateItem}
                onSplitItem={handleSplitItem}
                onHover={handleItemHover}
                onContextMenuChange={handleContextMenuChange}
                onRemoveGap={handleRemoveGap}
                zoomScale={zoomScale}
                onReorderRows={handleReorderRows}
                draggedRowIndex={draggedRowIndex}
                dragOverRowIndex={dragOverRowIndex}
                onAssetLoadingChange={handleAssetLoadingChange}
                assetDropPreview={assetDropPreview}
                displacementPreview={displacementPreview}
                snapLines={snapLines}
              />

              {/* Loading Indicator - Only shows during initial project load */}
              {SHOW_LOADING_PROJECT_ALERT &&
                isLoadingAssets &&
                isInitialLoad &&
                shouldShowInitialLoader && (
                  <div
                    className="absolute inset-0 bg-white/60 dark:bg-background/60 backdrop-blur-[1px] flex items-center justify-center z-50"
                    style={{ willChange: "opacity" }}
                  >
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/90 dark:bg-card/90 rounded-lg shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-600 dark:text-gray-300" />
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        Loading project...
                      </span>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Timeline;
