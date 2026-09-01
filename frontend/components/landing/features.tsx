import {
  Film, Type, Image as ImageIcon, Mic, Music,
  Captions, LayoutGrid, Eye, Sparkles,
} from "lucide-react";

const features = [
  { icon: Film, title: "Video Composition", desc: "Multi-track timeline with clips, trimming, splitting, and transitions" },
  { icon: Type, title: "Text & Overlays", desc: "Titles, lower thirds, annotations — positioned and styled precisely" },
  { icon: ImageIcon, title: "AI Image Generation", desc: "Generate and edit images inline, powered by your choice of model" },
  { icon: Mic, title: "Text-to-Speech", desc: "Natural voice narration generated directly on the timeline" },
  { icon: Music, title: "Music & SFX", desc: "AI-generated background music and sound effects that fit your content" },
  { icon: Captions, title: "Auto Captions", desc: "Transcription-based captions with word-level timing and styling" },
  { icon: LayoutGrid, title: "Motion Graphics", desc: "Animated elements, shape layers, and programmatic visual effects" },
  { icon: Eye, title: "Media Understanding", desc: "AI-powered scene analysis, transcription, and natural language queries" },
  { icon: Sparkles, title: "AI Workflows", desc: "Custom agent skills and automated editing pipelines via MCP" },
];

export function Features() {
  return (
    <section id="features" className="py-24 sm:py-32 px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16">
          <p className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Capabilities
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Everything you need, nothing you don&apos;t
          </h2>
          <p className="text-muted-foreground text-base max-w-md">
            14+ tool categories. All accessible via the visual editor or MCP.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <div
              key={i}
              className="bg-card p-6 sm:p-7 group"
            >
              <Icon className="size-5 text-muted-foreground/40 mb-4 group-hover:text-foreground/60 transition-colors" />
              <h3 className="text-base font-semibold mb-1.5">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
