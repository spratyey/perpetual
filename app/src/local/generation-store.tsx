/**
 * Generation store.
 *
 * The prompt row and the WebMCP tools both arrive here, so the approval gate,
 * the model choice and the asset hand-off live in one place.
 *
 * A job is only the work in flight. A finished job is not a job: it is an
 * asset, and it joins the media grid like any imported file. That keeps the
 * pending list short, and it means nothing has to be reconciled after a
 * reload — a request cannot outlive the page that made it.
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { useAspectRatio } from "@/components/editor/hooks/use-aspect-ratio";
import { useAssetStore } from "./asset-store";
import { requestConfirm } from "./confirm";
import * as gemini from "./gemini";
import type { ActorSource } from "./types";

export type GenerationKind = "image" | "video";

export interface GenerationJob {
  id: string;
  kind: GenerationKind;
  prompt: string;
  model: string;
  aspectRatio: string;
  durationSeconds?: gemini.VideoDuration;
  source: ActorSource;
  status: "pending" | "error";
  error?: string;
  startedAt: number;
  /** Seconds waited so far. Only a video job runs long enough to need it. */
  elapsed: number;
}

export interface GenerateRequest {
  kind: GenerationKind;
  prompt: string;
  aspectRatio?: string;
  durationSeconds?: gemini.VideoDuration;
  source: ActorSource;
  signal?: AbortSignal;
}

export interface GenerateOutcome {
  ok: boolean;
  jobId: string;
  assetId?: string;
  error?: string;
}

interface GenerationStore {
  jobs: GenerationJob[];
  generate: (request: GenerateRequest) => Promise<GenerateOutcome>;
  cancel: (jobId: string) => void;
  dismiss: (jobId: string) => void;
}

const GenerationStoreContext = createContext<GenerationStore | undefined>(undefined);

const DEFAULT_DURATION: gemini.VideoDuration = 4;

/** Veo makes landscape or portrait only, so the four canvas shapes fold into two. */
function videoAspectRatio(ratio: string): gemini.VideoAspectRatio {
  return ratio === "9:16" || ratio === "4:5" ? "9:16" : "16:9";
}

function fileName(prompt: string, extension: string): string {
  const stem = prompt.trim().replace(/\s+/g, " ").slice(0, 48).replace(/[^\w \-]/g, "");
  return `${stem || "generated"}.${extension}`;
}

function money(amount: number): string {
  return `about $${amount.toFixed(2)}`;
}

export const GenerationStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addGenerated } = useAssetStore();
  const { aspectRatio } = useAspectRatio();
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const controllers = useRef(new Map<string, AbortController>());

  const patch = useCallback((id: string, changes: Partial<GenerationJob>) => {
    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...changes } : job)));
  }, []);

  const ratioRef = useRef(aspectRatio);
  ratioRef.current = aspectRatio;

  const generate = useCallback(async (request: GenerateRequest): Promise<GenerateOutcome> => {
    const id = crypto.randomUUID();
    const isVideo = request.kind === "video";
    const duration = request.durationSeconds ?? DEFAULT_DURATION;
    const ratio = request.aspectRatio ?? (isVideo ? videoAspectRatio(ratioRef.current) : ratioRef.current);
    const model = isVideo ? gemini.VIDEO_MODEL : gemini.IMAGE_MODEL;

    const failed = (error: string): GenerateOutcome => ({ ok: false, jobId: id, error });

    if (!gemini.canGenerate()) return failed("No Gemini key is set. Add one in the editor header first.");

    const cost = isVideo ? duration * gemini.VIDEO_PRICE_USD_PER_SECOND : gemini.IMAGE_PRICE_USD;
    const noun = isVideo ? "a video" : "an image";
    const approved = await requestConfirm({
      title: request.source === "agent" ? `Let the agent generate ${noun}?` : `Generate ${noun}?`,
      description: "This sends your prompt to Google and uses your Gemini key. It is a paid request.",
      facts: [
        { label: "Provider", value: "Google Gemini" },
        {
          label: "Key",
          value: gemini.usingSharedKey()
            ? "The shared demo key, not yours"
            : "Your own key",
        },
        { label: "Model", value: model },
        { label: "Shape", value: isVideo ? `${ratio}, ${duration}s, 720p` : ratio },
        { label: "Cost", value: money(cost) },
        { label: "Prompt", value: request.prompt.slice(0, 300) },
      ],
      confirmLabel: "Generate",
    });
    if (!approved) return failed("The request was declined.");

    const controller = new AbortController();
    controllers.current.set(id, controller);
    request.signal?.addEventListener("abort", () => controller.abort(), { once: true });

    setJobs((prev) => [
      ...prev,
      {
        id,
        kind: request.kind,
        prompt: request.prompt,
        model,
        aspectRatio: ratio,
        durationSeconds: isVideo ? duration : undefined,
        source: request.source,
        status: "pending",
        startedAt: Date.now(),
        elapsed: 0,
      },
    ]);

    try {
      const { blob } = isVideo
        ? await gemini.generateVideo(
            request.prompt,
            { aspectRatio: ratio as gemini.VideoAspectRatio, durationSeconds: duration },
            (elapsed) => patch(id, { elapsed }),
            controller.signal
          )
        : await gemini.generateImage(request.prompt, ratio, controller.signal);

      const asset = await addGenerated(blob, fileName(request.prompt, isVideo ? "mp4" : "png"), {
        prompt: request.prompt,
        sourceModel: model,
      });

      setJobs((prev) => prev.filter((job) => job.id !== id));
      return { ok: true, jobId: id, assetId: asset.id };
    } catch (err) {
      const aborted = controller.signal.aborted;
      const error = aborted
        ? "The request was cancelled."
        : err instanceof Error
          ? err.message
          : "The request failed.";
      if (aborted) setJobs((prev) => prev.filter((job) => job.id !== id));
      else patch(id, { status: "error", error });
      return failed(error);
    } finally {
      controllers.current.delete(id);
    }
  }, [addGenerated, patch]);

  const cancel = useCallback((jobId: string) => {
    controllers.current.get(jobId)?.abort();
  }, []);

  const dismiss = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((job) => job.id !== jobId));
  }, []);

  const value = useMemo(() => ({ jobs, generate, cancel, dismiss }), [jobs, generate, cancel, dismiss]);

  return <GenerationStoreContext.Provider value={value}>{children}</GenerationStoreContext.Provider>;
};

export const useGenerationStore = (): GenerationStore => {
  const ctx = useContext(GenerationStoreContext);
  if (!ctx) throw new Error("useGenerationStore must be used within a GenerationStoreProvider");
  return ctx;
};
