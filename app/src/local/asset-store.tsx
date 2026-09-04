/**
 * Local asset store.
 *
 * Replaces `local-media-context.tsx`, which read and wrote media through the
 * project API. Files never leave the browser: bytes go to IndexedDB and the
 * timeline points at object URLs minted for this tab.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  type AssetMeta,
  deleteAsset as dbDeleteAsset,
  getAssetBlob,
  isQuotaError,
  listAssets,
  putAsset,
} from "./persistence";
import { generateThumbnail, getImageSize, getMediaDuration, kindFromMime } from "./media-probe";

export const MAX_ASSET_BYTES = 200 * 1024 * 1024;

export interface LoadedAsset extends AssetMeta {
  /** Object URL valid for the lifetime of this tab. */
  url: string;
}

interface AssetStore {
  assets: LoadedAsset[];
  isLoading: boolean;
  importFiles: (files: File[]) => Promise<LoadedAsset[]>;
  addGenerated: (blob: Blob, name: string, origin: { prompt: string; sourceModel: string }) => Promise<LoadedAsset>;
  removeAsset: (id: string) => Promise<void>;
  getAsset: (id: string) => LoadedAsset | undefined;
}

const AssetStoreContext = createContext<AssetStore | undefined>(undefined);

export const AssetStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [assets, setAssets] = useState<LoadedAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const urlsRef = useRef<string[]>([]);

  const trackUrl = useCallback((url: string) => {
    urlsRef.current.push(url);
    return url;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const metas = await listAssets();
      const loaded: LoadedAsset[] = [];
      for (const meta of metas) {
        const blob = await getAssetBlob(meta.id);
        if (!blob) continue;
        loaded.push({ ...meta, url: trackUrl(URL.createObjectURL(blob)) });
      }
      if (!cancelled) {
        setAssets(loaded);
        setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [trackUrl]);

  // Object URLs are only revoked when the whole editor unmounts; overlays may
  // still reference an asset that was removed from the media panel.
  useEffect(() => {
    const urls = urlsRef;
    return () => { urls.current.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);

  const importFiles = useCallback(async (files: File[]): Promise<LoadedAsset[]> => {
    const added: LoadedAsset[] = [];
    for (const file of files) {
      const type = kindFromMime(file.type);
      if (!type) continue;
      if (file.size > MAX_ASSET_BYTES) {
        throw new Error(`${file.name} is larger than ${Math.round(MAX_ASSET_BYTES / 1024 / 1024)} MB.`);
      }

      const [thumbnail, durationInSeconds, size] = await Promise.all([
        generateThumbnail(file),
        getMediaDuration(file),
        getImageSize(file),
      ]);

      const meta: AssetMeta = {
        id: crypto.randomUUID(),
        name: file.name,
        type,
        mimeType: file.type,
        size: file.size,
        durationInSeconds,
        width: size.width,
        height: size.height,
        thumbnail,
        createdAt: Date.now(),
        origin: "import",
      };

      try {
        await putAsset(meta, file);
      } catch (err) {
        if (isQuotaError(err)) {
          throw new Error("Browser storage is full. Remove some media and try again.");
        }
        throw err;
      }

      const asset: LoadedAsset = { ...meta, url: trackUrl(URL.createObjectURL(file)) };
      added.push(asset);
    }

    if (added.length) setAssets((prev) => [...prev, ...added]);
    return added;
  }, [trackUrl]);

  const addGenerated = useCallback(async (
    blob: Blob,
    name: string,
    origin: { prompt: string; sourceModel: string }
  ): Promise<LoadedAsset> => {
    const file = new File([blob], name, { type: blob.type || "image/png" });
    const type = kindFromMime(file.type);
    if (!type) throw new Error(`Gemini returned a ${file.type} file, which this editor cannot use.`);

    const [thumbnail, durationInSeconds, size] = await Promise.all([
      generateThumbnail(file),
      getMediaDuration(file),
      getImageSize(file),
    ]);

    const meta: AssetMeta = {
      id: crypto.randomUUID(),
      name,
      type,
      mimeType: file.type,
      size: file.size,
      durationInSeconds,
      width: size.width,
      height: size.height,
      thumbnail,
      createdAt: Date.now(),
      origin: "generated",
      prompt: origin.prompt,
      sourceModel: origin.sourceModel,
    };

    try {
      await putAsset(meta, file);
    } catch (err) {
      if (isQuotaError(err)) throw new Error("Browser storage is full. Remove some media and try again.");
      throw err;
    }

    const asset: LoadedAsset = { ...meta, url: trackUrl(URL.createObjectURL(file)) };
    setAssets((prev) => [...prev, asset]);
    return asset;
  }, [trackUrl]);

  const removeAsset = useCallback(async (id: string) => {
    await dbDeleteAsset(id);
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const getAsset = useCallback((id: string) => assetsRef.current.find((a) => a.id === id), []);

  const value = useMemo(
    () => ({ assets, isLoading, importFiles, addGenerated, removeAsset, getAsset }),
    [assets, isLoading, importFiles, addGenerated, removeAsset, getAsset]
  );

  return (
    <AssetStoreContext.Provider value={value}>
      {isLoading ? null : children}
    </AssetStoreContext.Provider>
  );
};

export const useAssetStore = (): AssetStore => {
  const ctx = useContext(AssetStoreContext);
  if (!ctx) throw new Error("useAssetStore must be used within an AssetStoreProvider");
  return ctx;
};
