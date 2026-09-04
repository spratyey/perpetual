// Define overlay types enum
export enum OverlayType {
  TEXT = "text",
  IMAGE = "image",
  SHAPE = "shape",
  VIDEO = "clip",
  SOUND = "sound",
  CAPTION = "caption",
  BACKGROUND = "background",
  /** A sidebar panel rather than an overlay kind, like BACKGROUND. */
  HISTORY = "history",
}
// Base overlay properties
type BaseOverlay = {
  id: number;
  durationInFrames: number;
  from: number;
  height: number;
  row: number;
  left: number;
  top: number;
  width: number;
  isDragging: boolean;
  rotation: number;
  type: OverlayType;
  maxDuration?: number;
  aspectRatioLocked?: boolean;
  /** Set when the overlay was created from a stored asset, so its blob URL can be re-linked after a reload. */
  assetId?: string; // true by default — lock aspect ratio during resize
};

// Base style properties
type BaseStyles = {
  opacity?: number;
  zIndex?: number;
  transform?: string;
};

// Base animation type
type AnimationConfig = {
  enter?: string;
  exit?: string;
};

// Zoom effect type
export type ZoomEffect = {
  id: string;
  startFrame: number;
  endFrame: number;
  positionX: number; // 0-100 percentage position on x-axis
  positionY: number; // 0-100 percentage position on y-axis
  magnitude: number; // zoom scale (0.1-5.0: <1 = zoom out, 1 = no zoom, >1 = zoom in)
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  snapDuration?: number; // legacy: frames for snap-in/out transitions (used as fallback)
  snapInDuration?: number; // frames for snap-in transition
  snapOutDuration?: number; // frames for snap-out transition
};

// Crop effect type
export type CropEffect = {
  x: number; // 0-100 percentage from left edge
  y: number; // 0-100 percentage from top edge
  width: number; // 0-100 percentage of original width
  height: number; // 0-100 percentage of original height
};

// Text overlay specific
export type TextOverlay = BaseOverlay & {
  type: OverlayType.TEXT;
  content: string;
  styles: BaseStyles & {
    fontSize: string;
    fontWeight: string;
    color: string;
    backgroundColor: string;
    fontFamily: string;
    fontStyle: string;
    textDecoration: string;
    lineHeight?: string;
    letterSpacing?: string;
    textAlign?: "left" | "center" | "right";
    textShadow?: string;
    padding?: string;
    borderRadius?: string;
    boxShadow?: string;
    background?: string;
    WebkitBackgroundClip?: string;
    WebkitTextFillColor?: string;
    backdropFilter?: string;
    border?: string;
    animation?: AnimationConfig;
  };
};

// Shape overlay specific
export type ShapeOverlay = BaseOverlay & {
  type: OverlayType.SHAPE;
  content: string;
  styles: BaseStyles & {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    borderRadius?: string;
    boxShadow?: string;
    gradient?: string;
    animation?: AnimationConfig;
    strokeDasharray?: string;  // SVG dash pattern (e.g. "8 4", "4 4", "2 2")
    strokeLinecap?: string;    // "round" | "butt" | "square"
    pathData?: string;         // SVG path "d" attribute (editable override of preset shape)
    pathViewBox?: string;      // viewBox for the custom path
    cornerRadius?: number;     // SVG rx/ry for rectangle shapes (0–50 in viewBox units)
  };
};

// Clip overlay specific
export type ClipOverlay = BaseOverlay & {
  type: OverlayType.VIDEO;
  content: string;
  src: string;
  videoStartTime?: number;
  styles: BaseStyles & {
    objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
    objectPosition?: string;
    volume?: number;
    speed?: number; // Playback speed multiplier (0.25-8, default 1)
    borderRadius?: string;
    filter?: string;
    boxShadow?: string;
    border?: string;
    animation?: AnimationConfig; // Using shared type
    zoomEffects?: ZoomEffect[]; // Array of zoom effects
    cropEffect?: CropEffect; // Crop configuration
  };
};

