import React from "react";
import { ClipOverlay, ZoomEffect } from "../../types";

interface ZoomIndicatorsProps {
  overlay: ClipOverlay;
  currentFrame: number;
  zoomScale: number;
}

/**
 * ZoomIndicators — renders zoom effect overlays on the main timeline.
 * Each effect is drawn as a trapezoid shape:
 *   ╱‾‾‾‾‾‾‾‾‾‾╲   (slope in → sustain → slope out)
 * The slope width corresponds to snapDuration.
 */
export const ZoomIndicators: React.FC<ZoomIndicatorsProps> = ({
  overlay,
  currentFrame,
}) => {
  const zoomEffects = overlay.styles?.zoomEffects || [];
  if (zoomEffects.length === 0) return null;

  const totalDur = overlay.durationInFrames;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {zoomEffects.map((effect, index) => {
        const leftPct = (effect.startFrame / totalDur) * 100;
        const widthPct =
          ((effect.endFrame - effect.startFrame) / totalDur) * 100;
        const dur = effect.endFrame - effect.startFrame;
        const fallback = effect.snapDuration ?? 20;
        const snapIn = Math.min(effect.snapInDuration ?? fallback, Math.floor(dur / 2));
        const snapOut = Math.min(effect.snapOutDuration ?? fallback, Math.floor(dur / 2));
        const snapInPct = dur > 0 ? (snapIn / dur) * 100 : 0;
        const snapOutPct = dur > 0 ? (snapOut / dur) * 100 : 0;

        const relFrame = currentFrame - overlay.from;
        const isActive =
          relFrame >= effect.startFrame && relFrame <= effect.endFrame;

        const clipPath = `polygon(0% 100%, ${snapInPct}% 0%, ${100 - snapOutPct}% 0%, 100% 100%)`;

        return (
          <div
            key={effect.id}
            className="absolute inset-y-0"
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          >
            {/* Trapezoid fill */}
            <div
              className="absolute inset-0"
              style={{
                clipPath,
                backgroundColor: isActive
                  ? "rgba(59, 130, 246, 0.7)"
                  : "rgba(59, 130, 246, 0.45)",
              }}
            />

            {/* Trapezoid outline */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <polygon
                points={`0,100 ${snapInPct},0 ${100 - snapOutPct},0 100,100`}
                fill="none"
                stroke="rgba(0, 0, 0, 0.5)"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
              <polygon
                points={`0,100 ${snapInPct},0 ${100 - snapOutPct},0 100,100`}
                fill="none"
                stroke={isActive ? "rgba(96, 165, 250, 0.9)" : "rgba(96, 165, 250, 0.5)"}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            </svg>

            {/* Magnitude label */}
            {widthPct > 3 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className={`text-[10px] font-bold drop-shadow-sm ${
                    isActive ? "text-white" : "text-blue-200"
                  }`}
                >
                  {effect.magnitude.toFixed(1)}x
                </span>
              </div>
            )}

            {/* Effect index badge */}
            {widthPct > 5 && (
              <div className="absolute left-1 bottom-0.5">
                <span className="text-[8px] font-medium text-blue-300/70">
                  Z{index + 1}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
