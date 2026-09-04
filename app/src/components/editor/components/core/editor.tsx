
import React, { useState, useCallback, useRef } from "react";
import { useEditorContext } from "../../contexts/editor-context";
import { TimelineControls } from "../timeline/timeline-controls";
import { FPS, ROW_HEIGHT, MAX_ROWS, MIN_DISPLAY_ROWS } from "../../constants";
import Timeline from "../timeline/timeline";
import { VideoPlayer } from "./video-player";

/**
 * Canvas area (goes inside the sidebar layout).
 * The properties panel has been moved into the left sidebar.
 */
export const EditorCanvas: React.FC = () => {
  const { playerRef } = useEditorContext();

  return (
    <div className="flex flex-row h-full overflow-hidden min-h-0">
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <VideoPlayer playerRef={playerRef} />
      </div>
    </div>
  );
};

/**
 * Timeline area — resize handle + controls + tracks.
 * Renders at full width below the sidebar layout.
 */
export const EditorTimeline: React.FC = () => {
  const {
    overlays,
    selectedOverlayId,
    setSelectedOverlayId,
    isPlaying,
    currentFrame,
    playerRef,
    togglePlayPause,
    formatTime,
    handleOverlayChange,
    handleTimelineClick,
    deleteOverlay,
    duplicateOverlay,
    splitOverlay,
    durationInFrames,
    timelineDurationInFrames,
    setOverlays,
  } = useEditorContext();

  // visibleRows: 0 = collapsed (just title bar), up to MAX_ROWS
  const [visibleRows, setVisibleRows] = useState(MIN_DISPLAY_ROWS);
  const resizeRef = useRef<{ startY: number; startRows: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const userResizedRef = useRef(false); // tracks if user manually resized

  // Auto-expand (never shrink) visibleRows when overlays need more rows
  React.useEffect(() => {
    if (isResizing) return; // don't fight a manual resize
    const maxOccupiedRow = overlays.reduce((max, o) => Math.max(max, o.row || 0), -1);
    const minNeeded = maxOccupiedRow >= 0 ? Math.max(maxOccupiedRow + 2, MIN_DISPLAY_ROWS) : MIN_DISPLAY_ROWS;
    // Only auto-expand to fit content, never shrink below what user set
    if (minNeeded > visibleRows) {
      setVisibleRows(minNeeded);
    } else if (!userResizedRef.current && visibleRows > minNeeded) {
      // Only auto-shrink if user hasn't manually resized
      setVisibleRows(minNeeded);
    }
  }, [overlays, isResizing]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const maxOccupiedRow = overlays.reduce((max, o) => Math.max(max, o.row || 0), -1);
    const minRows = maxOccupiedRow >= 0 ? maxOccupiedRow + 2 : 0;
    resizeRef.current = { startY: e.clientY, startRows: visibleRows };
    const handleResizeMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const pixelDelta = resizeRef.current.startY - ev.clientY;
      const rowDelta = Math.round(pixelDelta / ROW_HEIGHT);
      setVisibleRows(Math.max(minRows, Math.min(MAX_ROWS, resizeRef.current.startRows + rowDelta)));
    };
    const handleResizeUp = () => {
      resizeRef.current = null;
      setIsResizing(false);
      userResizedRef.current = true; // user has manually set the height
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeUp);
    };
    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeUp);
  }, [visibleRows]);

  // Measure timeline height and expose as CSS variable so the fixed sidebar knows where to stop
  const timelineRef = useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty('--timeline-area-height', `${el.offsetHeight}px`);
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => { ro.disconnect(); document.documentElement.style.removeProperty('--timeline-area-height'); };
  }, []);

  return (
    <div ref={timelineRef} className="flex flex-col flex-shrink-0 border-t border-border">
      {/* Resize handle */}
      <div
        className={`h-1.5 cursor-ns-resize flex-shrink-0 transition-colors duration-150 group
          ${isResizing ? 'bg-primary/20' : 'hover:bg-primary/10'}`}
        onMouseDown={handleResizeMouseDown}
      >
        <div className="mx-auto w-12 h-full flex items-center justify-center">
          <div className={`w-8 h-0.5 rounded-full transition-colors duration-150
            ${isResizing ? 'bg-primary' : 'bg-border group-hover:bg-primary/40'}`} />
        </div>
      </div>

      <TimelineControls
        isPlaying={isPlaying}
        togglePlayPause={togglePlayPause}
        currentFrame={currentFrame}
        timelineTotalDuration={timelineDurationInFrames}
        formatTime={formatTime}
      />

      {/* Timeline rows — height snaps instantly, content slides in/out */}
      <div
        className="overflow-hidden"
        style={{
          height: visibleRows > 0 ? `${visibleRows * ROW_HEIGHT}px` : '0px',
        }}
      >
        <div
          style={{
            transform: visibleRows > 0 ? 'translateY(0)' : `translateY(${visibleRows > 0 ? 0 : 20}px)`,
            opacity: visibleRows > 0 ? 1 : 0,
          }}
        >
          <Timeline
            currentFrame={currentFrame}
            overlays={overlays}
            durationInFrames={timelineDurationInFrames}
            selectedOverlayId={selectedOverlayId}
            setSelectedOverlayId={setSelectedOverlayId}
            onOverlayChange={handleOverlayChange}
            onOverlayDelete={deleteOverlay}
            onOverlayDuplicate={duplicateOverlay}
            onSplitOverlay={splitOverlay}
            setCurrentFrame={(frame) => {
              if (playerRef.current) {
                playerRef.current.seekTo(frame / FPS);
              }
            }}
            setOverlays={setOverlays}
            onTimelineClick={handleTimelineClick}
            extraRows={Math.max(0, visibleRows - MIN_DISPLAY_ROWS)}
          />
        </div>
      </div>
    </div>
  );
};

/** @deprecated Use EditorCanvas and EditorTimeline separately */
export const Editor = EditorCanvas;
