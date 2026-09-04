import React, { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

import { loadMatteBitmap } from "@/local/subject-matte";
import type { CaptionOverlay } from "../../../types";
import { captionFont, ensureCaptionFonts, layoutCue, resolveTypography } from "./caption-layout";

/** Frames a word takes to settle in, and frames the whole line takes to leave. */
const REVEAL_FRAMES = 7;
const EXIT_FRAMES = 9;

function easeOut(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

/**
 * Draws the cues that are up on this frame, then subtracts the subject
 * silhouette from what was drawn. The video below is left alone, so the words
 * read as if they were always behind the person.
 */
export const CaptionLayerContent: React.FC<{ overlay: CaptionOverlay }> = ({ overlay }) => {
  const frame = useCurrentFrame();
  const composition = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [matteBitmap, setMatteBitmap] = useState<ImageBitmap | null>(null);
  const typography = useMemo(() => resolveTypography(overlay), [overlay]);

  useEffect(() => {
    let cancelled = false;
    void ensureCaptionFonts().then(() => { if (!cancelled) setFontsReady(true); });
    return () => { cancelled = true; };
  }, []);

  const matteId = overlay.matte?.id;
  useEffect(() => {
    if (!matteId) return setMatteBitmap(null);
    let cancelled = false;
    void loadMatteBitmap(matteId).then((bitmap) => { if (!cancelled) setMatteBitmap(bitmap); });
    return () => { cancelled = true; };
  }, [matteId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fontsReady) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.textBaseline = "alphabetic";

    const style = () => {
      ctx.fillStyle = typography.color;
      ctx.shadowColor = "rgba(0, 0, 0, 0.42)";
      ctx.shadowBlur = height * 0.018;
      ctx.shadowOffsetY = height * 0.004;
    };

    const draw = (front: boolean) => {
      style();
      for (const cue of overlay.cues) {
        const local = frame - cue.from;
        if (local < 0 || local >= cue.durationInFrames) continue;

        const exit = Math.min(1, (cue.durationInFrames - local) / EXIT_FRAMES);
        for (const placed of layoutCue(cue, width, height, typography).tokens) {
          if (!!placed.token.inFront !== front) continue;
          const age = local - placed.token.from;
          if (age < 0) continue;
          const reveal = easeOut(Math.min(1, age / REVEAL_FRAMES));
          ctx.globalAlpha = reveal * exit;
          ctx.font = captionFont(placed.size, placed.italic, typography.family);
          ctx.fillText(placed.text, placed.x, placed.baseline + (1 - reveal) * placed.size * 0.16);
        }
      }
      ctx.globalAlpha = 1;
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    };

    draw(false);

    const matte = overlay.matte;
    if (matte && matteBitmap) {
      const cell = Math.max(0, Math.min(matte.frameCount - 1, Math.round((frame - matte.startFrame) / matte.frameStep)));
      const slotWidth = matte.cellWidth + matte.padding * 2;
      const slotHeight = matte.cellHeight + matte.padding * 2;
      const sx = (cell % matte.columns) * slotWidth + matte.padding;
      const sy = Math.floor(cell / matte.columns) * slotHeight + matte.padding;

      // The silhouette belongs to the footage, not to this box, so it is drawn
      // in composition space — moving or resizing the captions leaves it put.
      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(
        matteBitmap,
        sx, sy, matte.cellWidth, matte.cellHeight,
        -overlay.left, -overlay.top, composition.width, composition.height
      );
      ctx.globalCompositeOperation = "source-over";

      // Words the subject would have swallowed are laid over the top instead.
      draw(true);
    }
  }, [frame, overlay, typography, matteBitmap, fontsReady, composition.width, composition.height]);

  return (
    <canvas
      ref={canvasRef}
      width={Math.round(overlay.width)}
      height={Math.round(overlay.height)}
      style={{ width: "100%", height: "100%" }}
    />
  );
};
