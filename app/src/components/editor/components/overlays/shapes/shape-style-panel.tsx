import React from "react";
import { Label } from "@/components/ui/label";
import { ShapeOverlay } from "../../../types";

interface ShapeStylePanelProps {
  localOverlay: ShapeOverlay;
  handleStyleChange: (updates: Partial<ShapeOverlay["styles"]>) => void;
}

const GRADIENT_PRESETS = [
  { label: "Sunset", value: "#f97316, #ec4899" },
  { label: "Ocean", value: "#06b6d4, #3b82f6" },
  { label: "Forest", value: "#22c55e, #059669" },
  { label: "Purple", value: "#a78bfa, #7c3aed" },
  { label: "Gold", value: "#fbbf24, #f59e0b" },
  { label: "Rose", value: "#fb7185, #e11d48" },
];

export const ShapeStylePanel: React.FC<ShapeStylePanelProps> = ({
  localOverlay,
  handleStyleChange,
}) => {
  const gradient = localOverlay.styles.gradient || "";
  const boxShadow = localOverlay.styles.boxShadow || "";

  return (
    <div className="space-y-6">
      {/* Gradient */}
      <div className="space-y-4 rounded-md bg-muted/50 p-4 border border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Gradient</h3>
          {gradient && (
            <button
              onClick={() => handleStyleChange({ gradient: undefined })}
              className="text-[10px] px-2 py-0.5 rounded-md border border-border text-muted-foreground hover:text-foreground"
            >
              Remove
            </button>
          )}
        </div>

        {/* Presets */}
        <div className="grid grid-cols-3 gap-1.5">
          {GRADIENT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handleStyleChange({ gradient: preset.value })}
              className={`h-8 rounded-md border-2 transition-all hover:scale-105 ${
                gradient === preset.value ? "border-foreground" : "border-border"
              }`}
              style={{ background: `linear-gradient(135deg, ${preset.value})` }}
              title={preset.label}
            />
          ))}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Custom</Label>
          <input
            type="text"
            value={gradient}
            onChange={(e) => handleStyleChange({ gradient: e.target.value || undefined })}
            placeholder="#3B82F6, #8B5CF6"
            className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground"
          />
          {gradient && (
            <div
              className="h-6 rounded-md border border-border"
              style={{ background: `linear-gradient(135deg, ${gradient})` }}
            />
          )}
        </div>
      </div>

      {/* Shadow */}
      <div className="space-y-4 rounded-md bg-muted/50 p-4 border border-border">
        <h3 className="text-sm font-medium text-foreground">Shadow</h3>

        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "None", value: "" },
            { label: "Soft", value: "0 4px 12px rgba(0,0,0,0.15)" },
            { label: "Medium", value: "0 6px 20px rgba(0,0,0,0.25)" },
            { label: "Hard", value: "0 8px 30px rgba(0,0,0,0.4)" },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => handleStyleChange({ boxShadow: preset.value || undefined })}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                (boxShadow || "") === preset.value
                  ? "bg-accent text-accent-foreground border-accent"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Custom</Label>
          <input
            type="text"
            value={boxShadow}
            onChange={(e) => handleStyleChange({ boxShadow: e.target.value || undefined })}
            placeholder="0 4px 6px rgba(0,0,0,0.3)"
            className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Border Radius — now in Basic tab; kept here only as a read-only preview */}
    </div>
  );
};
