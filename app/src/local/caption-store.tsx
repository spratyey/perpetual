/**
 * Caption store.
 *
 * Kinetic captions are one finished effect rather than a pile of small edits,
 * so the whole pipeline sits behind one call. The sidebar button and the
 * WebMCP tool both arrive here, which is why the approval gate, the row choice
 * and the mutation live in this file rather than in either caller.
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { FPS, MAX_ROWS } from "@/components/editor/constants";
import { useEditorContext } from "@/components/editor/contexts/editor-context";
import {
  CAPTION_FAMILIES,
  DEFAULT_CAPTION_COLOR,
  DEFAULT_DISPLAY_SCALE,
} from "@/components/editor/components/overlays/captions/caption-layout";
import { useAssetStore } from "./asset-store";
import { requestConfirm } from "./confirm";
import * as gemini from "./gemini";
import { buildKineticCaptions } from "./kinetic-captions";
import { appendEvent, getAssetBlob } from "./persistence";
import type { ActorSource, OverlayMutation } from "./types";
import type { LocalProject } from "./use-local-project";

export interface CaptionRequest {
  overlayId: number;
  fromSeconds?: number;
  toSeconds?: number;
  maskSubject?: boolean;
  color?: string;
  fontFamily?: "serif" | "sans";
  source: ActorSource;
  signal?: AbortSignal;
  onStage?: (stage: string) => void;
}

export interface CaptionOutcome {
  ok: boolean;
  error?: string;
  revision?: number;
  overlayId?: number;
  lineCount?: number;
  wordCount?: number;
  masked?: boolean;
  transcript?: string;
}

interface CaptionStore {
  /** What the pipeline is doing, for whichever caller is watching. */
  stage: string | null;
  error: string | null;
  isRunning: boolean;
  captionClip: (request: CaptionRequest) => Promise<CaptionOutcome>;
}

const CaptionStoreContext = createContext<CaptionStore | undefined>(undefined);

/**
 * Captions belong above the footage. Rows draw front to back, so the topmost
 * free row is taken, and if row zero is already busy everything moves down one
 * — the same rule the editor's own panels follow when adding a title.
 */
function captionRow(overlays: any[], from: number, to: number): { row: number; shifts: OverlayMutation[] } {
  const live = overlays.filter((o) => o.from < to && o.from + o.durationInFrames > from);
  const topmost = live.reduce((min, o) => Math.min(min, o.row ?? 0), MAX_ROWS);
  if (topmost > 0) return { row: Math.min(topmost, MAX_ROWS) - 1, shifts: [] };

  const lowest = overlays.reduce((max, o) => Math.max(max, o.row ?? 0), 0);
  if (lowest + 1 >= MAX_ROWS) return { row: 0, shifts: [] };
  return {
    row: 0,
    shifts: overlays.map((o) => ({
      action: "update-overlay" as const,
      overlayId: o.id,
      updates: { row: (o.row ?? 0) + 1 },
    })),
  };
}

