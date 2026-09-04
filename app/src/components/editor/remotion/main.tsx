import React, { useCallback, useState } from "react";
import { AbsoluteFill } from "remotion";

import { Overlay, OverlayType, ShapeOverlay, BackgroundConfig } from "../types";
import { SortedOutlines } from "../components/selection/sorted-outlines";
import { Layer } from "../components/core/layer";
import { SnapGuides } from "../components/selection/snap-guides";
import { SnapLine } from "../components/selection/snap-utils";
import { usePathEditContext } from "../contexts/path-edit-context";
import { PathEditorOverlay } from "../components/overlays/shapes/path-editor-overlay";
import { DrawingOverlay } from "../components/overlays/shapes/drawing-overlay";
import { CropEditOverlay } from "../components/shared/crop-edit-overlay";
import { useVideoPreloader } from "../components/overlays/video/video-preloader";

/**
 * Props for the Main component
 */
export type MainProps = {
  /** Array of overlay objects to be rendered */
  readonly overlays: Overlay[];
  /** Function to set the currently selected overlay ID */
  readonly setSelectedOverlayId: React.Dispatch<
    React.SetStateAction<number | null>
  >;
  /** Currently selected overlay ID, or null if none selected */
  readonly selectedOverlayId: number | null;
  /** All selected overlay IDs for multi-select */
  readonly selectedOverlayIds: number[];
  /** Set multi-select IDs */
  readonly setSelectedOverlayIds: React.Dispatch<React.SetStateAction<number[]>>;
  /**
   * Function to update an overlay
   * @param overlayId - The ID of the overlay to update
   * @param updater - Function that receives the current overlay and returns an updated version
   */
  readonly changeOverlay: (
    overlayId: number,
    updater: (overlay: Overlay) => Overlay
  ) => void;
  /** Duration in frames of the composition */
  readonly durationInFrames: number;
  /** Frames per second of the composition */
  readonly fps: number;
  /** Width of the composition */
  readonly width: number;
  /** Height of the composition */
  readonly height: number;
  /** Background configuration */
  readonly background: BackgroundConfig;
};

const getBackgroundStyle = (
  background: BackgroundConfig
): React.CSSProperties => {
  switch (background.type) {
    case "color":
      return {
        backgroundColor: background.color || "#111827",
      };
    case "gradient":
      if (background.gradient) {
        return {
          background: `linear-gradient(${
            background.gradient.direction
          }, ${background.gradient.colors.join(", ")})`,
        };
      }
      return { backgroundColor: "#111827" };
    case "image":
      if (background.image?.src) {
        return {
          backgroundImage: `url(${background.image.src})`,
          backgroundSize:
            background.image.fit === "cover"
              ? "cover"
              : background.image.fit === "contain"
              ? "contain"
              : "100% 100%",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        };
      }
      return { backgroundColor: "#111827" };
    default:
      return { backgroundColor: "#111827" };
  }
};

const layerContainer: React.CSSProperties = {
  overflow: "hidden",
};

/**
 * Main component that renders a canvas-like area with overlays and their outlines.
 * Handles selection of overlays and provides a container for editing them.
 *
 * @param props - Component props of type MainProps
 * @returns React component that displays overlays and their interactive outlines
 */
export const Main: React.FC<MainProps> = ({
  overlays,
  setSelectedOverlayId,
  selectedOverlayId,
  selectedOverlayIds,
  setSelectedOverlayIds,
  changeOverlay,
  background,
  width,
  height,
}) => {
  const [snapGuides, setSnapGuides] = useState<SnapLine[]>([]);
  const { pathEditingId, exitPathEdit, drawingMode, cropEditingId, exitCropEdit } = usePathEditContext();

  // Prefetch all video clip sources into blob URLs so clip transitions are instant
  useVideoPreloader(overlays);

  const pathEditOverlay = React.useMemo(() => {
    if (pathEditingId === null) return null;
    const ov = overlays.find((o) => o.id === pathEditingId);
    if (!ov || ov.type !== OverlayType.SHAPE) return null;
    return ov as ShapeOverlay;
  }, [pathEditingId, overlays]);

  const cropEditOverlay = React.useMemo(() => {
    if (cropEditingId === null) return null;
    return overlays.find((o) => o.id === cropEditingId) || null;
  }, [cropEditingId, overlays]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) {
        return;
      }

      if (pathEditingId !== null) {
        exitPathEdit();
      }
      if (cropEditingId !== null) {
        exitCropEdit();
      }
      setSelectedOverlayIds([]);
    },
    [setSelectedOverlayIds, pathEditingId, exitPathEdit, cropEditingId, exitCropEdit]
  );

  return (
    <AbsoluteFill
      style={{
        ...getBackgroundStyle(background),
      }}
      onPointerDown={onPointerDown}
    >
      <AbsoluteFill style={layerContainer}>
        {overlays.map((overlay) => {
          return (
            <Layer
              key={overlay.id}
              overlay={overlay}
              selectedOverlayId={selectedOverlayId}
            />
          );
        })}
      </AbsoluteFill>
      <SortedOutlines
        selectedOverlayId={selectedOverlayId}
        selectedOverlayIds={selectedOverlayIds}
        setSelectedOverlayIds={setSelectedOverlayIds}
        overlays={overlays}
        setSelectedOverlayId={setSelectedOverlayId}
        changeOverlay={changeOverlay}
        canvasWidth={width}
        canvasHeight={height}
        onSnapGuidesChange={setSnapGuides}
      />
      <SnapGuides
        guides={snapGuides}
        canvasWidth={width}
        canvasHeight={height}
      />
      {pathEditOverlay && (
        <PathEditorOverlay
          overlay={pathEditOverlay}
          changeOverlay={changeOverlay}
        />
      )}
      {drawingMode !== 'none' && (
        <DrawingOverlay
          canvasWidth={width}
          canvasHeight={height}
        />
      )}
      {cropEditOverlay && (
        <CropEditOverlay
          overlay={cropEditOverlay}
          changeOverlay={changeOverlay}
        />
      )}
    </AbsoluteFill>
  );
};
