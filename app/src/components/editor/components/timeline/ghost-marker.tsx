import React from "react";

/**
 * Props for the GhostMarker component.
 */
interface GhostMarkerProps {
  /** The horizontal position of the marker as a percentage (0-100) or null if not set. */
  position: number | null;

  /** Indicates whether a dragging action is currently in progress. */
  isDragging: boolean;

  /** Indicates whether the context menu is open. */
  isContextMenuOpen: boolean;
}

/**
 * GhostMarker component displays a vertical line with a triangle on top to indicate a specific position.
 * It's typically used in editing interfaces to show potential insertion points or selections.
 *
 * @param {GhostMarkerProps} props - The props for the GhostMarker component.
 * @returns {React.ReactElement | null} The rendered GhostMarker or null if it should not be displayed.
 */
const GhostMarker: React.FC<GhostMarkerProps> = ({
  position,
  isDragging,
  isContextMenuOpen,
}) => {
  // Don't render the marker on mobile, when position is not set, or during dragging
  if (position === null || isDragging || isContextMenuOpen) {
    return null;
  }

  return (
    <div
      className="absolute top-0 w-[1.5px] bg-zinc-500/70 dark:bg-white/30 pointer-events-none z-40"
      style={{
        left: `calc(${position}% - 1px)`,
        height: "calc(100% + 0px)",
      }}
    >
      <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-zinc-500/70 dark:border-t-white/40 absolute top-[0px] left-1/2 transform -translate-x-1/2" />
    </div>
  );
};

export default GhostMarker;
