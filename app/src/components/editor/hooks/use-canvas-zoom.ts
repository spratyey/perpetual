import { useState, useCallback, useRef, useEffect } from "react";

const CANVAS_ZOOM = {
  min: 0.1,
  max: 5,
  step: 0.1,
  default: 1, // 1 = fit to container
};

// Predefined zoom stops for clean stepwise zoom
const ZOOM_STEPS = [
  0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9,
  1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5,
];

function nextZoomStep(current: number): number {
  for (const step of ZOOM_STEPS) {
    if (step > current + 0.001) return step;
  }
  return ZOOM_STEPS[ZOOM_STEPS.length - 1];
}

function prevZoomStep(current: number): number {
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
    if (ZOOM_STEPS[i] < current - 0.001) return ZOOM_STEPS[i];
  }
  return ZOOM_STEPS[0];
}

export interface CanvasZoomEvent {
  clientX: number;
  clientY: number;
}

export function useCanvasZoom() {
  const [canvasZoom, setCanvasZoom] = useState(CANVAS_ZOOM.default);
  // Incremented on every fit-to-view / reset action; VideoPlayer re-centers when it changes.
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  // Store the last wheel cursor position for zoom-toward-cursor in the video player
  const lastWheelCursor = useRef<{ clientX: number; clientY: number } | null>(null);

  const clampZoom = useCallback(
    (z: number) => Math.min(CANVAS_ZOOM.max, Math.max(CANVAS_ZOOM.min, z)),
    []
  );

  const zoomIn = useCallback(() => {
    lastWheelCursor.current = null;
    setCanvasZoom((z) => nextZoomStep(z));
  }, []);

  const zoomOut = useCallback(() => {
    lastWheelCursor.current = null;
    setCanvasZoom((z) => prevZoomStep(z));
  }, []);

  const resetZoom = useCallback(() => {
    lastWheelCursor.current = null;
    setCanvasZoom(CANVAS_ZOOM.default);
    setRecenterTrigger((c) => c + 1);
  }, []);

  const setZoom = useCallback(
    (z: number) => {
      setCanvasZoom(clampZoom(z));
    },
    [clampZoom]
  );

  // Ctrl+wheel zoom — one discrete step per scroll gesture, debounced
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Accumulate delta and fire one step when threshold is crossed
    let accumulatedDelta = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      e.preventDefault();
      e.stopPropagation();

      // Store cursor position for zoom-toward-cursor
      lastWheelCursor.current = { clientX: e.clientX, clientY: e.clientY };

      // Normalize: trackpad pinch gives small deltaY, mouse wheel gives large deltaY
      // We accumulate and step once a threshold is crossed
      accumulatedDelta += -e.deltaY;

      const threshold = 30; // pixels of accumulated delta to trigger one zoom step

      if (accumulatedDelta >= threshold) {
        accumulatedDelta = 0;
        setCanvasZoom((prev) => nextZoomStep(prev));
      } else if (accumulatedDelta <= -threshold) {
        accumulatedDelta = 0;
        setCanvasZoom((prev) => prevZoomStep(prev));
      }

      // Reset accumulator after a pause (end of gesture)
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        accumulatedDelta = 0;
      }, 200);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []);

  // Keyboard shortcuts: Ctrl+= zoom in, Ctrl+- zoom out, Ctrl+0 reset
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        zoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomIn, zoomOut, resetZoom]);

  return {
    canvasZoom,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    containerRef,
    lastWheelCursor,
    recenterTrigger,
    CANVAS_ZOOM,
  };
}
