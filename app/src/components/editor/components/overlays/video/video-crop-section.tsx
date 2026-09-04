import React from "react";
import { ClipOverlay, CropEffect } from "../../../types";
import { Button } from "@/components/ui/button";
import { RotateCcw, MousePointerClick } from "lucide-react";

interface Props {
  localOverlay: ClipOverlay;
  handleStyleChange: (updates: Partial<ClipOverlay["styles"]>) => void;
}

export const VideoCropSection: React.FC<Props> = ({
  localOverlay,
  handleStyleChange,
}) => {
  const hasCrop = !!localOverlay?.styles?.cropEffect;
  const crop = localOverlay?.styles?.cropEffect;

  const removeCrop = () => {
    handleStyleChange({ cropEffect: null as any });
  };

  const resetCrop = () => {
    handleStyleChange({ cropEffect: null as any });
  };

  return (
    <div className="space-y-2">
      {!hasCrop ? null : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Crop</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetCrop} title="Reset crop">
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={removeCrop}>
                Remove
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Crop: {Math.round(crop!.width)}% × {Math.round(crop!.height)}% at ({Math.round(crop!.x)}, {Math.round(crop!.y)})
          </div>

          <div className="grid grid-cols-4 gap-2 text-xs">
            {[
              { label: "X", key: "x" as const, max: 100 - (crop?.width ?? 100) },
              { label: "Y", key: "y" as const, max: 100 - (crop?.height ?? 100) },
              { label: "W", key: "width" as const, max: 100 - (crop?.x ?? 0), min: 5 },
              { label: "H", key: "height" as const, max: 100 - (crop?.y ?? 0), min: 5 },
            ].map(({ label, key, max, min }) => (
              <div key={key} className="space-y-1">
                <label className="text-muted-foreground">{label}</label>
                <input
                  type="number"
                  min={min ?? 0}
                  max={max}
                  step="1"
                  value={Math.round(crop![key])}
                  onChange={(e) => {
                    const val = Math.max(min ?? 0, Math.min(max, Number(e.target.value)));
                    handleStyleChange({ cropEffect: { ...crop!, [key]: val } });
                  }}
                  className="w-full px-1 py-1 text-xs border border-border rounded bg-card text-foreground"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 text-muted-foreground pt-1">
            <MousePointerClick className="w-3.5 h-3.5" />
            <span className="text-[10px]">Double-click video to adjust crop visually</span>
          </div>
        </>
      )}
    </div>
  );
};
