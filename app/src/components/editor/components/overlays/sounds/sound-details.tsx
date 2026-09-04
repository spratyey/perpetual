import React, { useState, useEffect, useMemo, useRef } from "react";
import { SoundOverlay } from "../../../types";
import { Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { AudioPlayerCard } from "../../shared/audio-player-card";

// Module-level cache so resolved names survive component re-mounts / overlay switches.
const nameCacheMap = new Map<string, string>();

interface SoundDetailsProps {
  localOverlay: SoundOverlay;
  setLocalOverlay: (overlay: SoundOverlay) => void;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
const GENERIC_NAMES = new Set(["audio", "untitled audio", "sound", "untitled"]);

export const SoundDetails: React.FC<SoundDetailsProps> = ({
  localOverlay,
  setLocalOverlay,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  const clipStartSec = (localOverlay.startFromSound || 0) / 30;
  const clipDurationSec = localOverlay.durationInFrames / 30;

  useEffect(() => {
    const audio = new Audio(localOverlay.src);
    audio.onended = () => setIsPlaying(false);
    setAudioEl(audio);
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [localOverlay.src]);

  // Stop at clip end using timeupdate
  useEffect(() => {
    if (!audioEl || !isPlaying) return;
    const clipEnd = clipStartSec + clipDurationSec;
    const onTimeUpdate = () => {
      if (audioEl.currentTime >= clipEnd) {
        audioEl.pause();
        audioEl.currentTime = clipEnd;
        setIsPlaying(false);
      }
    };
    audioEl.addEventListener("timeupdate", onTimeUpdate);
    return () => audioEl.removeEventListener("timeupdate", onTimeUpdate);
  }, [audioEl, isPlaying, clipStartSec, clipDurationSec]);

  const togglePlay = () => {
    if (!audioEl) return;
    if (isPlaying) {
      audioEl.pause();
      setIsPlaying(false);
    } else {
      audioEl.currentTime = clipStartSec;
      audioEl
        .play()
        .catch((error) => console.error("Error playing audio:", error));
      setIsPlaying(true);
    }
  };

  const handleStyleChange = (updates: Partial<SoundOverlay["styles"]>) => {
    setLocalOverlay({
      ...localOverlay,
      styles: { ...localOverlay.styles, ...updates },
    });
  };

  // ── Resolve display name ──
  // Module-level cache: src URL → resolved name (survives re-mounts / overlay switches)
  const nameCache = useRef(nameCacheMap);

  const displayName = useMemo(() => {
    const content = localOverlay.content || "";
    // 1. Check content field (best case — name stored on the overlay itself)
    if (content && !UUID_RE.test(content) && !GENERIC_NAMES.has(content.toLowerCase())) return content;
    // 2. Check URL filename
    if (localOverlay.src) {
      const filename = localOverlay.src.split("/").pop()?.split("?")[0] || "";
      if (filename && !UUID_RE.test(filename) && !GENERIC_NAMES.has(filename.toLowerCase())) return filename;
    }
    // 3. Check module-level cache (instant, no async)
    if (localOverlay.src && nameCache.current.has(localOverlay.src)) return nameCache.current.get(localOverlay.src)!;
    return null;
  }, [localOverlay.content, localOverlay.src]);

  const volume = localOverlay?.styles?.volume ?? 1;
  const isMuted = volume === 0;
  const fadeIn = localOverlay?.styles?.fadeIn ?? 0;
  const fadeOut = localOverlay?.styles?.fadeOut ?? 0;

  return (
    <div className="space-y-4">
      {/* Sound player card */}
      <AudioPlayerCard
        src={localOverlay.src}
        name={displayName || "Audio"}
        duration={clipDurationSec}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        audioElement={audioEl}
        clipStart={clipStartSec}
        clipDuration={clipDurationSec}
        showSkipButtons={false}
      />

      {/* Volume */}
      <div className="space-y-2">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Volume</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleStyleChange({ volume: isMuted ? 1 : 0 })}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
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
      </div>

      {/* Fade In */}
      <div className="space-y-2">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Fade In</span>
        <div className="flex items-center gap-2">
          <Slider
            value={[fadeIn]}
            onValueChange={([v]) => handleStyleChange({ fadeIn: v })}
            max={60}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-[11px] text-muted-foreground tabular-nums min-w-[36px] text-right">
            {(fadeIn / 30).toFixed(1)}s
          </span>
        </div>
      </div>

      {/* Fade Out */}
      <div className="space-y-2">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Fade Out</span>
        <div className="flex items-center gap-2">
          <Slider
            value={[fadeOut]}
            onValueChange={([v]) => handleStyleChange({ fadeOut: v })}
            max={60}
            min={0}
            step={1}
            className="flex-1"
          />
          <span className="text-[11px] text-muted-foreground tabular-nums min-w-[36px] text-right">
            {(fadeOut / 30).toFixed(1)}s
          </span>
        </div>
      </div>
    </div>
  );
};
