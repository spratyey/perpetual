import { useEffect, useMemo, useRef } from "react";
import { prefetch, getRemotionEnvironment } from "remotion";
import { Overlay, OverlayType, ClipOverlay } from "../../../types";

/** Check at call time, not import time — window.remotion_isPlayer is set by <Player> render */
const isPlayerEnv = () => getRemotionEnvironment().isPlayer;

/**
 * Preloads video sources for all clip overlays so transitions between clips
 * are instant instead of showing a 1-2s black gap.
 *
 * Problem: Remotion's <Sequence> only mounts children when the playhead is
 * within the sequence's frame range. When the playhead enters a new clip,
 * the <video> element mounts fresh — the browser must fetch metadata, seek,
 * and start decoding. This causes a noticeable black gap between clips.
 *
 * Solution: Use Remotion's prefetch() API to download video blobs into memory
 * when overlays are loaded. Remotion's <Video> and <OffthreadVideo> components
 * automatically use the prefetched blob URLs instead of fetching from the network,
 * making clip transitions near-instant.
 *
 * Only active in the Player (browser preview) — rendering doesn't need this
 * since OffthreadVideo handles its own decoding pipeline.
 */
export const useVideoPreloader = (overlays: Overlay[]) => {
  // Stable src list — only changes when actual video sources change,
  // not on every overlay mutation (drag, resize, style tweak).
  // Join into a single string key so the deps array is always length 1.
  const srcKey = overlays
    .filter((o): o is ClipOverlay => o.type === OverlayType.VIDEO && !!(o as ClipOverlay).src)
    .map(o => o.src)
    .sort()
    .join('\n');
  const videoSrcs = useMemo(() => (srcKey ? srcKey.split('\n') : []), [srcKey]);

  const activePrefetchesRef = useRef<Map<string, { free: () => void }>>(
    new Map()
  );

  useEffect(() => {
    // Only prefetch in the Player, not during headless rendering
    if (!isPlayerEnv()) return;

    const srcSet = new Set(videoSrcs);
    const current = activePrefetchesRef.current;

    // Free prefetches for sources no longer in the overlay list
    for (const [src, handle] of current.entries()) {
      if (!srcSet.has(src)) {
        handle.free();
        current.delete(src);
      }
    }

    // Start prefetching new sources
    for (const src of srcSet) {
      if (!current.has(src)) {
        // Infer content type from URL extension, default to video/mp4
        const isWebm = src.toLowerCase().includes('.webm');
        const handle = prefetch(src, {
          method: "blob-url",
          contentType: isWebm ? "video/webm" : "video/mp4",
        });
        current.set(src, handle);
      }
    }
  }, [videoSrcs]);

  // Cleanup all prefetches on unmount
  useEffect(() => {
    const current = activePrefetchesRef.current;
    return () => {
      for (const handle of current.values()) {
        handle.free();
      }
      current.clear();
    };
  }, []);
};
