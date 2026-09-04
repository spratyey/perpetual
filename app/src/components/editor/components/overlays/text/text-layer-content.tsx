import React from "react";
import { useCurrentFrame } from "remotion";
import { TextOverlay } from "../../../types";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMerriweather } from "@remotion/google-fonts/Merriweather";
import { loadFont as loadRobotoMono } from "@remotion/google-fonts/RobotoMono";
import { loadFont as loadVT323 } from "@remotion/google-fonts/VT323";
import { animationTemplates } from "../../../templates/animation-templates";

// Load the fonts
const { fontFamily: interFontFamily } = loadInter();
const { fontFamily: merriweatherFontFamily } = loadMerriweather();
const { fontFamily: robotoMonoFontFamily } = loadRobotoMono();
const { fontFamily: vt323FontFamily } = loadVT323();

interface TextLayerContentProps {
  overlay: TextOverlay;
}

// Font family mapping function
const getFontFamily = (fontClass: string) => {
  switch (fontClass) {
    case "font-sans":
      return interFontFamily;
    case "font-serif":
      return merriweatherFontFamily;
    case "font-mono":
      return robotoMonoFontFamily;
    case "font-retro":
      return vt323FontFamily;
    default:
      return interFontFamily;
  }
};

export const TextLayerContent: React.FC<TextLayerContentProps> = ({
  overlay,
}) => {
  const frame = useCurrentFrame();

  // Calculate if we're in the exit phase (last 30 frames)
  const isExitPhase = frame >= overlay.durationInFrames - 30;

  // Apply enter animation only during entry phase
  const enterAnimation =
    !isExitPhase && overlay.styles.animation?.enter
      ? animationTemplates[overlay.styles.animation.enter]?.enter(
          frame,
          overlay.durationInFrames
        )
      : {};

  // Apply exit animation only during exit phase
  const exitAnimation =
    isExitPhase && overlay.styles.animation?.exit
      ? animationTemplates[overlay.styles.animation.exit]?.exit(
          frame,
          overlay.durationInFrames
        )
      : {};

  // Use explicit fontSize from styles if it's a number (user-controlled),
  // otherwise auto-calculate to fit the box
  const getFontSize = (): number => {
    const raw = overlay.styles.fontSize;
    // Parse user-set font size (e.g. "48px", "3rem")
    if (raw) {
      const pxMatch = raw.match(/^(\d+(?:\.\d+)?)px$/);
      if (pxMatch) return parseFloat(pxMatch[1]);
      const remMatch = raw.match(/^(\d+(?:\.\d+)?)rem$/);
      if (remMatch) return parseFloat(remMatch[1]) * 16;
    }

    // Auto-calculate: fit text to box
    const lines = overlay.content.split("\n");
    const numLines = lines.length;
    const maxLineLength = Math.max(...lines.map((line) => line.length), 1);

    const areaBasedSize = Math.sqrt(
      (overlay.width * overlay.height) / (maxLineLength * numLines)
    );
    let fontSize = areaBasedSize * 1.2;

    if (numLines > 1) {
      fontSize *= Math.max(0.5, 1 - numLines * 0.1);
    }
    if (maxLineLength > 20) {
      fontSize *= Math.max(0.6, 1 - (maxLineLength - 20) / 100);
    }

    const aspectRatio = overlay.width / overlay.height;
    if (aspectRatio > 2 || aspectRatio < 0.5) {
      fontSize *= 0.8;
    }

    return Math.max(12, Math.min(fontSize, (overlay.height / numLines) * 0.8));
  };

  const containerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    textAlign: overlay.styles.textAlign,
    justifyContent:
      overlay.styles.textAlign === "center"
        ? "center"
        : overlay.styles.textAlign === "right"
        ? "flex-end"
        : "flex-start",
    overflow: "visible",
    ...(isExitPhase ? exitAnimation : enterAnimation),
  };

  const { ...restStyles } = overlay.styles;
  const textStyle: React.CSSProperties = {
    ...restStyles,
    animation: undefined,
    fontSize: `${getFontSize()}px`,
    fontFamily: getFontFamily(overlay.styles.fontFamily),
    maxWidth: "100%",
    wordWrap: "break-word",
    whiteSpace: "pre-wrap",
    lineHeight: overlay.styles.lineHeight || "1.3",
    padding: "0.1em",
    ...(isExitPhase ? exitAnimation : enterAnimation),
  };

  return (
    <div style={containerStyle}>
      <div style={textStyle}>{overlay.content}</div>
    </div>
  );
};
