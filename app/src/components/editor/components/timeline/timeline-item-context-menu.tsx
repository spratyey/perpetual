import React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Trash2, Copy, Scissors } from "lucide-react";
import { OverlayType } from "../../types";

/**
 * Props for the TimelineItemContextMenu component
 */
interface TimelineItemContextMenuProps {
  /** The content to wrap with the context menu */
  children: React.ReactNode;
  /** Callback fired when the context menu opens or closes */
  onOpenChange: (open: boolean) => void;
  /** Callback to delete the timeline item */
  onDeleteItem: (id: number) => void;
  /** Callback to duplicate the timeline item */
  onDuplicateItem: (id: number) => void;
  /** Callback to split the timeline item */
  onSplitItem: (id: number) => void;
  /** ID of the timeline item this menu belongs to */
  itemId: number;
  /** Type of the overlay item */
  itemType?: OverlayType;
}

/**
 * A context menu component for timeline items that provides delete, duplicate and split actions.
 * The menu is triggered by right-clicking on the wrapped children element.
 *
 * @example
 * ```tsx
 * <TimelineItemContextMenu
 *   itemId={1}
 *   onDeleteItem={handleDelete}
 *   onDuplicateItem={handleDuplicate}
 *   onSplitItem={handleSplit}
 *   onOpenChange={handleOpenChange}
 * >
 *   <TimelineItem />
 * </TimelineItemContextMenu>
 * ```
 */
export const TimelineItemContextMenu: React.FC<
  TimelineItemContextMenuProps
> = ({
  children,
  onOpenChange,
  onDeleteItem,
  onDuplicateItem,
  onSplitItem,
  itemId,
  itemType,
}) => {
  return (
    <ContextMenu onOpenChange={onOpenChange}>
      <ContextMenuTrigger className="z-[100]">{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onDeleteItem(itemId)}>
          <Trash2 className="mr-4 h-4 w-4" />
          Delete
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onDuplicateItem(itemId)}>
          <Copy className="mr-4 h-4 w-4" />
          Duplicate
        </ContextMenuItem>
        {(itemType === OverlayType.VIDEO || itemType === OverlayType.SOUND) && (
          <ContextMenuItem onClick={() => onSplitItem(itemId)}>
            <Scissors className="mr-4 h-4 w-4" />
            Split
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
