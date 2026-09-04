/**
 * Project catalogue.
 *
 * Owns the list of projects and which one is open. The document itself is owned
 * by `useLocalProject`, which is given the active id — so this hook never
 * touches timeline state, and switching projects is just an id change.
 *
 * The active id is remembered in localStorage so a reload reopens the same
 * project. Everything else lives in IndexedDB.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createProject as createProjectRecord,
  deleteProject as deleteProjectRecord,
  duplicateProject as duplicateProjectRecord,
  listProjects,
  renameProject as renameProjectRecord,
} from "./persistence";
import type { ProjectMeta } from "./types";
import { flushActiveProject } from "./use-local-project";

const ACTIVE_KEY = "perpetual:active-project";

function readActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function writeActiveId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // Private-mode browsers can refuse storage. Losing the last-opened project
    // is survivable; failing to open the editor is not.
  }
}

export interface Projects {
  /** Newest-updated first. */
  list: ProjectMeta[];
  activeId: string | null;
  active: ProjectMeta | null;
  /** False until the catalogue has been read once. */
  isReady: boolean;
  create: (name?: string) => Promise<ProjectMeta>;
  open: (id: string) => boolean;
  rename: (id: string, name: string) => Promise<ProjectMeta | null>;
  remove: (id: string) => Promise<boolean>;
  duplicate: (id: string, name?: string) => Promise<ProjectMeta | null>;
  refresh: () => Promise<void>;
}

export function useProjects(): Projects {
  const [list, setList] = useState<ProjectMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const listRef = useRef(list);
  listRef.current = list;

  const refresh = useCallback(async () => {
    const projects = await listProjects();
    setList(projects);
    listRef.current = projects;
  }, []);

  // First read decides what is open: the remembered project if it still
  // exists, otherwise the most recently updated one. A first-time visitor gets
  // a project created for them, so the app still opens straight into the
  // editor rather than an empty-state screen — that screen is only reached by
  // deleting every project.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let projects = await listProjects();
      if (cancelled) return;

      if (projects.length === 0) {
        await createProjectRecord("Untitled");
        projects = await listProjects();
        if (cancelled) return;
      }

      setList(projects);
      listRef.current = projects;

      const remembered = readActiveId();
      const resolved =
        (remembered && projects.some((p) => p.id === remembered) && remembered) ||
        projects[0]?.id ||
        null;
      setActiveId(resolved);
      writeActiveId(resolved);
      setIsReady(true);
    })().catch((err) => {
      // Whatever went wrong, do not hang on the loading screen. That is what
      // this did when a browser refused storage: "Opening your projects…"
      // forever, and one SecurityError in the console as the only clue.
      console.error("[perpetual] The project catalogue could not be opened.", err);
      if (!cancelled) {
        setList([]);
        listRef.current = [];
        setActiveId(null);
        setIsReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const create = useCallback(async (name?: string) => {
    const meta = await createProjectRecord(name ?? "Untitled");
    await refresh();
    setActiveId(meta.id);
    writeActiveId(meta.id);
    return meta;
  }, [refresh]);

  const open = useCallback((id: string) => {
    if (!listRef.current.some((p) => p.id === id)) return false;
    setActiveId(id);
    writeActiveId(id);
    return true;
  }, []);

  const rename = useCallback(async (id: string, name: string) => {
    const meta = await renameProjectRecord(id, name);
    await refresh();
    return meta;
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    if (!listRef.current.some((p) => p.id === id)) return false;
    await deleteProjectRecord(id);
    const remaining = listRef.current.filter((p) => p.id !== id);
    setList(remaining);
    listRef.current = remaining;
    // Deleting the open project falls through to the next one rather than
    // leaving the editor pointed at a document that no longer exists.
    setActiveId((prev) => {
      if (prev !== id) return prev;
      const next = remaining[0]?.id ?? null;
      writeActiveId(next);
      return next;
    });
    return true;
  }, []);

  const duplicate = useCallback(async (id: string, name?: string) => {
    // Duplication reads the source document from storage, and saves are
    // debounced — without this the copy can miss the most recent edits.
    await flushActiveProject();
    const meta = await duplicateProjectRecord(id, name);
    await refresh();
    if (meta) {
      setActiveId(meta.id);
      writeActiveId(meta.id);
    }
    return meta;
  }, [refresh]);

  const active = useMemo(() => list.find((p) => p.id === activeId) ?? null, [list, activeId]);

  return useMemo(
    () => ({ list, activeId, active, isReady, create, open, rename, remove, duplicate, refresh }),
    [list, activeId, active, isReady, create, open, rename, remove, duplicate, refresh]
  );
}