// Sound overlay specific
export type SoundOverlay = BaseOverlay & {
  type: OverlayType.SOUND;
  content: string;
  src: string;
  startFromSound?: number;
  captions?: Caption[];
  captionStyles?: CaptionStyles;
  captionTemplate?: string;
  styles: BaseStyles & {
    volume?: number;
    fadeIn?: number; // fade in duration in frames
    fadeOut?: number; // fade out duration in frames
  };
};

export type CaptionWord = {
  word: string;
  startMs: number;
  endMs: number;
  confidence: number;
};

export type Caption = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
  words: CaptionWord[];
};

// Update CaptionOverlay to include styling for highlighted words
export interface CaptionStyles {
  fontFamily: string;
  fontSize: string;
  lineHeight: number;
  textAlign: "left" | "center" | "right";
  color: string;
  backgroundColor?: string;
  background?: string;
  backdropFilter?: string;
  padding?: string;
  fontWeight?: number | string;
  letterSpacing?: string;
  textShadow?: string;
  borderRadius?: string;
  transition?: string;
  highlightStyle?: {
    backgroundColor?: string;
    color?: string;
    scale?: number;
    fontWeight?: number;
    textShadow?: string;
    padding?: string;
    borderRadius?: string;
    transition?: string;
    background?: string;
    border?: string;
    backdropFilter?: string;
  };
}

/** @deprecated CaptionOverlay is no longer used. Captions are now a property of SoundOverlay. */
export interface LegacyCaptionOverlay extends BaseOverlay {
  type: OverlayType.SOUND;
  captions: Caption[];
  styles?: CaptionStyles;
  template?: string;
}

/**
 * Where a caption word sits in its line: the run-up, the phrase the viewer
 * reads first, and the words that trail off it.
 */
export type CaptionRole = "lead" | "display" | "tail";

export type CaptionToken = {
  text: string;
  role: CaptionRole;
  /** Frames from the start of its own cue. */
  from: number;
  /** Set when the subject would swallow the word, so it stays in front of them. */
  inFront?: boolean;
};

/** One line of kinetic caption: its words, its timing and where it sits. */
export type CaptionCue = {
  /** Frames from the start of the overlay. */
  from: number;
  durationInFrames: number;
  tokens: CaptionToken[];
  /** Centre of the cue block, as a fraction of the canvas. */
  anchor: { x: number; y: number };
};

/**
 * A sprite atlas of subject silhouettes, one cell per sampled frame. The
 * caption is erased where the silhouette is opaque, which puts the words
 * behind the subject without touching the video underneath.
 */
export type CaptionMatte = {
  id: string;
  columns: number;
  cellWidth: number;
  cellHeight: number;
  /** Transparent gutter around each cell, so upscaling cannot sample a neighbour. */
  padding: number;
  frameCount: number;
  /** Overlay frame the first cell was sampled at. */
  startFrame: number;
  /** Overlay frames covered by one cell. */
  frameStep: number;
};

export type CaptionOverlay = BaseOverlay & {
  type: OverlayType.CAPTION;
  /** The transcript, kept for the timeline label and for search. */
  content: string;
  cues: CaptionCue[];
  matte?: CaptionMatte;
  styles: BaseStyles & {
    color?: string;
    /** Height of the display phrase as a fraction of the canvas height. */
    displayScale?: number;
    fontFamily?: "serif" | "sans";
  };
};

export type Overlay =
  | TextOverlay
  | ImageOverlay
  | ShapeOverlay
  | ClipOverlay
  | SoundOverlay
  | CaptionOverlay;

export type MainProps = {
  readonly overlays: Overlay[];
  readonly setSelectedOverlay: React.Dispatch<
    React.SetStateAction<number | null>
  >;
  readonly selectedOverlay: number | null;
  readonly changeOverlay: (
    overlayId: number,
    updater: (overlay: Overlay) => Overlay
  ) => void;
};

import { z } from "zod";

// Base interface for all timeline items
interface TimelineItem {
  id: string;
  start: number;
  duration: number;
  row: number;
}

// Clip specific properties
export interface Video extends TimelineItem {
  type: OverlayType.VIDEO;
  src: string;
  videoStartTime?: number;
}

// Sound specific properties
export interface Sound extends TimelineItem {
  type: OverlayType.SOUND;
  file: string;
  content: string;
  startFromSound: number;
}

