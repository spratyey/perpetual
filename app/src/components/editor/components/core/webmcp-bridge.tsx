/**
 * WebMCP bridge.
 *
 * Ported from the original editor bridge, with the WebSocket mutation transport
 * replaced by the local project store. Every tool is a thin, validated
 * wrapper over the same commands the editor UI uses, so a human and an agent
 * share one document, one history and one activity feed.
 */

import { useEffect, useRef } from "react";
import { z } from "zod";

import { FPS, MAX_ROWS } from "../../constants";
import { useEditorContext } from "../../contexts/editor-context";
import { useAssetStore } from "@/local/asset-store";
import { useAnalysisStore } from "@/local/analysis-store";
import { useCaptionStore } from "@/local/caption-store";
import { fetchMediaAsFile, UrlImportError } from "@/local/import-url";
import { useGenerationStore, type GenerateRequest } from "@/local/generation-store";
import type { LocalProject } from "@/local/use-local-project";
import { defineTool, type ToolConfig } from "@/local/webmcp-tool";
import type { OverlayMutation } from "@/local/types";

const SHAPE_KINDS = [
  "rectangle", "rounded-rect", "circle", "ellipse", "triangle", "diamond",
  "pentagon", "hexagon", "arrow-right", "arrow-left", "arrow-up", "arrow-down",
  "double-arrow", "line-horizontal", "line-vertical", "heart", "cross", "ring",
  "chevron-right", "chevron-left", "speech-bubble", "thought-bubble",
] as const;

const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:5"] as const;

const emptyInput = z.object({}).strict();

const finite = (max: number) => z.number().finite().min(-max).max(max);

const timingFields = {
  fromSeconds: z.number().finite().min(0).max(3600).optional(),
  durationSeconds: z.number().finite().min(0.1).max(3600).optional(),
  row: z.number().int().min(0).max(MAX_ROWS - 1).optional(),
};

const boxFields = {
  left: finite(20000).optional(),
  top: finite(20000).optional(),
  width: z.number().finite().min(1).max(20000).optional(),
  height: z.number().finite().min(1).max(20000).optional(),
  rotation: finite(3600).optional(),
};

/** Paging for get_editor_state, so a long timeline is not silently cut off. */
const overlayPageInput = z.object({
  offset: z.number().int().min(0).max(1000).optional(),
  limit: z.number().int().min(1).max(50).optional(),
}).strict();

const seekInput = z.object({ timeSeconds: z.number().finite().min(0).max(36000) }).strict();

const addTextInput = z.object({
  content: z.string().min(1).max(500),
  ...timingFields,
  ...boxFields,
  fontSize: z.string().max(20).optional(),
  color: z.string().max(64).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
}).strict();

const addShapeInput = z.object({
  shape: z.enum(SHAPE_KINDS),
  ...timingFields,
  ...boxFields,
  fill: z.string().max(64).optional(),
}).strict();

const addAssetInput = z.object({
  assetId: z.string().min(8).max(64),
  sourceStartSeconds: z.number().finite().min(0).max(36000).optional(),
  sourceEndSeconds: z.number().finite().min(0).max(36000).optional(),
  ...timingFields,
}).strict();

const updateOverlayInput = z.object({
  overlayId: z.number().int().positive(),
  ...timingFields,
  ...boxFields,
  content: z.string().max(2000).optional(),
  sourceStartSeconds: z.number().finite().min(0).max(36000).optional(),
  opacity: z.number().min(0).max(1).optional(),
  volume: z.number().min(0).max(1).optional(),
  speed: z.number().min(0.25).max(8).optional(),
  color: z.string().max(64).optional(),
  fontSize: z.string().max(20).optional(),
}).strict().refine(
  (input) => Object.keys(input).some((key) => key !== "overlayId"),
  "Provide at least one field to change."
);

const assetIdsInput = z.object({
  assetIds: z.array(z.string().min(8).max(64)).min(1).max(10),
}).strict();

const assetIdInput = z.object({ assetId: z.string().min(8).max(64) }).strict();

const searchContentInput = z.object({
  query: z.string().min(2).max(200),
  limit: z.number().int().min(1).max(30).optional(),
}).strict();

