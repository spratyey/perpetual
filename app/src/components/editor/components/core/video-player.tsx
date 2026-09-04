import React, { useCallback, useEffect, useLayoutEffect } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { Main } from "../../remotion/main";
import { useEditorContext } from "../../contexts/editor-context";
import { FPS } from "../../constants";
import { useCanvasZoom } from "../../hooks/use-canvas-zoom";
import { CanvasZoomControls } from "./canvas-zoom-controls";
import { usePathEditContext } from "../../contexts/path-edit-context";

interface VideoPlayerProps {
  playerRef: React.RefObject<PlayerRef>;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ playerRef }) => {
  const {
    overlays,
    setSelectedOverlayId,
    changeOverlay,
    selectedOverlayId,
    selectedOverlayIds,
    setSelectedOverlayIds,
    aspectRatio,
    playerDimensions,
    updatePlayerDimensions,
    getAspectRatioDimensions,
    durationInFrames,
    background,
  } = useEditorContext();

  const { pathEditingId, exitPathEdit, cropEditingId, exitCropEdit } = usePathEditContext();

  // Click on the grey grid area outside the player to deselect everything
  const handleOutsidePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      // Only deselect if the click is NOT inside the editor viewport (the Player)
      const viewport = (e.currentTarget as HTMLElement).querySelector("[data-editor-viewport]");
      if (viewport && viewport.contains(e.target as Node)) return;
      if (pathEditingId !== null) exitPathEdit();
      if (cropEditingId !== null) exitCropEdit();
      setSelectedOverlayIds([]);
    },
    [setSelectedOverlayIds, pathEditingId, exitPathEdit, cropEditingId, exitCropEdit]
  );

  const {
    canvasZoom,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    containerRef,
    lastWheelCursor,
    recenterTrigger,
  } = useCanvasZoom();

  // Track raw container size (not the fitted player size) for scroll margin calculations
  const [containerSize, setContainerSize] = React.useState({ w: 0, h: 0 });
  const needsRecenterRef = React.useRef(false);

  useEffect(() => {
    const videoContainer = document.querySelector(".video-container");
    if (!videoContainer) return;

    const handleDimensionUpdate = () => {
      const { width, height } = videoContainer.getBoundingClientRect();
      updatePlayerDimensions(width, height);
      setContainerSize({ w: width, h: height });
      needsRecenterRef.current = true;

      // Directly center scroll after React processes the state updates
      // This is the most reliable way to ensure centering happens
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const scrollEl = scrollContainerRef.current;
          if (scrollEl) {
            const sl = (scrollEl.scrollWidth - scrollEl.clientWidth) / 2;
            const st = (scrollEl.scrollHeight - scrollEl.clientHeight) / 2;
            scrollEl.scrollLeft = sl;
            scrollEl.scrollTop = st;
            scrollPosRef.current = { left: scrollEl.scrollLeft, top: scrollEl.scrollTop };
          }
        });
      });
    };

    handleDimensionUpdate();

    const ro = new ResizeObserver(handleDimensionUpdate);
    ro.observe(videoContainer);

    return () => {
      ro.disconnect();
    };
  }, [aspectRatio, updatePlayerDimensions]);

  const { width: compositionWidth, height: compositionHeight } =
    getAspectRatioDimensions();

  // ── "Fit to view" Player size ─────────────────────────────────────
  // At canvasZoom=1 the Player fills 90% of the container while keeping
  // the composition's aspect ratio.  CSS transform: scale() handles zoom
  // on top of this base size, so Remotion never needs to recalculate.
  const FIT_FILL = 0.9;
  const compAspect = compositionWidth / compositionHeight;
  const containerAspect =
    playerDimensions.height > 0
      ? playerDimensions.width / playerDimensions.height
      : compAspect;

  let fitWidth: number;
  let fitHeight: number;
  if (compAspect > containerAspect) {
    // Width is the constraining dimension
    fitWidth = playerDimensions.width * FIT_FILL;
    fitHeight = fitWidth / compAspect;
  } else {
    // Height is the constraining dimension
    fitHeight = playerDimensions.height * FIT_FILL;
    fitWidth = fitHeight * compAspect;
  }

  // Visual size after zoom (used only for scroll-area sizing, not for the Player).
  const zoomedWidth = fitWidth * canvasZoom;
  const zoomedHeight = fitHeight * canvasZoom;

  const PLAYER_CONFIG = {
    durationInFrames: Math.round(durationInFrames),
    fps: FPS,
  };

  // ── Scroll tracking & zoom-toward-cursor ──────────────────────────
  //
  // Layout: scroll container ▸ content area ▸ viewport (absolutely positioned).
  //
  // The content area has one container-width of margin on each side of the
  // viewport.  This guarantees enough scroll headroom in every direction so
  // that anchor-to-cursor never has to clamp scroll to 0 (the old flexbox
  // centering approach failed here because the offset shrank when the
  // viewport grew, leaving no room to scroll left/up).
  //
  // Viewport offset within the content area is ALWAYS (cW, cH) regardless
  // of zoom level, which makes the anchor math trivially correct.

  // Use actual container size for scroll margins so centering always works,
  // even when the fitted player is much narrower/shorter than the container
  // (e.g. 9:16 in a wide container).
  const cW = containerSize.w || playerDimensions.width;
  const cH = containerSize.h || playerDimensions.height;

  const contentWidth = zoomedWidth + cW * 2;
  const contentHeight = zoomedHeight + cH * 2;

  // Viewport position — constant margin equal to the container size.
  const vpLeft = cW;
  const vpTop = cH;

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const prevZoomRef = React.useRef(canvasZoom);
  const scrollPosRef = React.useRef({ left: 0, top: 0 });
  const prevContainerDimsRef = React.useRef({ w: 0, h: 0 });
  const prevRecenterRef = React.useRef(recenterTrigger);
  const skipNextAnchorRef = React.useRef(false);

  // Track scroll position continuously & prevent non-zoom wheel events
  // from accidentally panning the canvas.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onScroll = () => {
      scrollPosRef.current = { left: el.scrollLeft, top: el.scrollTop };
    };
    const onWheel = (e: WheelEvent) => {
      // Only Ctrl/Meta+wheel is handled (by the zoom hook on containerRef).
      // All other wheel events are suppressed so the user can't accidentally
      // scroll the viewport away from its centered position.
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Center viewport on mount, container resize, or explicit recenter (fit-to-view).
  const centerScroll = React.useCallback(() => {
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;
    const sl = (scrollEl.scrollWidth - scrollEl.clientWidth) / 2;
    const st = (scrollEl.scrollHeight - scrollEl.clientHeight) / 2;
    scrollEl.scrollLeft = sl;
    scrollEl.scrollTop = st;
    scrollPosRef.current = { left: scrollEl.scrollLeft, top: scrollEl.scrollTop };
  }, []);

  useLayoutEffect(() => {
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl || cW === 0 || cH === 0) return;

    const prev = prevContainerDimsRef.current;
    const recentered = prevRecenterRef.current !== recenterTrigger;
    prevRecenterRef.current = recenterTrigger;

    if (prev.w === cW && prev.h === cH && !recentered && !needsRecenterRef.current) return;
    prevContainerDimsRef.current = { w: cW, h: cH };
    needsRecenterRef.current = false;

    // Tell the zoom-anchor effect to skip this render.
    if (recentered) skipNextAnchorRef.current = true;

    centerScroll();
    // Also center after browser layout in case DOM wasn't ready
    requestAnimationFrame(centerScroll);
    // And once more after paint to catch any late layout shifts
    requestAnimationFrame(() => requestAnimationFrame(centerScroll));
  });

  // Zoom toward cursor position (skip when recentering — the centering effect handles it).
  useLayoutEffect(() => {
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl || prevContainerDimsRef.current.w === 0) return;

    const prevZoom = prevZoomRef.current;
    prevZoomRef.current = canvasZoom;
    if (prevZoom === canvasZoom) return;

    // If the centering effect already handled scroll this render, skip anchor math.
    if (skipNextAnchorRef.current) {
      skipNextAnchorRef.current = false;
      return;
    }

    const cursor = lastWheelCursor.current;
    const rect = scrollEl.getBoundingClientRect();
    const cursorInViewX = cursor
      ? cursor.clientX - rect.left
      : rect.width / 2;
    const cursorInViewY = cursor
      ? cursor.clientY - rect.top
      : rect.height / 2;

    const prevSL = scrollPosRef.current.left;
    const prevST = scrollPosRef.current.top;

    // Position within the zoomed viewport under the cursor.
    // vpLeft/vpTop are constant (= cW/cH) so the offset doesn't change
    // between old and new zoom — the key insight that fixes the anchor drift.
    const localX = prevSL + cursorInViewX - vpLeft;
    const localY = prevST + cursorInViewY - vpTop;

    const ratio = canvasZoom / prevZoom;

    const newSL = vpLeft + localX * ratio - cursorInViewX;
    const newST = vpTop + localY * ratio - cursorInViewY;

    scrollEl.scrollLeft = Math.max(0, newSL);
    scrollEl.scrollTop = Math.max(0, newST);
    scrollPosRef.current = {
      left: scrollEl.scrollLeft,
      top: scrollEl.scrollTop,
    };
  }, [canvasZoom, lastWheelCursor, vpLeft, vpTop]);

  return (
    <div className="w-full lg:h-full relative" ref={containerRef}>
      <div
        className="z-0 video-container relative w-full h-full
        bg-muted
        bg-[linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)]
        bg-[size:16px_16px]
        shadow-lg"
      >
        {/* Scrollable container — scrollbars hidden; position controlled programmatically */}
        <div
          ref={scrollContainerRef}
          className="z-10 absolute inset-0 overflow-auto"
          style={{ scrollbarWidth: "none" }}
          onPointerDown={handleOutsidePointerDown}
        >
          {/* Explicitly-sized content area with generous margins */}
          <div
            style={{
              position: "relative",
              width: contentWidth,
              height: contentHeight,
            }}
          >
            {/* Viewport: fixed Player size, visually zoomed via CSS transform */}
            <div
              data-editor-viewport
              className="relative rounded-sm"
              style={{
                position: "absolute",
                left: vpLeft,
                top: vpTop,
                width: fitWidth,
                height: fitHeight,
                transform: `scale(${canvasZoom})`,
                transformOrigin: "0 0",
                border: "1px solid hsl(var(--border) / 0.5)",
                boxShadow:
                  "0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              <Player
                ref={playerRef}
                className="w-full h-full"
                component={Main}
                compositionWidth={compositionWidth}
                compositionHeight={compositionHeight}
                style={{
                  width: "100%",
                  height: "100%",
                }}
                durationInFrames={PLAYER_CONFIG.durationInFrames}
                fps={PLAYER_CONFIG.fps}
                inputProps={{
                  overlays,
                  setSelectedOverlayId,
                  changeOverlay,
                  selectedOverlayId,
                  selectedOverlayIds,
                  setSelectedOverlayIds,
                  durationInFrames,
                  fps: FPS,
                  width: compositionWidth,
                  height: compositionHeight,
                  background,
                }}
                errorFallback={() => <></>}
                overflowVisible
              />
            </div>
          </div>
        </div>

        {/* Zoom controls overlay */}
        <CanvasZoomControls
          zoom={canvasZoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetZoom}
          onZoomChange={setZoom}
        />
      </div>
    </div>
  );
};
