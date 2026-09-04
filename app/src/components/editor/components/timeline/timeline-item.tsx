import React, { useCallback, useMemo, memo, useRef } from "react";
import { Clapperboard } from "lucide-react";
import { Overlay, OverlayType, ClipOverlay, SoundOverlay } from "../../types";
import { useWaveformProcessor } from "../../hooks/use-waveform-processor";
import WaveformVisualizer from "../overlays/sounds/waveform-visualizer";

import { TimelineItemHandle } from "./timeline-item-handle";
import { TimelineItemContextMenu } from "./timeline-item-context-menu";
import { TimelineItemLabel } from "./timeline-item-label";
import { ZoomIndicators } from "./zoom-indicators";
import { useEditorContext } from "../../contexts/editor-context";

/**
 * TimelineItem Component
 *
 * A draggable, resizable item displayed on the video editor timeline. Each item represents
 * a clip, text overlay, or sound element in the video composition.
 *
 * Features:
 * - Draggable positioning
 * - Resizable handles on both ends
 * - Context menu for quick actions
 * - Touch support for mobile devices
 * - Visual feedback for selection and dragging states
 * - Color-coded by content type (text, clip, sound)
 *
 * @component
 */

// Add new interface for waveform data
interface WaveformData {
  peaks: number[];
  length: number;
}

interface TimelineItemProps {
  /** The overlay item data to be rendered */
  item: Overlay;
  /** Whether any item is currently being dragged */
  isDragging: boolean;
  /** Reference to the item currently being dragged, if any */
  draggedItem: Overlay | null;
  /** Currently selected item in the timeline */
  selectedItem: { id: number } | null;
  /** Callback to update the selected item */
  setSelectedItem: (item: { id: number }) => void;
  /** Handler for mouse-based drag and resize operations */
  handleMouseDown: (
    action: "move" | "resize-start" | "resize-end",
    e: React.MouseEvent<HTMLDivElement>
  ) => void;
  /** Handler for touch-based drag and resize operations */
  handleTouchStart: (
    action: "move" | "resize-start" | "resize-end",
    e: React.TouchEvent<HTMLDivElement>
  ) => void;
  /** Total duration of the timeline in frames */
  totalDuration: number;
  /** Callback to delete an item */
  onDeleteItem: (id: number) => void;
  /** Callback to duplicate an item */
  onDuplicateItem: (id: number) => void;
  /** Callback to split an item at the current position */
  onSplitItem: (id: number) => void;
  /** Callback fired when hovering over an item */
  onHover: (itemId: number, position: number) => void;
  /** Callback fired when context menu state changes */
  onContextMenuChange: (open: boolean) => void;
  /** Waveform data for audio items */
  waveformData?: WaveformData;
  /** Current Frame of the video */
  currentFrame?: number;
  /** Zoom scale of the timeline */
  zoomScale: number;
  /** Callback when asset loading state changes */
  onAssetLoadingChange?: (overlayId: number, isLoading: boolean) => void;
  /** Preview start frame during displacement drag (undefined = no preview) */
  previewFrom?: number;
}

/** Height of each timeline item in pixels */
export const TIMELINE_ITEM_HEIGHT = 40;

