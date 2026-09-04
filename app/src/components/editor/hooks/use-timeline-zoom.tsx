import { useState, useCallback, useRef, useLayoutEffect, RefObject } from "react";
import { ZOOM_CONSTRAINTS } from "../constants";

type ZoomState = {
  scale: number;
  scroll: number;
};

/**
 * A custom hook that manages zoom and scroll behavior for a timeline component.
 * Handles both programmatic and wheel-based zooming while maintaining the zoom point
 * relative to the cursor position.
 *
 * Uses discrete, stepwise zoom with accumulated delta debouncing for smooth,
 * consistent zoom behavior across mouse wheels and trackpads.
 * Scroll adjustments are applied synchronously via useLayoutEffect to prevent
 * visual tearing between zoom width changes and scroll position.
 *
 * @param timelineRef - React ref object pointing to the timeline DOM element
 * @returns {Object} An object containing:
 *   - zoomScale: Current zoom level
 *   - scrollPosition: Current scroll position
 *   - setZoomScale: Function to directly set zoom level
 *   - setScrollPosition: Function to directly set scroll position
 *   - handleZoom: Function to handle programmatic zooming
 *   - handleWheelZoom: Event handler for wheel-based zooming
 */
export const useTimelineZoom = (timelineRef: RefObject<HTMLDivElement>) => {
  const [zoomState, setZoomState] = useState<ZoomState>({
    scale: ZOOM_CONSTRAINTS.default,
    scroll: 0,
  });

  // Use a ref for the scale so the wheel handler always reads up-to-date value
  const scaleRef = useRef(zoomState.scale);
  scaleRef.current = zoomState.scale;

  // Pending scroll target — applied synchronously in useLayoutEffect
  // before the browser paints, so width and scroll update in the same frame.
  const pendingScrollRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (pendingScrollRef.current === null) return;
    const scrollContainer = timelineRef.current?.parentElement;
    if (!scrollContainer) return;
    scrollContainer.scrollLeft = pendingScrollRef.current;
    pendingScrollRef.current = null;
  }, [zoomState, timelineRef]);

  const handleZoom = useCallback(
    (delta: number, clientX: number) => {
      const scrollContainer = timelineRef.current?.parentElement;
      if (!scrollContainer) return;

      const prevZoom = scaleRef.current;
      const step = ZOOM_CONSTRAINTS.zoomStep;
      const newZoom = Math.min(
        ZOOM_CONSTRAINTS.max,
        Math.max(ZOOM_CONSTRAINTS.min, prevZoom + delta * step)
      );
      if (newZoom === prevZoom) return;

      const rect = scrollContainer.getBoundingClientRect();
      const relativeX = clientX - rect.left + scrollContainer.scrollLeft;
      const zoomFactor = newZoom / prevZoom;
      const newScroll = relativeX * zoomFactor - (clientX - rect.left);

      // Store pending scroll — will be applied in useLayoutEffect
      // before the browser paints, in sync with the width change.
      pendingScrollRef.current = newScroll;

      setZoomState({ scale: newZoom, scroll: newScroll });
    },
    [timelineRef]
  );

  // Keep refs for the accumulated delta and debounce timer so the wheel
  // handler never becomes stale.
  const wheelAccumRef = useRef(0);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWheelZoom = useCallback(
    (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;

      event.preventDefault();

      // Accumulate delta; fire one discrete step when threshold is crossed
      wheelAccumRef.current += -event.deltaY;

      const threshold = 30;

      if (wheelAccumRef.current >= threshold) {
        wheelAccumRef.current = 0;
        handleZoom(1, event.clientX); // +1 step in
      } else if (wheelAccumRef.current <= -threshold) {
        wheelAccumRef.current = 0;
        handleZoom(-1, event.clientX); // -1 step out
      }

      // Reset accumulator after a pause (end of gesture)
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => {
        wheelAccumRef.current = 0;
      }, 200);
    },
    [handleZoom]
  );

  return {
    zoomScale: zoomState.scale,
    scrollPosition: zoomState.scroll,
    setZoomScale: (newScale: number) =>
      setZoomState((prev) => ({ ...prev, scale: newScale })),
    setScrollPosition: (newScroll: number) =>
      setZoomState((prev) => ({ ...prev, scroll: newScroll })),
    handleZoom,
    handleWheelZoom,
  };
};
