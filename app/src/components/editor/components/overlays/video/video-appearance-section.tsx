import React from "react";
import { ClipOverlay } from "../../../types";
import { Slider } from "@/components/ui/slider";

interface Props {
  localOverlay: ClipOverlay;
  handleStyleChange: (updates: Partial<ClipOverlay["styles"]>) => void;
}

export const VideoAppearanceSection: React.FC<Props> = ({
  localOverlay,
  handleStyleChange,
}) => {
  const borderRadius = parseInt(localOverlay?.styles?.borderRadius ?? "0");
  const opacity = localOverlay?.styles?.opacity ?? 1;

  return (
    <div className="space-y-4">
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
