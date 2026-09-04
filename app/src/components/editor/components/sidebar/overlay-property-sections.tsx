/**
 * Overlay property sections — renders individual property sections
 * for selected overlays inside the left sidebar panel.
 *
 * Extracted from the former right-side PropertiesPanel.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Settings2,
  Gauge,
  Crop,
  Play,
  Pause,
  ZoomIn,
  Info,
  Palette,
  Blend,
  Sparkles,
  Ruler,
  SlidersHorizontal,
  Volume2,
  Captions,
  Lock,
  Unlock,
  RotateCcw,
  Pencil,
  X,
  MousePointerClick,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditorContext } from "../../contexts/editor-context";
import { useAspectRatio } from "../../hooks/use-aspect-ratio";
import { computeResizeDisplacement } from "../../hooks/use-timeline-positioning";
import {
  Overlay,
  OverlayType,
  ClipOverlay,
  TextOverlay,
  ImageOverlay,
  SoundOverlay,
  ShapeOverlay,
} from "../../types";

// Sub-panels reused from overlay editors
import { TextSettingsPanel } from "../overlays/text/text-settings-panel";
import { TextStylePanel } from "../overlays/text/text-style-panel";
import { ImageStylePanel } from "../overlays/images/image-style-panel";
import { SoundDetails } from "../overlays/sounds/sound-details";
import { ShapeSettingsPanel } from "../overlays/shapes/shape-settings-panel";
import { ShapeStylePanel } from "../overlays/shapes/shape-style-panel";
import { getShapeByKey } from "../overlays/shapes/shape-definitions";
import { AnimationTabs } from "../shared/animation-tabs";
import { ImageCropSection } from "../overlays/images/image-crop-section";
import { ImageAnimationSection } from "../overlays/images/image-animation-section";
import { VideoVolumeSection } from "../overlays/video/video-volume-section";
import { VideoCropSection } from "../overlays/video/video-crop-section";
import { VideoAnimationSection } from "../overlays/video/video-animation-section";
import { VideoCaptionSection } from "../overlays/video/video-caption-section";
import { VideoAppearanceSection } from "../overlays/video/video-appearance-section";
import { VideoSpeedSection } from "../overlays/video/video-speed-section";

/* ------------------------------------------------------------------ */
/*  Section definitions per overlay type                               */
/* ------------------------------------------------------------------ */