// Base interface for layers
interface Layer extends TimelineItem {
  position: { x: number; y: number };
}

// Text layer specific properties
export interface TextLayer extends Layer {
  type: OverlayType.TEXT;
  text: string;
  fontSize: number;
  fontColor: string;
  fontFamily: string;
  backgroundColor: string;
}

// Shape layer specific properties
export interface ShapeLayer extends Layer {
  type: OverlayType.SHAPE;
  shapeType: "rectangle" | "circle" | "triangle";
  color: string;
  size: { width: number; height: number };
}

// Image layer specific properties
export interface ImageLayer extends Layer {
  type: OverlayType.IMAGE;
  src: string;
  size: { width: number; height: number };
}

// Union type for all possible layers
export type LayerItem = TextLayer | ShapeLayer | ImageLayer;

// Union type for all timeline items
export type TimelineItemUnion = Video | Sound | LayerItem;

// Type for the selected item in the editor
export type SelectedItem = TimelineItemUnion | null;

// Zod schema for composition props
export const CompositionProps = z.object({
  overlays: z.array(z.any()), // Replace with your actual Overlay type
  durationInFrames: z.number(),
  width: z.number(),
  height: z.number(),
  fps: z.number(),
  src: z.string(),
  background: z.object({
    type: z.enum(["color", "gradient", "image"]),
    color: z.string().optional(),
    gradient: z
      .object({
        direction: z.string(),
        colors: z.array(z.string()),
      })
      .optional(),
    image: z
      .object({
        src: z.string(),
        fit: z.enum(["cover", "contain", "fill"]),
      })
      .optional(),
  }),
});

// Other types remain the same
export const RenderRequest = z.object({
  id: z.string(),
  inputProps: CompositionProps,
  outputPath: z.string().optional(),
  renderMethod: z.enum(["local", "modal"]).optional(),
});

export const ProgressRequest = z.object({
  bucketName: z.string(),
  id: z.string(),
});

export type ProgressResponse =
  | { type: "error"; message: string }
  | { type: "progress"; progress: number }
  | { type: "done"; url: string; size: number; downloadUrl?: string };

// Additional types
export interface PexelsMedia {
  id: string;
  duration?: number;
  image?: string;
  video_files?: { link: string }[];
}

export interface PexelsAudio {
  id: string;
  title: string;
  artist: string;
  audio_url: string;
  duration: number;
}

export interface LocalSound {
  id: string;
  title: string;
  artist: string;
  file: string;
  duration: number;
}

export type LocalClip = {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  videoUrl: string;
};

export type AspectRatio = "16:9" | "1:1" | "4:5" | "9:16";

export interface TimelineRow {
  id: number;
  index: number;
}

export interface WaveformData {
  peaks: number[];   // peak amplitude per bucket (for outer envelope)
  rms: number[];     // RMS amplitude per bucket (for inner fill)
  length: number;
}

// Update EditorContextType
export interface EditorContextType {
  // ... existing context properties ...
  rows: TimelineRow[];
  addRow: () => void;
}

// Update ImageStyles interface to match ClipOverlay style pattern
export interface ImageStyles extends BaseStyles {
  filter?: string;
  borderRadius?: string;
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
  objectPosition?: string;
  boxShadow?: string;
  border?: string;
  animation?: AnimationConfig;
  cropEffect?: CropEffect;
}

// Update ImageOverlay to match ClipOverlay pattern
export interface ImageOverlay extends BaseOverlay {
  type: OverlayType.IMAGE;
  src: string;
  content?: string; // Optional thumbnail/preview
  styles: ImageStyles;
}

// Background configuration interface
export interface BackgroundConfig {
  type: "color" | "gradient" | "image";
  color?: string;
  gradient?: {
    direction: string;
    colors: string[];
  };
  image?: {
    src: string;
    fit: "cover" | "contain" | "fill";
  };
}

// Background preset interfaces
export interface GradientPreset {
  id: string;
  name: string;
  colors: string[];
  direction: string;
  preview?: string;
}

export interface ImagePreset {
  id: string;
  name: string;
  src: string;
  thumbnail?: string;
  category?: string;
}

// Local media file interface