export const CaptionStoreProvider: React.FC<{ project: LocalProject; children: React.ReactNode }> = ({
  project,
  children,
}) => {
  const editor = useEditorContext();
  const { getAsset } = useAssetStore();
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const editorRef = useRef(editor);
  editorRef.current = editor;
  const projectRef = useRef(project);
  projectRef.current = project;
  const running = useRef(false);

  const captionClip = useCallback(async (request: CaptionRequest): Promise<CaptionOutcome> => {
    const fail = (message: string): CaptionOutcome => {
      setError(message);
      setStage(null);
      return { ok: false, error: message };
    };
    if (running.current) return fail("Captions are already being built for this project.");

    // `getDoc()` rather than the editor's render-time overlays: an agent that
    // adds a clip and captions it in the same tick would otherwise be told the
    // overlay does not exist.
    const startedFor = projectRef.current.projectId;
    const clip = projectRef.current.getDoc().overlays.find((o: any) => o.id === request.overlayId) as any;
    if (!clip) return fail(`Overlay ${request.overlayId} was not found.`);
    if (clip.type !== "clip") return fail("Captions can only be added to a video clip.");
    if (!clip.assetId) return fail("That clip has no stored media behind it, so it cannot be transcribed.");

    const asset = getAsset(clip.assetId);
    if (!asset) return fail("The media for that clip is missing from this browser.");
    if (!gemini.canGenerate()) return fail("No Gemini key is set. Add one in the editor header first.");

    const clipEnd = clip.from + clip.durationInFrames;
    const origin = Math.max(clip.from, request.fromSeconds === undefined ? clip.from : Math.round(request.fromSeconds * FPS));
    const end = Math.min(clipEnd, request.toSeconds === undefined ? clipEnd : Math.round(request.toSeconds * FPS));
    if (end - origin < FPS) return fail("Captions need a range of at least one second inside the clip.");

    const masked = request.maskSubject ?? true;
    const approved = await requestConfirm({
      title: request.source === "agent" ? "Let the agent caption this clip?" : "Caption this clip?",
      description:
        "The clip is uploaded to Google with your key, transcribed, and then deleted from Google " +
        "again. The subject is separated in this browser, and nothing else leaves it.",
      facts: [
        { label: "Provider", value: "Google Gemini" },
        {
          label: "Key",
          value: gemini.usingSharedKey()
            ? "The shared demo key, not yours"
            : "Your own key",
        },
        { label: "Model", value: gemini.ANALYSIS_MODEL },
        { label: "Sends", value: asset.name.slice(0, 120) },
        { label: "Range", value: `${(origin / FPS).toFixed(1)}–${(end / FPS).toFixed(1)}s` },
        { label: "Masking", value: masked ? "Words pass behind the subject" : "Off" },
      ],
      confirmLabel: "Caption",
    });
    if (!approved) return fail("The request was declined.");

    const blob = await getAssetBlob(asset.id);
    if (!blob) return fail("The media for that clip is missing from this browser.");

    running.current = true;
    setIsRunning(true);
    setError(null);
    const report = (next: string) => {
      setStage(next);
      request.onStage?.(next);
    };

    try {
      const speed = clip.styles?.speed ?? 1;
      const sourceStart = clip.videoStartTime ?? 0;
      const dims = editorRef.current.getAspectRatioDimensions();

      const built = await buildKineticCaptions({
        blob,
        mimeType: asset.mimeType,
        videoSrc: asset.url,
        sourceTimeAt: (frame) => (sourceStart + (origin + frame - clip.from) * speed) / FPS,
        frameAtSource: (seconds) => (seconds * FPS - sourceStart) / speed + clip.from - origin,
        durationInFrames: end - origin,
        canvas: { width: dims.width, height: dims.height },
        typography: {
          color: request.color ?? DEFAULT_CAPTION_COLOR,
          displayScale: DEFAULT_DISPLAY_SCALE,
          family: CAPTION_FAMILIES[request.fontFamily ?? "serif"],
        },
        maskSubject: masked,
        signal: request.signal,
        onProgress: report,
      });

      const duration = Math.max(...built.cues.map((cue) => cue.from + cue.durationInFrames));

      // Captioning a 30s clip takes over a minute, and the user is free to
      // switch project while it runs. `projectRef` follows whatever is open, so
      // dispatching blind would drop the captions into a different video —
      // silently, and on someone else's timeline. Refuse instead.
      if (projectRef.current.projectId !== startedFor) {
        return fail(
          "The captions finished after you moved to another project, so they were not applied. " +
          "Reopen that project and caption the clip again."
        );
      }

      const { row, shifts } = captionRow(projectRef.current.getDoc().overlays, origin, origin + duration);
      const outcome = projectRef.current.dispatch(
        {
          action: "batch",
          mutations: [
            ...shifts,
            {
              action: "add-overlay",
              payload: {
                type: "caption",
                content: built.transcript.slice(0, 200),
                cues: built.cues,
                matte: built.matte,
                color: request.color,
                fontFamily: request.fontFamily,
                from: origin,
                durationInFrames: duration,
                row,
                left: 0,
                top: 0,
                width: dims.width,
                height: dims.height,
              },
            },
          ],
        },
        { source: request.source, label: "Added captions", detail: `${built.cues.length} lines` }
      );

      if (!outcome.ok) return fail(outcome.error ?? "The captions could not be added.");

      /**
       * A human click has to land in the event log too, or a workflow captured
       * from this session would not mention the captions at all. It cannot ride
       * the normal human recorder: that names an action by inspecting the
       * overlay it produced, and a caption overlay carries no reference to the
       * clip it covers — so it would be logged as `unknown` and dropped. Here
       * the real tool input is still in hand. The agent path is already
       * recorded by `defineTool`, hence the guard.
       */
      if (request.source === "human" && startedFor) {
        void appendEvent({
          projectId: startedFor,
          ts: Date.now(),
          source: "human",
          tool: "add_kinetic_captions",
          input: {
            overlayId: request.overlayId,
            maskSubject: masked,
            ...(request.fontFamily ? { fontFamily: request.fontFamily } : {}),
            ...(request.color ? { color: request.color } : {}),
          },
          revision: outcome.revision ?? 0,
        });
      }

      setStage(null);
      return {
        ok: true,
        revision: outcome.revision,
        overlayId: outcome.result?.batchResults?.at(-1)?.id,
        lineCount: built.cues.length,
        wordCount: built.cues.reduce((sum, cue) => sum + cue.tokens.length, 0),
        masked: !!built.matte,
        transcript: built.transcript,
      };
    } catch (err) {
      if (request.signal?.aborted) return fail("The request was cancelled.");
      return fail(err instanceof Error ? err.message : "The captions could not be built.");
    } finally {
      running.current = false;
      setIsRunning(false);
      setStage(null);
    }
  }, [getAsset]);

  const value = useMemo(
    () => ({ stage, error, isRunning, captionClip }),
    [stage, error, isRunning, captionClip]
  );

  return <CaptionStoreContext.Provider value={value}>{children}</CaptionStoreContext.Provider>;
};

export const useCaptionStore = (): CaptionStore => {
  const ctx = useContext(CaptionStoreContext);
  if (!ctx) throw new Error("useCaptionStore must be used within a CaptionStoreProvider");
  return ctx;
};
