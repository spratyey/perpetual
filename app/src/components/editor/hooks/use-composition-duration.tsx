import { useMemo } from "react";
import { Overlay } from "../types";
import {
  FPS,
  MIN_TIMELINE_DURATION_FRAMES,
  TIMELINE_END_PADDING_FRAMES,
} from "../constants";

export const useCompositionDuration = (overlays: Overlay[]) => {
  // ── Content duration — tight end of last overlay (used for rendering & Remotion Player)
  const durationInFrames = useMemo(() => {
    if (!overlays.length) return FPS * 3; // Default minimum duration (3 seconds)

    const maxEndFrame = overlays.reduce((maxEnd, overlay) => {
      const endFrame = overlay.from + overlay.durationInFrames;
      return Math.max(maxEnd, endFrame);
    }, 0);

    return Math.ceil(Math.max(maxEndFrame, FPS * 3));
  }, [overlays]);

  // ── Timeline duration — padded for drag-drop comfort (used for timeline UI)
  //    Always at least 1 minute, and always 10 s buffer beyond the last clip.
  const timelineDurationInFrames = useMemo(() => {
    return Math.max(
      MIN_TIMELINE_DURATION_FRAMES,
      durationInFrames + TIMELINE_END_PADDING_FRAMES
    );
  }, [durationInFrames]);

  // Utility functions for duration conversions
  const getDurationInSeconds = () => durationInFrames / FPS;
  const getDurationInFrames = () => durationInFrames;

  return {
    /** Tight content duration (for rendering / Remotion Player). */
    durationInFrames,
    /** Padded timeline duration (min 1 min, +10 s buffer). For timeline UI only. */
    timelineDurationInFrames,
    durationInSeconds: durationInFrames / FPS,
    getDurationInSeconds,
    getDurationInFrames,
    fps: FPS,
  };
};
