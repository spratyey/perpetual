import React from "react";

/**
 * Props for the TimelineItemHandle component
 */
interface TimelineItemHandleProps {
  /** Position of the handle - either on the left or right side */
  position: "left" | "right";
  /** Whether this handle is currently selected */
  isSelected: boolean;
  /** Handler for mouse down events */
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Handler for touch start events - for mobile support */
  onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
}

/**
 * A draggable handle component used in timeline items.
 * Renders a semi-transparent vertical bar with two lines indicating it's draggable.
 * The handle becomes visible on hover or when selected, and supports both mouse and touch interactions.
 */
export const TimelineItemHandle: React.FC<TimelineItemHandleProps> = ({
  position,
  isSelected,
  onMouseDown,
  onTouchStart,
}) => {
  return (
    <div
      className={`bg-zinc-500/10 dark:bg-white/5 w-3 absolute ${position}-0 top-0 bottom-0 z-50
      transition-opacity duration-150 ${
        isSelected
          ? "opacity-100 cursor-ew-resize hover:bg-zinc-500/20 dark:hover:bg-white/10"
          : "opacity-0 pointer-events-none"
      }`}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`space-x-0.5 flex ${
            position === "left" ? "ml-0" : "mr-0"
          }`}
        >
          <div
            className={`w-[1px] h-3 bg-zinc-500/60 dark:bg-white/40 rounded-full`}
          />
          <div
            className={`w-[1px] h-3 bg-zinc-500/60 dark:bg-white/40 rounded-full`}
          />
        </div>
      </div>
    </div>
  );
};
