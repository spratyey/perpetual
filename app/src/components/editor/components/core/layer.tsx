import React, { useMemo } from "react";
import { Sequence } from "remotion";
import { LayerContent } from "./layer-content";
import { Overlay } from "../../types";
import { MAX_ROWS } from "../../constants";

/**
 * Props for the Layer component
 * @interface LayerProps
 * @property {Overlay} overlay - The overlay object containing position, dimensions, and content information
 * @property {number | null} selectedOverlayId - ID of the currently selected overlay, used for interaction states
 */
export const Layer: React.FC<{
  overlay: Overlay;
  selectedOverlayId: number | null;
}> = ({ overlay }) => {
  /**
   * Memoized style calculations for the layer
   * Handles positioning, dimensions, rotation, and z-index based on:
   * - Overlay position (left, top)
   * - Dimensions (width, height)
   * - Rotation
   * - Row position for z-index stacking
   *
   * @returns {React.CSSProperties} Computed styles for the layer
   */
  const style: React.CSSProperties = useMemo(() => {
    const zIndex = (MAX_ROWS - (overlay.row || 0)) * 10;

    return {
      position: "absolute",
      left: overlay.left,
      top: overlay.top,
      width: overlay.width,
      height: overlay.height,
      transform: `rotate(${overlay.rotation || 0}deg)`,
      transformOrigin: "center center",
      maxWidth: "100%",
      maxHeight: "100%",
      zIndex,
      pointerEvents: "none" as const,
    };
  }, [
    overlay.height,
    overlay.left,
    overlay.top,
    overlay.width,
    overlay.rotation,
    overlay.row,
  ]);

  /**
   * Special handling for sound overlays
   * Sound overlays don't need positioning or visual representation,
   * they just need to be sequenced correctly
   */
  if (overlay.type === "sound") {
    return (
      <Sequence
        key={overlay.id}
        from={Math.round(overlay.from)}
        durationInFrames={Math.round(overlay.durationInFrames)}
      >
        <LayerContent overlay={overlay} />
      </Sequence>
    );
  }

  /**
   * Standard layer rendering for visual elements
   * Wraps the content in a Sequence for timing control and
   * a positioned div for layout management
   */
  return (
    <Sequence
      key={overlay.id}
      from={Math.round(overlay.from)}
      durationInFrames={Math.round(overlay.durationInFrames)}
      layout="none"
    >
      <div style={style}>
        <LayerContent overlay={overlay} />
      </div>
    </Sequence>
  );
};
