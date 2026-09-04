import React from "react";
import { SnapLine } from "./snap-utils";

export const SnapGuides: React.FC<{
  guides: SnapLine[];
  canvasWidth: number;
  canvasHeight: number;
}> = ({ guides, canvasWidth, canvasHeight }) => {
  if (guides.length === 0) return null;

  return (
    <>
      {guides.map((guide, i) => {
        if (guide.axis === "x") {
          return (
            <div
              key={`x-${i}`}
              style={{
                position: "absolute",
                left: guide.position,
                top: 0,
                width: 0,
                height: canvasHeight,
                borderLeft: "1.5px dashed #FF4444",
                pointerEvents: "none",
                zIndex: 99999,
              }}
            />
          );
        }
        return (
          <div
            key={`y-${i}`}
            style={{
              position: "absolute",
              top: guide.position,
              left: 0,
              height: 0,
              width: canvasWidth,
              borderTop: "1.5px dashed #FF4444",
              pointerEvents: "none",
              zIndex: 99999,
            }}
          />
        );
      })}
    </>
  );
};
