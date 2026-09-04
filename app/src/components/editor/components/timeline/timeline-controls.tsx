import React, { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Scissors,
  Trash2,
  Copy,
  Magnet,
} from "lucide-react";
import { useEditorContext } from "../../contexts/editor-context";
import { useTimeline } from "../../contexts/timeline-context";
import { OverlayType } from "../../types";
import {
  ZOOM_CONSTRAINTS,
  SHOW_LOADING_PROJECT_ALERT,
} from "../../constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTimelineShortcuts } from "../../hooks/use-timeline-shortcuts";
import { useAssetLoading } from "../../contexts/asset-loading-context";

interface TimelineControlsProps {
  isPlaying: boolean;
  togglePlayPause: () => void;
  currentFrame: number;
  /** Padded timeline duration — used for playhead/scroll positioning. */
  timelineTotalDuration: number;
  formatTime: (frames: number) => string;
}

export const TimelineControls: React.FC<TimelineControlsProps> = ({
  isPlaying,
  togglePlayPause,
  currentFrame,
  timelineTotalDuration,
  formatTime,
}) => {
  const {
    undo,
    redo,
    canUndo,
    canRedo,
    selectedOverlayId,
    deleteOverlay,
    duplicateOverlay,
    splitOverlay,
    durationInFrames: contentDuration,
  } = useEditorContext();

  const { zoomScale, setZoomScale, handleZoom, timelineRef, snapEnabled, setSnapEnabled } = useTimeline();

  useTimelineShortcuts({
    handlePlayPause: () => {
      togglePlayPause();
    },
    undo,
    redo,
    canUndo,
    canRedo,
    zoomScale,
    setZoomScale,
  });

  const { isLoadingAssets } = useAssetLoading();

  const prevFrameRef = React.useRef(currentFrame);
  const isPlayingRef = React.useRef(isPlaying);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (isPlayingRef.current) {
      if (prevFrameRef.current > contentDuration - 2 && currentFrame === 0) {
        togglePlayPause();
      }
    }
    prevFrameRef.current = currentFrame;
  }, [currentFrame, contentDuration, togglePlayPause]);

  // Get the playhead's screen X position so zoom centers around cursor
  const getPlayheadClientX = useCallback(() => {
    const scrollContainer = timelineRef.current?.parentElement;
    if (!scrollContainer) return 0;
    const rect = scrollContainer.getBoundingClientRect();
    // Playhead position in timeline pixels (uses timeline padded duration)
    const playheadX = (currentFrame / timelineTotalDuration) * (timelineRef.current?.scrollWidth ?? 0);
    // Convert to screen X
    const clientX = rect.left + playheadX - scrollContainer.scrollLeft;
    // Clamp to visible area
    return Math.max(rect.left, Math.min(rect.right, clientX));
  }, [timelineRef, currentFrame, timelineTotalDuration]);

  const handleZoomOut = () => {
    handleZoom(-1, getPlayheadClientX());
  };

  const handleZoomIn = () => {
    handleZoom(1, getPlayheadClientX());
  };

  const handleFitTimeline = () => {
    setZoomScale(ZOOM_CONSTRAINTS.min);
  };

  const { overlays } = useEditorContext();
  const hasSelection = selectedOverlayId !== null;
  const selectedOverlay = hasSelection ? overlays.find((o) => o.id === selectedOverlayId) : null;
  const canSplit = hasSelection && (selectedOverlay?.type === OverlayType.VIDEO || selectedOverlay?.type === OverlayType.SOUND);

  const actionBtnClass = "h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:text-muted-foreground/40 disabled:opacity-100";
  const zoomBtnClass = "h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted/80";
  const tooltipClass = "bg-popover text-popover-foreground text-xs px-2 py-1 rounded-md z-[9999] border border-border";
  const kbdClass = "px-1 py-0.5 text-[10px] font-mono bg-foreground text-background rounded-md border border-border";

  return (
    <div className="flex justify-between items-center border-b border-border bg-background/95 px-3 py-1 backdrop-blur-sm">
      {/* Left section: Split / Delete / Duplicate */}
      <div className="flex items-center gap-0.5">
        <TooltipProvider delayDuration={50}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => canSplit && splitOverlay(selectedOverlayId!, currentFrame)}
                disabled={!canSplit}
                size="icon"
                variant="ghost"
                className={actionBtnClass}
              >
                <Scissors className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={5} className={tooltipClass}>
              Split
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => hasSelection && deleteOverlay(selectedOverlayId!)}
                disabled={!hasSelection}
                size="icon"
                variant="ghost"
                className={actionBtnClass}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={5} className={tooltipClass}>
              <div className="flex items-center gap-1">
                Delete
                <kbd className={kbdClass}>⌫</kbd>
              </div>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => hasSelection && duplicateOverlay(selectedOverlayId!)}
                disabled={!hasSelection}
                size="icon"
                variant="ghost"
                className={actionBtnClass}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={5} className={tooltipClass}>
              <div className="flex items-center gap-1">
                Duplicate
                <kbd className={kbdClass}>⌘D</kbd>
              </div>
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-4 bg-border mx-0.5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setSnapEnabled(!snapEnabled)}
                size="icon"
                variant="ghost"
                className={`${actionBtnClass} ${snapEnabled ? '!text-primary' : ''}`}
              >
                <Magnet className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={5} className={tooltipClass}>
              {snapEnabled ? 'Snap to edges (on)' : 'Snap to edges (off)'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {!SHOW_LOADING_PROJECT_ALERT && isLoadingAssets && (
          <div className="flex items-center gap-2 px-2 py-0.5 bg-blue-50/90 dark:bg-blue-900/20 rounded-md ml-1">
            <Loader2 className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300">
              Loading...
            </span>
          </div>
        )}
      </div>

      {/* Center section: Play/Pause control and time display */}
      <div className="flex items-center space-x-2">
        <TooltipProvider delayDuration={50}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={togglePlayPause}
                size="sm"
                variant="default"
                className="h-7 bg-muted hover:bg-muted/80"
              >
                {isPlaying ? (
                  <Pause className="h-3 w-3 text-foreground" />
                ) : (
                  <Play className="h-3 w-3 text-foreground" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={5} className={tooltipClass}>
              <div className="flex items-center gap-1">
                {isPlaying ? "Pause" : "Play"}
                <kbd className={kbdClass}>⌥ Space</kbd>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="flex items-center space-x-1">
          <span className="text-xs font-medium text-foreground tabular-nums">
            {formatTime(currentFrame)}
          </span>
          <span className="text-xs font-medium text-muted-foreground/50">
            /
          </span>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {formatTime(contentDuration)}
          </span>
        </div>
      </div>

      {/* Right section: Zoom controls + Fit */}
      <div className="flex items-center gap-1">
        <TooltipProvider delayDuration={50}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleFitTimeline}
                size="icon"
                variant="ghost"
                className={zoomBtnClass}
              >
                <Maximize className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={5} className={tooltipClass}>
              Fit timeline
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="w-px h-4 bg-border mx-0.5" />
        <Button
          onClick={handleZoomOut}
          disabled={zoomScale <= ZOOM_CONSTRAINTS.min}
          size="icon"
          variant="ghost"
          className={zoomBtnClass}
        >
          <ZoomOut className="h-3 w-3" />
        </Button>
        <Button
          onClick={handleZoomIn}
          disabled={zoomScale >= ZOOM_CONSTRAINTS.max}
          size="icon"
          variant="ghost"
          className={zoomBtnClass}
        >
          <ZoomIn className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};
