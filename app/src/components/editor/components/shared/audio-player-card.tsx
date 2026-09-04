import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

interface AudioPlayerCardProps {
  src: string;
  name: string;
  duration?: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  audioElement?: HTMLAudioElement | null;
  clipStart?: number;
  clipDuration?: number;
  showSkipButtons?: boolean;
  /** Album art / thumbnail URL */
  image?: string;
  children?: React.ReactNode;
}

export const AudioPlayerCard: React.FC<AudioPlayerCardProps> = ({
  src,
  name,
  duration,
  isPlaying,
  onTogglePlay,
  audioElement,
  clipStart,
  clipDuration,
  showSkipButtons = false,
  image,
  children,
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const effectiveStart = clipStart ?? 0;
  const effectiveDuration = clipDuration ?? duration ?? 0;

  // Direct DOM updates for smooth progress — avoids React re-render overhead
  useEffect(() => {
    if (isSeeking) return;
    if (!isPlaying || !audioElement) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Reset bar
      if (progressRef.current) progressRef.current.style.width = "0%";
      setCurrentTime(0);
      return;
    }
    let lastUpdate = 0;
    const tick = (now: number) => {
      if (audioElement) {
        const elapsed = audioElement.currentTime - effectiveStart;
        const totalDur = effectiveDuration > 0 ? effectiveDuration : (audioElement.duration - effectiveStart);
        if (totalDur > 0) {
          const pct = Math.min(100, Math.max(0, (elapsed / totalDur) * 100));
          // Update DOM directly for smooth bar
          if (progressRef.current) {
            progressRef.current.style.width = `${pct}%`;
          }
          // Update React state less frequently (every ~200ms) for time display
          if (now - lastUpdate > 200) {
            setCurrentTime(Math.max(0, elapsed));
            lastUpdate = now;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, audioElement, effectiveStart, effectiveDuration, isSeeking]);

  // Reset when stopped
  useEffect(() => {
    if (!isPlaying) {
      if (progressRef.current) progressRef.current.style.width = "0%";
      setCurrentTime(0);
    }
  }, [isPlaying]);

  const seekTo = useCallback((fraction: number) => {
    if (!audioElement) return;
    const clamped = Math.min(1, Math.max(0, fraction));
    const totalDur = effectiveDuration > 0 ? effectiveDuration : (audioElement.duration - effectiveStart);
    audioElement.currentTime = effectiveStart + clamped * totalDur;
    if (progressRef.current) progressRef.current.style.width = `${clamped * 100}%`;
    setCurrentTime(clamped * totalDur);
  }, [audioElement, effectiveStart, effectiveDuration]);

  const handleScrubStart = useCallback((e: React.MouseEvent) => {
    if (!scrubberRef.current || !audioElement) return;
    e.preventDefault();
    setIsSeeking(true);
    const rect = scrubberRef.current.getBoundingClientRect();
    seekTo((e.clientX - rect.left) / rect.width);

    const onMove = (ev: MouseEvent) => {
      const f = (ev.clientX - rect.left) / rect.width;
      seekTo(f);
    };
    const onUp = () => {
      setIsSeeking(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [audioElement, seekTo]);

  const skipForward = useCallback(() => {
    if (!audioElement) return;
    const totalDur = effectiveDuration > 0 ? effectiveDuration : audioElement.duration;
    audioElement.currentTime = Math.min(audioElement.currentTime + 5, effectiveStart + totalDur);
  }, [audioElement, effectiveStart, effectiveDuration]);

  const skipBack = useCallback(() => {
    if (!audioElement) return;
    audioElement.currentTime = Math.max(audioElement.currentTime - 5, effectiveStart);
  }, [audioElement, effectiveStart]);

  const barSeeds = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        height: 40 + Math.sin(i * 0.7) * 30,
        dur: 0.4 + (((i * 7 + 3) % 10) / 10) * 0.4,
        delay: i * 0.04,
      })),
    []
  );

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const displayDuration = effectiveDuration > 0 ? effectiveDuration : duration;

  return (
    <div
      className={`relative rounded-md overflow-hidden transition-all duration-200 ${
        isPlaying
          ? "border border-zinc-600 bg-zinc-800/80"
          : "border border-border hover:bg-zinc-800/50"
      }`}
    >
      {/* Animated waveform bars */}
      {isPlaying && (
        <>
          <style>{`
            @keyframes audioBarShared {
              0% { transform: scaleY(0.3); }
              100% { transform: scaleY(1); }
            }
          `}</style>
          <div className="absolute inset-0 flex items-end justify-around px-8 pb-3 pointer-events-none opacity-[0.08]">
            {barSeeds.map((bar, i) => (
              <div
                key={i}
                className="w-[2px] rounded-full origin-bottom bg-white"
                style={{
                  height: `${bar.height}%`,
                  animation: `audioBarShared ${bar.dur}s ease-in-out ${bar.delay}s infinite alternate`,
                }}
              />
            ))}
          </div>
        </>
      )}

      <div className="relative flex items-center gap-2.5 px-2.5 py-2 overflow-hidden">
        {/* Album art */}
        {image && (
          <div className="relative h-10 w-10 rounded overflow-hidden shrink-0 bg-muted z-10">
            <img src={image} alt="" className="object-cover w-full h-full" />
          </div>
        )}

        {showSkipButtons && isPlaying && (
          <button
            onClick={(e) => { e.stopPropagation(); skipBack(); }}
            className="relative z-10 h-6 w-6 shrink-0 flex items-center justify-center rounded text-zinc-400 hover:text-white transition-colors"
          >
            <SkipBack className="h-3 w-3" />
          </button>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
          className={`relative z-10 h-8 w-8 shrink-0 flex items-center justify-center rounded-full transition-colors ${
            isPlaying
              ? "bg-white/15 text-white"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
          }`}
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
        </button>

        {showSkipButtons && isPlaying && (
          <button
            onClick={(e) => { e.stopPropagation(); skipForward(); }}
            className="relative z-10 h-6 w-6 shrink-0 flex items-center justify-center rounded text-zinc-400 hover:text-white transition-colors"
          >
            <SkipForward className="h-3 w-3" />
          </button>
        )}

        <div className="relative z-10 w-0 flex-1 overflow-hidden">
          <p className="text-[12px] font-medium text-foreground truncate leading-tight" title={name}>
            {name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isPlaying && displayDuration ? (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {fmtTime(currentTime)} / {fmtTime(displayDuration)}
              </span>
            ) : displayDuration != null && displayDuration > 0 ? (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {fmtTime(displayDuration)}
              </span>
            ) : null}
            {children}
          </div>
        </div>
      </div>

      {/* Seekable bottom progress bar */}
      <div
        ref={scrubberRef}
        className="h-[3px] w-full bg-border/30 cursor-pointer hover:h-[5px] transition-[height]"
        onMouseDown={handleScrubStart}
      >
        <div ref={progressRef} className="h-full bg-primary rounded-r-full" style={{ width: "0%" }} />
      </div>
    </div>
  );
};
