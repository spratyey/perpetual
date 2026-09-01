"use client";

import { useEffect, useRef, useState } from "react";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Scissors,
  Type,
  Image as ImageIcon,
  Music,
  Wand2,
  Layers,
  Eye,
  Lock,
  Plus,
  Minus,
  ZoomIn,
  Volume2,
  Film,
  Send,
  CheckCircle2,
  Bot,
} from "lucide-react";

const HUMAN_COLOR = "oklch(0.65 0.15 250)";
const AI_COLOR = "oklch(0.70 0.18 170)";
const TOTAL_DURATION = 16000;

/* ─── Cursor SVG ─── */
function CursorIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" fill="none" className="drop-shadow-md">
      <path
        d="M1 1L1 14.5L4.5 11L8.5 18L11 17L7 10L12 10L1 1Z"
        fill={color}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="1"
      />
    </svg>
  );
}

/* ─── Interpolating cursor ─── */
function useCursorPosition(
  keyframes: { time: number; x: number; y: number }[],
  elapsed: number,
) {
  let from = keyframes[0];
  let to = keyframes[0];
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (elapsed >= keyframes[i].time && elapsed < keyframes[i + 1].time) {
      from = keyframes[i];
      to = keyframes[i + 1];
      break;
    }
    if (i === keyframes.length - 2) {
      from = keyframes[i + 1];
      to = keyframes[i + 1];
    }
  }
  const segDuration = to.time - from.time;
  const p = segDuration > 0 ? Math.min((elapsed - from.time) / segDuration, 1) : 1;
  const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  return {
    x: from.x + (to.x - from.x) * ease,
    y: from.y + (to.y - from.y) * ease,
  };
}

/* ─── Typewriter ─── */
function useTypewriter(text: string, startAt: number, elapsed: number, speed = 50) {
  if (elapsed < startAt) return "";
  const charsElapsed = Math.floor((elapsed - startAt) / speed);
  return text.slice(0, Math.min(charsElapsed, text.length));
}

/* ─── Toast notification ─── */
function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-card border border-border shadow-xl text-xs sm:text-sm transition-all duration-300 whitespace-nowrap ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
      }`}
    >
      <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
      <span className="text-foreground/90 font-medium">{message}</span>
    </div>
  );
}

/* ─── Track Row ─── */
function TrackRow({
  label,
  children,
  visible = true,
}: {
  label: string;
  children: React.ReactNode;
  visible?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 transition-all duration-500 ${visible ? "opacity-100" : "opacity-0 h-0 overflow-hidden"}`}
    >
      <div className="w-12 sm:w-16 flex items-center gap-1 sm:gap-1.5 shrink-0">
        <Eye className="size-3 text-muted-foreground/40 hidden sm:block" />
        <Lock className="size-3 text-muted-foreground/30 hidden sm:block" />
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}

