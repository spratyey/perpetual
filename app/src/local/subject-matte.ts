/**
 * Subject matte.
 *
 * Words are put behind a person by erasing the caption where the person is,
 * not by drawing the person back on top. Only an alpha silhouette has to be
 * stored, the video underneath is never touched, and the edge keeps the
 * original pixels.
 *
 * Silhouettes are segmented once, ahead of playback, and packed into a single
 * sprite atlas in IndexedDB. A frame then costs one extra drawImage.
 */

import type { CaptionMatte } from "@/components/editor/types";
import { putMatte, getMatte } from "./persistence";

// Fetched on first use rather than bundled: the runtime alone is 12 MB.
const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";

/** Longest edge of one atlas cell. Upscaling to the canvas softens the edge for free. */
const CELL_LONG_EDGE = 256;
/** Transparent gutter around each cell so upscaling cannot sample a neighbour. */
const CELL_PADDING = 3;
/** How much of the previous silhouette carries over, to stop the edge crawling. */
const SMOOTHING = 0.35;
/** Extra passes over the blurred silhouette, which thickens it just past the subject. */
const DILATE_PASSES = 2;

export const OCCUPANCY_COLUMNS = 24;
export const OCCUPANCY_ROWS = 14;

export interface SubjectOccupancy {
  /** Coverage in 0–1 per grid cell, one grid per sampled frame. */
  values: Float32Array;
  startFrame: number;
  frameStep: number;
  frameCount: number;
}

export interface MatteBuildRequest {
  src: string;
  width: number;
  height: number;
  startFrame: number;
  frameStep: number;
  frameCount: number;
  /** Overlay frame to seconds into the source file. */
  sourceTimeAt: (frame: number) => number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

export interface MatteBuildResult {
  matte: CaptionMatte;
  occupancy: SubjectOccupancy;
}

type Segmenter = import("@mediapipe/tasks-vision").ImageSegmenter;

let segmenterPromise: Promise<Segmenter> | null = null;

function loadSegmenter(): Promise<Segmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      const options = {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" as const },
        runningMode: "IMAGE" as const,
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      };
      try {
        return await ImageSegmenter.createFromOptions(fileset, options);
      } catch {
        return await ImageSegmenter.createFromOptions(fileset, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: "CPU" as const },
        });
      }
    })();
    segmenterPromise.catch(() => { segmenterPromise = null; });
  }
  return segmenterPromise;
}

function openVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = src;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error("The clip could not be opened for segmentation."));
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 1e-3) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      clearTimeout(timer);
      resolve();
    };
    // A seek past the last decodable frame never fires, so the frame already
    // in the element is used instead of stalling the whole build.
    const timer = setTimeout(done, 2000);
    video.addEventListener("seeked", done);
    video.currentTime = time;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, w: number, h: number): void {
  const scale = Math.max(w / video.videoWidth, h / video.videoHeight);
  const dw = video.videoWidth * scale;
  const dh = video.videoHeight * scale;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

export async function buildSubjectMatte(request: MatteBuildRequest): Promise<MatteBuildResult> {
  const { width, height, frameCount, frameStep, startFrame, signal } = request;

  const cellWidth = width >= height ? CELL_LONG_EDGE : Math.round((CELL_LONG_EDGE * width) / height);
  const cellHeight = width >= height ? Math.round((CELL_LONG_EDGE * height) / width) : CELL_LONG_EDGE;
  const slotWidth = cellWidth + CELL_PADDING * 2;
  const slotHeight = cellHeight + CELL_PADDING * 2;
  const columns = Math.ceil(Math.sqrt(frameCount));
  const rows = Math.ceil(frameCount / columns);

  const [segmenter, video] = await Promise.all([loadSegmenter(), openVideo(request.src)]);
  throwIfAborted(signal);

  const frame = document.createElement("canvas");
  frame.width = cellWidth;
  frame.height = cellHeight;
  const frameCtx = frame.getContext("2d", { willReadFrequently: true })!;

  const silhouette = document.createElement("canvas");
  silhouette.width = cellWidth;
  silhouette.height = cellHeight;
  const silhouetteCtx = silhouette.getContext("2d")!;
  const pixels = silhouetteCtx.createImageData(cellWidth, cellHeight);

  const atlas = document.createElement("canvas");
  atlas.width = columns * slotWidth;
  atlas.height = rows * slotHeight;
  const atlasCtx = atlas.getContext("2d")!;

  const smoothed = new Float32Array(cellWidth * cellHeight);
  const occupancy = new Float32Array(frameCount * OCCUPANCY_COLUMNS * OCCUPANCY_ROWS);
  const blur = Math.max(1, Math.round(cellWidth / 110));

  try {
    for (let index = 0; index < frameCount; index++) {
      throwIfAborted(signal);
      await seekTo(video, request.sourceTimeAt(startFrame + index * frameStep));
      drawCover(frameCtx, video, cellWidth, cellHeight);

      const result = segmenter.segment(frame);
      const categories = result.categoryMask?.getAsUint8Array();
      if (categories) {
        for (let i = 0; i < smoothed.length; i++) {
          const subject = categories[i] === 0 ? 0 : 1;
          smoothed[i] = index === 0 ? subject : subject * (1 - SMOOTHING) + smoothed[i] * SMOOTHING;
          pixels.data[i * 4 + 3] = Math.round(smoothed[i] * 255);
        }
      }
      result.close();

      silhouetteCtx.putImageData(pixels, 0, 0);

      const slotX = (index % columns) * slotWidth;
      const slotY = Math.floor(index / columns) * slotHeight;
      atlasCtx.filter = `blur(${blur}px)`;
      // Stretched first so the gutter carries the same silhouette: a subject
      // touching the frame edge then stays opaque right up to it.
      atlasCtx.drawImage(silhouette, slotX, slotY, slotWidth, slotHeight);
      for (let pass = 0; pass <= DILATE_PASSES; pass++) {
        atlasCtx.drawImage(silhouette, slotX + CELL_PADDING, slotY + CELL_PADDING, cellWidth, cellHeight);
      }
      atlasCtx.filter = "none";

      accumulateOccupancy(smoothed, cellWidth, cellHeight, occupancy, index);
      request.onProgress?.(index + 1, frameCount);
    }
  } finally {
    video.src = "";
  }

  const blob = await new Promise<Blob | null>((resolve) => atlas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The subject matte could not be encoded.");

  const id = crypto.randomUUID();
  await putMatte(id, blob);

  return {
    matte: { id, columns, cellWidth, cellHeight, padding: CELL_PADDING, frameCount, startFrame, frameStep },
    occupancy: { values: occupancy, startFrame, frameStep, frameCount },
  };
}

function accumulateOccupancy(
  mask: Float32Array,
  width: number,
  height: number,
  out: Float32Array,
  index: number
): void {
  const base = index * OCCUPANCY_COLUMNS * OCCUPANCY_ROWS;
  const counts = new Float32Array(OCCUPANCY_COLUMNS * OCCUPANCY_ROWS);
  for (let y = 0; y < height; y++) {
    const gy = Math.min(OCCUPANCY_ROWS - 1, Math.floor((y / height) * OCCUPANCY_ROWS));
    for (let x = 0; x < width; x++) {
      const gx = Math.min(OCCUPANCY_COLUMNS - 1, Math.floor((x / width) * OCCUPANCY_COLUMNS));
      const cell = gy * OCCUPANCY_COLUMNS + gx;
      out[base + cell] += mask[y * width + x];
      counts[cell] += 1;
    }
  }
  for (let cell = 0; cell < counts.length; cell++) {
    if (counts[cell]) out[base + cell] /= counts[cell];
  }
}

/** Mean subject coverage under a normalised box, across the frames a cue is up. */
export function subjectCoverage(
  occupancy: SubjectOccupancy,
  fromFrame: number,
  toFrame: number,
  box: { left: number; top: number; right: number; bottom: number }
): number {
  const first = Math.max(0, Math.floor((fromFrame - occupancy.startFrame) / occupancy.frameStep));
  const last = Math.min(occupancy.frameCount - 1, Math.ceil((toFrame - occupancy.startFrame) / occupancy.frameStep));
  if (last < first) return 0;

  const x0 = Math.max(0, Math.floor(box.left * OCCUPANCY_COLUMNS));
  const x1 = Math.min(OCCUPANCY_COLUMNS - 1, Math.ceil(box.right * OCCUPANCY_COLUMNS) - 1);
  const y0 = Math.max(0, Math.floor(box.top * OCCUPANCY_ROWS));
  const y1 = Math.min(OCCUPANCY_ROWS - 1, Math.ceil(box.bottom * OCCUPANCY_ROWS) - 1);

  let total = 0;
  let cells = 0;
  for (let index = first; index <= last; index++) {
    const base = index * OCCUPANCY_COLUMNS * OCCUPANCY_ROWS;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        total += occupancy.values[base + y * OCCUPANCY_COLUMNS + x];
        cells += 1;
      }
    }
  }
  return cells ? total / cells : 0;
}

const bitmaps = new Map<string, Promise<ImageBitmap | null>>();

export function loadMatteBitmap(id: string): Promise<ImageBitmap | null> {
  let pending = bitmaps.get(id);
  if (!pending) {
    pending = getMatte(id)
      .then((blob) => (blob ? createImageBitmap(blob) : null))
      .catch(() => null);
    bitmaps.set(id, pending);
  }
  return pending;
}
