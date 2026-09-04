import React, { useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";

/**
 * Props for the PositionCanvas component
 */
interface PositionCanvasProps {
  /** X position percentage (0-100) */
  positionX: number;
  /** Y position percentage (0-100) */
  positionY: number;
  /** Callback when position changes */
  onPositionChange: (x: number, y: number) => void;
  /** Canvas width in pixels */
  width?: number;
  /** Canvas height in pixels */
  height?: number;
  /** Whether to show pixel coordinates as alternative */
  showPixelCoordinates?: boolean;
  /** Video dimensions for pixel calculation (optional) */
  videoDimensions?: { width: number; height: number };
}

/**
 * PositionCanvas Component
 *
 * An interactive canvas that allows users to click/drag to set X/Y position
 * for zoom effects. Provides visual feedback with a crosshair indicator.
 *
 * @component
 */
export const PositionCanvas: React.FC<PositionCanvasProps> = ({
  positionX,
  positionY,
  onPositionChange,
  width: _width = 160,
  height: _height = 90,
  showPixelCoordinates = true,
  videoDimensions = { width: 1920, height: 1080 },
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);

  /**
   * Handle click/touch events on the canvas
   */
  const handleCanvasInteraction = useCallback(
    (
      event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
    ) => {
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      let clientX: number;
      let clientY: number;

      if ("touches" in event) {
        // Touch event
        if (event.touches.length === 0) return;
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else {
        // Mouse event
        clientX = event.clientX;
        clientY = event.clientY;
      }

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // Convert pixel coordinates to percentages
      const xPercent = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const yPercent = Math.max(0, Math.min(100, (y / rect.height) * 100));

      onPositionChange(Math.round(xPercent), Math.round(yPercent));
    },
    [onPositionChange]
  );

  /**
   * Handle drag events
   */
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.buttons === 1) {
        // Only handle if left mouse button is pressed
        handleCanvasInteraction(event);
      }
    },
    [handleCanvasInteraction]
  );

  // Calculate dot position as percentages for responsive canvas
  const dotLeft = `${positionX}%`;
  const dotTop = `${positionY}%`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">
          Zoom Position
        </label>
        <div className="text-xs text-muted-foreground">
          {showPixelCoordinates ? (
            <div className="flex flex-col text-right">
              <span>
                ({positionX}%, {positionY}%)
              </span>
              <span className="text-[10px] text-gray-400">
                {Math.round((positionX / 100) * videoDimensions.width)}px, {Math.round((positionY / 100) * videoDimensions.height)}px
              </span>
            </div>
          ) : (
            <span>
              ({positionX}%, {positionY}%)
            </span>
          )}
        </div>
      </div>

      <Card className="p-3 bg-gray-50 dark:bg-gray-900/50 border border-border">
        <div
          ref={canvasRef}
          className="relative cursor-crosshair border border-border rounded-sm overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-800 dark:to-gray-700 w-full aspect-video"
          style={{ 
            minHeight: "90px",
            maxHeight: "160px"
          }}
          onClick={handleCanvasInteraction}
          onMouseMove={handleMouseMove}
          onTouchStart={handleCanvasInteraction}
          onTouchMove={handleCanvasInteraction}
        >
          {/* Grid lines for better visual reference */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Vertical lines */}
            <div
              className="absolute top-0 bottom-0 w-px bg-gray-300/50 dark:bg-gray-500/30"
              style={{ left: "25%" }}
            />
            <div
              className="absolute top-0 bottom-0 w-px bg-gray-400/70 dark:bg-gray-400/50"
              style={{ left: "50%" }}
            />
            <div
              className="absolute top-0 bottom-0 w-px bg-gray-300/50 dark:bg-gray-500/30"
              style={{ left: "75%" }}
            />

            {/* Horizontal lines */}
            <div
              className="absolute left-0 right-0 h-px bg-gray-300/50 dark:bg-gray-500/30"
              style={{ top: "33.33%" }}
            />
            <div
              className="absolute left-0 right-0 h-px bg-gray-400/70 dark:bg-gray-400/50"
              style={{ top: "66.67%" }}
            />
          </div>

          {/* Position indicator dot */}
          <div
            className={`absolute w-3 h-3 border-2 border-white dark:border-gray-800 rounded-full shadow-md transform -translate-x-1/2 -translate-y-1/2 transition-all duration-150 hover:scale-110 ${
              positionX <= 5 ||
              positionX >= 95 ||
              positionY <= 5 ||
              positionY >= 95
                ? "bg-orange-500 ring-2 ring-orange-300"
                : "bg-blue-500"
            }`}
            style={{
              left: dotLeft,
              top: dotTop,
            }}
          >
            {/* Crosshair lines */}
            <div
              className={`absolute w-6 h-px top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${
                positionX <= 5 ||
                positionX >= 95 ||
                positionY <= 5 ||
                positionY >= 95
                  ? "bg-orange-500/60"
                  : "bg-blue-500/60"
              }`}
            />
            <div
              className={`absolute h-6 w-px top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${
                positionX <= 5 ||
                positionX >= 95 ||
                positionY <= 5 ||
                positionY >= 95
                  ? "bg-orange-500/60"
                  : "bg-blue-500/60"
              }`}
            />
          </div>

          {/* Corner indicators */}
          <div className="absolute top-1 left-1 w-1 h-1 bg-gray-400/50 rounded-full" />
          <div className="absolute top-1 right-1 w-1 h-1 bg-gray-400/50 rounded-full" />
          <div className="absolute bottom-1 left-1 w-1 h-1 bg-gray-400/50 rounded-full" />
          <div className="absolute bottom-1 right-1 w-1 h-1 bg-gray-400/50 rounded-full" />
        </div>

        {/* Helper text */}
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Click or drag to set zoom focus point
          {showPixelCoordinates && (
            <>
              <br />
              <span className="text-[10px]">
                Video: {videoDimensions.width}×{videoDimensions.height}px
              </span>
            </>
          )}
        </p>
      </Card>
    </div>
  );
};