export interface PropertySectionDef {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const OVERLAY_PROPERTY_SECTIONS: Record<string, PropertySectionDef[]> = {
  [OverlayType.VIDEO]: [
    { id: "properties", label: "Properties", icon: Settings2 },
    { id: "captions", label: "Captions", icon: Captions },
    { id: "animation", label: "Animation", icon: Play },
  ],
  [OverlayType.TEXT]: [
    { id: "style", label: "Style", icon: Palette },
    { id: "animation", label: "Animation", icon: Play },
  ],
  [OverlayType.IMAGE]: [
    { id: "properties", label: "Properties", icon: Settings2 },
    { id: "crop", label: "Crop", icon: Crop },
    { id: "animation", label: "Animation", icon: Play },
  ],
  [OverlayType.SHAPE]: [
    { id: "properties", label: "Properties", icon: Settings2 },
    { id: "effects", label: "Effects", icon: Blend },
    { id: "animation", label: "Animation", icon: Play },
  ],
  [OverlayType.SOUND]: [
    { id: "properties", label: "Properties", icon: Volume2 },
  ],
};

export function getSectionsForOverlay(type: string): PropertySectionDef[] {
  return OVERLAY_PROPERTY_SECTIONS[type] ?? [];
}

/* ------------------------------------------------------------------ */
/*  Inline helpers (migrated from properties-panel.tsx)                */
/* ------------------------------------------------------------------ */

/** Inline playable video preview */
const VideoPreview: React.FC<{ src: string }> = ({ src }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) v.pause();
    else v.play().catch(() => {});
    setPlaying(!playing);
  };

  return (
    <div className="pb-2">
      <div
        className="relative w-full overflow-hidden rounded-sm border border-border bg-black cursor-pointer group"
        onClick={toggle}
      >
        <video
          ref={videoRef}
          src={src}
          className="w-full h-auto object-contain max-h-[120px]"
          muted
          playsInline
          onEnded={() => setPlaying(false)}
        />
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="w-3.5 h-3.5 text-black ml-0.5" />
            </div>
          </div>
        )}
        {playing && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
              <Pause className="w-3.5 h-3.5 text-black" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const OriginalDimensions: React.FC<{ src: string; type: "video" | "image" }> = ({ src, type }) => {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!src) return;
    if (type === "image") {
      const img = new Image();
      img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = src;
    } else {
      const vid = document.createElement("video");
      vid.preload = "metadata";
      vid.onloadedmetadata = () => setDims({ w: vid.videoWidth, h: vid.videoHeight });
      vid.src = src;
    }
  }, [src, type]);
  if (!dims) return null;
  return (
    <span className="text-[10px] text-muted-foreground">
      Original: {dims.w} × {dims.h}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

interface OverlayPropertySectionProps {
  sectionId: string;
}

export const OverlayPropertySection: React.FC<OverlayPropertySectionProps> = ({ sectionId }) => {
  const {
    selectedOverlayId,
    setSelectedOverlayId,
    selectedOverlayIds,
    overlays,
    changeOverlay,
    batchUpdate,
    currentFrame,
    seekTo,
  } = useEditorContext();
  const { getAspectRatioDimensions } = useAspectRatio();

  const [localOverlay, setLocalOverlay] = useState<Overlay | null>(null);

  useEffect(() => {
    if (selectedOverlayId === null) {
      setLocalOverlay(null);
      return;
    }
    const found = overlays.find((o) => o.id === selectedOverlayId);
    if (found) setLocalOverlay(found);
  }, [selectedOverlayId, overlays]);

  if (
    (selectedOverlayIds && selectedOverlayIds.length > 1) ||
    !localOverlay ||
    selectedOverlayId === null
  )
    return null;

  /* ---- update helpers ---- */

  const handleUpdateOverlay = (updated: Overlay) => {
    setLocalOverlay(updated);
    changeOverlay(updated.id, updated);
  };

  // ── Dimension Lock Row ──
  const renderDimensionLock = () => {
    if (!localOverlay) return null;
    const locked = localOverlay.aspectRatioLocked !== false;
    const ratio = localOverlay.width / localOverlay.height;

    const updateWidth = (w: number) => {
      const newW = Math.max(1, w);
      const updated = locked
        ? { ...localOverlay, width: newW, height: Math.round(newW / ratio) }
        : { ...localOverlay, width: newW };
      handleUpdateOverlay(updated);
    };
    const updateHeight = (h: number) => {
      const newH = Math.max(1, h);
      const updated = locked
        ? { ...localOverlay, height: newH, width: Math.round(newH * ratio) }
        : { ...localOverlay, height: newH };
      handleUpdateOverlay(updated);
    };
    const toggleLock = () => {
      handleUpdateOverlay({ ...localOverlay, aspectRatioLocked: !locked });
    };

    const resetToOriginal = () => {
      const canvas = getAspectRatioDimensions();
      const src = (localOverlay as any).src || (localOverlay as any).content;
      if (!src) return;

      if (localOverlay.type === OverlayType.IMAGE) {
        const img = new Image();
        img.onload = () => {
          const natW = img.naturalWidth;
          const natH = img.naturalHeight;
          const scale = Math.min(canvas.width / natW, canvas.height / natH, 1);
          const w = Math.round(natW * scale);
          const h = Math.round(natH * scale);
          const left = Math.round((canvas.width - w) / 2);
          const top = Math.round((canvas.height - h) / 2);
          handleUpdateOverlay({ ...localOverlay, width: w, height: h, left, top });
        };
        img.src = src;
      } else if (localOverlay.type === OverlayType.VIDEO) {
        const vid = document.createElement("video");
        vid.preload = "metadata";
        vid.onloadedmetadata = () => {
          const natW = vid.videoWidth;
          const natH = vid.videoHeight;
          const scale = Math.min(canvas.width / natW, canvas.height / natH, 1);
          const w = Math.round(natW * scale);
          const h = Math.round(natH * scale);
          const left = Math.round((canvas.width - w) / 2);
          const top = Math.round((canvas.height - h) / 2);
          handleUpdateOverlay({ ...localOverlay, width: w, height: h, left, top });
        };
        vid.src = src;
      }
    };

    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-[11px] text-muted-foreground shrink-0">W</span>
          <input
            type="number"
            value={Math.round(localOverlay.width)}
            onChange={(e) => updateWidth(Number(e.target.value))}
            className="w-full px-1.5 py-1 text-xs border border-border rounded bg-card text-foreground tabular-nums"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-[11px] text-muted-foreground shrink-0">H</span>
          <input
            type="number"
            value={Math.round(localOverlay.height)}
            onChange={(e) => updateHeight(Number(e.target.value))}
            className="w-full px-1.5 py-1 text-xs border border-border rounded bg-card text-foreground tabular-nums"
          />
        </div>
        <button
          onClick={resetToOriginal}
          className="shrink-0 p-1 rounded text-muted-foreground hover:bg-muted transition-colors"
          title="Reset to original aspect ratio (fit to canvas)"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={toggleLock}
          className={`shrink-0 p-1 rounded transition-colors ${
            locked
              ? "text-primary bg-primary/10 hover:bg-primary/20"
              : "text-muted-foreground hover:bg-muted"
          }`}
          title={locked ? "Unlock aspect ratio" : "Lock aspect ratio"}
        >
          {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
        </button>
      </div>
    );
  };

  /* ---- Type-specific style change helpers ---- */

  const handleVideoStyleChange = (updates: Partial<ClipOverlay["styles"]>) => {
    const clip = localOverlay as ClipOverlay;
    const newStyles = { ...clip.styles, ...updates };
    for (const key of Object.keys(updates) as (keyof typeof updates)[]) {
      if (updates[key] === undefined || updates[key] === null) delete (newStyles as any)[key];
    }
    let updated: ClipOverlay = { ...clip, styles: newStyles };
    if (updates.speed !== undefined) {
      const oldSpeed = clip.styles.speed ?? 1;
      const newSpeed = updates.speed;
      if (newSpeed > 0 && newSpeed !== oldSpeed) {
        const newDuration = Math.max(1, Math.round(clip.durationInFrames * (oldSpeed / newSpeed)));
        updated = { ...updated, durationInFrames: newDuration };

        // If duration grew, push right-side neighbours to prevent overlaps
        if (newDuration > clip.durationInFrames) {
          const { displaced } = computeResizeDisplacement(
            overlays,
            clip.id,
            clip.from,
            newDuration,
            clip.row
          );
          if (displaced.length > 0 && batchUpdate) {
            const batchUpdates: Array<{ id: number; overlay: Partial<Overlay> }> = [
              { id: clip.id, overlay: { ...updated, durationInFrames: newDuration } },
            ];
            for (const d of displaced) {
              batchUpdates.push({ id: d.id, overlay: { from: d.from } });
            }
            setLocalOverlay(updated);
            batchUpdate(batchUpdates);
            return;
          }
        }
      }
    }
    handleUpdateOverlay(updated);
  };

  const handleTextInputChange = (field: keyof TextOverlay, value: string) => {
    handleUpdateOverlay({ ...(localOverlay as TextOverlay), [field]: value });
  };

  const handleTextStyleChange = (field: keyof TextOverlay["styles"], value: string) => {
    const text = localOverlay as TextOverlay;
    handleUpdateOverlay({ ...text, styles: { ...text.styles, [field]: value } });
  };

  const handleImageStyleChange = (updates: Partial<ImageOverlay["styles"]>) => {
    const img = localOverlay as ImageOverlay;
    const newStyles = { ...img.styles, ...updates };
    for (const key of Object.keys(updates) as (keyof typeof updates)[]) {
      if (updates[key] === undefined || updates[key] === null) delete (newStyles as any)[key];
    }
    handleUpdateOverlay({ ...img, styles: newStyles });
  };

  const handleShapeStyleChange = (updates: Partial<ShapeOverlay["styles"]>) => {
    const shape = localOverlay as ShapeOverlay;
    const newStyles = { ...shape.styles, ...updates };
    for (const key of Object.keys(updates) as (keyof typeof updates)[]) {
      if (updates[key] === undefined || updates[key] === null) delete (newStyles as any)[key];
    }
    handleUpdateOverlay({ ...shape, styles: newStyles });
  };

  /* ---- Per-type section rendering ---- */

  switch (localOverlay.type) {
    /* ======================== VIDEO ======================== */
    case OverlayType.VIDEO: {
      const clip = localOverlay as ClipOverlay;
      switch (sectionId) {
        case "properties":
          return (
            <div className="space-y-4">
              {/* Dimensions */}
              {renderDimensionLock()}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <OriginalDimensions src={clip.src || clip.content} type="video" />
                <span>·</span>
                <span>Double-click video to crop</span>
              </div>

              {/* Fit */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground shrink-0">Fit</span>
                <Select
                  value={clip.styles?.objectFit ?? "cover"}
                  onValueChange={(v) => handleVideoStyleChange({ objectFit: v as any })}
                >
                  <SelectTrigger className="h-7 text-[11px] w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cover">Cover</SelectItem>
                    <SelectItem value="contain">Contain</SelectItem>
                    <SelectItem value="fill">Fill</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="h-px bg-border my-1" />

              {/* Volume / Opacity / Round */}
              <VideoVolumeSection localOverlay={clip} handleStyleChange={handleVideoStyleChange} />
              <VideoAppearanceSection localOverlay={clip} handleStyleChange={handleVideoStyleChange} />

              <div className="h-px bg-border my-1" />

              {/* Speed */}
              <VideoSpeedSection localOverlay={clip} handleStyleChange={handleVideoStyleChange} />
            </div>
          );
        case "captions":
          return <VideoCaptionSection overlay={clip} />;
        case "animation":
          return <VideoAnimationSection localOverlay={clip} handleStyleChange={handleVideoStyleChange} />;
        default:
          return null;
      }
    }

    /* ======================== TEXT ======================== */
    case OverlayType.TEXT: {
      const text = localOverlay as TextOverlay;
      switch (sectionId) {
        case "style":
          return (
            <div className="space-y-2">
              {/* Preview + Editor */}
              <div
                style={{ backgroundColor: text.styles.backgroundColor }}
                className="relative w-full overflow-hidden rounded-sm border border-border p-3"
              >
                <div
                  className={`w-full break-words ${text.styles.fontFamily}`}
                  style={{
                    color: text.styles.color,
                    background: text.styles.background,
                    WebkitBackgroundClip: text.styles.WebkitBackgroundClip,
                    WebkitTextFillColor: text.styles.WebkitTextFillColor,
                    fontWeight: text.styles.fontWeight,
                    fontStyle: text.styles.fontStyle,
                    textDecoration: text.styles.textDecoration,
                    textAlign: text.styles.textAlign as any,
                  }}
                >
                  {text.content || "Text Preview"}
                </div>
              </div>
              <textarea
                value={text.content || ""}
                onChange={(e) => handleTextInputChange("content", e.target.value)}
                placeholder="Enter your text here..."
                className="w-full min-h-[48px] rounded-sm border border-border bg-muted/30 p-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:outline-none resize-none"
                spellCheck="false"
              />
              <TextStylePanel
                localOverlay={text}
                handleInputChange={handleTextInputChange}
                handleStyleChange={handleTextStyleChange}
              />
            </div>
          );
        case "animation":
          return <TextSettingsPanel localOverlay={text} handleStyleChange={handleTextStyleChange} />;
        default:
          return null;
      }
    }

    /* ======================== IMAGE ======================== */
    case OverlayType.IMAGE: {
      const img = localOverlay as ImageOverlay;
      switch (sectionId) {
        case "properties":
          return (
            <div className="space-y-2">
              <div className="relative w-full overflow-hidden rounded-sm border border-border bg-muted/30">
                <img src={img.src} alt="Image preview" className="w-full h-auto object-contain max-h-[120px]" />
              </div>
              <div className="flex items-center justify-between">
                {renderDimensionLock()}
              </div>
              <OriginalDimensions src={img.src} type="image" />
              <ImageStylePanel localOverlay={img} handleStyleChange={handleImageStyleChange} />
            </div>
          );
        case "crop":
          return <ImageCropSection localOverlay={img} handleStyleChange={handleImageStyleChange} />;
        case "animation":
          return <ImageAnimationSection localOverlay={img} handleStyleChange={handleImageStyleChange} />;
        default:
          return null;
      }
    }

    /* ======================== SHAPE ======================== */
    case OverlayType.SHAPE: {
      const shape = localOverlay as ShapeOverlay;
      const shapeDef = getShapeByKey(shape.content);
      const previewFill = shape.styles.fill || "transparent";
      const previewStroke = shape.styles.stroke || "none";
      const previewStrokeWidth = shape.styles.strokeWidth ?? 0;
      const previewPathData = shape.styles.pathData;
      const previewPathViewBox = shape.styles.pathViewBox;
      const previewViewBox = previewPathData
        ? previewPathViewBox || shapeDef?.viewBox || "0 0 100 100"
        : shapeDef?.viewBox || "0 0 100 100";
      const previewGradient = shape.styles.gradient;
      const previewGradientId = `preview-grad-${shape.id}`;

      switch (sectionId) {
        case "properties":
          return (
            <div className="space-y-2">
              {/* Shape preview */}
              <div
                className="relative w-full overflow-hidden rounded-sm border border-border"
                style={{
                  aspectRatio: "16 / 9",
                  background:
                    "repeating-conic-gradient(hsl(var(--muted)) 0% 25%, hsl(var(--background)) 0% 50%) 50% / 16px 16px",
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center p-2">
                  <svg
                    viewBox={previewViewBox}
                    className="w-full h-full"
                    preserveAspectRatio={previewPathData ? "none" : "xMidYMid meet"}
                    style={{ maxWidth: "100%", maxHeight: "100%" }}
                  >
                    {previewGradient && (
                      <defs>
                        <linearGradient id={previewGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                          {previewGradient.split(",").map((c: string, i: number, arr: string[]) => (
                            <stop
                              key={i}
                              offset={`${Math.round((i / Math.max(arr.length - 1, 1)) * 100)}%`}
                              stopColor={c.trim()}
                            />
                          ))}
                        </linearGradient>
                      </defs>
                    )}
                    {previewPathData ? (
                      <path
                        d={previewPathData}
                        fill={previewGradient ? `url(#${previewGradientId})` : previewFill}
                        stroke={previewStroke}
                        strokeWidth={previewStrokeWidth}
                        strokeDasharray={shape.styles.strokeDasharray || undefined}
                        strokeLinecap={(shape.styles.strokeLinecap as any) || "round"}
                        fillRule={shape.content === "ring" ? "evenodd" : undefined}
                      />
                    ) : (
                      shapeDef?.path(
                        previewGradient ? `url(#${previewGradientId})` : previewFill,
                        previewStroke,
                        previewStrokeWidth,
                      )
                    )}
                  </svg>
                </div>
              </div>
              <ShapeSettingsPanel localOverlay={shape} handleStyleChange={handleShapeStyleChange} />
            </div>
          );
        case "effects":
          return <ShapeStylePanel localOverlay={shape} handleStyleChange={handleShapeStyleChange} />;
        case "animation":
          return (
            <AnimationTabs
              enterValue={shape.styles.animation?.enter}
              exitValue={shape.styles.animation?.exit}
              onEnterChange={(key) => handleShapeStyleChange({ animation: { ...shape.styles.animation, enter: key } })}
              onExitChange={(key) => handleShapeStyleChange({ animation: { ...shape.styles.animation, exit: key } })}
            />
          );
        default:
          return null;
      }
    }

    /* ======================== SOUND ======================== */
    case OverlayType.SOUND: {
      const soundOverlay = localOverlay as SoundOverlay;
      switch (sectionId) {
        case "properties":
          return (
            <SoundDetails
              localOverlay={soundOverlay}
              setLocalOverlay={(o) => handleUpdateOverlay(o)}
            />
          );
        default:
          return null;
      }
    }

    default:
      return null;
  }
};
