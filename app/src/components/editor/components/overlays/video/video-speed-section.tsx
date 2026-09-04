import React from "react";
import { ClipOverlay } from "../../../types";
import { Slider } from "@/components/ui/slider";

interface Props {
  localOverlay: ClipOverlay;
  handleStyleChange: (updates: Partial<ClipOverlay["styles"]>) => void;
}

const SPEED_PRESETS = [0.5, 1, 1.5, 2, 4, 8];

export const VideoSpeedSection: React.FC<Props> = ({
  localOverlay,
  handleStyleChange,
}) => {
  const speed = localOverlay?.styles?.speed ?? 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground shrink-0 w-[60px]">Speed</span>
        <Slider
          value={[speed]}
          onValueChange={([v]) => handleStyleChange({ speed: v })}
          max={8}
          min={0.25}
          step={0.25}
          className="flex-1"
        />
        <span className="text-[11px] text-muted-foreground tabular-nums min-w-[28px] text-right">
          {speed}x
        </span>
      </div>
      <div className="flex flex-wrap gap-1 ml-[68px]">
        {SPEED_PRESETS.map((s) => (
          <button
            key={s}
            onClick={() => handleStyleChange({ speed: s })}
            className={`text-[10px] px-2 py-1 rounded transition-colors ${
              speed === s
                ? "bg-accent text-accent-foreground font-medium"
                : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
};
