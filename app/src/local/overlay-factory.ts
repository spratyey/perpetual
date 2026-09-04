/**
 * Overlay factory — ported verbatim in behaviour from the backend
 * `buildOverlay` in the server room.
 *
 * Keeping this identical means overlays created by WebMCP tools match the
 * overlays created by the existing editor panels.
 */

import { OverlayType } from "@/components/editor/types";
import { MAX_ROWS } from "@/components/editor/constants";

export function buildOverlay(payload: any): any {
  const {
    overlayType = payload.type || "clip",
    from = 0,
    durationInFrames = 150,
    row = 0,
    left = 0,
    top = 0,
    width = 1920,
    height = 1080,
    rotation = 0,
  } = payload;

  const clampedRow = Math.max(0, Math.min(row, MAX_ROWS - 1));

  const base: any = {
    from,
    durationInFrames,
    row: clampedRow,
    left,
    top,
    width,
    height,
    rotation,
    isDragging: false,
    aspectRatioLocked: payload.aspectRatioLocked ?? true,
    ...(payload.maxDuration != null ? { maxDuration: payload.maxDuration } : {}),
    ...(payload.assetId ? { assetId: payload.assetId } : {}),
  };

  switch (overlayType) {
    case "text":
      return {
        ...base,
        type: OverlayType.TEXT,
        content: payload.content ?? "Text",
        styles: {
          fontSize: payload.fontSize ?? "48px",
          fontWeight: payload.fontWeight ?? "700",
          color: payload.color ?? "#ffffff",
          backgroundColor: payload.backgroundColor ?? "transparent",
          fontFamily: payload.fontFamily ?? "Inter",
          fontStyle: "normal",
          textDecoration: "none",
          textAlign: payload.textAlign ?? "center",
          animation: payload.animation ?? {},
          ...(payload.styles ?? {}),
        },
      };

    case "image":
      return {
        ...base,
        type: OverlayType.IMAGE,
        src: payload.src ?? "",
        content: "",
        styles: {
          objectFit: "cover",
          filter: "none",
          borderRadius: "0",
          animation: {},
          ...(payload.styles ?? {}),
        },
      };

    case "shape":
      return {
        ...base,
        aspectRatioLocked: payload.aspectRatioLocked ?? false,
        type: OverlayType.SHAPE,
        content: payload.content ?? "rectangle",
        styles: {
          fill: payload.fill ?? "#ffffff",
          stroke: payload.stroke ?? "transparent",
          strokeWidth: payload.strokeWidth ?? 0,
          borderRadius: "0",
          ...(payload.styles ?? {}),
        },
      };

    case "sound":
      return {
        ...base,
        type: OverlayType.SOUND,
        src: payload.src ?? payload.mediaUrl ?? "",
        content: payload.content ?? payload.name ?? "",
        startFromSound: payload.startFromSound ?? 0,
        styles: {
          volume: payload.volume ?? 1,
          ...(payload.styles ?? {}),
        },
      };

    case "caption":
      return {
        ...base,
        aspectRatioLocked: payload.aspectRatioLocked ?? false,
        type: OverlayType.CAPTION,
        content: payload.content ?? "",
        cues: payload.cues ?? [],
        ...(payload.matte ? { matte: payload.matte } : {}),
        styles: {
          color: payload.color ?? "#ffffff",
          fontFamily: payload.fontFamily ?? "serif",
          ...(payload.displayScale != null ? { displayScale: payload.displayScale } : {}),
          ...(payload.styles ?? {}),
        },
      };

    case "clip":
    default:
      return {
        ...base,
        type: OverlayType.VIDEO,
        content: payload.content || payload.name || "",
        src: payload.src ?? payload.mediaUrl ?? "",
        videoStartTime: payload.videoStartTime ?? 0,
        styles: {
          objectFit: "cover",
          filter: "none",
          borderRadius: 0,
          opacity: 1,
          zIndex: 100,
          transform: "none",
          animation: {},
          speed: payload.speed ?? 1,
          ...(payload.styles ?? {}),
        },
      };
  }
}
