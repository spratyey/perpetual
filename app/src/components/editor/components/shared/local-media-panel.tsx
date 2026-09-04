/**
 * Local media panel.
 *
 * Replaces the video, image and sound panels. Those three shared one
 * implementation made mostly of upload progress, R2 badges, AI indexing and
 * stock-media browsing — none of which exist without a backend. The card
 * grid, drop zone and drag-to-timeline contract are kept exactly as they
 * were so the timeline behaves the same.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Clapperboard, ImageIcon, Loader2, Music, Pause, Play, Plus, Sparkles, Trash2, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { invokeLocalTool } from "@/local/webmcp-tool";

import { useEditorContext } from "../../contexts/editor-context";
import { useAspectRatio } from "../../hooks/use-aspect-ratio";
import { useTimelinePositioning } from "../../hooks/use-timeline-positioning";
import { OverlayType } from "../../types";
import { MediaDropZone } from "./media-drop-zone";
import { MediaGeneration } from "./media-generation";
import { AssetAnalysisDialog } from "./asset-analysis-dialog";
import { useAssetStore, MAX_ASSET_BYTES, type LoadedAsset } from "@/local/asset-store";
import { useAnalysisStore } from "@/local/analysis-store";
import { FPS } from "../../constants";

type PanelKind = "video" | "image" | "audio";

/** A slice of the source file, in seconds, when only part of it is wanted. */
export interface SourceRange {
  startSeconds: number;
  endSeconds: number;
}

const ACCEPT: Record<PanelKind, string> = {
  video: "video/*",
  image: "image/*",
  audio: "audio/*",
};

const EMPTY_COPY: Record<PanelKind, string> = {
  video: "No video yet.",
  image: "No images yet.",
  audio: "No audio yet.",
};

const EMPTY_ICON: Record<PanelKind, LucideIcon> = {
  video: Clapperboard,
  image: ImageIcon,
  audio: Music,
};

const DEFAULT_IMAGE_FRAMES = 200;

function useAddToTimeline() {
  const { addOverlay, overlays } = useEditorContext();
  const { findSmartPositionForType } = useTimelinePositioning();
  const { getAspectRatioDimensions } = useAspectRatio();

  return useCallback(
    (asset: LoadedAsset, range?: SourceRange) => {
      const canvas = getAspectRatioDimensions();
      const naturalFrames = asset.durationInSeconds ? Math.round(asset.durationInSeconds * FPS) : 150;
      const sourceStartFrames = range ? Math.round(range.startSeconds * FPS) : 0;
      const durationInFrames =
        asset.type === "image"
          ? DEFAULT_IMAGE_FRAMES
          : range
            ? Math.max(1, Math.min(Math.round((range.endSeconds - range.startSeconds) * FPS), naturalFrames - sourceStartFrames))
            : naturalFrames;

      const overlayType =
        asset.type === "video" ? OverlayType.VIDEO : asset.type === "audio" ? OverlayType.SOUND : OverlayType.IMAGE;
      const { from, row } = findSmartPositionForType(overlays, durationInFrames, overlayType);

      const base = {
        id: Date.now(),
        assetId: asset.id,
        from,
        row,
        rotation: 0,
        isDragging: false,
        durationInFrames,
        left: 0,
        top: 0,
        width: canvas.width,
        height: canvas.height,
      };

      if (asset.type === "audio") {
        addOverlay({
          ...base,
          height: 100,
          type: OverlayType.SOUND,
          content: asset.name,
          src: asset.url,
          startFromSound: sourceStartFrames,
          maxDuration: naturalFrames,
          styles: { opacity: 1, volume: 1 },
        } as any);
        return;
      }

      if (asset.type === "image") {
        addOverlay({
          ...base,
          type: OverlayType.IMAGE,
          src: asset.url,
          content: "",
          styles: { opacity: 1, objectFit: "cover", animation: {} },
        } as any);
        return;
      }

      addOverlay({
        ...base,
        type: OverlayType.VIDEO,
        content: asset.name,
        src: asset.url,
        videoStartTime: sourceStartFrames,
        maxDuration: naturalFrames,
        styles: { opacity: 1, zIndex: 100, transform: "none", objectFit: "cover", speed: 1 },
      } as any);
    },
    [addOverlay, overlays, findSmartPositionForType, getAspectRatioDimensions]
  );
}

function startAssetDrag(e: React.DragEvent, asset: LoadedAsset) {
  const durationFrames =
    asset.type === "image"
      ? DEFAULT_IMAGE_FRAMES
      : asset.durationInSeconds
        ? Math.round(asset.durationInSeconds * FPS)
        : 150;
  e.dataTransfer.setData(
    "application/x-perpetual-asset",
    JSON.stringify({ type: asset.type, src: asset.url, name: asset.name, duration: asset.durationInSeconds })
  );
  window.dispatchEvent(new CustomEvent("perpetual-asset-drag-start", { detail: { durationFrames } }));
}

