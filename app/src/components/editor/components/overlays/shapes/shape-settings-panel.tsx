import React from "react";
import { Label } from "@/components/ui/label";
import { ShapeOverlay } from "../../../types";

import { usePathEditContext } from "../../../contexts/path-edit-context";
import { isLineShape } from "./shape-definitions";

interface ShapeSettingsPanelProps {
  localOverlay: ShapeOverlay;
  handleStyleChange: (updates: Partial<ShapeOverlay["styles"]>) => void;
}

const PRESET_COLORS = [
  "#FFFFFF", "#000000", "#EF4444", "#F97316", "#EAB308",
  "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899", "#06B6D4",
];

const DASH_PATTERNS = [
  { label: "Solid", value: "" },
  { label: "Dashed", value: "8 4" },
  { label: "Dotted", value: "2 4" },
  { label: "Dash-Dot", value: "8 4 2 4" },
];

export const ShapeSettingsPanel: React.FC<ShapeSettingsPanelProps> = ({
  localOverlay,
  handleStyleChange,
}) => {
  const { pathEditingId, enterPathEdit, exitPathEdit } = usePathEditContext();
  const isPathEditing = pathEditingId === localOverlay.id;
  const hasCustomPath = !!localOverlay.styles.pathData;
  const isLine = isLineShape(localOverlay.content);

  const fill = localOverlay.styles.fill ?? "transparent";
  const stroke = localOverlay.styles.stroke ?? "none";
  const strokeWidth = localOverlay.styles.strokeWidth ?? 0;
  const opacity = localOverlay.styles.opacity ?? 1;
  const strokeDasharray = localOverlay.styles.strokeDasharray ?? "";
  const isTransparentFill = fill === "transparent" || fill === "none";
  const isTransparentStroke = stroke === "transparent" || stroke === "none";

  // Whether this shape supports SVG corner radius control
  const isRectShape = localOverlay.content === "rectangle" || localOverlay.content === "rounded-rect";
  const cornerRadius = isRectShape
    ? (localOverlay.styles.cornerRadius ?? (localOverlay.content === "rounded-rect" ? 15 : 0))
    : (parseInt(localOverlay.styles.borderRadius || "0") || 0);

  // ── Reusable sub-sections ──

  const renderStrokeSection = () => (
    <div className="space-y-3 rounded-md bg-muted/50 p-3 border border-border">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-foreground">Stroke</h3>
        {!isLine && (
          <button
            onClick={() => {
              if (isTransparentStroke) {
                handleStyleChange({ stroke: "#000000", strokeWidth: strokeWidth || 2 });
              } else {
                handleStyleChange({ stroke: "none", strokeWidth: 0 });
              }
            }}
            className={`px-2 py-0.5 text-[10px] rounded-md border transition-colors ${
              isTransparentStroke
                ? "bg-accent text-accent-foreground border-accent"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {isTransparentStroke ? "No Stroke" : "Remove"}
          </button>
        )}
      </div>

      {(!isTransparentStroke || isLine) && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => handleStyleChange({ stroke: color, strokeWidth: strokeWidth || 2 })}
                className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                  stroke === color ? "border-foreground scale-110" : "border-border"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={isTransparentStroke ? "#a78bfa" : stroke}
              onChange={(e) => handleStyleChange({ stroke: e.target.value, strokeWidth: strokeWidth || 2 })}
              className="w-7 h-6 rounded border border-border cursor-pointer"
            />
            <input
              type="text"
              value={isTransparentStroke ? "" : stroke}
              onChange={(e) => handleStyleChange({ stroke: e.target.value })}
              placeholder="#000000"
              className="flex-1 px-2 py-1 text-xs rounded-md border border-border bg-background text-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground">Width</Label>
              <span className="text-[10px] text-muted-foreground">{strokeWidth}px</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={20}
              step={0.5}
              value={strokeWidth}
              onChange={(e) => handleStyleChange({ strokeWidth: parseFloat(e.target.value) })}
              className="w-full accent-primary h-1"
            />
          </div>
          {/* Dash pattern */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Style</Label>
            <div className="flex gap-1">
              {DASH_PATTERNS.map(({ label, value }) => (
                <button
                  key={label}
                  onClick={() => handleStyleChange({ strokeDasharray: value || undefined })}
                  title={label}
                  className={`flex-1 h-7 rounded border flex items-center justify-center transition-colors ${
                    strokeDasharray === value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <svg width="28" height="4" viewBox="0 0 28 4">
                    <line
                      x1="0" y1="2" x2="28" y2="2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray={value || undefined}
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderFillSection = () => (
    <div className="space-y-3 rounded-md bg-muted/50 p-3 border border-border">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-foreground">Fill</h3>
        <button
          onClick={() => handleStyleChange({ fill: isTransparentFill ? "#3B82F6" : "transparent" })}
          className={`px-2 py-0.5 text-[10px] rounded-md border transition-colors ${
            isTransparentFill
              ? "bg-accent text-accent-foreground border-accent"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {isTransparentFill ? "No Fill" : "Remove"}
        </button>
      </div>

      {!isTransparentFill && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => handleStyleChange({ fill: color })}
                className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                  fill === color ? "border-foreground scale-110" : "border-border"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={fill}
              onChange={(e) => handleStyleChange({ fill: e.target.value })}
              className="w-7 h-6 rounded border border-border cursor-pointer"
            />
            <input
              type="text"
              value={fill}
              onChange={(e) => handleStyleChange({ fill: e.target.value })}
              className="flex-1 px-2 py-1 text-xs rounded-md border border-border bg-background text-foreground"
            />
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Path Editing */}
      <div className="flex gap-2">
        <button
          onClick={() => isPathEditing ? exitPathEdit() : enterPathEdit(localOverlay.id)}
          className={`flex-1 px-3 py-1.5 text-xs rounded-md border transition-colors ${
            isPathEditing
              ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
              : "bg-accent text-accent-foreground border-border hover:bg-accent/80"
          }`}
        >
          {isPathEditing ? "Exit Path Edit" : "Edit Path"}
        </button>
        {hasCustomPath && (
          <button
            onClick={() => {
              handleStyleChange({ pathData: undefined, pathViewBox: undefined });
              exitPathEdit();
            }}
            className="px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* Corner Radius (all non-line shapes) */}
      {!isLine && !hasCustomPath && (
        <div className="space-y-2 rounded-md bg-muted/50 p-3 border border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-foreground">Corner Radius</h3>
            <span className="text-[10px] text-muted-foreground">{cornerRadius}{isRectShape ? '' : 'px'}</span>
          </div>
          <input
            type="range"
            min={0}
            max={isRectShape ? 50 : 100}
            step={1}
            value={cornerRadius}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (isRectShape) {
                handleStyleChange({ cornerRadius: val });
              } else {
                handleStyleChange({ borderRadius: val > 0 ? `${val}px` : undefined });
              }
            }}
            className="w-full accent-primary h-1"
          />
        </div>
      )}

      {/* For lines: Stroke first, then optionally Fill */}
      {isLine ? (
        <>
          {renderStrokeSection()}
          {renderFillSection()}
        </>
      ) : (
        <>
          {renderFillSection()}
          {renderStrokeSection()}
        </>
      )}

      {/* Opacity */}
      <div className="space-y-2 rounded-md bg-muted/50 p-3 border border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-foreground">Opacity</h3>
          <span className="text-[10px] text-muted-foreground">{Math.round(opacity * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => handleStyleChange({ opacity: parseFloat(e.target.value) })}
          className="w-full accent-primary h-1"
        />
      </div>

    </div>
  );
};
