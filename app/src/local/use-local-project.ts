/**
 * Local project store.
 *
 * This is the replacement for `useEditorSync` + `useAutosave` + the
 * EditorRoom undo stack. It owns the document, the history and the activity
 * feed, and it is the single funnel every change goes through — whether the
 * change came from a human click or from a WebMCP tool call.
 *
 * History and the activity feed are the same list on purpose: undo/redo just
 * moves a pointer along the entries the user can see.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyMutation, MutationError } from "./mutations";
import { appendEvent, loadDoc, saveDoc, trimEvents } from "./persistence";
import { createEmptyDoc, type ActorSource, type OverlayMutation, type ProjectDoc } from "./types";

const MAX_ENTRIES = 120;
/** Consecutive drags of the same overlay collapse into one entry. */
const COALESCE_WINDOW_MS = 1200;

export interface HistoryEntry {
  id: string;
  source: ActorSource | "system";
  label: string;
  detail?: string;
  ts: number;
  revision: number;
  doc: ProjectDoc;
  /** Set for repeated actions on one overlay so they can be coalesced. */
  coalesceKey?: string;
}

export interface DispatchOptions {
  source: ActorSource;
  label: string;
  detail?: string;
  coalesceKey?: string;
  /**
   * The WebMCP tool this change is equivalent to, plus its input. Recorded in
   * the durable event log, which is what workflows are extracted from. Human
   * commands pass these explicitly; agent tool calls are logged by the tool
   * wrapper instead. Unannotated changes are logged as "unknown" and skipped
   * by extraction.
   */
  tool?: string;
  toolInput?: Record<string, unknown>;
}

export interface DispatchResult {
  ok: boolean;
  revision: number;
  result?: any;
  error?: string;
}

export interface LocalProject {
  /** The open project, or null when none is. */
  projectId: string | null;
  doc: ProjectDoc;
  entries: HistoryEntry[];
  pointer: number;
  canUndo: boolean;
  canRedo: boolean;
  dispatch: (mutation: OverlayMutation, options: DispatchOptions) => DispatchResult;
  undo: () => boolean;
  redo: () => boolean;
  jumpTo: (entryId: string) => void;
  setDocSilently: (updater: (prev: ProjectDoc) => ProjectDoc) => void;
  /**
   * The document as of *now*, not as of the last render.
   *
   * `doc` is React state, so back-to-back tool calls — an agent applying a
   * pattern, for instance — would read a stale timeline and fail to find an
   * overlay a previous call just created. This reads the same ref `dispatch`
   * writes, so it is always current.
   */
  getDoc: () => ProjectDoc;
  isReady: boolean;
}

function makeInitialEntry(doc: ProjectDoc, label: string): HistoryEntry {
  return { id: crypto.randomUUID(), source: "system", label, ts: Date.now(), revision: 0, doc };
}

/**
 * Writes the open project's in-memory document to storage immediately.
 *
 * Saves are debounced, so anything that reads a project straight out of
 * IndexedDB — duplicating, for instance — would otherwise read a document that
 * is up to one debounce interval stale. Only one project is open at a time, so
 * a single module-level hook is enough.
 */
let flushOpenProject: (() => Promise<void>) | null = null;

export function flushActiveProject(): Promise<void> {
  return flushOpenProject ? flushOpenProject() : Promise.resolve();
}

/**
 * @param projectId The open project. Passing a different id loads that
 * document and starts a fresh history — undo must never cross a project
 * boundary. `null` means no project is open.
 */