const TimelineItem: React.FC<TimelineItemProps> = ({
  item,
  isDragging,
  draggedItem,
  selectedItem,
  setSelectedItem,
  handleMouseDown,
  handleTouchStart,
  totalDuration,
  onDeleteItem,
  onDuplicateItem,
  onSplitItem,
  onHover,
  onContextMenuChange,
  currentFrame,
  zoomScale,
  onAssetLoadingChange,
  previewFrom,
}) => {
  const waveformData = useWaveformProcessor(
    item.type === OverlayType.SOUND ? item.src : undefined,
    item.type === OverlayType.SOUND ? item.startFromSound : undefined,
    item.durationInFrames
  );

  const { selectedOverlayIds } = useEditorContext();
  const isSelected = selectedItem?.id === item.id || selectedOverlayIds.includes(item.id);
  const itemRef = useRef<HTMLDivElement>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);

  /**
   * Handles mouse and touch interactions with the timeline item.
   * Distinguishes between clicks (select) and drags (move) using a 3px threshold.
   */
  const handleItemInteraction = (
    e: React.MouseEvent | React.TouchEvent,
    action: "click" | "mousedown" | "touchstart"
  ) => {
    e.stopPropagation();
    if (action === "click") {
      // Only select if we didn't drag
      if (!didDragRef.current) {
        setSelectedItem({ id: item.id });
      }
      didDragRef.current = false;
    } else if (action === "mousedown") {
      const me = e as React.MouseEvent<HTMLDivElement>;
      mouseDownPosRef.current = { x: me.clientX, y: me.clientY };
      didDragRef.current = false;

      // Track movement to detect drag vs click
      const onMove = (ev: MouseEvent) => {
        if (!mouseDownPosRef.current) return;
        const dx = ev.clientX - mouseDownPosRef.current.x;
        const dy = ev.clientY - mouseDownPosRef.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          didDragRef.current = true;
        }
      };
      const onUp = () => {
        mouseDownPosRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);

      handleMouseDown("move", me);
    } else if (action === "touchstart") {
      handleTouchStart("move", e as React.TouchEvent<HTMLDivElement>);
    }
  };

  /**
   * Calculates and reports the hover position within the item
   * Used for showing precise position indicators while hovering
   */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!e.currentTarget) {
        console.warn("Current target is null or undefined");
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect) {
        console.warn("getBoundingClientRect returned null or undefined");
        return;
      }
      const relativeX = e.clientX - rect.left;
      const hoverPosition =
        item.from + (relativeX / rect.width) * item.durationInFrames;
      onHover(item.id, Math.round(hoverPosition));
    },
    [item, onHover]
  );

  /**
   * Returns Tailwind CSS classes for styling based on content type
   */
  const getItemClasses = (
    type: OverlayType,
    isHandle: boolean = false
  ): string => {
    switch (type) {
      case OverlayType.TEXT:
        return isHandle
          ? "bg-purple-500"
          : "bg-purple-300 dark:bg-purple-500/15 border-l-2 border-l-purple-600 dark:border-l-purple-500 text-black dark:text-purple-300";
      case OverlayType.VIDEO:
        return isHandle
          ? "bg-sky-500"
          : "bg-sky-300 dark:bg-sky-500/15 border-l-2 border-l-sky-600 dark:border-l-sky-500 text-black dark:text-sky-300";
      case OverlayType.SOUND:
        return isHandle
          ? "bg-amber-500"
          : "bg-amber-300 dark:bg-amber-500/15 border-l-2 border-l-amber-600 dark:border-l-amber-500 text-black dark:text-amber-300";
      case OverlayType.IMAGE:
        return isHandle
          ? "bg-teal-500"
          : "bg-teal-300 dark:bg-emerald-500/15 border-l-2 border-l-teal-600 dark:border-l-emerald-500 text-black dark:text-emerald-300";
      case OverlayType.SHAPE:
        return isHandle
          ? "bg-pink-500"
          : "bg-pink-300 dark:bg-pink-500/15 border-l-2 border-l-pink-600 dark:border-l-pink-500 text-black dark:text-pink-300";
      case OverlayType.CAPTION:
        return isHandle
          ? "bg-indigo-500"
          : "bg-indigo-300 dark:bg-indigo-500/15 border-l-2 border-l-indigo-600 dark:border-l-indigo-500 text-black dark:text-indigo-300";
      default:
        return isHandle
          ? "bg-zinc-400 dark:bg-zinc-600"
          : "bg-zinc-300 dark:bg-zinc-800 border-l-2 border-l-zinc-400 dark:border-l-zinc-600 text-black dark:text-zinc-300";
    }
  };

  const itemClasses = useMemo(() => getItemClasses(item.type), [item.type]);

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!didDragRef.current) {
      setSelectedItem({ id: item.id });
    }
    didDragRef.current = false;
  };

  const renderContent = () => {
    return (
      <>
        {item.type === OverlayType.IMAGE ? (
          <div className="h-full w-full flex items-center">
            <img
              src={item.src}
              alt=""
              draggable="false"
              onDragStart={(e) => e.preventDefault()}
              className="h-7 w-auto rounded-[1px] ml-6 object-cover"
            />
          </div>
        ) : item.type === OverlayType.VIDEO ? (
          <div className="h-full w-full flex items-center overflow-hidden">
            <video
              src={`${(item as ClipOverlay).src}#t=${(item as ClipOverlay).videoStartTime ?? 0}`}
              muted
              preload="metadata"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              className="h-7 w-auto rounded-[2px] ml-6 object-cover flex-shrink-0"
            />
            <div className="flex items-center text-[9px] rounded-[2px] px-1.5 py-0.5 ml-1.5 bg-sky-400/30 text-black dark:bg-sky-200/20 dark:text-sky-200 flex-shrink-0">
              <Clapperboard className="w-2 h-2 mr-0.5 flex-shrink-0" />
              <span className="truncate max-w-[100px]">
                {(() => {
                  const clip = item as ClipOverlay;
                  // Older projects stored the thumbnail here, which is not a caption.
                  const raw = clip.content && clip.content !== clip.src ? clip.content : '';
                  const name = raw.startsWith('data:') ? '' : raw;
                  if (name) return name.length > 20 ? name.slice(0, 18) + '…' : name;
                  return 'Video';
                })()}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center px-2">
            <TimelineItemLabel item={item} isSelected={isSelected} />
          </div>
        )}
        {item.type === OverlayType.SOUND && waveformData && (
          <div className="absolute inset-0">
            <WaveformVisualizer waveformData={waveformData} zoomScale={zoomScale} />
          </div>
        )}
        {item.type === OverlayType.SOUND && (() => {
          const sound = item as SoundOverlay;
          const fadeIn = sound.styles?.fadeIn ?? 0;
          const fadeOut = sound.styles?.fadeOut ?? 0;
          if (fadeIn === 0 && fadeOut === 0) return null;
          const totalFrames = sound.durationInFrames;
          return (
            <>
              {fadeIn > 0 && (
                <div
                  className="absolute top-0 bottom-0 left-0 z-10 pointer-events-none"
                  style={{ width: `${(fadeIn / totalFrames) * 100}%` }}
                >
                  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <polygon points="0,0 100,0 0,100" fill="rgba(0,0,0,0.45)" />
                    <line x1="0" y1="100" x2="100" y2="0" stroke="rgba(251,191,36,0.7)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  </svg>
                </div>
              )}
              {fadeOut > 0 && (
                <div
                  className="absolute top-0 bottom-0 right-0 z-10 pointer-events-none"
                  style={{ width: `${(fadeOut / totalFrames) * 100}%` }}
                >
                  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <polygon points="100,0 0,0 100,100" fill="rgba(0,0,0,0.45)" />
                    <line x1="0" y1="0" x2="100" y2="100" stroke="rgba(251,191,36,0.7)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  </svg>
                </div>
              )}
            </>
          );
        })()}
        {item.type === OverlayType.VIDEO && (
          <ZoomIndicators
            overlay={item as ClipOverlay}
            currentFrame={currentFrame ?? 0}
            zoomScale={zoomScale}
          />
        )}
      </>
    );
  };

  return (
    <TimelineItemContextMenu
      onOpenChange={onContextMenuChange}
      onDeleteItem={onDeleteItem}
      onDuplicateItem={onDuplicateItem}
      onSplitItem={onSplitItem}
      itemId={item.id}
      itemType={item.type}
    >
      <div
        ref={itemRef}
        className={`absolute inset-y-[0.9px] rounded-[4px] cursor-grab group
        ${itemClasses}
        ${isDragging && draggedItem?.id === item.id ? "opacity-50 !border-2 !border-dashed !border-primary/70 !ring-0" : ""}
        ${
          isSelected && !(isDragging && draggedItem?.id === item.id)
            ? "ring-[1.5px] ring-black dark:ring-white"
            : ""
        }
        ${previewFrom !== undefined ? "ring-1 ring-primary/40" : ""}
        select-none pointer-events-auto overflow-hidden`}
        style={{
          left: `${((previewFrom !== undefined ? previewFrom : item.from) / totalDuration) * 100}%`,
          width: `${(item.durationInFrames / totalDuration) * 100}%`,
          zIndex: isDragging ? 1 : 30,
          transition: previewFrom !== undefined ? "left 75ms ease-out" : undefined,
        }}
        onMouseDown={(e) => handleItemInteraction(e, "mousedown")}
        onTouchStart={(e) => handleItemInteraction(e, "touchstart")}
        onClick={handleSelect}
        onMouseMove={handleMouseMove}
      >
        {renderContent()}
        <TimelineItemHandle
          position="left"
          isSelected={isSelected}
          onMouseDown={(e) => {
            e.stopPropagation();
            handleMouseDown("resize-start", e);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            handleTouchStart("resize-start", e);
          }}
        />
        <TimelineItemHandle
          position="right"
          isSelected={isSelected}
          onMouseDown={(e) => {
            e.stopPropagation();
            handleMouseDown("resize-end", e);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            handleTouchStart("resize-end", e);
          }}
        />
      </div>
    </TimelineItemContextMenu>
  );
};

export default memo(TimelineItem);
