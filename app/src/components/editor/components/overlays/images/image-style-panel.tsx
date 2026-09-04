import React from "react";
import { ImageOverlay } from "../../../types";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ImageStylePanelProps {
  localOverlay: ImageOverlay;
  handleStyleChange: (updates: Partial<ImageOverlay["styles"]>) => void;
}

export const ImageStylePanel: React.FC<ImageStylePanelProps> = ({
  localOverlay,
  handleStyleChange,
}) => {
  const borderRadius = parseInt(localOverlay?.styles?.borderRadius ?? "0");
  const opacity = localOverlay?.styles?.opacity ?? 1;

  return (
    <div className="space-y-3">
      {/* Fit */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-muted-foreground shrink-0">Fit</span>
        <Select
          value={localOverlay?.styles?.objectFit ?? "cover"}
          onValueChange={(v) => handleStyleChange({ objectFit: v as any })}
        >
          <SelectTrigger className="h-7 text-[11px] w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cover">Cover</SelectItem>
            <SelectItem value="contain">Contain</SelectItem>
            <SelectItem value="fill">Fill</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Opacity */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground shrink-0 w-[60px]">Opacity</span>
        <Slider
          value={[opacity]}
          onValueChange={([v]) => handleStyleChange({ opacity: v })}
          max={1}
          min={0}
          step={0.05}
          className="flex-1"
        />
        <span className="text-[11px] text-muted-foreground tabular-nums min-w-[32px] text-right">
          {Math.round(opacity * 100)}
        </span>
      </div>

      {/* Border Radius */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground shrink-0 w-[60px]">Round</span>
        <Slider
          value={[borderRadius]}
          onValueChange={([v]) => handleStyleChange({ borderRadius: `${v}px` })}
          max={100}
          min={0}
          step={1}
          className="flex-1"
        />
        <span className="text-[11px] text-muted-foreground tabular-nums min-w-[32px] text-right">
          {borderRadius}
        </span>
      </div>
    </div>
  );
};