const arrangeTimelineInput = z.object({
  placements: z.array(
    z.object({
      overlayId: z.number().int().positive(),
      fromSeconds: z.number().finite().min(0).max(36000),
      row: z.number().int().min(0).max(MAX_ROWS - 1).optional(),
    }).strict()
  ).min(1).max(24),
}).strict();

const splitOverlayInput = z.object({
  overlayId: z.number().int().positive(),
  timeSeconds: z.number().finite().min(0).max(36000),
}).strict();

const deleteOverlayInput = z.object({ overlayId: z.number().int().positive() }).strict();

const backgroundInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("color"), color: z.string().min(1).max(64) }).strict(),
  z.object({
    type: z.literal("gradient"),
    gradient: z.object({
      direction: z.string().min(1).max(64),
      colors: z.array(z.string().min(1).max(64)).min(2).max(8),
    }).strict(),
  }).strict(),
]);

const aspectRatioInput = z.object({ aspectRatio: z.enum(ASPECT_RATIOS) }).strict();

const generateImageInput = z.object({
  prompt: z.string().min(1).max(2000),
  aspectRatio: z.enum(ASPECT_RATIOS).optional(),
}).strict();

const importUrlInput = z.object({
  urls: z.array(z.string().min(1).max(2048)).min(1).max(8),
}).strict();

const generateVideoInput = z.object({
  prompt: z.string().min(1).max(2000),
  aspectRatio: z.enum(["16:9", "9:16"]).optional(),
  durationSeconds: z.union([z.literal(4), z.literal(6), z.literal(8)]).optional(),
}).strict();

const kineticCaptionsInput = z.object({
  overlayId: z.number().int().positive(),
  fromSeconds: z.number().finite().min(0).max(36000).optional(),
  toSeconds: z.number().finite().min(0).max(36000).optional(),
  maskSubject: z.boolean().optional(),
  color: z.string().max(64).optional(),
  fontFamily: z.enum(["serif", "sans"]).optional(),
}).strict();

