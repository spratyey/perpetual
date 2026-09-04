import React from "react";
import { useCurrentFrame, Img } from "remotion";
import { ImageOverlay, CropEffect } from "../../../types";
import { animationTemplates } from "../../../templates/animation-templates";

interface ImageLayerContentProps {
  overlay: ImageOverlay;
}

const calculateCropClipPath = (cropEffect?: CropEffect): string | undefined => {
  if (!cropEffect) return undefined;
  const top = cropEffect.y;
  const right = 100 - (cropEffect.x + cropEffect.width);
  const bottom = 100 - (cropEffect.y + cropEffect.height);
  const left = cropEffect.x;
  return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
};

export const ImageLayerContent: React.FC<ImageLayerContentProps> = ({
  overlay,
}) => {
  const frame = useCurrentFrame();
  const isExitPhase = frame >= overlay.durationInFrames - 30;

  const enterAnimation =
    !isExitPhase && overlay.styles.animation?.enter
      ? animationTemplates[overlay.styles.animation.enter]?.enter(frame, overlay.durationInFrames)
      : {};

  const exitAnimation =
    isExitPhase && overlay.styles.animation?.exit
      ? animationTemplates[overlay.styles.animation.exit]?.exit(frame, overlay.durationInFrames)
      : {};

  const animStyles = isExitPhase ? exitAnimation : enterAnimation;
  const cropClipPath = calculateCropClipPath(overlay.styles.cropEffect);

  const wrapperStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    ...animStyles,
    ...(cropClipPath ? { clipPath: cropClipPath } : {}),
  };

  const imageStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: overlay.styles.objectFit || "cover",
    objectPosition: overlay.styles.objectPosition,
    opacity: overlay.styles.opacity,
    transform: overlay.styles.transform || "none",
    filter: overlay.styles.filter || "none",
    borderRadius: overlay.styles.borderRadius || "0px",
    boxShadow: overlay.styles.boxShadow || "none",
    border: overlay.styles.border || "none",
  };

  return (
    <div style={wrapperStyle}>
      <Img src={overlay.src} style={imageStyle} alt="" />
    </div>
  );
};
