import React, { useRef, useEffect } from "react";
import {
  Internals,
  OffthreadVideo,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  getRemotionEnvironment,
} from "remotion";

// usePlayingState lives on Internals.Timeline — not a public API but stable
// (used by Remotion's own <Video> component internally)
const usePlayingState = Internals.Timeline.usePlayingState as () => readonly [
  boolean,
  (cb: (prev: boolean) => boolean) => void,
  { current: boolean },
];

// usePreload resolves prefetched blob URLs — same hook Remotion's <Video> uses
const usePreload = Internals.usePreload as (src: string) => string;

import { ClipOverlay, ZoomEffect, CropEffect } from "../../../types";
import { animationTemplates } from "../../../templates/animation-templates";

/** Check at call time, not import time — window.remotion_isPlayer is set by <Player> render */
const isPlayerEnv = () => getRemotionEnvironment().isPlayer;

/**
 * Native-playback video for high-speed preview (speed > 2x).
 *
 * Problem: Both Remotion's <Video> and <OffthreadVideo> set video.currentTime
 * per frame. At 8x speed each seek jumps ~267ms, forcing the browser to decode
 * from the nearest H.264 keyframe every single frame → ~1-3 fps.
 *
 * Solution: During active playback, call video.play() with native playbackRate.
 * The browser's hardware-accelerated decoder handles smooth high-speed playback
 * by dropping non-reference frames as needed. We only fall back to per-frame
 * seeking when paused or scrubbing (frame jumps).
 *
 * Uses Remotion's usePlayingState() for instant pause/play response — same
 * mechanism Remotion's own <Video> component uses internally.
 */
const NativePlaybackVideo: React.FC<{
  src: string;
  startFrom: number;
  playbackRate: number;
  volume: number;
  style: React.CSSProperties;
}> = ({ src, startFrom, playbackRate, volume, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [playing] = usePlayingState();
  const resolvedSrc = usePreload(src); // blob: URL if prefetched, otherwise original
  const videoRef = useRef<HTMLVideoElement>(null);
  const prevFrameRef = useRef(-1);
  const isNativePlayingRef = useRef(false);
  const lastSyncFrameRef = useRef(0);
  const activePlaybackRateRef = useRef(playbackRate);

  // Source video time for the current composition frame
  const targetTime = (startFrom + frame * playbackRate) / fps;

  // Respond to play/pause state changes instantly — same as Remotion's <Video>
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!playing) {
      if (isNativePlayingRef.current) {
        video.pause();
        isNativePlayingRef.current = false;
      }
      // Only seek if the video is actually at a different position
      const drift = Math.abs(video.currentTime - targetTime);
      if (drift > 0.05) {
        video.currentTime = targetTime;
      }
    } else if (playing && !isNativePlayingRef.current) {
      // Resuming playback — kick off native play from current position
      prevFrameRef.current = frame;
      video.currentTime = targetTime;
      video.playbackRate = playbackRate;
      activePlaybackRateRef.current = playbackRate;
      video.play().catch(() => {});
      isNativePlayingRef.current = true;
      lastSyncFrameRef.current = frame;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally narrow deps.
  // targetTime/frame/playbackRate read from closure may be up to 1 frame stale
  // when playing toggles, but the frame-advance effect corrects on the next tick.
  // This avoids running this effect 30×/sec during playback for zero benefit.
  }, [playing]);

  // Update native playbackRate immediately when speed changes mid-playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isNativePlayingRef.current) return;
    if (playbackRate !== activePlaybackRateRef.current) {
      video.playbackRate = playbackRate;
      activePlaybackRateRef.current = playbackRate;
      // Re-sync position since the rate changed
      video.currentTime = targetTime;
      lastSyncFrameRef.current = frame;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally narrow deps.
  // targetTime/frame read from closure may be 1 frame stale; frame-advance effect
  // corrects immediately. Avoids running 30×/sec when speed hasn't changed.
  }, [playbackRate]);

  // Handle frame advancement: native playback during play, seeking during scrub
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playing) return;

    const delta = frame - prevFrameRef.current;
    prevFrameRef.current = frame;

    if (delta === 1) {
      // Sequential frame advance → timeline is playing
      if (!isNativePlayingRef.current) {
        // Kick off native playback from the correct position
        video.currentTime = targetTime;
        video.playbackRate = playbackRate;
        activePlaybackRateRef.current = playbackRate;
        video.play().catch(() => {});
        isNativePlayingRef.current = true;
        lastSyncFrameRef.current = frame;
      } else {
        // Already playing natively — re-sync every ~60 frames (2s) to fix drift
        if (frame - lastSyncFrameRef.current > 60) {
          const drift = Math.abs(video.currentTime - targetTime);
          if (drift > 0.15) {
            video.currentTime = targetTime;
          }
          lastSyncFrameRef.current = frame;
        }
      }
    } else if (delta > 1 || delta < -1) {
      // Jumped forward or looped (large negative delta) — re-sync
      video.currentTime = targetTime;
      if (!isNativePlayingRef.current) {
        video.playbackRate = playbackRate;
        activePlaybackRateRef.current = playbackRate;
        video.play().catch(() => {});
        isNativePlayingRef.current = true;
      }
      lastSyncFrameRef.current = frame;
    }
    // delta === 0: duplicate frame tick — ignore
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `playing` read in guard
  // is safe to omit: frames don't advance when paused, and the play/pause effect
  // handles state transitions. Adding it would cause redundant work.
  }, [frame, targetTime, playbackRate]);

  // Sync volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  // Pause native playback on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
  }, []);

  return (
    <video
      ref={videoRef}
      src={resolvedSrc}
      style={style}
      playsInline
      preload="auto"
      crossOrigin="anonymous"
      muted={volume === 0}
    />
  );
};

