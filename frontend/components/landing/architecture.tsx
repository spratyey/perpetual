"use client";

import { Monitor, Terminal, ArrowDown, Layers } from "lucide-react";

const humanFeatures = [
  "Drag-and-drop timeline",
  "Canvas with real-time preview",
  "Properties panel for fine-tuning",
  "Built with React + Remotion",
];

const aiFeatures = [
  "14+ tool categories",
  "Streamable HTTP protocol",
  "Works with any MCP client",
  "AI gen, media understanding, composition",
];

export function Architecture() {
  return (
    <section id="architecture" className="py-24 sm:py-32 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="text-center mb-16 sm:mb-20">
          <p className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-3">
            How it connects
          </p>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            Two interfaces, one project
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
            Humans use the visual editor. AI agents use MCP. Both operate on the
            same project — every change syncs instantly.
          </p>
        </div>

        {/* Diagram */}
        <div className="relative">
          {/* Two entry points */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
            {/* Human side */}
            <div className="relative">
              <div className="h-full rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-5 sm:p-8 hover:border-blue-500/30 transition-colors group flex flex-col">
                {/* Icon + Title */}
                <div className="flex items-center gap-3 mb-5 sm:mb-6">
                  <div className="size-10 sm:size-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/15 transition-colors">
                    <Monitor className="size-4 sm:size-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold">Visual Editor</h3>
                    <p className="text-xs sm:text-sm text-blue-400/70">For humans</p>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 sm:space-y-3">
                  {humanFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-xs sm:text-sm text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-blue-400/40 shrink-0 mt-1.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Mini visual: toolbar mockup */}
                <div className="mt-auto pt-5 sm:pt-6 flex items-center gap-1 p-2 rounded-lg bg-background/50 border border-border/50">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="size-5 sm:size-6 rounded bg-muted/50 flex items-center justify-center">
                      <div className="size-2 sm:size-2.5 rounded-sm bg-blue-400/20" />
                    </div>
                  ))}
                  <div className="flex-1" />
                  <div className="w-8 sm:w-12 h-4 sm:h-5 rounded bg-blue-500/10 border border-blue-500/20" />
                </div>
              </div>
            </div>

            {/* AI side */}
            <div className="relative">
              <div className="h-full rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-5 sm:p-8 hover:border-emerald-500/30 transition-colors group flex flex-col">
                {/* Icon + Title */}
                <div className="flex items-center gap-3 mb-5 sm:mb-6">
                  <div className="size-10 sm:size-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/15 transition-colors">
                    <Terminal className="size-4 sm:size-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold">MCP Server</h3>
                    <p className="text-xs sm:text-sm text-emerald-400/70">For AI agents</p>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 sm:space-y-3">
                  {aiFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-xs sm:text-sm text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-emerald-400/40 shrink-0 mt-1.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Mini visual: code/protocol mockup */}
                <div className="mt-auto pt-5 sm:pt-6 p-2 rounded-lg bg-background/50 border border-border/50 font-mono text-[9px] sm:text-[10px] space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400/60">POST</span>
                    <span className="text-muted-foreground/50">/mcp/tools/add_clip</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400/60">POST</span>
                    <span className="text-muted-foreground/50">/mcp/tools/add_text</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400/60">POST</span>
                    <span className="text-muted-foreground/50">/mcp/tools/generate_audio</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Converging flow lines */}
          <div className="relative py-6 sm:py-8">
            {/* Desktop: two angled lines converging to center */}
            <div className="hidden sm:flex items-end justify-center gap-0 relative h-16">
              {/* Blue line from left card */}
              <div className="w-[25%] h-px origin-right rotate-[20deg] translate-y-[-8px]">
                <div className="h-full w-full bg-gradient-to-l from-blue-400/50 to-transparent animate-[flowRight_2s_linear_infinite]"
                  style={{ backgroundSize: "20px 1px", backgroundImage: "repeating-linear-gradient(to right, rgb(96,165,250,0.5) 0px, rgb(96,165,250,0.5) 8px, transparent 8px, transparent 20px)" }}
                />
              </div>

              {/* Center merge icon */}
              <div className="relative z-10 mx-4">
                <div className="size-12 rounded-full border-2 border-dashed border-border/60 flex items-center justify-center bg-card shadow-lg shadow-black/20">
                  <Layers className="size-5 text-muted-foreground/60" />
                </div>
              </div>

              {/* Green line from right card */}
              <div className="w-[25%] h-px origin-left -rotate-[20deg] translate-y-[-8px]">
                <div className="h-full w-full bg-gradient-to-r from-emerald-400/50 to-transparent"
                  style={{ backgroundSize: "20px 1px", backgroundImage: "repeating-linear-gradient(to left, rgb(52,211,153,0.5) 0px, rgb(52,211,153,0.5) 8px, transparent 8px, transparent 20px)" }}
                />
              </div>
            </div>

            {/* Vertical connector line to shared state (desktop) */}
            <div className="hidden sm:flex justify-center">
              <div className="w-px h-8 bg-gradient-to-b from-border/60 to-border/20" />
            </div>

            {/* Mobile: simple vertical flow */}
            <div className="flex sm:hidden flex-col items-center">
              <div className="w-px h-6 bg-gradient-to-b from-blue-400/30 to-emerald-400/30" />
              <div className="size-10 rounded-full border-2 border-dashed border-border/60 flex items-center justify-center bg-card shadow-lg shadow-black/20">
                <Layers className="size-4 text-muted-foreground/60" />
              </div>
              <div className="w-px h-6 bg-gradient-to-b from-emerald-400/30 to-border/20" />
            </div>
          </div>

          {/* Shared state bar */}
          <div className="relative rounded-2xl border border-border bg-card/50 backdrop-blur-sm px-5 sm:px-8 py-4 sm:py-5">
            <div className="flex items-center justify-center gap-3">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-xs sm:text-sm text-muted-foreground font-medium">
                Shared project state — changes sync in real time
              </span>
            </div>

            {/* Mini timeline preview */}
            <div className="mt-3 sm:mt-4 flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 rounded-lg bg-background/30 border border-border/30">
              <span className="text-[8px] sm:text-[9px] text-muted-foreground/40 font-mono w-6 sm:w-8 shrink-0">V1</span>
              <div className="flex-1 h-3 sm:h-4 rounded bg-blue-500/10 border border-blue-500/15" />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 rounded-lg">
              <span className="text-[8px] sm:text-[9px] text-muted-foreground/40 font-mono w-6 sm:w-8 shrink-0">T1</span>
              <div className="w-[40%] h-3 sm:h-4 rounded bg-amber-500/10 border border-amber-500/15" />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 rounded-lg">
              <span className="text-[8px] sm:text-[9px] text-muted-foreground/40 font-mono w-6 sm:w-8 shrink-0">A1</span>
              <div className="flex-1 h-3 sm:h-4 rounded bg-emerald-500/10 border border-emerald-500/15" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