export function useLocalProject(projectId: string | null): LocalProject {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => [
    makeInitialEntry(createEmptyDoc(), "Project opened"),
  ]);
  const [pointer, setPointer] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const pointerRef = useRef(pointer);
  pointerRef.current = pointer;
  const revisionRef = useRef(0);
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  /**
   * The project whose document is actually in `entries`. Lags `projectIdRef`
   * between a switch and the load completing; `dispatch` refuses to run while
   * they disagree, so a mutation can never be computed from the outgoing
   * document and then saved under the incoming project's id.
   */
  const loadedProjectIdRef = useRef<string | null>(null);

  // Load the open project's document. Re-runs on switch, which is what resets
  // the history and the activity feed.
  useEffect(() => {
    let cancelled = false;
    setIsReady(false);
    if (!projectId) {
      const empty = [makeInitialEntry(createEmptyDoc(), "No project open")];
      entriesRef.current = empty;
      pointerRef.current = 0;
      revisionRef.current = 0;
      loadedProjectIdRef.current = null;
      setEntries(empty);
      setPointer(0);
      return;
    }
    (async () => {
      const stored = await loadDoc(projectId);
      if (cancelled || projectIdRef.current !== projectId) return;
      const opened = [makeInitialEntry(stored ?? createEmptyDoc(), stored ? "Project opened" : "Project created")];
      entriesRef.current = opened;
      pointerRef.current = 0;
      revisionRef.current = 0;
      loadedProjectIdRef.current = projectId;
      setEntries(opened);
      setPointer(0);
      setIsReady(true);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const doc = entries[pointer]?.doc ?? createEmptyDoc();
  const docRef = useRef(doc);
  docRef.current = doc;

  // Persist the visible document, debounced. Captures the id at schedule time
  // so an in-flight save can never land on the project you just switched to.
  useEffect(() => {
    if (!isReady || !projectId) return;
    const target = projectId;
    const timer = setTimeout(() => { void saveDoc(target, docRef.current); }, 400);
    return () => clearTimeout(timer);
  }, [doc, isReady, projectId]);

  // Expose an immediate save for the open project, and flush on the way out.
  //
  // The debounced effect above clears its timer on cleanup, so leaving a
  // project inside the debounce window would discard the last edit. This
  // effect only re-runs when the project changes, so its cleanup is exactly
  // "we are leaving this project" — and unmount, which covers deleting the
  // last project.
  useEffect(() => {
    if (!projectId) return;
    const target = projectId;
    const flush = () =>
      loadedProjectIdRef.current === target ? saveDoc(target, docRef.current) : Promise.resolve();
    flushOpenProject = flush;
    return () => {
      if (flushOpenProject === flush) flushOpenProject = null;
      void flush();
    };
  }, [projectId]);

  const dispatch = useCallback((mutation: OverlayMutation, options: DispatchOptions): DispatchResult => {
    if (!projectIdRef.current) {
      return { ok: false, revision: revisionRef.current, error: "No project is open. Create or open one first." };
    }
    if (loadedProjectIdRef.current !== projectIdRef.current) {
      return { ok: false, revision: revisionRef.current, error: "The project is still opening. Try again in a moment." };
    }
    const current = entriesRef.current[pointerRef.current]?.doc;
    if (!current) return { ok: false, revision: revisionRef.current, error: "No project loaded" };

    let next: ProjectDoc;
    let result: any;
    try {
      const outcome = applyMutation(current, mutation);
      next = outcome.doc;
      result = outcome.result;
    } catch (err) {
      const message = err instanceof MutationError || err instanceof Error ? err.message : "Mutation failed";
      return { ok: false, revision: revisionRef.current, error: message };
    }

    const revision = ++revisionRef.current;
    const truncated = entriesRef.current.slice(0, pointerRef.current + 1);
    const last = truncated[truncated.length - 1];
    const canCoalesce =
      !!options.coalesceKey &&
      last?.coalesceKey === options.coalesceKey &&
      last.source === options.source &&
      Date.now() - last.ts < COALESCE_WINDOW_MS;

    let updated: HistoryEntry[];
    if (canCoalesce) {
      updated = [
        ...truncated.slice(0, -1),
        { ...last, doc: next, ts: Date.now(), revision, detail: options.detail ?? last.detail },
      ];
    } else {
      updated = [
        ...truncated,
        {
          id: crypto.randomUUID(),
          source: options.source,
          label: options.label,
          detail: options.detail,
          ts: Date.now(),
          revision,
          doc: next,
          coalesceKey: options.coalesceKey,
        },
      ];
      if (updated.length > MAX_ENTRIES) updated = updated.slice(updated.length - MAX_ENTRIES);
    }

    entriesRef.current = updated;
    pointerRef.current = updated.length - 1;
    setEntries(updated);
    setPointer(pointerRef.current);

    // Durable record for workflow extraction. Agent tool calls are logged by the
    // tool wrapper, so only annotate human commands here to avoid duplicates.
    if (options.source === "human" && projectIdRef.current) {
      const created = result && typeof result === "object" && typeof (result as any).id === "number"
        ? [(result as any).id as number]
        : undefined;
      void appendEvent({
        projectId: projectIdRef.current,
        ts: Date.now(),
        source: "human",
        tool: options.tool ?? "unknown",
        input: options.toolInput ?? {},
        producedOverlayIds: created,
        revision,
      }).then((seq) => {
        if (seq > 0 && seq % 200 === 0 && projectIdRef.current) void trimEvents(projectIdRef.current);
      });
    }

    return { ok: true, revision, result };
  }, []);

  /** Local-only document edit that must not create a history entry. */
  const setDocSilently = useCallback((updater: (prev: ProjectDoc) => ProjectDoc) => {
    const idx = pointerRef.current;
    const target = entriesRef.current[idx];
    if (!target) return;
    const updated = [...entriesRef.current];
    updated[idx] = { ...target, doc: updater(target.doc) };
    entriesRef.current = updated;
    setEntries(updated);
  }, []);

  const getDoc = useCallback(
    () => entriesRef.current[pointerRef.current]?.doc ?? createEmptyDoc(),
    []
  );

  const undo = useCallback(() => {
    if (pointerRef.current <= 0) return false;
    pointerRef.current -= 1;
    setPointer(pointerRef.current);
    return true;
  }, []);

  const redo = useCallback(() => {
    if (pointerRef.current >= entriesRef.current.length - 1) return false;
    pointerRef.current += 1;
    setPointer(pointerRef.current);
    return true;
  }, []);

  const jumpTo = useCallback((entryId: string) => {
    const idx = entriesRef.current.findIndex((e) => e.id === entryId);
    if (idx === -1) return;
    pointerRef.current = idx;
    setPointer(idx);
  }, []);

  return useMemo(
    () => ({
      projectId,
      doc,
      entries,
      pointer,
      canUndo: pointer > 0,
      canRedo: pointer < entries.length - 1,
      dispatch,
      undo,
      redo,
      jumpTo,
      setDocSilently,
      getDoc,
      isReady,
    }),
    [projectId, doc, entries, pointer, dispatch, undo, redo, jumpTo, setDocSilently, getDoc, isReady]
  );
}
