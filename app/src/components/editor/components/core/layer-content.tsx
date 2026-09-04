import React from "react";
import { Overlay, SoundOverlay } from "../../types";
import { TextLayerContent } from "../overlays/text/text-layer-content";
import { Audio, interpolate } from "remotion";
import { OverlayType } from "../../types";
import { VideoLayerContent } from "../overlays/video/video-layer-content";
import { ImageLayerContent } from "../overlays/images/image-layer-content";
import { ShapeLayerContent } from "../overlays/shapes/shape-layer-content";
import { CaptionLayerContent } from "../overlays/captions/caption-layer-content";

/**
 * Error boundary that catches render errors in individual overlays
 * instead of crashing the entire Remotion composition.
 */
class OverlayErrorBoundary extends React.Component<
  { overlayId: number; overlayType: string; children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[OverlayErrorBoundary] Overlay id=${this.props.overlayId} type=${this.props.overlayType} crashed:`,
      error.message,
      info.componentStack
    );
  }
  render() {
    if (this.state.hasError) {
      // Render nothing for this overlay — don't crash the video
      return null;
    }
    return this.props.children;
  }
}

/**
 * Props for the LayerContent component
 * @interface LayerContentProps
 * @property {Overlay} overlay - The overlay object containing type and content information
 */
interface LayerContentProps {
  overlay: Overlay;
}

/**
 * LayerContent Component
 *
 * @component
 * @description
 * A component that renders different types of content layers in the video editor.
 * It acts as a switch component that determines which specific layer component
 * to render based on the overlay type.
 *
 * Supported overlay types:
 * - VIDEO: Renders video content with VideoLayerContent
 * - TEXT: Renders text overlays with TextLayerContent
 * - SHAPE: Renders colored shapes
 * - IMAGE: Renders images with ImageLayerContent
 * - CAPTION: Renders captions with CaptionLayerContent
 * - SOUND: Renders audio elements using Remotion's Audio component
 *
 * Each layer type maintains consistent sizing through commonStyle,
 * with specific customizations applied as needed.
 *
 * @example
 * ```tsx
 * <LayerContent overlay={{
 *   type: OverlayType.TEXT,
 *   content: "Hello World",
 *   // ... other overlay properties
 * }} />
 * ```
 */
export const LayerContent: React.FC<LayerContentProps> = ({ overlay }) => {
  // Debug logging for render issues — log once per overlay on first frame
  if (!overlay.styles) {
    console.error(`[LayerContent] CRITICAL: overlay id=${overlay.id} type=${overlay.type} has NO styles! Keys: ${Object.keys(overlay).join(',')}`);
  }
  /**
   * Common styling applied to all layer types
   * Ensures consistent dimensions across different content types
   */
  const commonStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
  };

  const content = (() => {
    switch (overlay.type) {
      case OverlayType.VIDEO:
        return (
          <div style={{ ...commonStyle }}>
            <VideoLayerContent overlay={overlay} />
          </div>
        );

      case OverlayType.TEXT:
        return (
          <div style={{ ...commonStyle }}>
            <TextLayerContent overlay={overlay} />
          </div>
        );

      case OverlayType.IMAGE:
        return (
          <div style={{ ...commonStyle }}>
            <ImageLayerContent overlay={overlay} />
          </div>
        );

      case OverlayType.SHAPE:
        return (
          <div style={{ ...commonStyle }}>
            <ShapeLayerContent overlay={overlay as import("../../types").ShapeOverlay} />
          </div>
        );

      case OverlayType.CAPTION:
        return (
          <div style={{ ...commonStyle }}>
            <CaptionLayerContent overlay={overlay} />
          </div>
        );

      case OverlayType.SOUND: {
        const soundOverlay = overlay as SoundOverlay;
        const baseVolume = soundOverlay.styles?.volume ?? 1;
        const fadeInFrames = soundOverlay.styles?.fadeIn ?? 0;
        const fadeOutFrames = soundOverlay.styles?.fadeOut ?? 0;
        const totalFrames = soundOverlay.durationInFrames;

        const volumeFunc = (f: number) => {
          let vol = baseVolume;
          if (fadeInFrames > 0 && f < fadeInFrames) {
            vol *= interpolate(f, [0, fadeInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          }
          if (fadeOutFrames > 0 && f > totalFrames - fadeOutFrames) {
            vol *= interpolate(f, [totalFrames - fadeOutFrames, totalFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          }
          return vol;
        };

        return (
          <Audio
            src={soundOverlay.src}
            startFrom={soundOverlay.startFromSound || 0}
            volume={fadeInFrames > 0 || fadeOutFrames > 0 ? volumeFunc : baseVolume}
          />
        );
      }

      default:
        return null;
    }
  })();

  return (
    <OverlayErrorBoundary overlayId={overlay.id} overlayType={overlay.type}>
      {content}
    </OverlayErrorBoundary>
  );
};
