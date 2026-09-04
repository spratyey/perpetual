/**
 * Workflow library.
 *
 * Workflows are deliberately not scoped to a project: one recorded in a teaser
 * is exactly what you want in the next teaser. Stored in IndexedDB alongside
 * everything else.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteWorkflow as deleteWorkflowRecord,
  getWorkflow as getWorkflowRecord,
  listWorkflows,
  putWorkflow,
} from "./persistence";
import type { Workflow } from "./types";

export interface Workflows {
  list: Workflow[];
  isReady: boolean;
  get: (id: string) => Promise<Workflow | null>;
  save: (workflow: Workflow) => Promise<Workflow>;
  remove: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useWorkflows(): Workflows {
  const [list, setList] = useState<Workflow[]>([]);
  const [isReady, setIsReady] = useState(false);
  const listRef = useRef(list);
  listRef.current = list;

  const refresh = useCallback(async () => {
    const all = await listWorkflows();
    setList(all);
    listRef.current = all;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await listWorkflows();
      if (cancelled) return;
      setList(all);
      listRef.current = all;
      setIsReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const get = useCallback((id: string) => getWorkflowRecord(id), []);

  const save = useCallback(async (workflow: Workflow) => {
    const next = { ...workflow, updatedAt: Date.now() };
    await putWorkflow(next);
    await refresh();
    return next;
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    if (!listRef.current.some((w) => w.id === id)) return false;
    await deleteWorkflowRecord(id);
    await refresh();
    return true;
  }, [refresh]);

  return useMemo(
    () => ({ list, isReady, get, save, remove, refresh }),
    [list, isReady, get, save, remove, refresh]
  );
}