/** Speed threshold above which we switch to native playback in the Player */
const NATIVE_PLAYBACK_THRESHOLD = 2;

/**
 * Calculates the CSS clip-path for crop effect
 * @param cropEffect - Crop effect configuration
 * @returns CSS clip-path string or undefined if no crop
 */
const calculateCropClipPath = (cropEffect?: CropEffect): string | undefined => {
  if (!cropEffect) return undefined;

  // Convert crop percentages to inset values for clip-path
  const top = cropEffect.y;
  const right = 100 - (cropEffect.x + cropEffect.width);
  const bottom = 100 - (cropEffect.y + cropEffect.height);
  const left = cropEffect.x;

  return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
};

/**
 * Applies easing to a 0-1 progress value.
 */
const applyEasing = (
  progress: number,
  easing: ZoomEffect["easing"]
): number => {
  switch (easing) {
    case "ease-in":
      return progress * progress;
    case "ease-out":
      return 1 - Math.pow(1 - progress, 2);
    case "ease-in-out":
      return progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    case "linear":
    default:
      return progress;
  }
};

/**
 * Snap-zoom model: snap-in → sustain at magnitude → snap-out
 */
const calculateZoomTransform = (
  frame: number,
  zoomEffects: ZoomEffect[]
): { transform: string; transformOrigin: string } => {
  const activeEffects = zoomEffects.filter(
    (effect) => frame >= effect.startFrame && frame <= effect.endFrame
  );

  if (activeEffects.length === 0) {
    return { transform: "", transformOrigin: "center center" };
  }

  const effect = activeEffects[activeEffects.length - 1];

  const totalDuration = effect.endFrame - effect.startFrame;
  const fallback = effect.snapDuration ?? 20;
  const snapInFrames = Math.min(
    effect.snapInDuration ?? fallback,
    Math.floor(totalDuration / 2)
  );
  const snapOutFrames = Math.min(
    effect.snapOutDuration ?? fallback,
    Math.floor(totalDuration / 2)
  );
  const elapsed = frame - effect.startFrame;

  let currentZoom: number;

  if (elapsed < snapInFrames) {
    // Snap-in phase
    const progress = snapInFrames > 0 ? elapsed / snapInFrames : 1;
    const easedProgress = applyEasing(progress, effect.easing);
    currentZoom = interpolate(easedProgress, [0, 1], [1, effect.magnitude], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  } else if (elapsed > totalDuration - snapOutFrames) {
    // Snap-out phase
    const remaining = totalDuration - elapsed;
    const progress = snapOutFrames > 0 ? remaining / snapOutFrames : 0;
    const easedProgress = applyEasing(progress, effect.easing);
    currentZoom = interpolate(easedProgress, [0, 1], [1, effect.magnitude], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  } else {
    // Sustain phase
    currentZoom = effect.magnitude;
  }

  const transformOrigin = `${effect.positionX}% ${effect.positionY}%`;

  return {
    transform: `scale(${currentZoom})`,
    transformOrigin,
  };
};

/**
 * Interface defining the props for the VideoLayerContent component
 */
interface VideoLayerContentProps {
  /** The overlay configuration object containing video properties and styles */
  overlay: ClipOverlay;
}

/**
 * VideoLayerContent component renders a video layer with animations and styling
 *
 * This component handles:
 * - Video playback using Remotion's OffthreadVideo
 * - Enter/exit animations based on the current frame
 * - Styling including transform, opacity, border radius, etc.
 * - Video timing and volume controls
 *
 * @param props.overlay - Configuration object for the video overlay including:
 *   - src: Video source URL
 *   - videoStartTime: Start time offset for the video
 *   - durationInFrames: Total duration of the overlay
 *   - styles: Object containing visual styling properties and animations
 */
export const VideoLayerContent: React.FC<VideoLayerContentProps> = ({
  overlay,
}) => {
  const frame = useCurrentFrame();

  // Calculate if we're in the exit phase (last 30 frames)
  const isExitPhase = frame >= overlay.durationInFrames - 30;

  // Apply enter animation only during entry phase
  const enterAnimation =
    !isExitPhase && overlay.styles?.animation?.enter
      ? (animationTemplates[overlay.styles.animation.enter]?.enter(
          frame,
          overlay.durationInFrames
        ) ?? {})
      : {};

  // Apply exit animation only during exit phase
  const exitAnimation =
    isExitPhase && overlay.styles?.animation?.exit
      ? (animationTemplates[overlay.styles.animation.exit]?.exit(
          frame,
          overlay.durationInFrames
        ) ?? {})
      : {};

  // Calculate zoom effects
  const zoomEffects = overlay.styles?.zoomEffects || [];
  const zoomResult = calculateZoomTransform(frame, zoomEffects);

  // Calculate crop effect
  const cropClipPath = calculateCropClipPath(overlay.styles?.cropEffect);

  // Get the active animation styles
  const animationStyles = isExitPhase ? exitAnimation : enterAnimation;

  // Combine all transforms: base + zoom + animation
  const baseTransform = overlay.styles?.transform || "";
  const transforms = [
    baseTransform && baseTransform !== "none" ? baseTransform : "",
    zoomResult.transform || "",
    animationStyles.transform || "",
  ].filter(Boolean).join(" ");

  const finalTransform = transforms || "none";

  // Separate styles for crop container and video element
  const cropContainerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    position: "relative",
    clipPath: cropClipPath, // Apply crop effect to container
    borderRadius: overlay.styles?.borderRadius || "0px", // Apply border radius to container so it doesn't scale with zoom
  };

  // Extract transform and opacity from animation so we can merge them properly
  const { transform: _animTransform, opacity: animOpacity, ...animRest } = animationStyles;

  // Multiply user opacity with animation opacity (e.g. fade-in returns 0→1)
  const baseOpacity = overlay.styles?.opacity ?? 1;
  const finalOpacity = animOpacity != null ? baseOpacity * (animOpacity as number) : baseOpacity;

  const videoStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: overlay.styles?.objectFit || "cover",
    opacity: finalOpacity,
    transform: finalTransform, // Combined: base + zoom + animation transforms
    filter: overlay.styles?.filter || "none",
    boxShadow: overlay.styles?.boxShadow || "none",
    border: overlay.styles?.border || "none",
    transformOrigin: zoomResult.transformOrigin, // Use dynamic transform origin
    ...animRest, // Apply remaining animation styles (filter/clipPath) without overwriting
  };

  // Main container style
  const containerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    overflow: "hidden", // Clip zoom effects within bounds
    position: "relative",
  };

  // Choose the video component:
  // - Rendering (Modal/headless): OffthreadVideo for frame-accurate extraction
  // - Player + high speed (>2x): NativePlaybackVideo for smooth hardware-decoded playback
  // - Player + normal speed: Video (Remotion's player-optimized component)
  const speed = overlay.styles?.speed ?? 1;
  const _isPlayer = isPlayerEnv();
  const useNativePlayback = _isPlayer && speed > NATIVE_PLAYBACK_THRESHOLD;

  return (
    <div style={containerStyle}>
      <div style={cropContainerStyle}>
        {useNativePlayback ? (
          <NativePlaybackVideo
            src={overlay.src}
            startFrom={overlay.videoStartTime || 0}
            playbackRate={speed}
            volume={overlay.styles?.volume ?? 1}
            style={videoStyle}
          />
        ) : _isPlayer ? (
          <Video
            src={overlay.src}
            startFrom={overlay.videoStartTime || 0}
            style={videoStyle}
            volume={overlay.styles?.volume ?? 1}
            playbackRate={speed}
          />
        ) : (
          <OffthreadVideo
            src={overlay.src}
            startFrom={overlay.videoStartTime || 0}
            style={videoStyle}
            volume={overlay.styles?.volume ?? 1}
            playbackRate={speed}
          />
        )}
      </div>
    </div>
  );
};
