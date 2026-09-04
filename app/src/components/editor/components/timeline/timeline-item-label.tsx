import React from "react";
import { LetterText, Clapperboard, Image, Music, Shapes, Captions } from "lucide-react";
import { OverlayType, Overlay } from "../../types";

/**
 * Props for the TimelineItemLabel component
 * @interface TimelineItemLabelProps
 * @property {Overlay} item - The overlay item to display (text, video, image, sound, or caption)
 * @property {boolean} isSelected - Whether the timeline item is currently selected
 */
interface TimelineItemLabelProps {
  item: Overlay;
  isSelected: boolean;
}

/**
 * Component that renders a label for a timeline item, showing its type and content
 * with appropriate styling and icons based on the overlay type.
 *
 * @component
 * @param {TimelineItemLabelProps} props - Component props
 * @returns {JSX.Element} Rendered timeline item label
 */
export const TimelineItemLabel: React.FC<TimelineItemLabelProps> = ({
  item,
  isSelected,
}) => {
  /**
   * Returns the appropriate icon component based on the overlay type
   * @param {string} type - The type of overlay
   * @returns {JSX.Element | null} Icon component or null
   */
  const getItemIcon = (type: string) => {
    switch (type) {
      case OverlayType.TEXT:
        return <LetterText className="w-2 h-2 mr-0.5" />;
      case OverlayType.VIDEO:
        return <Clapperboard className="w-2 h-2 mr-0.5" />;
      case OverlayType.IMAGE:
        return <Image className="w-2 h-2 mr-0.5" />;
      case OverlayType.SOUND:
        return <Music className="w-2 h-2 mr-0.5" />;
      case OverlayType.SHAPE:
        return <Shapes className="w-2 h-2 mr-0.5" />;
      case OverlayType.CAPTION:
        return <Captions className="w-2 h-2 mr-0.5" />;
      default:
        return null;
    }
  };

  /**
   * Determines the label content to display based on the item type and properties
   * - For captions: returns empty string
   * - For text: returns the content string
   * - For media (image/video/sound): returns filename from src or name property
   * - Fallback: returns the item type
   *
   * @returns {string} The label content to display
   */
  const getLabelContent = () => {
    if (item.type === OverlayType.TEXT && typeof item.content === "string") {
      return item.content;
    }
    if (item.type === OverlayType.CAPTION) {
      return item.content || "Captions";
    }
    if (item.type === OverlayType.SHAPE && "content" in item) {
      return String(item.content).split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
    if (item.type === OverlayType.SOUND && "content" in item && item.content) {
      return String(item.content);
    }
    if ("src" in item && item.src) {
      const filename = item.src.split("/").pop() || "";
      return filename.split("?")[0];
    }
    if ("name" in item && item.name) {
      return String(item.name);
    }
    return String(item.type);
  };

  return (
    <div className="absolute inset-0 flex items-center z-20">
      <div
        className={`flex items-center text-[9px] rounded-[2px] px-1.5 py-0.5
        ${item.type === OverlayType.VIDEO ? "ml-1" : isSelected ? "mx-5" : "mx-2"}
        ${item.type !== OverlayType.VIDEO ? "group-hover:mx-5" : ""}
        transition-all duration-200 ease-in-out
        ${
          item.type === OverlayType.TEXT
            ? "bg-purple-400/30 text-black dark:bg-purple-200/20 dark:text-purple-200"
            : item.type === OverlayType.VIDEO
            ? "bg-sky-400/30 text-black dark:bg-sky-200/20 dark:text-sky-200"
            : item.type === OverlayType.SOUND
            ? "bg-black/40 text-white dark:bg-amber-200/20 dark:text-amber-200"
            : item.type === OverlayType.IMAGE
            ? "bg-teal-400/30 text-black dark:bg-emerald-200/20 dark:text-emerald-200"
            : item.type === OverlayType.SHAPE
            ? "bg-pink-400/30 text-black dark:bg-pink-200/20 dark:text-pink-200"
            : item.type === OverlayType.CAPTION
            ? "bg-indigo-400/30 text-black dark:bg-indigo-200/20 dark:text-indigo-200"
            : "bg-gray-400/30 text-black dark:bg-muted/90 dark:text-gray-200"
        }`}
      >
        <div className="flex items-center gap-0.5" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
          {getItemIcon(item.type)}
          <span className="capitalize truncate max-w-[100px]">
            {getLabelContent()}
          </span>
        </div>
      </div>
    </div>
  );
};
