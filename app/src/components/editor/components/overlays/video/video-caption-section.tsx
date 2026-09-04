import React, { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCaptionStore } from "@/local/caption-store";
import { ClipOverlay } from "../../../types";

function Pills<T extends string | boolean>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  disabled: boolean;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[60px] shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {options.map((option) => (
          <button
            key={String(option.id)}
            onClick={() => onChange(option.id)}
            disabled={disabled}
            className={`rounded px-2 py-1 text-[10px] transition-colors ${
              value === option.id
                ? "bg-accent font-medium text-accent-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export const VideoCaptionSection: React.FC<{ overlay: ClipOverlay }> = ({ overlay }) => {
  const { captionClip, stage, error, isRunning } = useCaptionStore();
  const [maskSubject, setMaskSubject] = useState(true);
  const [fontFamily, setFontFamily] = useState<"serif" | "sans">("serif");

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Transcribes the speech in this clip and lays it back over itself: each line typeset with its
        key phrase large, revealed in time with the voice, and placed to graze the subject.
      </p>

      <Pills
        label="Font"
        value={fontFamily}
        options={[{ id: "serif", label: "Serif" }, { id: "sans", label: "Sans" }]}
        disabled={isRunning}
        onChange={setFontFamily}
      />
      <Pills
        label="Depth"
        value={maskSubject}
        options={[{ id: true, label: "Behind subject" }, { id: false, label: "Flat" }]}
        disabled={isRunning}
        onChange={setMaskSubject}
      />

      <Button
        size="sm"
        className="w-full gap-1.5"
        disabled={isRunning}
        onClick={() => void captionClip({ overlayId: overlay.id, maskSubject, fontFamily, source: "human" })}
      >
        {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {isRunning ? "Working…" : "Generate captions"}
      </Button>

      {stage && <p className="text-[11px] text-muted-foreground">{stage}</p>}
      {!isRunning && error && <p className="text-[11px] text-destructive">{error}</p>}
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Needs your Gemini key. The clip is uploaded to Google, transcribed, then deleted there; the
        subject is separated in this browser.
      </p>
    </div>
  );
};