/**
 * One control for the whole content-index state of an asset: it starts the
 * analysis, shows it running, and afterwards opens what Gemini found.
 */
const AnalysisAction: React.FC<{
  asset: LoadedAsset;
  onAddRange: (range: SourceRange) => void;
  tone: "overlay" | "plain";
}> = ({ asset, onAddRange, tone }) => {
  const { analyses, statuses, errors, analyze } = useAnalysisStore();
  const [isOpen, setIsOpen] = useState(false);
  const analysis = analyses[asset.id];
  const status = statuses[asset.id] ?? "idle";

  const className =
    tone === "overlay"
      ? "h-6 w-6 rounded-full border-0 bg-black/70 text-white hover:bg-foreground hover:text-background"
      : "h-6 w-6";

  if (status === "running") {
    return (
      <span className={`flex items-center justify-center ${className}`}>
        <Loader2 className="h-3 w-3 animate-spin" />
      </span>
    );
  }

  const label = analysis
    ? "See what Gemini found"
    : status === "error"
      ? errors[asset.id] ?? "The analysis failed. Try again."
      : "Analyse with Gemini";

  return (
    <>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={tone === "overlay" ? "secondary" : "ghost"}
              size="icon"
              className={className}
              onClick={(e) => {
                e.stopPropagation();
                if (analysis) setIsOpen(true);
                else void analyze([asset.id]);
              }}
            >
              <Sparkles className={`h-3 w-3 ${analysis ? "" : "opacity-60"}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px] text-xs">{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {analysis && (
        <AssetAnalysisDialog
          asset={asset}
          analysis={analysis}
          onAddRange={onAddRange}
          open={isOpen}
          onOpenChange={setIsOpen}
        />
      )}
    </>
  );
};

const CardActions: React.FC<{ onAdd: () => void; onDelete: () => void }> = ({ onAdd, onDelete }) => (
  <div className="absolute top-1 right-1 z-20 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="secondary" size="icon"
            className="h-6 w-6 rounded-full border-0 bg-black/70 text-white hover:bg-foreground hover:text-background"
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Add to timeline</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="secondary" size="icon"
            className="h-6 w-6 rounded-full border-0 bg-black/70 text-white hover:bg-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Remove from this project</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
);

const VisualCard: React.FC<{
  asset: LoadedAsset;
  onAdd: () => void;
  onAddRange: (range: SourceRange) => void;
  onDelete: () => void;
}> = ({ asset, onAdd, onAddRange, onDelete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    if (isPlaying) { el.pause(); setIsPlaying(false); } else { void el.play(); setIsPlaying(true); }
  }, [isPlaying]);

  return (
    <div
      className="group relative aspect-video overflow-hidden border border-border bg-black"
      draggable
      onDragStart={(e) => startAssetDrag(e, asset)}
      onDoubleClick={onAdd}
    >
      {asset.type === "video" ? (
        <>
          <video
            ref={videoRef} src={asset.url} muted playsInline preload="metadata"
            className="h-full w-full object-cover"
            onEnded={() => setIsPlaying(false)}
          />
          <button onClick={togglePlay} className="absolute inset-0 z-10 flex items-center justify-center">
            <span className={`bg-black/60 p-2 backdrop-blur-sm transition-opacity ${isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}>
              {isPlaying ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white" />}
            </span>
          </button>
        </>
      ) : (
        <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" draggable={false} />
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-4">
        <span className="max-w-[65%] truncate text-[10px] text-white">{asset.name}</span>
        <span className="text-[9px] text-white/70">
          {asset.durationInSeconds ? `${Math.round(asset.durationInSeconds)}s` : asset.origin === "generated" ? "AI" : ""}
        </span>
      </div>
      <div className="absolute top-1 left-1 z-20">
        <AnalysisAction asset={asset} onAddRange={onAddRange} tone="overlay" />
      </div>
      <CardActions onAdd={onAdd} onDelete={onDelete} />
    </div>
  );
};

const AudioCard: React.FC<{
  asset: LoadedAsset;
  onAdd: () => void;
  onAddRange: (range: SourceRange) => void;
  onDelete: () => void;
}> = ({ asset, onAdd, onAddRange, onDelete }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div
      className="group relative flex items-center gap-3 border border-border bg-card px-3 py-2"
      draggable
      onDragStart={(e) => startAssetDrag(e, asset)}
      onDoubleClick={onAdd}
    >
      <audio ref={audioRef} src={asset.url} onEnded={() => setIsPlaying(false)} className="hidden" />
      <button
        className="flex h-8 w-8 shrink-0 items-center justify-center border border-border"
        onClick={(e) => {
          e.stopPropagation();
          const el = audioRef.current;
          if (!el) return;
          if (isPlaying) { el.pause(); setIsPlaying(false); } else { void el.play(); setIsPlaying(true); }
        }}
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs">{asset.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {asset.durationInSeconds ? `${Math.round(asset.durationInSeconds)}s` : "audio"}
        </p>
      </div>
      <div className="relative flex shrink-0 gap-1">
        <AnalysisAction asset={asset} onAddRange={onAddRange} tone="plain" />
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onAdd(); }}>
          <Plus className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

/**
 * Import by URL.
 *
 * Calls the `import_from_url` tool rather than reimplementing the fetch, so a
 * person pasting a link and an agent passing one take the same path — same type
 * detection, same limits, same error text.
 */
const ImportFromUrl: React.FC = () => {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = url.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const result = await invokeLocalTool("import_from_url", { urls: [trimmed] });
      if (result?.ok) {
        setUrl("");
        toast({ title: `Added ${result.imported[0]?.name ?? "media"}` });
      } else {
        toast({
          title: "Could not import that link",
          description: result?.error ?? "Unknown problem.",
          variant: "destructive",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex shrink-0 gap-1.5">
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
        placeholder="Paste a media URL"
        spellCheck={false}
        className="h-7 text-[11px]"
      />
      <Button size="sm" variant="secondary" className="h-7 shrink-0 px-2 text-[11px]"
              onClick={() => void submit()} disabled={busy || !url.trim()}>
        {busy ? "Fetching…" : "Add"}
      </Button>
    </div>
  );
};

export const LocalMediaPanel: React.FC<{ kind: PanelKind }> = ({ kind }) => {
  const { assets, importFiles, removeAsset, isLoading } = useAssetStore();
  const { analyses, analyze } = useAnalysisStore();
  const [isImporting, setIsImporting] = useState(false);
  const addToTimeline = useAddToTimeline();

  const visible = useMemo(() => assets.filter((a) => a.type === kind), [assets, kind]);
  const unindexed = useMemo(() => visible.filter((a) => !analyses[a.id]), [visible, analyses]);

  const handleFiles = useCallback(async (files: File[]) => {
    setIsImporting(true);
    try {
      const added = await importFiles(files);
      if (added.length) {
        toast({ title: `Added ${added.length} file${added.length > 1 ? "s" : ""}` });
      }
    } catch (err) {
      toast({
        title: "Could not add that file",
        description: err instanceof Error ? err.message : "Unknown problem.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  }, [importFiles]);

  const Icon = EMPTY_ICON[kind];

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <MediaDropZone
        accept={ACCEPT[kind]}
        multiple
        isLoading={isImporting}
        maxSizeMB={Math.round(MAX_ASSET_BYTES / 1024 / 1024)}
        label={`Drop ${kind} or browse`}
        onFileSelected={(file) => void handleFiles([file])}
        onFilesSelected={(files) => void handleFiles(files)}
        onOverLimit={(filename, size, limit) =>
          toast({ title: "File too large", description: `${filename} is ${size} MB. The limit is ${limit} MB.`, variant: "destructive" })
        }
      />

      <ImportFromUrl />

      {kind !== "audio" && <MediaGeneration kind={kind} />}

      {unindexed.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 justify-start gap-1.5 px-2 text-[11px] text-muted-foreground"
          onClick={() => void analyze(unindexed.map((a) => a.id))}
        >
          <Sparkles className="h-3 w-3" />
          Analyse {unindexed.length} {unindexed.length === 1 ? "file" : "files"} with Gemini
        </Button>
      )}

      <ScrollArea className="min-h-0 flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading media…
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <p className="max-w-[220px] text-xs text-muted-foreground">{EMPTY_COPY[kind]}</p>
          </div>
        ) : kind === "audio" ? (
          <div className="flex flex-col gap-2">
            {visible.map((asset) => (
              <AudioCard
                key={asset.id}
                asset={asset}
                onAdd={() => addToTimeline(asset)}
                onAddRange={(range) => addToTimeline(asset, range)}
                onDelete={() => void removeAsset(asset.id)}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {visible.map((asset) => (
              <VisualCard
                key={asset.id}
                asset={asset}
                onAdd={() => addToTimeline(asset)}
                onAddRange={(range) => addToTimeline(asset, range)}
                onDelete={() => void removeAsset(asset.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
