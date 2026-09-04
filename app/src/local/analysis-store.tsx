/**
 * Analysis store.
 *
 * Owns the content index: what Gemini has understood about each local asset.
 * Analyses are persisted beside the media they describe, so an indexed
 * project survives a reload without asking Google anything a second time.
 *
 * Both the human button and the WebMCP tool arrive here, which is why the
 * confirmation gate lives in this file rather than in either caller.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import {
  analysisPrompt,
  GEMINI_ANALYSIS_SCHEMA,
  normalizeAnalysis,
  searchAnalyses,
  type AssetAnalysis,
  type ContentHit,
} from "./analysis";
import { useAssetStore, type LoadedAsset } from "./asset-store";
import { requestConfirm } from "./confirm";
import * as gemini from "./gemini";
import { getAssetBlob, listAnalyses, putAnalysis } from "./persistence";

export type AnalysisStatus = "idle" | "running" | "error";

export interface AnalyzeOutcome {
  analyzed: AssetAnalysis[];
  failed: { assetId: string; error: string }[];
}

interface AnalysisStore {
  analyses: Record<string, AssetAnalysis>;
  statuses: Record<string, AnalysisStatus>;
  errors: Record<string, string>;
  /** One approval covers the whole set; the files are then indexed in order. */
  analyze: (assetIds: string[], signal?: AbortSignal) => Promise<AnalyzeOutcome>;
  getAnalysis: (assetId: string) => AssetAnalysis | undefined;
  search: (query: string, limit?: number) => ContentHit[];
}

const AnalysisStoreContext = createContext<AnalysisStore | undefined>(undefined);

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const AnalysisStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { assets, getAsset } = useAssetStore();
  const [analyses, setAnalyses] = useState<Record<string, AssetAnalysis>>({});
  const [statuses, setStatuses] = useState<Record<string, AnalysisStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void listAnalyses().then((stored) => {
      if (cancelled) return;
      setAnalyses(Object.fromEntries(stored.map((a) => [a.assetId, a])));
    });
    return () => { cancelled = true; };
  }, []);

  const analysesRef = useRef(analyses);
  analysesRef.current = analyses;
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  /** Assets already being indexed are skipped rather than sent twice. */
  const running = useRef(new Set<string>());

  const analyze = useCallback(async (assetIds: string[], signal?: AbortSignal): Promise<AnalyzeOutcome> => {
    const failed: { assetId: string; error: string }[] = [];
    const targets: LoadedAsset[] = [];

    for (const id of assetIds) {
      if (running.current.has(id)) continue;
      const asset = getAsset(id);
      if (!asset) failed.push({ assetId: id, error: `No asset with id ${id}.` });
      else targets.push(asset);
    }
    if (!targets.length) return { analyzed: [], failed };

    if (!gemini.canGenerate()) {
      const error = "No Gemini key is set. Add one in the editor header first.";
      return { analyzed: [], failed: [...failed, ...targets.map((a) => ({ assetId: a.id, error }))] };
    }

    const totalBytes = targets.reduce((sum, a) => sum + a.size, 0);
    const approved = await requestConfirm({
      title: targets.length === 1 ? "Send this media to Gemini?" : `Send ${targets.length} files to Gemini?`,
      description:
        "Each file is uploaded to Google with your key, indexed, and then deleted from Google again. " +
        "The index is kept in this browser.",
      facts: [
        { label: "Provider", value: "Google Gemini" },
        {
          label: "Key",
          value: gemini.usingSharedKey()
            ? "The shared demo key, not yours"
            : "Your own key",
        },
        { label: "Model", value: gemini.ANALYSIS_MODEL },
        { label: "Sends", value: targets.map((a) => a.name).join(", ").slice(0, 300) },
        { label: "Size", value: megabytes(totalBytes) },
      ],
      confirmLabel: "Analyse",
    });

    if (!approved) {
      const error = "The user declined the request.";
      return { analyzed: [], failed: [...failed, ...targets.map((a) => ({ assetId: a.id, error }))] };
    }

    targets.forEach((a) => running.current.add(a.id));
    setStatuses((prev) => ({ ...prev, ...Object.fromEntries(targets.map((a) => [a.id, "running" as const])) }));

    const analyzed: AssetAnalysis[] = [];
    try {
      for (const asset of targets) {
        try {
          const blob = await getAssetBlob(asset.id);
          if (!blob) throw new Error(`The media for ${asset.name} is missing from this browser.`);

          const raw = await gemini.analyzeMedia(
            blob,
            asset.mimeType,
            analysisPrompt(asset.type),
            GEMINI_ANALYSIS_SCHEMA,
            signal
          );
          const analysis = normalizeAnalysis(asset.id, gemini.ANALYSIS_MODEL, raw, asset.durationInSeconds);
          await putAnalysis(analysis);

          analyzed.push(analysis);
          setAnalyses((prev) => ({ ...prev, [asset.id]: analysis }));
          setStatuses((prev) => ({ ...prev, [asset.id]: "idle" }));
          setErrors((prev) => {
            const { [asset.id]: _cleared, ...rest } = prev;
            return rest;
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "The analysis failed.";
          failed.push({ assetId: asset.id, error: message });
          setStatuses((prev) => ({ ...prev, [asset.id]: "error" }));
          setErrors((prev) => ({ ...prev, [asset.id]: message }));
          if (signal?.aborted) break;
        }
      }
    } finally {
      targets.forEach((a) => running.current.delete(a.id));
      setStatuses((prev) => {
        const next = { ...prev };
        for (const asset of targets) if (next[asset.id] === "running") next[asset.id] = "idle";
        return next;
      });
    }

    return { analyzed, failed };
  }, [getAsset]);

  const getAnalysis = useCallback((assetId: string) => analysesRef.current[assetId], []);

  const search = useCallback(
    (query: string, limit?: number) => searchAnalyses(assetsRef.current, analysesRef.current, query, limit),
    []
  );

  const value = useMemo(
    () => ({ analyses, statuses, errors, analyze, getAnalysis, search }),
    [analyses, statuses, errors, analyze, getAnalysis, search]
  );

  return <AnalysisStoreContext.Provider value={value}>{children}</AnalysisStoreContext.Provider>;
};

export const useAnalysisStore = (): AnalysisStore => {
  const ctx = useContext(AnalysisStoreContext);
  if (!ctx) throw new Error("useAnalysisStore must be used within an AnalysisStoreProvider");
  return ctx;
};
