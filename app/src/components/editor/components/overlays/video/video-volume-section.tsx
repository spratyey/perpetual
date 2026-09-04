import React from "react";
import { ClipOverlay } from "../../../types";
import { Slider } from "@/components/ui/slider";
import { Volume2, VolumeX } from "lucide-react";

interface Props {
  localOverlay: ClipOverlay;
  handleStyleChange: (updates: Partial<ClipOverlay["styles"]>) => void;
}

export const VideoVolumeSection: React.FC<Props> = ({
  localOverlay,
  handleStyleChange,
}) => {
  const volume = localOverlay?.styles?.volume ?? 1;
  const isMuted = volume === 0;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleStyleChange({ volume: isMuted ? 1 : 0 })}
        className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-[60px] p-0 text-left"
      >
        {isMuted ? "Muted" : "Volume"}
      </button>
      <Slider
        value={[volume]}
        onValueChange={([v]) => handleStyleChange({ volume: v })}
        max={1}
        min={0}
        step={0.05}
        className="flex-1"
      />
      <span className="text-[11px] text-muted-foreground tabular-nums min-w-[32px] text-right">
        {Math.round(volume * 100)}
      </span>
    </div>
  );
};
