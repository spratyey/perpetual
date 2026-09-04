/**
 * Object URLs only live as long as the page that made them, so a project
 * loaded from storage still points at dead `blob:` URLs. Overlays remember
 * which asset they came from; this re-points them at the URLs minted for the
 * current page load, and holds the editor back until it has done so.
 */

import { useLayoutEffect, useState, type ReactNode } from "react";
import { useAssetStore } from "./asset-store";
import type { LocalProject } from "./use-local-project";

export function AssetRelinker({ project, children }: { project: LocalProject; children: ReactNode }) {
  const { assets } = useAssetStore();
  const { setDocSilently } = project;
  const [relinked, setRelinked] = useState(false);

  useLayoutEffect(() => {
    const urlById = new Map(assets.map((a) => [a.id, a.url]));
    setDocSilently((doc) => {
      let changed = false;
      const overlays = doc.overlays.map((overlay: any) => {
        const url = overlay.assetId ? urlById.get(overlay.assetId) : undefined;
        if (!url || overlay.src === url) return overlay;
        changed = true;
        return { ...overlay, src: url };
      });
      return changed ? { ...doc, overlays } : doc;
    });
    setRelinked(true);
  }, [assets, setDocSilently]);

  return relinked ? <>{children}</> : null;
}
