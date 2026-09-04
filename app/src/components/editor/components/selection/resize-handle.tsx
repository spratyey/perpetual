import React, { useCallback, useMemo } from "react";
import { useCurrentScale } from "remotion";
import { Overlay, OverlayType } from "../../types";
import { MAX_ROWS } from "../../constants";
import { computeResizeSnap, SnapLine, Rect } from "./snap-utils";

export type HandleType =
  | "top-left" | "top-right" | "bottom-left" | "bottom-right"
  | "top" | "bottom" | "left" | "right";

const CORNER_SIZE = 8;
const EDGE_LONG = 16;
const EDGE_SHORT = 4;

// Screen-pixel thresholds: below these, edge handles on that axis are hidden
const MIN_SCREEN_PX_FOR_EDGE = 56;

export const ResizeHandle: React.FC<{
  type: HandleType;
  setOverlay: (
    overlayId: number,
    updater: (overlay: Overlay) => Overlay
  ) => void;
  overlay: Overlay;
  allOverlays: Overlay[];
  canvasWidth: number;
  canvasHeight: number;
  onSnapGuidesChange: (guides: SnapLine[]) => void;
}> = ({ type, setOverlay, overlay, allOverlays, canvasWidth, canvasHeight, onSnapGuidesChange }) => {
  const scale = useCurrentScale();
  const clampedScale = Math.max(scale, 0.35);

  // Screen-pixel dimensions of the overlay
  const screenW = overlay.width * scale;
  const screenH = overlay.height * scale;

  // Corner sizing: based on the tightest handle spacing.
  // Two corners share each edge, so budget per corner ≈ minDim / 2.
  // Scale handle size so it never exceeds ~20% of the shortest on-screen edge.
  const minScreenDim = Math.min(screenW, screenH);
  const cornerBudget = minScreenDim * 0.2;
  const cornerSizePx = Math.min(CORNER_SIZE, Math.max(4, cornerBudget));

  const cornerSize = Math.round(cornerSizePx / clampedScale);
  const edgeLong = Math.round((EDGE_LONG * (cornerSizePx / CORNER_SIZE)) / clampedScale);
  const edgeShort = Math.round((EDGE_SHORT * (cornerSizePx / CORNER_SIZE)) / clampedScale);
  const borderWidth = 1 / clampedScale;

  const isCorner = type.includes("-");
  const isEdge = !isCorner;

  const style: React.CSSProperties = useMemo(() => {
    const zIndex = (MAX_ROWS - (overlay.row || 0)) * 10 + 20000;
    const base: React.CSSProperties = {
      position: "absolute",
      backgroundColor: "white",
      border: `${borderWidth}px solid #3B8BF2`,
      zIndex,
      pointerEvents: "all",
      borderRadius: isCorner ? `${2 / clampedScale}px` : `${99}px`,
    };

    if (isCorner) {
      const w = cornerSize;
      const h = cornerSize;
      const m = -w / 2 - borderWidth;
      switch (type) {
        case "top-left":
          return { ...base, width: w, height: h, left: 0, top: 0, marginLeft: m, marginTop: m, cursor: "nwse-resize" };
        case "top-right":
          return { ...base, width: w, height: h, right: 0, top: 0, marginRight: m, marginTop: m, cursor: "nesw-resize" };
        case "bottom-left":
          return { ...base, width: w, height: h, left: 0, bottom: 0, marginLeft: m, marginBottom: m, cursor: "nesw-resize" };
        case "bottom-right":
          return { ...base, width: w, height: h, right: 0, bottom: 0, marginRight: m, marginBottom: m, cursor: "nwse-resize" };
      }
    } else {
      switch (type) {
        case "top":
          return { ...base, width: edgeLong, height: edgeShort, left: "50%", top: 0, transform: "translate(-50%, -50%)", cursor: "ns-resize" };
        case "bottom":
          return { ...base, width: edgeLong, height: edgeShort, left: "50%", bottom: 0, transform: "translate(-50%, 50%)", cursor: "ns-resize" };
        case "left":
          return { ...base, width: edgeShort, height: edgeLong, left: 0, top: "50%", transform: "translate(-50%, -50%)", cursor: "ew-resize" };
        case "right":
          return { ...base, width: edgeShort, height: edgeLong, right: 0, top: "50%", transform: "translate(50%, -50%)", cursor: "ew-resize" };
      }
    }
    return base;
  }, [cornerSize, edgeLong, edgeShort, borderWidth, type, overlay.row, scale, isCorner, clampedScale, cornerSizePx]);

  const onPointerDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.button !== 0) return;

      const initialX = e.clientX;
      const initialY = e.clientY;

      // Determine which edges this handle affects
      const isLeft = type === "top-left" || type === "bottom-left" || type === "left";
      const isTop = type === "top-left" || type === "top-right" || type === "top";
      const isRight = type === "top-right" || type === "bottom-right" || type === "right";
      const isBottom = type === "bottom-left" || type === "bottom-right" || type === "bottom";
      const affectsX = isLeft || isRight;
      const affectsY = isTop || isBottom;

      const otherRects: Rect[] = allOverlays
        .filter((o) => o.id !== overlay.id && o.type !== OverlayType.SOUND)
        .map((o) => ({ left: o.left, top: o.top, width: o.width, height: o.height }));

      const aspectRatio = overlay.width / overlay.height;
      const locked = overlay.aspectRatioLocked !== false && isCorner; // Only lock on corners

      const onPointerMove = (pointerMoveEvent: PointerEvent) => {
        const offsetX = (pointerMoveEvent.clientX - initialX) / scale;
        const offsetY = (pointerMoveEvent.clientY - initialY) / scale;

        let newWidth = overlay.width + (affectsX ? (isLeft ? -offsetX : offsetX) : 0);
        let newHeight = overlay.height + (affectsY ? (isTop ? -offsetY : offsetY) : 0);
        let newLeft = overlay.left + (isLeft ? offsetX : 0);
        let newTop = overlay.top + (isTop ? offsetY : 0);

        // Enforce aspect ratio when locked (corners only)
        if (locked && aspectRatio > 0 && isFinite(aspectRatio)) {
          const absX = Math.abs(offsetX);
          const absY = Math.abs(offsetY);
          if (absX >= absY) {
            newHeight = newWidth / aspectRatio;
            newTop = overlay.top + (isTop ? overlay.height - newHeight : 0);
          } else {
            newWidth = newHeight * aspectRatio;
            newLeft = overlay.left + (isLeft ? overlay.width - newWidth : 0);
          }
        }

        const rawRect: Rect = {
          left: Math.round(newLeft),
          top: Math.round(newTop),
          width: Math.max(1, Math.round(newWidth)),
          height: Math.max(1, Math.round(newHeight)),
        };

        const edges = { left: isLeft, top: isTop, right: isRight || (!isLeft && isCorner), bottom: isBottom || (!isTop && isCorner) };

        const { rect: snapped, guides } = computeResizeSnap(
          rawRect, otherRects, { w: canvasWidth, h: canvasHeight }, edges
        );
        onSnapGuidesChange(guides);

        setOverlay(overlay.id, (i) => ({
          ...i,
          width: Math.max(1, snapped.width),
          height: Math.max(1, snapped.height),
          left: Math.min(overlay.left + overlay.width - 1, snapped.left),
          top: Math.min(overlay.top + overlay.height - 1, snapped.top),
          isDragging: true,
        }));
      };

      const onPointerUp = () => {
        onSnapGuidesChange([]);
        setOverlay(overlay.id, (i) => ({ ...i, isDragging: false }));
        window.removeEventListener("pointermove", onPointerMove);
      };

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerup", onPointerUp, { once: true });
    },
    [overlay, scale, setOverlay, type, allOverlays, canvasWidth, canvasHeight, onSnapGuidesChange, isCorner]
  );

  if (overlay.type === OverlayType.SOUND) return null;

  // Hide edge handles when aspect ratio is locked (only corners make sense)
  if (isEdge && overlay.aspectRatioLocked !== false) return null;

  // Hide edge handles when their axis is too cramped (handles would overlap corners)
  if (isEdge) {
    const isHorizEdge = type === "top" || type === "bottom";
    if (isHorizEdge && screenW < MIN_SCREEN_PX_FOR_EDGE) return null;
    if (!isHorizEdge && screenH < MIN_SCREEN_PX_FOR_EDGE) return null;
  }

  return <div onPointerDown={onPointerDown} style={style} />;
};