export function Hero() {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    startRef.current = Date.now();
    const iv = setInterval(() => {
      setElapsed((Date.now() - startRef.current) % TOTAL_DURATION);
    }, 50);
    return () => clearInterval(iv);
  }, []);

  const prompt = "Compose a product demo — add intro title, background music, and captions";
  const typedPrompt = useTypewriter(prompt, 500, elapsed, 40);
  const promptDone = elapsed > 500 + prompt.length * 40;

  // Visibility phases
  const showClip = elapsed > 4500;
  const showTitle = elapsed > 6000;
  const showOverlay = elapsed > 6000;
  const showAudio = elapsed > 7500;
  const showCaptions = elapsed > 9000;
  const humanTweaking = elapsed > 10500 && elapsed < 14500;

  // Toast visibility — each lasts through the next so 2 are visible at once
  const toastClip = elapsed > 4500 && elapsed < 7500;
  const toastTitle = elapsed > 6000 && elapsed < 9000;
  const toastAudio = elapsed > 7500 && elapsed < 10500;
  const toastCaptions = elapsed > 9000 && elapsed < 12000;

  const titleText = humanTweaking ? "Meet perpetual.video" : "Introducing perpetual.video";

  const playheadPos = showClip ? 15 + ((elapsed - 4500) / TOTAL_DURATION) * 60 : 0;

  // Phase label
  let phase = "";
  if (elapsed < 500) phase = "";
  else if (elapsed < 3300) phase = "Human typing prompt...";
  else if (elapsed < 4000) phase = "Sending to AI agent...";
  else if (elapsed < 4500) phase = "AI agent received task";
  else if (elapsed < 6000) phase = "AI placing video clip...";
  else if (elapsed < 7500) phase = "AI adding title overlay...";
  else if (elapsed < 9000) phase = "AI generating background music...";
  else if (elapsed < 10500) phase = "AI generating captions...";
  else if (elapsed < 14500) phase = "Human fine-tuning layout...";
  else phase = "Ready to export";

  // Human cursor keyframes — now relative to the EDITOR container (not including floating chat)
  const humanKeyframes = [
    { time: 0, x: 30, y: 25 },
    { time: 500, x: 35, y: 25 },
    { time: 3300, x: 58, y: 25 },
    { time: 3800, x: 58, y: 25 },
    { time: 4000, x: 15, y: 25 },
    { time: 10500, x: 15, y: 25 },
    { time: 11500, x: 22, y: 38 },
    { time: 12500, x: 25, y: 36 },
    { time: 13500, x: 50, y: 82 },
    { time: 14500, x: 55, y: 85 },
    { time: 15500, x: 30, y: 25 },
  ];

  const aiKeyframes = [
    { time: 0, x: 90, y: 50 },
    { time: 4000, x: 90, y: 50 },
    { time: 4500, x: 45, y: 50 },
    { time: 5500, x: 40, y: 55 },
    { time: 6000, x: 20, y: 36 },
    { time: 7000, x: 25, y: 38 },
    { time: 7500, x: 40, y: 82 },
    { time: 8500, x: 50, y: 85 },
    { time: 9000, x: 55, y: 88 },
    { time: 10000, x: 60, y: 90 },
    { time: 10500, x: 90, y: 50 },
    { time: 15500, x: 90, y: 50 },
  ];

  const humanPos = useCursorPosition(humanKeyframes, elapsed);
  const aiPos = useCursorPosition(aiKeyframes, elapsed);
  const showAiCursor = elapsed > 4000 && elapsed < 10500;
  // Human cursor only visible in editor during tweaking (typing happens in floating chat above)
  const showHumanCursor = elapsed > 10500 && elapsed < 15500;

  // MCP line pulse when data is flowing
  const mcpActive = elapsed > 3800 && elapsed < 10500;

  return (
    <section className="pt-28 pb-20 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        {/* Copy */}
        <div className="text-center mb-10 sm:mb-12">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
            Video Editor built equally
            <br />
            for Humans and AI
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
            Edit visually or let AI compose via MCP — both work on the same project, in real time.
          </p>
          <button
            onClick={() => {
              const el = document.getElementById("join-waitlist");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm sm:text-base hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            Join the Waitlist
          </button>
        </div>

        {/* Floating Chat + MCP Connector + Editor */}
        <div className="max-w-6xl mx-auto">

          {/* Floating Chat Box */}
          <div className="mx-auto max-w-xl sm:max-w-2xl">
            <div className="rounded-xl border border-border bg-card shadow-lg px-3 sm:px-4 py-2 sm:py-2.5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="shrink-0 size-6 sm:size-7 rounded-md bg-muted flex items-center justify-center">
                  <Bot className="size-3 sm:size-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 rounded-md border border-border bg-background px-2.5 sm:px-3 py-1 sm:py-1.5 flex items-center min-h-7 sm:min-h-8">
                  <span className="text-[11px] sm:text-sm text-foreground/80 leading-relaxed">
                    {typedPrompt}
                    {!promptDone && elapsed > 500 && (
                      <span className="inline-block w-0.5 h-3.5 sm:h-4 bg-foreground/60 ml-0.5 animate-pulse align-middle" />
                    )}
                    {elapsed <= 500 && (
                      <span className="text-muted-foreground/40">
                        Ask AI to compose your video...
                      </span>
                    )}
                  </span>
                </div>
                <button
                  className={`shrink-0 size-6 sm:size-7 rounded-md flex items-center justify-center transition-colors ${
                    promptDone
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Send className="size-3 sm:size-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* MCP Connector Line */}
          <div className="flex flex-col items-center">
            <div className={`w-px h-3 sm:h-4 transition-colors duration-300 ${mcpActive ? "bg-emerald-400/60" : "bg-border"}`} />
            <div className={`px-1.5 py-px rounded-full border text-[8px] sm:text-[9px] font-mono transition-colors duration-300 ${
              mcpActive ? "border-emerald-400/40 text-emerald-400 bg-emerald-400/5" : "border-border text-muted-foreground/50 bg-card"
            }`}>
              MCP
            </div>
            <div className={`w-px h-3 sm:h-4 transition-colors duration-300 ${mcpActive ? "bg-emerald-400/60" : "bg-border"}`} />
          </div>

          {/* Editor */}
          <div className="relative">
            {/* Toast notifications - top right inside editor */}
            <div className="absolute top-12 right-2 sm:right-3 z-50 flex flex-col gap-2 pointer-events-none">
              <Toast message="Video clip added to timeline" visible={toastClip} />
              <Toast message="Title overlay added" visible={toastTitle} />
              <Toast message="Background music generated" visible={toastAudio} />
              <Toast message="Captions generated" visible={toastCaptions} />
            </div>

            <div className="rounded-xl border border-border bg-card shadow-lg">
              {/* Toolbar */}
              <div className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 sm:py-2 border-b border-border">
                {[Scissors, Type, ImageIcon, Music, Wand2, Layers].map((Icon, i) => (
                  <button
                    key={i}
                    className="p-1 sm:p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon className="size-3 sm:size-3.5" />
                  </button>
                ))}
                <Separator orientation="vertical" className="h-3 sm:h-4 mx-0.5 sm:mx-1" />
                <button className="p-1 sm:p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="size-3 sm:size-3.5" />
                </button>
              </div>

              <div className="flex">
                {/* Canvas */}
                <div className="flex-1 p-2 sm:p-3">
                  <div className="relative rounded-lg bg-background overflow-hidden border border-border" style={{ aspectRatio: "16/6" }}>
                    <div
                      className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${showClip ? "opacity-100" : "opacity-30"}`}
                    >
                      <div className="size-8 sm:size-10 rounded-xl bg-muted flex items-center justify-center mb-2">
                        <Play className="size-3.5 sm:size-4 text-muted-foreground ml-0.5" />
                      </div>
                      <div className="text-muted-foreground text-[11px] sm:text-xs font-medium">
                        {showClip ? "Product Demo.mp4" : "No clips yet"}
                      </div>
                      {showClip && (
                        <div className="text-muted-foreground/50 text-[9px] sm:text-[10px] mt-0.5">
                          1920 x 1080 · 00:02:34
                        </div>
                      )}
                    </div>

                    {/* Title overlay */}
                    <div
                      className={`absolute top-2 sm:top-3 left-2 sm:left-3 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded border transition-all duration-500 ${
                        showOverlay ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
                      } ${humanTweaking ? "ring-2 ring-blue-500/40 bg-blue-500/10 border-blue-500/30" : "bg-muted border-border"}`}
                    >
                      <span className={`text-[10px] sm:text-xs font-medium transition-colors duration-300 ${
                        humanTweaking ? "text-blue-300" : "text-foreground"
                      }`}>
                        {titleText}
                      </span>
                    </div>

                    {/* Caption subtitle */}
                    <div
                      className={`absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 px-3 sm:px-4 py-0.5 sm:py-1 rounded bg-black/70 transition-all duration-500 ${
                        showCaptions ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                      }`}
                    >
                      <span className="text-[6px] sm:text-[11px] text-white/90 font-medium">
                        Welcome to our product walkthrough
                      </span>
                    </div>
                  </div>
                </div>

                {/* Properties panel */}
                <div className="w-36 lg:w-44 border-l border-border p-2 sm:p-3 hidden md:block">
                  <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground mb-2 sm:mb-3">
                    Properties
                  </div>
                  <div className="space-y-2">
                    {[
                      ["Position X", humanTweaking ? "385" : "420"],
                      ["Position Y", humanTweaking ? "95" : "120"],
                      ["Width", "1920"],
                      ["Height", "1080"],
                      ["Opacity", "100%"],
                      ["Rotation", "0°"],
                    ].map(([l, v]) => (
                      <div key={l} className="flex items-center justify-between">
                        <span className="text-[10px] sm:text-[11px] text-muted-foreground">{l}</span>
                        <span
                          className={`text-[10px] sm:text-[11px] font-mono transition-colors duration-300 ${
                            humanTweaking && (l === "Position X" || l === "Position Y")
                              ? "text-blue-400"
                              : "text-foreground/70"
                          }`}
                        >
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transport */}
              <div className="flex items-center justify-center gap-3 sm:gap-4 py-1.5 border-t border-border">
                <SkipBack className="size-3 sm:size-3.5 text-muted-foreground" />
                <div className="size-6 sm:size-7 rounded-full bg-muted flex items-center justify-center">
                  <Pause className="size-2.5 sm:size-3 text-foreground" />
                </div>
                <SkipForward className="size-3 sm:size-3.5 text-muted-foreground" />
                <span className="text-[10px] sm:text-[11px] font-mono text-muted-foreground ml-1 sm:ml-2">
                  00:01:12 / 00:02:34
                </span>
                <div className="flex-1" />
                <Volume2 className="size-3 sm:size-3.5 text-muted-foreground mr-2 sm:mr-3" />
              </div>

              {/* Timeline */}
              <div className="border-t border-border bg-background">
                <div className="relative h-4 sm:h-5 border-b border-border/50 px-2 sm:px-3">
                  {[0, 20, 40, 60, 80, 100].map((p) => (
                    <div key={p} className="absolute top-0 flex flex-col items-center" style={{ left: `${p}%` }}>
                      <div className="w-px h-1.5 sm:h-2 bg-border" />
                      <span className="text-[7px] sm:text-[8px] text-muted-foreground/50 mt-0.5">
                        {Math.floor((p / 100) * 154)}s
                      </span>
                    </div>
                  ))}
                  {showClip && (
                    <div
                      className="absolute top-0 w-0.5 h-full bg-primary z-10 transition-all duration-100"
                      style={{ left: `${Math.min(playheadPos, 75)}%` }}
                    >
                      <div className="w-2 sm:w-2.5 h-1.5 sm:h-2 bg-primary rounded-b -ml-0.75 sm:-ml-1" />
                    </div>
                  )}
                </div>

                <div className="px-2 sm:px-3 py-1.5 sm:py-2 space-y-1 sm:space-y-1.5 min-h-15 sm:min-h-20">
                  <TrackRow label="V1" visible={showClip}>
                    <div className="flex-1 h-6 sm:h-7 rounded bg-blue-500/15 border border-blue-500/25 flex items-center px-1.5 sm:px-2 gap-1 sm:gap-1.5">
                      <Film className="size-2.5 sm:size-3 text-blue-400/70 shrink-0" />
                      <span className="text-[9px] sm:text-[10px] text-blue-300/70 truncate">Product Demo.mp4</span>
                    </div>
                  </TrackRow>
                  <TrackRow label="T1" visible={showTitle}>
                    <div className="flex-1 h-6 sm:h-7 flex gap-1">
                      <div
                        className={`w-[35%] rounded bg-amber-500/15 border border-amber-500/25 flex items-center px-1.5 sm:px-2 transition-all duration-300 ${humanTweaking ? "ring-1 ring-blue-500/30" : ""}`}
                      >
                        <Type className="size-2.5 sm:size-3 text-amber-400/70 mr-0.5 sm:mr-1 shrink-0" />
                        <span className="text-[9px] sm:text-[10px] text-amber-300/70 truncate">Title Card</span>
                      </div>
                    </div>
                  </TrackRow>
                  <TrackRow label="A1" visible={showAudio}>
                    <div className="flex-1 h-6 sm:h-7 rounded bg-emerald-500/15 border border-emerald-500/25 flex items-center px-1.5 sm:px-2 relative overflow-hidden">
                      <Music className="size-2.5 sm:size-3 text-emerald-400/70 mr-1 sm:mr-1.5 shrink-0" />
                      <span className="text-[9px] sm:text-[10px] text-emerald-300/70 truncate">Background Music</span>
                      <div className="absolute right-1 sm:right-2 top-1 bottom-1 w-20 sm:w-28 flex items-center gap-px opacity-30">
                        {Array.from({ length: 25 }).map((_, i) => (
                          <div
                            key={i}
                            className="w-0.5 bg-emerald-400 rounded-full"
                            style={{
                              height: `${Math.round(20 + Math.sin(i * 0.8) * 30 + Math.sin(i * 2.3 + 1.7) * 15 + 10)}%`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </TrackRow>
                  <TrackRow label="C1" visible={showCaptions}>
                    <div className="flex-1 h-4 sm:h-5 flex gap-0.5">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex-1 rounded-sm bg-purple-500/10 border border-purple-500/15" />
                      ))}
                    </div>
                  </TrackRow>

                  {!showClip && (
                    <div className="flex items-center justify-center py-3 sm:py-4 text-[11px] sm:text-xs text-muted-foreground/40">
                      Timeline is empty — waiting for AI...
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end px-2 sm:px-3 py-1 border-t border-border/50">
                  <Minus className="size-2.5 sm:size-3 text-muted-foreground/40" />
                  <div className="w-16 sm:w-20 h-1 bg-muted rounded mx-1.5 sm:mx-2">
                    <div className="w-[60%] h-full bg-muted-foreground/30 rounded" />
                  </div>
                  <ZoomIn className="size-2.5 sm:size-3 text-muted-foreground/40" />
                </div>
              </div>
            </div>

            {/* Cursors - after card so they paint on top */}
            {showHumanCursor && (
              <div
                className="absolute z-40 pointer-events-none"
                style={{
                  left: `${humanPos.x}%`,
                  top: `${humanPos.y}%`,
                  transform: "translate(-2px, -2px)",
                }}
              >
                <CursorIcon color={HUMAN_COLOR} />
                <span
                  className="absolute left-4 top-4 text-[10px] font-medium px-1.5 py-0.5 rounded-md whitespace-nowrap shadow-sm"
                  style={{ backgroundColor: HUMAN_COLOR, color: "#fff" }}
                >
                  You
                </span>
              </div>
            )}
            {showAiCursor && (
              <div
                className="absolute z-40 pointer-events-none"
                style={{
                  left: `${aiPos.x}%`,
                  top: `${aiPos.y}%`,
                  transform: "translate(-2px, -2px)",
                }}
              >
                <CursorIcon color={AI_COLOR} />
                <span
                  className="absolute left-4 top-4 text-[10px] font-medium px-1.5 py-0.5 rounded-md whitespace-nowrap shadow-sm"
                  style={{ backgroundColor: AI_COLOR, color: "#fff" }}
                >
                  AI Agent
                </span>
              </div>
            )}

            {/* Status bar */}
            <div className="flex items-center justify-between mt-3 sm:mt-4 px-1">
              <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-[11px] font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: HUMAN_COLOR }} />
                  You
                </span>
                <span
                  className={`flex items-center gap-1.5 transition-opacity duration-300 ${showAiCursor ? "opacity-100" : "opacity-40"}`}
                >
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: AI_COLOR }} />
                  AI Agent
                </span>
              </div>
              <span className="text-muted-foreground/50 text-[10px] sm:text-[11px] font-mono">
                {phase}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
