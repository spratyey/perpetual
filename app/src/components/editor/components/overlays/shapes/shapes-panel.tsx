import React, { useState, useMemo } from "react";
import { Search, Pencil, PenTool, Minus, MoveRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEditorContext } from "../../../contexts/editor-context";
import { useTimelinePositioning } from "../../../hooks/use-timeline-positioning";
import { usePathEditContext, DrawingMode } from "../../../contexts/path-edit-context";
import { Overlay, OverlayType } from "../../../types";
import { shapesByCategory, categoryLabels, ShapeDefinition, shapeDefinitions } from "./shape-definitions";

const PREVIEW_FILL = "#a78bfa";
const PREVIEW_STROKE = "#7c3aed";

// Categories to show in the panel (exclude "drawn" which is only for programmatic use)
const visibleCategories = ["basic", "arrows", "lines", "stars", "callouts", "other"];

const DRAWING_TOOLS: { mode: DrawingMode; label: string; icon: React.FC<any>; description: string }[] = [
  { mode: "freehand", label: "Freehand", icon: Pencil, description: "Draw freely" },
  { mode: "pen", label: "Pen", icon: PenTool, description: "Bezier path" },
  { mode: "line", label: "Line", icon: Minus, description: "Straight line" },
  { mode: "arrow-line", label: "Arrow", icon: MoveRight, description: "Arrow line" },
];

export const ShapesPanel: React.FC = () => {
  const [search, setSearch] = useState("");
  const { addOverlay, overlays, batchUpdate, currentFrame } = useEditorContext();
  const { findSmartPositionForType } = useTimelinePositioning();
  const { drawingMode, setDrawingMode } = usePathEditContext();

  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return shapeDefinitions.filter(
      (s) => s.category !== "drawn" && (s.label.toLowerCase().includes(q) || s.key.includes(q) || s.category.includes(q))
    );
  }, [search]);

  const handleAddShape = (shape: ShapeDefinition) => {
    const { from, row, rowShifts } = findSmartPositionForType(overlays, 150, OverlayType.SHAPE, currentFrame);
    const isLine = shape.isLine === true;

    const newOverlay: Overlay = {
      left: 100,
      top: 100,
      width: shape.defaultW,
      height: shape.defaultH,
      aspectRatioLocked: false,
      durationInFrames: 150,
      from,
      id: Date.now(),
      rotation: 0,
      row,
      isDragging: false,
      type: OverlayType.SHAPE,
      content: shape.key,
      styles: isLine
        ? {
            fill: "none",
            stroke: "#a78bfa",
            strokeWidth: 4,
            strokeLinecap: "round",
            opacity: 1,
          }
        : {
            fill: "#a78bfa",
            stroke: "none",
            strokeWidth: 0,
            opacity: 1,
            ...(shape.key === "rounded-rect" ? { cornerRadius: 15 } : {}),
          },
    };
    if (rowShifts.length > 0 && batchUpdate) {
      const updates = rowShifts.map((s) => ({ id: s.id, overlay: { row: s.newRow } }));
      batchUpdate(updates, newOverlay);
    } else {
      addOverlay(newOverlay);
    }
  };

  const handleToolClick = (mode: DrawingMode) => {
    setDrawingMode(drawingMode === mode ? "none" : mode);
  };

  const renderGrid = (shapes: ShapeDefinition[]) => (
    <div className="grid grid-cols-3 gap-1.5">
      {shapes.map((shape) => (
        <button
          key={shape.key}
          onClick={() => handleAddShape(shape)}
          draggable
          onDragStart={(e) => {
            const durFrames = 150;
            e.dataTransfer.setData("application/x-perpetual-asset", JSON.stringify({
              type: "shape",
              shapeKey: shape.key,
              defaultW: shape.defaultW,
              defaultH: shape.defaultH,
              isLine: shape.isLine || false,
            }));
            window.dispatchEvent(new CustomEvent("perpetual-asset-drag-start", { detail: { durationFrames: durFrames } }));
          }}
          className="group flex flex-col items-center gap-1 p-2.5 rounded-lg border border-transparent hover:border-primary/30 hover:bg-accent/30 transition-all duration-150"
        >
          <div className="w-10 h-10 flex items-center justify-center">
            <svg
              viewBox={shape.viewBox}
              className="w-8 h-8 group-hover:scale-110 transition-transform duration-150"
              preserveAspectRatio="xMidYMid meet"
            >
              {shape.isLine
                ? shape.path("none", PREVIEW_FILL, 4)
                : shape.path(PREVIEW_FILL, PREVIEW_STROKE, 1.5)
              }
            </svg>
          </div>
          <span className="text-[10px] text-muted-foreground truncate w-full text-center leading-tight">
            {shape.label}
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-3 p-4 bg-background h-full overflow-y-auto">
      {/* Header */}
      <h2 className="text-sm font-semibold text-foreground">Shapes</h2>

      {/* Drawing Tools */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Draw</span>
        <div className="grid grid-cols-4 gap-1.5">
          {DRAWING_TOOLS.map(({ mode, label, icon: Icon, description }) => {
            const isActive = drawingMode === mode;
            return (
              <button
                key={mode}
                onClick={() => handleToolClick(mode)}
                title={description}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all duration-150 ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/30 hover:bg-accent/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px] leading-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search shapes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs bg-background border-border"
        />
      </div>

      {/* Shape Grid */}
      {filtered ? (
        filtered.length > 0 ? (
          renderGrid(filtered)
        ) : (
          <p className="text-xs text-muted-foreground text-center py-6">No shapes found</p>
        )
      ) : (
        visibleCategories
          .filter((cat) => shapesByCategory[cat]?.length > 0)
          .map((cat) => (
            <div key={cat} className="space-y-1.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {categoryLabels[cat]}
              </span>
              {renderGrid(shapesByCategory[cat])}
            </div>
          ))
      )}
    </div>
  );
};