export function WebMcpBridge({ project }: { project: LocalProject }) {
  const editor = useEditorContext();
  const assetStore = useAssetStore();
  const analysisStore = useAnalysisStore();
  const captionStore = useCaptionStore();
  const generationStore = useGenerationStore();

  const editorRef = useRef(editor);
  editorRef.current = editor;
  const assetsRef = useRef(assetStore);
  assetsRef.current = assetStore;
  const analysisRef = useRef(analysisStore);
  analysisRef.current = analysisStore;
  const captionsRef = useRef(captionStore);
  captionsRef.current = captionStore;
  const generationsRef = useRef(generationStore);
  generationsRef.current = generationStore;
  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    const modelContext = document.modelContext;
    const registration = new AbortController();

    /**
     * Runs a document mutation. Activity reporting is `defineTool`'s job, so
     * `toolName` is no longer needed here — the wrapper already knows it.
     */
    const run = (mutation: OverlayMutation, label: string, detail?: string) => {
      const outcome = projectRef.current.dispatch(mutation, { source: "agent", label, detail });
      return outcome.ok
        ? { ok: true, revision: outcome.revision, result: outcome.result }
        : { ok: false, error: outcome.error };
    };

    /**
     * Both generation tools report alike and hand back an assetId, so they
     * compose with add_asset. The confirm gate and the cost live in the
     * generation store, which is also what `list_generations` reads.
     */
    const runGeneration = async (request: GenerateRequest) => {
      const outcome = await generationsRef.current.generate(request);
      return outcome.ok
        ? {
            ok: true,
            assetId: outcome.assetId,
            note: "The media is saved in the media panel. Call add_asset with this assetId to place it on the timeline.",
          }
        : { ok: false, error: outcome.error };
    };

    const framesFrom = (seconds: number | undefined, fallback: number) =>
      seconds === undefined ? fallback : Math.max(1, Math.round(seconds * FPS));

    const tools: WebMCP.ModelContextTool[] = [
      defineTool({
        name: "get_editor_state",
        title: "Get editor state",
        description:
          "Read the open project: canvas settings, timeline length, playhead and the overlays on the timeline. " +
          "Overlays are returned 12 at a time; when `overlaysTruncated` is true, call again with a higher " +
          "`offset` to page through the rest. `overlayCount` is the true total.",
        schema: overlayPageInput,
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: ({ offset, limit }) => {
          const current = editorRef.current;
          const doc = projectRef.current.getDoc();
          const start = offset ?? 0;
          const count = limit ?? 12;
          const overlays = doc.overlays.slice(start, start + count).map((o: any) => ({
            id: o.id,
            type: o.type,
            fromSeconds: +(o.from / FPS).toFixed(2),
            durationSeconds: +(o.durationInFrames / FPS).toFixed(2),
            row: o.row,
            left: o.left, top: o.top, width: o.width, height: o.height,
            content: typeof o.content === "string" ? o.content.slice(0, 80) : undefined,
          }));
          return {
            ok: true,
            project: { id: projectRef.current.projectId, name: current.projectName ?? doc.name },
            aspectRatio: doc.aspectRatio,
            background: doc.background,
            durationSeconds: +current.durationInSeconds.toFixed(2),
            currentTimeSeconds: +(current.currentFrame / FPS).toFixed(2),
            selectedOverlayIds: current.selectedOverlayIds,
            overlayCount: doc.overlays.length,
            overlays,
            overlayOffset: start,
            overlaysTruncated: start + overlays.length < doc.overlays.length,
            assetCount: assetsRef.current.assets.length,
            canUndo: projectRef.current.canUndo,
            canRedo: projectRef.current.canRedo,
          };
        },
      }),

      defineTool({
        name: "list_assets",
        title: "List imported media",
        description: "List the media the user imported or generated in this browser. Use the returned assetId with add_asset.",
        schema: emptyInput,
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => ({
          ok: true,
          assets: assetsRef.current.assets.map((a) => ({
            assetId: a.id,
            name: a.name.slice(0, 80),
            type: a.type,
            durationSeconds: a.durationInSeconds ? +a.durationInSeconds.toFixed(2) : undefined,
            width: a.width,
            height: a.height,
            origin: a.origin,
            indexed: !!analysisRef.current.analyses[a.id],
          })),
          note: "Media with indexed=false has not been analysed yet. Call analyze_assets to index it.",
        }),
      }),

      defineTool({
        name: "seek",
        title: "Move the playhead",
        description: "Move the playhead of the preview to a time in seconds.",
        schema: seekInput,
        execute: ({ timeSeconds }) => {
          const current = editorRef.current;
          if (timeSeconds > current.durationInSeconds) {
            return { ok: false, error: `timeSeconds must be between 0 and ${current.durationInSeconds.toFixed(2)}` };
          }
          const frame = Math.round(timeSeconds * FPS);
          current.playerRef.current?.seekTo(frame);
          return { ok: true, currentTimeSeconds: timeSeconds };
        },
      }),

      defineTool({
        name: "add_text",
        title: "Add a title",
        description:
          "Add a text overlay to the timeline. Times are in seconds and default to fromSeconds 0 for 3 seconds. " +
          "Position and size are in canvas pixels — call get_editor_state for the current canvas dimensions — and " +
          "default to a centred band across 80% of the width. `row` is the timeline layer, 0 on top. Overlapping " +
          "overlays on the same row are pushed apart automatically.",
        schema: addTextInput,
        execute: ({ content, fromSeconds, durationSeconds, row, fontSize, color, textAlign, ...box }) => {
          const dims = editorRef.current.getAspectRatioDimensions();
          return run({
            action: "add-overlay",
            payload: {
              type: "text",
              content,
              from: fromSeconds === undefined ? 0 : Math.round(fromSeconds * FPS),
              durationInFrames: framesFrom(durationSeconds, 90),
              row: row ?? 0,
              left: box.left ?? Math.round(dims.width * 0.1),
              top: box.top ?? Math.round(dims.height * 0.4),
              width: box.width ?? Math.round(dims.width * 0.8),
              height: box.height ?? Math.round(dims.height * 0.2),
              rotation: box.rotation ?? 0,
              fontSize, color, textAlign,
            },
          }, "Added text", content.slice(0, 60));
        },
      }),

      defineTool({
        name: "add_shape",
        title: "Add a shape",
        description:
          "Add a shape overlay to the timeline. Times are in seconds and default to fromSeconds 0 for 3 seconds. " +
          "Position and size are in canvas pixels — call get_editor_state for the current canvas dimensions — and " +
          "default to a centred box. `row` is the timeline layer, 0 on top. Overlapping overlays on the same row " +
          "are pushed apart automatically.",
        schema: addShapeInput,
        execute: ({ shape, fromSeconds, durationSeconds, row, fill, ...box }) => {
          const dims = editorRef.current.getAspectRatioDimensions();
          return run({
            action: "add-overlay",
            payload: {
              type: "shape",
              content: shape,
              from: fromSeconds === undefined ? 0 : Math.round(fromSeconds * FPS),
              durationInFrames: framesFrom(durationSeconds, 90),
              row: row ?? 0,
              left: box.left ?? Math.round(dims.width * 0.35),
              top: box.top ?? Math.round(dims.height * 0.35),
              width: box.width ?? Math.round(dims.width * 0.3),
              height: box.height ?? Math.round(dims.height * 0.3),
              rotation: box.rotation ?? 0,
              fill,
            },
          }, "Added shape", shape);
        },
      }),

      defineTool({
        name: "add_asset",
        annotations: { untrustedContentHint: true },
        title: "Add media to the timeline",
        description:
          "Put an imported or generated asset on the timeline. Call list_assets first to get an assetId. " +
          "Give sourceStartSeconds and sourceEndSeconds to place only one part of a video or sound, which " +
          "is how a moment found with search_content is cut out of the original file.",
        schema: addAssetInput,
        execute: ({ assetId, sourceStartSeconds, sourceEndSeconds, fromSeconds, durationSeconds, row }) => {
          const asset = assetsRef.current.getAsset(assetId);
          if (!asset) return { ok: false, error: `No asset with id ${assetId}. Call list_assets for valid ids.` };

          const hasRange = sourceStartSeconds !== undefined || sourceEndSeconds !== undefined;
          if (hasRange && asset.type === "image") {
            return { ok: false, error: "An image has no source range. Use durationSeconds instead." };
          }
          if (sourceEndSeconds !== undefined && sourceEndSeconds <= (sourceStartSeconds ?? 0)) {
            return { ok: false, error: "sourceEndSeconds must be greater than sourceStartSeconds." };
          }
          if (hasRange && asset.durationInSeconds && (sourceStartSeconds ?? 0) >= asset.durationInSeconds) {
            return {
              ok: false,
              error: `sourceStartSeconds must be less than the ${asset.durationInSeconds.toFixed(2)}s length of this asset.`,
            };
          }

          const dims = editorRef.current.getAspectRatioDimensions();
          const naturalFrames = asset.durationInSeconds ? Math.round(asset.durationInSeconds * FPS) : 150;
          const sourceStartFrames = Math.round((sourceStartSeconds ?? 0) * FPS);
          const rangeFrames = sourceEndSeconds !== undefined
            ? Math.round((sourceEndSeconds - (sourceStartSeconds ?? 0)) * FPS)
            : naturalFrames - sourceStartFrames;
          const defaultFrames = asset.type === "image" ? 150 : Math.max(1, Math.min(rangeFrames, naturalFrames - sourceStartFrames));

          const payload: any = {
            assetId: asset.id,
            type: asset.type === "video" ? "clip" : asset.type === "audio" ? "sound" : "image",
            src: asset.url,
            name: asset.name,
            content: asset.name,
            from: fromSeconds === undefined ? 0 : Math.round(fromSeconds * FPS),
            durationInFrames: framesFrom(durationSeconds, defaultFrames),
            row: row ?? 0,
            left: 0,
            top: 0,
            width: dims.width,
            height: asset.type === "audio" ? 100 : dims.height,
          };
          if (asset.type !== "image") payload.maxDuration = naturalFrames;
          if (asset.type === "video") payload.videoStartTime = sourceStartFrames;
          if (asset.type === "audio") payload.startFromSound = sourceStartFrames;

          const detail = hasRange
            ? `${asset.name.slice(0, 40)} ${(sourceStartSeconds ?? 0).toFixed(1)}–${((sourceEndSeconds ?? asset.durationInSeconds) ?? 0).toFixed(1)}s`
            : asset.name.slice(0, 60);
          return run({ action: "add-overlay", payload }, `Added ${asset.type}`, detail);
        },
      }),

      defineTool({
        name: "update_overlay",
        annotations: { untrustedContentHint: true },
        title: "Change an overlay",
        description: "Change one overlay: its timing, row, position, size, rotation, text or style. sourceStartSeconds "
          + "re-points a video or sound at a different part of its own file. To move more than one overlay, "
          + "use arrange_timeline instead.",
        schema: updateOverlayInput,
        execute: ({ overlayId, fromSeconds, durationSeconds, sourceStartSeconds, opacity, volume, speed, color, fontSize, ...rest }) => {
          const target = projectRef.current.getDoc().overlays.find((o: any) => o.id === overlayId);
          if (!target) return { ok: false, error: `Overlay ${overlayId} was not found.` };

          const updates: Record<string, unknown> = {};
          if (fromSeconds !== undefined) updates.from = Math.round(fromSeconds * FPS);
          if (durationSeconds !== undefined) updates.durationInFrames = Math.max(1, Math.round(durationSeconds * FPS));
          if (sourceStartSeconds !== undefined) {
            if (target.type === "clip") updates.videoStartTime = Math.round(sourceStartSeconds * FPS);
            else if (target.type === "sound") updates.startFromSound = Math.round(sourceStartSeconds * FPS);
            else return { ok: false, error: "Only a video or sound overlay has a source range." };
          }
          for (const [key, value] of Object.entries(rest)) {
            if (value !== undefined) updates[key] = value;
          }

          const styles: Record<string, unknown> = {};
          if (opacity !== undefined) styles.opacity = opacity;
          if (volume !== undefined) styles.volume = volume;
          if (speed !== undefined) styles.speed = speed;
          if (color !== undefined) styles.color = color;
          if (fontSize !== undefined) styles.fontSize = fontSize;
          if (Object.keys(styles).length) updates.styles = styles;

          return run({ action: "update-overlay", overlayId, updates }, "Changed overlay", `#${overlayId}`);
        },
      }),

      defineTool({
        name: "arrange_timeline",
        title: "Move several overlays at once",
        description:
          "Set the start time, and optionally the row, of several overlays in one step. Use this to " +
          "reorder a sequence: moving overlays one at a time makes each move push the others aside, " +
          "because the timeline closes overlaps after every change.",
        schema: arrangeTimelineInput,
        execute: ({ placements }) => {
          const overlays = projectRef.current.getDoc().overlays;
          const missing = placements.find((p) => !overlays.some((o: any) => o.id === p.overlayId));
          if (missing) return { ok: false, error: `Overlay ${missing.overlayId} was not found.` };

          const mutations = placements.map((p) => ({
            action: "update-overlay" as const,
            overlayId: p.overlayId,
            updates: {
              from: Math.round(p.fromSeconds * FPS),
              ...(p.row !== undefined ? { row: p.row } : {}),
            },
          }));
          return run({ action: "batch", mutations },
            "Rearranged timeline",
            `${placements.length} overlays`
          );
        },
      }),

      defineTool({
        name: "duplicate_overlay",
        title: "Duplicate an overlay",
        annotations: { untrustedContentHint: true },
        description:
          "Copy one overlay, placing the copy immediately after the original on the same row. Useful for repeating " +
          "a title or a shape without restating all of its styling.",
        schema: deleteOverlayInput,
        execute: ({ overlayId }) => {
          const target = projectRef.current.getDoc().overlays.find((o: any) => o.id === overlayId);
          if (!target) return { ok: false, error: `Overlay ${overlayId} was not found.` };
          return run({ action: "duplicate-overlay", overlayId }, "Duplicated overlay", `#${overlayId} ${target.type}`);
        },
      }),

      defineTool({
        name: "delete_overlay",
        title: "Delete an overlay",
        description: "Remove one overlay from the timeline. The user can undo this from the activity panel.",
        schema: deleteOverlayInput,
        execute: ({ overlayId }) => {
          const target = projectRef.current.getDoc().overlays.find((o: any) => o.id === overlayId);
          if (!target) return { ok: false, error: `Overlay ${overlayId} was not found.` };
          return run({ action: "delete-overlay", overlayId }, "Deleted overlay", `#${overlayId} ${target.type}`);
        },
      }),

      defineTool({
        name: "split_overlay",
        title: "Cut an overlay in two",
        description:
          "Cut one overlay at a point on the timeline, leaving two overlays that play back to back. " +
          "Use this to drop an unwanted stretch: cut at both ends of it, then delete the middle piece.",
        schema: splitOverlayInput,
        execute: ({ overlayId, timeSeconds }) => {
          const target = projectRef.current.getDoc().overlays.find((o: any) => o.id === overlayId);
          if (!target) return { ok: false, error: `Overlay ${overlayId} was not found.` };

          const splitFrame = Math.round(timeSeconds * FPS);
          const start = target.from;
          const end = target.from + target.durationInFrames;
          if (splitFrame <= start || splitFrame >= end) {
            return {
              ok: false,
              error: `timeSeconds must fall inside the overlay, between ${(start / FPS).toFixed(2)} and ${(end / FPS).toFixed(2)}.`,
            };
          }
          return run({ action: "split-overlay", overlayId, splitFrame },
            "Cut overlay",
            `#${overlayId} at ${timeSeconds.toFixed(2)}s`
          );
        },
      }),

      defineTool({
        name: "analyze_assets",
        title: "Index media with Gemini",
        description:
          "Send local media to Gemini so its content can be searched: shots, spoken words and subjects, " +
          "each with a time range. The user must approve the upload. The index is then stored in this " +
          "browser, so an asset only needs analysing once. Call search_content afterwards.",
        schema: assetIdsInput,
        annotations: { untrustedContentHint: true },
        execute: async ({ assetIds }, { signal }, report) => {
          // Uploading and indexing video takes tens of seconds; say so.
          report(assetIds.length > 1 ? `Indexing ${assetIds.length} files` : "Indexing media");
          const { analyzed, failed } = await analysisRef.current.analyze(assetIds, signal);

          if (!analyzed.length) {
            return { ok: false, error: failed[0]?.error ?? "Nothing was analysed.", failed };
          }
          return {
            ok: true,
            analyzed: analyzed.map((a) => ({
              assetId: a.assetId,
              summary: a.summary,
              segmentCount: a.segments.length,
              tags: a.tags,
            })),
            failed,
          };
        },
      }),

      defineTool({
        name: "get_asset_analysis",
        title: "Read what is in one asset",
        description:
          "Return the stored index for one asset: a summary, tags, and every segment with its start and " +
          "end time, description and speech. Use the times with add_asset to place just that part.",
        schema: assetIdInput,
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: ({ assetId }) => {
          const asset = assetsRef.current.getAsset(assetId);
          if (!asset) return { ok: false, error: `No asset with id ${assetId}. Call list_assets for valid ids.` };

          const analysis = analysisRef.current.getAnalysis(assetId);
          if (!analysis) {
            return { ok: false, error: `${asset.name} has not been analysed yet. Call analyze_assets first.` };
          }
          return {
            ok: true,
            assetId,
            name: asset.name.slice(0, 80),
            type: asset.type,
            durationSeconds: asset.durationInSeconds ? +asset.durationInSeconds.toFixed(2) : undefined,
            summary: analysis.summary,
            tags: analysis.tags,
            segments: analysis.segments.slice(0, 60).map((s) => ({
              segmentId: s.id,
              startSeconds: s.startSeconds,
              endSeconds: s.endSeconds,
              description: s.description,
              transcript: s.transcript,
              speaker: s.speaker,
              tags: s.tags,
            })),
          };
        },
      }),

      defineTool({
        name: "search_content",
        title: "Find a moment in the media",
        description:
          "Search everything that has been analysed and return the matching moments, each with its asset " +
          "and its start and end time. Pass those times to add_asset to place only that moment.",
        schema: searchContentInput,
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: ({ query, limit }) => {
          const hits = analysisRef.current.search(query, limit);
          const indexed = assetsRef.current.assets.filter((a) => analysisRef.current.analyses[a.id]).length;
          return {
            ok: true,
            query,
            indexedAssetCount: indexed,
            hits: hits.map((hit) => ({
              assetId: hit.assetId,
              name: hit.assetName.slice(0, 80),
              type: hit.assetType,
              segmentId: hit.segmentId,
              startSeconds: hit.startSeconds,
              endSeconds: hit.endSeconds,
              text: hit.text.slice(0, 300),
            })),
            note: indexed === 0 ? "No media has been analysed yet. Call analyze_assets first." : undefined,
          };
        },
      }),

      defineTool({
        name: "set_background",
        title: "Set the background",
        description: "Set the canvas background to a solid colour or a gradient.",
        schema: backgroundInput,
        execute: (input) => {
          const payload = input.type === "color"
            ? { type: "color" as const, color: input.color }
            : { type: "gradient" as const, gradient: input.gradient };
          return run({ action: "set-background", payload }, "Set background", input.type);
        },
      }),

      defineTool({
        name: "set_aspect_ratio",
        title: "Set the aspect ratio",
        description: "Set the canvas shape to 16:9, 9:16, 1:1 or 4:5.",
        schema: aspectRatioInput,
        execute: ({ aspectRatio }) =>
          run({ action: "set-aspect-ratio", ratio: aspectRatio }, "Set aspect ratio", aspectRatio),
      }),

      defineTool({
        name: "undo",
        title: "Undo",
        description: "Undo the most recent change, whoever made it.",
        schema: emptyInput,
        execute: () => {
          const moved = projectRef.current.undo();
          return moved ? { ok: true } : { ok: false, error: "There is nothing left to undo." };
        },
      }),

      defineTool({
        name: "redo",
        title: "Redo",
        description: "Redo the change that was undone last.",
        schema: emptyInput,
        execute: () => {
          const moved = projectRef.current.redo();
          return moved ? { ok: true } : { ok: false, error: "There is nothing to redo." };
        },
      }),

      defineTool({
        name: "import_from_url",
        title: "Import hosted media by URL",
        description:
          "Fetch video, audio or images from public URLs and store them in this browser's media " +
          "library. Use this whenever you have a link to a file rather than a file — an agent cannot " +
          "put media into the user's browser any other way. Pass up to 8 URLs at once. The kind and " +
          "duration are detected automatically. This does not put anything on the timeline; call " +
          "add_asset with a returned assetId next. The URL must point straight at the file and the " +
          "host must allow other sites to read it, which most CDNs and object stores do; a link to a " +
          "web page that merely displays the media will not work.",
        schema: importUrlInput,
        annotations: { untrustedContentHint: true },
        execute: async ({ urls }, { signal }, report) => {
          const imported: unknown[] = [];
          const failed: { url: string; error: string }[] = [];

          for (const [index, url] of urls.entries()) {
            report(urls.length > 1 ? `Fetching ${index + 1} of ${urls.length}` : "Fetching");
            try {
              const { file, mimeType, bytes } = await fetchMediaAsFile(url, signal);
              // The file picker's own path, so a URL import is probed,
              // thumbnailed and size-limited exactly like a dragged file.
              const [asset] = await assetsRef.current.importFiles([file]);
              if (!asset) {
                failed.push({ url, error: `${mimeType} is not a video, image or audio file.` });
                continue;
              }
              imported.push({
                assetId: asset.id,
                name: asset.name,
                kind: asset.type,
                durationInSeconds: asset.durationInSeconds,
                width: asset.width,
                height: asset.height,
                bytes,
              });
            } catch (err) {
              failed.push({
                url,
                error:
                  err instanceof UrlImportError || err instanceof Error
                    ? err.message
                    : "The file could not be imported.",
              });
            }
          }

          if (!imported.length) {
            return {
              ok: false,
              error: failed[0]?.error ?? "Nothing could be imported.",
              failed,
            };
          }
          return {
            ok: true,
            imported,
            failed: failed.length ? failed : undefined,
            note: "Stored in the media library. Call add_asset with an assetId to place one on the timeline.",
          };
        },
      }),

      defineTool({
        name: "generate_image",
        title: "Generate an image with Gemini",
        description:
          "Generate an image from a prompt with the user's own Gemini key and save it as a local asset. " +
          "The user must approve the request, which is paid. This does not put the image on the timeline; " +
          "call add_asset with the returned assetId next.",
        schema: generateImageInput,
        annotations: { untrustedContentHint: true },
        execute: async ({ prompt, aspectRatio }, { signal }, report) => {
          report("Waiting on Gemini");
          return runGeneration({
            kind: "image",
            prompt,
            aspectRatio: aspectRatio ?? projectRef.current.getDoc().aspectRatio,
            source: "agent",
            signal,
          });
        },
      }),

      defineTool({
        name: "generate_video",
        title: "Generate a video with Gemini",
        description:
          "Generate a short video clip from a prompt with the user's own Gemini key, and save it as a " +
          "local asset. The user must approve the request, which is paid and takes one to three minutes. " +
          "This does not put the clip on the timeline; call add_asset with the returned assetId next. " +
          "The result is ordinary local media, so analyze_assets and add_kinetic_captions work on it too.",
        schema: generateVideoInput,
        annotations: { untrustedContentHint: true },
        execute: async ({ prompt, aspectRatio, durationSeconds }, { signal }, report) => {
          report("Waiting on Veo — one to three minutes");
          return runGeneration({ kind: "video", prompt, aspectRatio, durationSeconds, source: "agent", signal });
        },
      }),

      defineTool({
        name: "add_kinetic_captions",
        title: "Caption a clip in the kinetic style",
        description:
          "Transcribe the speech in one video clip and lay it over that clip as animated captions. " +
          "Each line is typeset with its key phrase large, revealed word by word in time with the " +
          "speech, placed to graze the subject, and masked so words pass behind the person on " +
          "screen. This is a single finished effect — do not try to reproduce it with add_text. " +
          "The user must approve the upload to Gemini, and it takes around a minute.",
        schema: kineticCaptionsInput,
        annotations: { untrustedContentHint: true },
        execute: async (input, { signal }, report) => {
          const outcome = await captionsRef.current.captionClip({
            ...input,
            source: "agent",
            signal,
            // The pipeline's own stages — transcribing, isolating the subject —
            // beat a static label for a job that runs about a minute.
            onStage: report,
          });
          return outcome.ok
            ? { ...outcome, transcript: outcome.transcript?.slice(0, 600) }
            : { ok: false, error: outcome.error };
        },
      }),

      defineTool({
        name: "list_generations",
        title: "List generations in progress",
        description:
          "List the image and video requests that are still running or that failed, whoever started them. " +
          "A finished generation is not listed here: it becomes an asset, so call list_assets for it.",
        schema: emptyInput,
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => {
          const jobs = generationsRef.current.jobs;
          return {
            ok: true,
            generations: jobs.map((job) => ({
              generationId: job.id,
              kind: job.kind,
              status: job.status,
              prompt: job.prompt.slice(0, 200),
              model: job.model,
              aspectRatio: job.aspectRatio,
              durationSeconds: job.durationSeconds,
              startedBy: job.source,
              waitedSeconds: job.elapsed,
              error: job.error,
            })),
            note: jobs.length ? undefined : "Nothing is being generated. Finished media is in list_assets.",
          };
        },
      }),
    ];

    // The tools are in the local registry regardless, which is how the app's own
    // UI calls them. Only exposing them to a browser agent needs WebMCP.
    if (!modelContext) {
      console.info("[perpetual] This browser has no WebMCP support. The editor and workflows still work.");
      return () => registration.abort();
    }

    Promise.all(tools.map((tool) => modelContext.registerTool(tool, { signal: registration.signal })))
      .then(() => console.info(`[perpetual] ${tools.length} WebMCP tools registered.`))
      .catch((error) => {
        if (!registration.signal.aborted) console.warn("[perpetual] WebMCP tool registration failed.", error);
      });

    return () => registration.abort();
  }, []);

  return null;
}
