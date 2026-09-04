import React from "react";
import { FPS } from "../../constants";

/**
 * Props for the TimeMarkers component
 * @typedef {Object} TimeMarkersProps
 * @property {number} durationInFrames - Total number of frames in the timeline
 * @property {function} handleTimelineClick - Callback function when timeline is clicked
 * @property {number} zoomScale - Current zoom level of the timeline
 */
type TimeMarkersProps = {
  durationInFrames: number;
  zoomScale: number;
};

/**
 * Renders timeline markers with adaptive scaling based on zoom level
 * Displays time indicators and clickable markers for timeline navigation
 */
const TimeMarkers = ({
  durationInFrames,
  zoomScale,
}: TimeMarkersProps): JSX.Element => {
  const generateMarkers = (): JSX.Element[] => {
    const markers: JSX.Element[] = [];
    // Calculate total seconds more precisely using frames
    const totalSeconds = durationInFrames / FPS;

    // Dynamic interval calculation based on zoom level
    // At higher zoom levels, the timeline is wider so we need proportionally
    // more markers to keep density consistent in the visible viewport.
    const baseInterval = (() => {
      const markersInViewport = 30;
      const targetMarkerCount = Math.round(markersInViewport * zoomScale);
      const rawInterval = totalSeconds / targetMarkerCount;

      // Nice intervals spanning sub-frame to 5 minutes
      const niceIntervals = [
        0.02, 0.04, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300,
      ];
      return niceIntervals.reduce((prev, curr) =>
        Math.abs(curr - rawInterval) < Math.abs(prev - rawInterval)
          ? curr
          : prev
      );
    })();

    // Calculate sub-intervals for different marker types
    const majorInterval = baseInterval;
    const minorInterval = baseInterval / 4;
    const microInterval = baseInterval / 8;
    // Show a label at every major marker
    const labelInterval = majorInterval;

    // Generate marker elements
    // Use tolerance relative to the micro interval to handle floating-point drift
    const eps = microInterval * 0.1;
    for (let time = 0; time <= totalSeconds; time += microInterval) {
      const [minutes, seconds] = [Math.floor(time / 60), time % 60];
      const isMainMarker = majorInterval > 0 && Math.abs(Math.round(time / majorInterval) * majorInterval - time) < eps;
      const isIntermediateMarker = minorInterval > 0 && Math.abs(Math.round(time / minorInterval) * minorInterval - time) < eps;
      const shouldShowLabel = isMainMarker && time > 0;

      const markerElement = (
        <div
          key={time}
          className="absolute top-0 flex flex-col items-center"
          style={{
            left: `${(time / totalSeconds) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div
            className={`
              ${
                isMainMarker
                  ? "h-2 w-[1px] bg-gray-300 dark:bg-gray-600/50"
                  : isIntermediateMarker
                  ? "h-1 w-px bg-gray-300 dark:bg-gray-600/40"
                  : "h-0.5 w-px bg-gray-200 dark:bg-gray-600/30"
              }
              group-hover:bg-blue-500/50 dark:group-hover:bg-blue-300/50
            `}
          />
          {shouldShowLabel && (
            <span
              className={`
                text-[8px] font-light tracking-tight
                ${
                  isMainMarker
                    ? "text-gray-700 dark:text-gray-300/90"
                    : "text-gray-500 dark:text-gray-500/60"
                }
                mt-0.5 select-none
                duration-150
              `}
            >
              {`${minutes}:${Math.floor(seconds).toString().padStart(2, "0")}${
                seconds % 1 !== 0 ? `.${(seconds % 1).toFixed(2).slice(2)}` : ""
              }`}
            </span>
          )}
        </div>
      );

      markers.push(markerElement);
    }

    return markers;
  };

  return (
    <div
      className="absolute top-0 left-0 right-0 h-full  
        pointer-events-none
        z-10"
    >
      {generateMarkers()}
    </div>
  );
};

export default TimeMarkers;
