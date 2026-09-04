import React, { useState } from "react";
import { useEditorContext } from "../../../contexts/editor-context";
import { useTimelinePositioning } from "../../../hooks/use-timeline-positioning";
import { useAspectRatio } from "../../../hooks/use-aspect-ratio";
import { OverlayType, TextOverlay } from "../../../types";
import { textOverlayTemplates, TEXT_CATEGORIES } from "../../../templates/text-overlay-templates";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SelectTextOverlayProps {
  setLocalOverlay: (overlay: TextOverlay) => void;
}

export const SelectTextOverlay: React.FC<SelectTextOverlayProps> = () => {
  const { addOverlay, overlays, batchUpdate, currentFrame } = useEditorContext();
  const { findSmartPositionForType } = useTimelinePositioning();
  const { getAspectRatioDimensions } = useAspectRatio();
  const [activeCategory, setActiveCategory] = useState<string>("titles");

  const handleAddOverlay = (option: (typeof textOverlayTemplates)[string]) => {
    const { from, row, rowShifts } = findSmartPositionForType(
      overlays,
      90,
      OverlayType.TEXT,
      currentFrame
    );

    // Size text box relative to canvas — 80% width, centered
    const canvas = getAspectRatioDimensions();
    const textWidth = Math.round(canvas.width * 0.8);
    const textHeight = Math.round(canvas.height * 0.15);
    const textLeft = Math.round((canvas.width - textWidth) / 2);
    const textTop = Math.round((canvas.height - textHeight) / 2);

    const newOverlay: TextOverlay = {
      left: textLeft,
      top: textTop,
      width: textWidth,
      height: textHeight,
      durationInFrames: 90,
      from,
      id: Date.now(),
      row,
      rotation: 0,
      isDragging: false,
      type: OverlayType.TEXT,
      content: option.content ?? "Testing",
      styles: {
        ...option.styles,
        fontSize: "3rem",
        opacity: 1,
        zIndex: 1,
        transform: "none",
        textAlign: option.styles.textAlign as "left" | "center" | "right",
      } as TextOverlay["styles"],
    };

    if (rowShifts.length > 0 && batchUpdate) {
      // Shift existing overlays down and add new overlay atomically
      const updates = rowShifts.map((s) => ({ id: s.id, overlay: { row: s.newRow } }));
      batchUpdate(updates, newOverlay);
    } else {
      addOverlay(newOverlay);
    }
  };

  const filtered = Object.entries(textOverlayTemplates).filter(
    ([, t]) => t.category === activeCategory
  );

  return (
    <div className="flex flex-col h-full">
      {/* Category tabs */}
      <div className="flex gap-1 px-2 pt-2 pb-1 shrink-0 flex-wrap">
        {TEXT_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              activeCategory === cat.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-1 gap-2 p-2">
          {filtered.map(([key, option]) => (
            <div
              key={key}
              onClick={() => handleAddOverlay(option)}
              draggable
              onDragStart={(e) => {
                const durFrames = 90;
                e.dataTransfer.setData("application/x-perpetual-asset", JSON.stringify({
                  type: "text",
                  templateKey: key,
                  content: option.content,
                  styles: option.styles,
                }));
                window.dispatchEvent(new CustomEvent("perpetual-asset-drag-start", { detail: { durationFrames: durFrames } }));
              }}
              className="group relative overflow-hidden border bg-muted rounded-md border-border transition-all duration-200 hover:border-primary cursor-pointer"
            >
              <div className="aspect-[16/6] w-full flex items-center justify-center p-2 pb-10">
                <div
                  className="transform-gpu transition-transform duration-200 group-hover:scale-[1.02] text-foreground"
                  style={{
                    ...option.styles,
                    fontSize: "1.25rem",
                    padding: option.styles.padding || undefined,
                    fontFamily: option.styles.fontFamily?.startsWith("font-")
                      ? undefined
                      : option.styles.fontFamily,
                    color: option.styles.WebkitTextFillColor === "transparent"
                      ? undefined
                      : option.styles.color || undefined,
                  }}
                >
                  {option.content}
                </div>
              </div>
              <div className="absolute bottom-0 inset-x-0 bg-background/40 backdrop-blur-[2px] px-3 py-1.5">
                <div className="font-medium text-foreground text-[11px]">
                  {option.name}
                </div>
                <div className="text-muted-foreground text-[9px] leading-tight">
                  {option.preview}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
