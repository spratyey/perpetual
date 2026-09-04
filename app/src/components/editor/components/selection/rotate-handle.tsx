import React, { useCallback, useState } from "react";
import { Overlay } from "../../types";
import { RotateCw } from "lucide-react";
import { snapRotation } from "./snap-utils";

export const RotateHandle: React.FC<{
  overlay: Overlay;
  setOverlay: (
    overlayId: number,
    updater: (overlay: Overlay) => Overlay
  ) => void;
  scale?: number;
}> = ({ overlay, setOverlay, scale = 1 }) => {
  const [isSnapped, setIsSnapped] = useState(false);
  const clampedScale = Math.max(scale, 0.35);
  const minScreenDim = Math.min(overlay.width, overlay.height) * scale;
  // Scale rotate handle proportionally to the corner handle budget
  const sizeFactor = Math.min(1, Math.max(0.4, (minScreenDim * 0.2) / 8));

  const startRotating = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();

      const rect = e.currentTarget.parentElement?.getBoundingClientRect();
      if (!rect) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const getAngle = (x: number, y: number) => {
        const deltaX = x - centerX;
        const deltaY = y - centerY;
        return Math.atan2(deltaY, deltaX) * (180 / Math.PI);
      };

      const startAngle = getAngle(e.clientX, e.clientY);
      const startRotation = overlay.rotation || 0;

      const onPointerMove = (e: PointerEvent) => {
        const currentAngle = getAngle(e.clientX, e.clientY);
        const deltaAngle = currentAngle - startAngle;
        const rawRotation = startRotation + deltaAngle;

        const { angle: snappedRotation, snapped } = snapRotation(rawRotation);
        setIsSnapped(snapped);

        setOverlay(overlay.id, (o) => ({
          ...o,
          rotation: snappedRotation,
        }));
      };

      const onPointerUp = () => {
        setIsSnapped(false);
        window.removeEventListener("pointermove", onPointerMove);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp, { once: true });
    },
    [overlay, setOverlay]
  );

  // Hide rotate handle entirely on very small overlays (after all hooks)
  if (minScreenDim < 30) return null;

  return (
    <>
      <div
        onPointerDown={startRotating}
        style={{
          position: "absolute",
          width: `${(16 * sizeFactor) / clampedScale}px`,
          height: `${(16 * sizeFactor) / clampedScale}px`,
          cursor: "grab",
          top: `${(-22 * sizeFactor) / clampedScale}px`,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "white",
          borderRadius: "50%",
          border: `${1 / clampedScale}px solid #3B8BF2`,
          zIndex: 20001,
          pointerEvents: "all",
        }}
      >
        <RotateCw size={(8 * sizeFactor) / clampedScale} strokeWidth={2.5} color="#3B8BF2" />
      </div>
      {isSnapped && (
        <div
          style={{
            position: "absolute",
            top: (-36 * sizeFactor) / clampedScale,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#FF44CC",
            color: "white",
            padding: `${2 / clampedScale}px ${5 / clampedScale}px`,
            borderRadius: `${3 / clampedScale}px`,
            fontSize: `${9 / clampedScale}px`,
            fontWeight: "600",
            whiteSpace: "nowrap",
            zIndex: 99999,
            pointerEvents: "none",
          }}
        >
          {Math.round(((overlay.rotation || 0) % 360 + 360) % 360)}°
        </div>
      )}
    </>
  );
};
