import React from "react";
import { useCurrentFrame } from "remotion";
import { ShapeOverlay } from "../../../types";
import { getShapeByKey } from "./shape-definitions";
import { animationTemplates } from "../../../templates/animation-templates";

interface ShapeLayerContentProps {
  overlay: ShapeOverlay;
}

export const ShapeLayerContent: React.FC<ShapeLayerContentProps> = ({ overlay }) => {
  const frame = useCurrentFrame();
  const shape = getShapeByKey(overlay.content);

  if (!shape) return null;

  const fill = overlay.styles.fill || "transparent";
  const stroke = overlay.styles.stroke || "none";
  const strokeWidth = overlay.styles.strokeWidth ?? 0;
  const opacity = overlay.styles.opacity ?? 1;
  const gradient = overlay.styles.gradient;
  const borderRadius = overlay.styles.borderRadius;
  const boxShadow = overlay.styles.boxShadow;
  const pathData = overlay.styles.pathData;
  const pathViewBox = overlay.styles.pathViewBox;
  const strokeDasharray = overlay.styles.strokeDasharray;
  const strokeLinecap = overlay.styles.strokeLinecap || "round";
  const cornerRadius = overlay.styles.cornerRadius;

  // Whether this is a rectangle shape that supports SVG-level corner radius
  const isRectShape = overlay.content === "rectangle" || overlay.content === "rounded-rect";

  const isExitPhase = frame >= overlay.durationInFrames - 30;

  const enterAnimation =
    !isExitPhase && overlay.styles.animation?.enter
      ? animationTemplates[overlay.styles.animation.enter]?.enter(frame, overlay.durationInFrames)
      : {};

  const exitAnimation =
    isExitPhase && overlay.styles.animation?.exit
      ? animationTemplates[overlay.styles.animation.exit]?.exit(frame, overlay.durationInFrames)
      : {};

  const animStyle = isExitPhase ? exitAnimation : enterAnimation;
  const gradientId = `shape-grad-${overlay.id}`;

  const actualFill = gradient ? `url(#${gradientId})` : fill;

  // Smart resize: if the shape has a resizePath function and no custom pathData override,
  // compute a dimension-aware path that keeps fixed regions (arrowheads, tails) constant
  const smartResize = !pathData && shape.resizePath
    ? shape.resizePath(overlay.width, overlay.height)
    : null;

  const effectivePathData = pathData || (smartResize ? smartResize.d : null);
  const viewBox = effectivePathData
    ? (pathData ? (pathViewBox || shape.viewBox) : smartResize?.viewBox || shape.viewBox)
    : shape.viewBox;

  // For smart resize shapes, use xMidYMid meet so the parametric viewBox controls
  // the stretched geometry. For all others, stretch to fill (preserveAspectRatio="none").
  const par = smartResize ? "xMidYMid meet" : "none";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        opacity,
        borderRadius: borderRadius || undefined,
        boxShadow: boxShadow || undefined,
        overflow: borderRadius ? "hidden" : undefined,
        ...animStyle,
      }}
    >
      <svg
        viewBox={viewBox}
        preserveAspectRatio={par}
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
      >
        {gradient && (
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              {parseGradient(gradient).map((stop, i) => (
                <stop key={i} offset={stop.offset} stopColor={stop.color} />
              ))}
            </linearGradient>
          </defs>
        )}
        {effectivePathData ? (
          <path
            d={effectivePathData}
            fill={actualFill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray || undefined}
            strokeLinecap={strokeLinecap as any}
            fillRule={overlay.content === "ring" ? "evenodd" : undefined}
          />
        ) : isRectShape && cornerRadius != null ? (
          /* Rectangle with explicit SVG corner radius — bypasses preset path() */
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={100 - strokeWidth}
            height={100 - strokeWidth}
            rx={cornerRadius}
            ry={cornerRadius}
            fill={actualFill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray || undefined}
            strokeLinecap={strokeLinecap as any}
          />
        ) : (
          shape.path(actualFill, stroke, strokeWidth)
        )}
      </svg>
    </div>
  );
};

function parseGradient(gradient: string): { offset: string; color: string }[] {
  const colors = gradient.split(",").map((c) => c.trim());
  if (colors.length < 2) return [{ offset: "0%", color: colors[0] || "#3B82F6" }, { offset: "100%", color: "#1E40AF" }];
  return colors.map((color, i) => ({
    offset: `${Math.round((i / (colors.length - 1)) * 100)}%`,
    color,
  }));
}
