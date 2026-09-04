import React, { createContext, useContext, useRef, useMemo, useState, useEffect, useCallback } from "react";
import { useTimelineZoom } from "../hooks/use-timeline-zoom";


const LAYOUT_KEY = 'perpetual-layout-flags';
const SNAP_KEY = 'perpetual-snap-enabled';

/** Snap line indicator: a frame position + which rows to show it on */
export interface SnapLine {
  frame: number;
  rows: number[];
}

/** Active snap lines during a drag */
export type SnapLines = SnapLine[];

interface TimelineContextType {
  timelineRef: React.RefObject<HTMLDivElement>;
  zoomScale: number;
  setZoomScale: (scale: number) => void;
  scrollPosition: number;
  setScrollPosition: (position: number) => void;
  handleZoom: (delta: number, clientX: number) => void;
  handleWheelZoom: (event: WheelEvent) => void;
  resetOverlays?: () => void;
  /** Left panel (sidebar) extends full height */
  leftFullHeight: boolean;
  setLeftFullHeight: (v: boolean) => void;
  /** Right panel (chat) extends full height */
  rightFullHeight: boolean;
  setRightFullHeight: (v: boolean) => void;
  /** Snap-to-edges toggle (persisted) */
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;
  /** Active snap lines (frame positions) during a drag */
  snapLines: SnapLines;
  setSnapLines: (lines: SnapLines) => void;
}

export const TimelineContext = createContext<TimelineContextType | null>(null);

export const TimelineProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);

  // Snap toggle (persisted)
  const [snapEnabled, setSnapEnabledState] = useState(() => {
    try {
      const stored = localStorage.getItem(SNAP_KEY);
      return stored === null ? true : stored === '1'; // default ON
    } catch { return true; }
  });
  const setSnapEnabled = useCallback((v: boolean) => {
    setSnapEnabledState(v);
    try { localStorage.setItem(SNAP_KEY, v ? '1' : '0'); } catch {}
  }, []);

  // Snap lines (transient, only during drags)
  const [snapLines, setSnapLines] = useState<SnapLines>([]);

  // Layout flags (persisted)
  const [leftFullHeight, setLeftFullHeightState] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}');
      return stored.left ?? false;
    } catch { return false; }
  });
  const [rightFullHeight, setRightFullHeightState] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}');
      return stored.right ?? false;
    } catch { return false; }
  });

  const persist = useCallback((left: boolean, right: boolean) => {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify({ left, right })); } catch {}
  }, []);

  const setLeftFullHeight = useCallback((v: boolean) => {
    setLeftFullHeightState(v);
    setRightFullHeightState((prev: boolean) => { persist(v, prev); return prev; });
  }, [persist]);

  const setRightFullHeight = useCallback((v: boolean) => {
    setRightFullHeightState(v);
    setLeftFullHeightState((prev: boolean) => { persist(prev, v); return prev; });
  }, [persist]);

  // Sidebar stops at timeline in default/right layouts, but goes full height when left layout is on
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-bottom-offset',
      leftFullHeight ? '0px' : 'var(--timeline-area-height, 0px)'
    );
    return () => {
      document.documentElement.style.removeProperty('--sidebar-bottom-offset');
    };
  }, [leftFullHeight, rightFullHeight]);

  const {
    zoomScale,
    scrollPosition,
    setZoomScale,
    setScrollPosition,
    handleZoom,
    handleWheelZoom,
  } = useTimelineZoom(timelineRef);

  const value = useMemo(
    () => ({
      timelineRef,
      zoomScale,
      setZoomScale,
      scrollPosition,
      setScrollPosition,
      handleZoom,
      handleWheelZoom,
      leftFullHeight,
      setLeftFullHeight,
      rightFullHeight,
      setRightFullHeight,
      snapEnabled,
      setSnapEnabled,
      snapLines,
      setSnapLines,
    }),
    [
      timelineRef,
      zoomScale,
      setZoomScale,
      scrollPosition,
      setScrollPosition,
      handleZoom,
      handleWheelZoom,
      leftFullHeight,
      setLeftFullHeight,
      rightFullHeight,
      setRightFullHeight,
      snapEnabled,
      setSnapEnabled,
      snapLines,
      setSnapLines,
    ]
  );

  return (
    <TimelineContext.Provider value={value}>
      {children}
    </TimelineContext.Provider>
  );
};

export const useTimeline = () => {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error("useTimeline must be used within a TimelineProvider");
  }
  return context;
};
