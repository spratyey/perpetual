/**
 * Local persistence.
 *
 * Replaces the server storage boundary. The
 * project document and every imported media blob live in IndexedDB, so the
 * app keeps working with no network at all.
 */

import { openDB, type IDBPDatabase } from "idb";
import { createMemoryDb } from "./memory-db";
import type { AssetAnalysis } from "./analysis";
import { createEmptyDoc, type LoggedEvent, type ProjectDoc, type ProjectMeta, type Workflow } from "./types";

const DB_NAME = "perpetual-video";
/**
 * v5 is the union of two lineages that both reached v3 independently: one added
 * `projects` (then v4 for `events` and `workflows`), the other added `mattes`.
 * A user can arrive from either, so every store is created behind a `contains`
 * check and the version is bumped past both.
 */
const DB_VERSION = 5;
const DOC_STORE = "doc";
const PROJECT_STORE = "projects";
const ASSET_STORE = "assets";
const BLOB_STORE = "blobs";
const ANALYSIS_STORE = "analyses";
const EVENT_STORE = "events";
const WORKFLOW_STORE = "workflows";
const MATTE_STORE = "mattes";
/** Oldest events are dropped past this, per project. */
const MAX_EVENTS_PER_PROJECT = 2000;
/** Key the single pre-v3 document lived under, before projects existed. */
const LEGACY_DOC_KEY = "project";

export type AssetKind = "video" | "image" | "audio";

export interface AssetMeta {
  id: string;
  name: string;
  type: AssetKind;
  mimeType: string;
  size: number;
  durationInSeconds?: number;
  width?: number;
  height?: number;
  thumbnail?: string;
  createdAt: number;
  origin: "import" | "generated";
  /** Set on generated media, so it says where it came from. */
  prompt?: string;
  sourceModel?: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

/**
 * Before projects existed the document lived at one fixed key. Promote it to a
 * real project so a returning user's work survives, then drop the old key so
 * this only ever happens once. Idempotent and safe on a fresh database.
 */
async function migrateLegacyDoc(database: IDBPDatabase): Promise<void> {
  try {
    const legacy = (await database.get(DOC_STORE, LEGACY_DOC_KEY)) as ProjectDoc | undefined;
    if (!legacy) return;
    const now = Date.now();
    const id = crypto.randomUUID();
    const tx = database.transaction([PROJECT_STORE, DOC_STORE], "readwrite");
    await Promise.all([
      tx.objectStore(PROJECT_STORE).put({ id, name: legacy.name || "Untitled", createdAt: now, updatedAt: now }),
      tx.objectStore(DOC_STORE).put(legacy, id),
      tx.objectStore(DOC_STORE).delete(LEGACY_DOC_KEY),
      tx.done,
    ]);
    console.info("[perpetual] Migrated the pre-projects document into a project.");
  } catch (err) {
    console.warn("[perpetual] Could not migrate the pre-projects document.", err);
  }
}

/**
 * Removes workflows from the replay design.
 *
 * Those records held parameterised tool-call scripts; a workflow now holds an
 * analysis of what was done and why. There is no way to convert one into the
 * other — the analysis never existed — so they are dropped rather than left to
 * break every read. Without this they crash the Workflows view: no `observed`
 * field, so rendering throws.
 */
async function dropLegacyWorkflows(database: IDBPDatabase): Promise<void> {
  try {
    const all = (await database.getAll(WORKFLOW_STORE)) as { id: string; version?: number }[];
    const stale = all.filter((w) => w.version !== 2);
    if (stale.length === 0) return;
    const tx = database.transaction(WORKFLOW_STORE, "readwrite");
    await Promise.all([...stale.map((w) => tx.objectStore(WORKFLOW_STORE).delete(w.id)), tx.done]);
    console.info(`[perpetual] Discarded ${stale.length} workflow(s) from the previous replay-based design.`);
  } catch (err) {
    console.warn("[perpetual] Could not tidy up old workflows.", err);
  }
}

/**
 * True when storage was refused and the session is running in memory.
 *
 * Not a preference: some contexts — a sandboxed frame, a partitioned
 * third-party context, a profile with site data blocked — throw on the very
 * first touch of `indexedDB`. Agent browsers do. The editor needs somewhere to
 * put a document, not somewhere durable, so it falls back and warns rather
 * than refusing to open.
 */
let ephemeral = false;

export function isEphemeral(): boolean {
  return ephemeral;
}

/**
 * How long to wait for the database to open before giving up on it.
 *
 * Opening is not reading — it settles in milliseconds normally, so a few
 * seconds is generous. The timeout exists because refusal is not always an
 * error: an agent browser returns a real `IDBRequest` from `open()` that never
 * fires at all — no success, no error, no `upgradeneeded`. There is nothing to
 * catch, so the boot simply waited forever on "Opening your projects…" with a
 * clean console. A hang has to be treated as a failure, not awaited politely.
 */
const OPEN_TIMEOUT_MS = 4000;

/** Cheap probe: the getter itself throws in a denied context. */
function storageAvailable(): boolean {
  try {
    return !!globalThis.indexedDB;
  } catch {
    return false;
  }
}

function memoryFallback(reason: unknown): IDBPDatabase {
  ephemeral = true;
  console.warn(
    "[perpetual] This browser will not give the page persistent storage, so the session is " +
      "running in memory. Everything works; nothing survives a reload.",
    reason
  );
  return createMemoryDb() as unknown as IDBPDatabase;
}

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    if (!storageAvailable()) {
      dbPromise = Promise.resolve(memoryFallback("indexedDB is unavailable in this context"));
      return dbPromise;
    }
    const timedOut = Symbol("timed-out");
    const opening = openDB(DB_NAME, DB_VERSION, {
      blocked(current) {
        console.warn(
          `[perpetual] Another tab is holding version ${current} of the database open, ` +
            "so this one cannot upgrade it. Close the other tab."
        );
      },
      upgrade(database) {
        if (!database.objectStoreNames.contains(DOC_STORE)) database.createObjectStore(DOC_STORE);
        if (!database.objectStoreNames.contains(ASSET_STORE)) database.createObjectStore(ASSET_STORE, { keyPath: "id" });
        if (!database.objectStoreNames.contains(BLOB_STORE)) database.createObjectStore(BLOB_STORE);
        if (!database.objectStoreNames.contains(ANALYSIS_STORE)) {
          database.createObjectStore(ANALYSIS_STORE, { keyPath: "assetId" });
        }
        if (!database.objectStoreNames.contains(PROJECT_STORE)) {
          database.createObjectStore(PROJECT_STORE, { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains(EVENT_STORE)) {
          const events = database.createObjectStore(EVENT_STORE, { keyPath: ["projectId", "seq"] });
          events.createIndex("byProject", "projectId");
        }
        if (!database.objectStoreNames.contains(WORKFLOW_STORE)) {
          database.createObjectStore(WORKFLOW_STORE, { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains(MATTE_STORE)) database.createObjectStore(MATTE_STORE);
      },
    }).then(async (database) => {
      // Runs after the upgrade transaction has committed. Doing this inside
      // `upgrade` would race the versionchange transaction closing.
      await migrateLegacyDoc(database);
      await dropLegacyWorkflows(database);
      return database;
    });

    // If the open wins, use it. If the clock wins, the session runs in memory;
    // a late-arriving connection is then simply ignored rather than swapped in
    // underneath a document the user has already started editing.
    dbPromise = Promise.race([
      opening,
      new Promise<typeof timedOut>((resolve) => setTimeout(() => resolve(timedOut), OPEN_TIMEOUT_MS)),
    ])
      .then((result) =>
        result === timedOut
          ? memoryFallback(`the database did not open within ${OPEN_TIMEOUT_MS}ms`)
          : (result as IDBPDatabase)
      )
      .catch((err) => memoryFallback(err));
    opening.catch(() => {});
  }
  return dbPromise;
}

// ─── Projects ───

/** Newest first, so the picker and `list_projects` agree on ordering. */
export async function listProjects(): Promise<ProjectMeta[]> {
  try {
    const all = (await (await db()).getAll(PROJECT_STORE)) as ProjectMeta[];
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.warn("[perpetual] Could not list projects.", err);
    return [];
  }
}

/** Creates the catalogue entry and its (empty) document in one transaction. */
export async function createProject(name: string): Promise<ProjectMeta> {
  const now = Date.now();
  const meta: ProjectMeta = { id: crypto.randomUUID(), name: name.trim() || "Untitled", createdAt: now, updatedAt: now };
  const database = await db();
  const tx = database.transaction([PROJECT_STORE, DOC_STORE], "readwrite");
  const doc = { ...createEmptyDoc(), name: meta.name };
  await Promise.all([
    tx.objectStore(PROJECT_STORE).put(meta),
    tx.objectStore(DOC_STORE).put(doc, meta.id),
    tx.done,
  ]);
  return meta;
}

/**
 * Renames a project.
 *
 * Only the catalogue entry is touched. `ProjectDoc.name` is set when a project
 * is created and then left alone: the editor holds the document in memory and
 * saves it on a debounce, so writing a name into the stored document here would
 * be silently overwritten by the next save. The catalogue is the single source
 * of truth for the name.
 */
export async function renameProject(id: string, name: string): Promise<ProjectMeta | null> {
  const database = await db();
  const existing = (await database.get(PROJECT_STORE, id)) as ProjectMeta | undefined;
  if (!existing) return null;
  const meta: ProjectMeta = { ...existing, name: name.trim() || existing.name, updatedAt: Date.now() };
  await database.put(PROJECT_STORE, meta);
  return meta;
}

/**
 * Removes a project and its document. Assets are deliberately left alone —
 * the media library is shared across projects, so deleting one project must
 * not take another project's footage with it.
 */
export async function deleteProject(id: string): Promise<void> {
  const database = await db();
  const tx = database.transaction([PROJECT_STORE, DOC_STORE, EVENT_STORE], "readwrite");
  const events = tx.objectStore(EVENT_STORE).index("byProject");
  let cursor = await events.openKeyCursor(id);
  const pending: Promise<unknown>[] = [];
  while (cursor) {
    pending.push(tx.objectStore(EVENT_STORE).delete(cursor.primaryKey));
    cursor = await cursor.continue();
  }
  await Promise.all([
    ...pending,
    tx.objectStore(PROJECT_STORE).delete(id),
    tx.objectStore(DOC_STORE).delete(id),
    tx.done,
  ]);
}

export async function duplicateProject(id: string, name?: string): Promise<ProjectMeta | null> {
  const database = await db();
  const source = (await database.get(DOC_STORE, id)) as ProjectDoc | undefined;
  const sourceMeta = (await database.get(PROJECT_STORE, id)) as ProjectMeta | undefined;
  if (!source || !sourceMeta) return null;
  const meta = await createProject(name?.trim() || `${sourceMeta.name} copy`);
  await saveDoc(meta.id, { ...source, name: meta.name });
  return meta;
}

// ─── Documents ───

export async function loadDoc(projectId: string): Promise<ProjectDoc | null> {
  try {
    const stored = await (await db()).get(DOC_STORE, projectId);
    if (!stored || stored.version !== 1) return null;
    return stored as ProjectDoc;
  } catch (err) {
    console.warn("[perpetual] Could not read the saved project.", err);
    return null;
  }
}

/** Persists the document and bumps the project's `updatedAt` so ordering stays useful. */
export async function saveDoc(projectId: string, doc: ProjectDoc): Promise<void> {
  try {
    const database = await db();
    const tx = database.transaction([DOC_STORE, PROJECT_STORE], "readwrite");
    const meta = (await tx.objectStore(PROJECT_STORE).get(projectId)) as ProjectMeta | undefined;
    await Promise.all([
      tx.objectStore(DOC_STORE).put(doc, projectId),
      meta ? tx.objectStore(PROJECT_STORE).put({ ...meta, updatedAt: Date.now() }) : Promise.resolve(),
      tx.done,
    ]);
  } catch (err) {
    console.warn("[perpetual] Could not save the project.", err);
  }
}

export async function listAssets(): Promise<AssetMeta[]> {
  try {
    const all = (await (await db()).getAll(ASSET_STORE)) as AssetMeta[];
    return all.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function putAsset(meta: AssetMeta, blob: Blob): Promise<void> {
  const database = await db();
  const tx = database.transaction([ASSET_STORE, BLOB_STORE], "readwrite");
  await Promise.all([
    tx.objectStore(ASSET_STORE).put(meta),
    tx.objectStore(BLOB_STORE).put(blob, meta.id),
    tx.done,
  ]);
}

export async function getAssetBlob(id: string): Promise<Blob | undefined> {
  return (await db()).get(BLOB_STORE, id);
}

export async function deleteAsset(id: string): Promise<void> {
  const database = await db();
  const tx = database.transaction([ASSET_STORE, BLOB_STORE, ANALYSIS_STORE], "readwrite");
  await Promise.all([
    tx.objectStore(ASSET_STORE).delete(id),
    tx.objectStore(BLOB_STORE).delete(id),
    tx.objectStore(ANALYSIS_STORE).delete(id),
    tx.done,
  ]);
}

export async function listAnalyses(): Promise<AssetAnalysis[]> {
  try {
    return (await (await db()).getAll(ANALYSIS_STORE)) as AssetAnalysis[];
  } catch {
    return [];
  }
}

export async function putAnalysis(analysis: AssetAnalysis): Promise<void> {
  await (await db()).put(ANALYSIS_STORE, analysis);
}

/** Caption subject silhouettes, kept as one sprite atlas per caption overlay. */
export async function putMatte(id: string, atlas: Blob): Promise<void> {
  await (await db()).put(MATTE_STORE, atlas, id);
}

export async function getMatte(id: string): Promise<Blob | undefined> {
  return (await db()).get(MATTE_STORE, id);
}

export async function clearAll(): Promise<void> {
  const database = await db();
  const tx = database.transaction(
    [DOC_STORE, PROJECT_STORE, ASSET_STORE, BLOB_STORE, ANALYSIS_STORE, EVENT_STORE, WORKFLOW_STORE, MATTE_STORE],
    "readwrite"
  );
  await Promise.all([
    tx.objectStore(DOC_STORE).clear(),
    tx.objectStore(PROJECT_STORE).clear(),
    tx.objectStore(EVENT_STORE).clear(),
    tx.objectStore(WORKFLOW_STORE).clear(),
    tx.objectStore(ASSET_STORE).clear(),
    tx.objectStore(BLOB_STORE).clear(),
    tx.objectStore(ANALYSIS_STORE).clear(),
    tx.objectStore(MATTE_STORE).clear(),
    tx.done,
  ]);
}

export function isQuotaError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === "QuotaExceededError" || err.name === "NotAllowedError");
}

// ─── Event log ───

/** Appends one action. `seq` is allocated from the current tail. */
export async function appendEvent(event: Omit<LoggedEvent, "seq">): Promise<number> {
  try {
    const database = await db();
    const tx = database.transaction(EVENT_STORE, "readwrite");
    const store = tx.objectStore(EVENT_STORE);
    // Highest existing seq for this project, via the compound key range.
    const last = await store.openCursor(
      IDBKeyRange.bound([event.projectId, -Infinity], [event.projectId, Infinity]),
      "prev"
    );
    const seq = last ? (last.value as LoggedEvent).seq + 1 : 1;
    await store.put({ ...event, seq });
    await tx.done;
    return seq;
  } catch (err) {
    console.warn("[perpetual] Could not record the action.", err);
    return -1;
  }
}

export async function listEvents(projectId: string, offset = 0, limit = 200): Promise<{ events: LoggedEvent[]; total: number; trimmed: boolean }> {
  try {
    const database = await db();
    const all = (await database.getAll(
      EVENT_STORE,
      IDBKeyRange.bound([projectId, -Infinity], [projectId, Infinity])
    )) as LoggedEvent[];
    all.sort((a, b) => a.seq - b.seq);
    return {
      events: all.slice(offset, offset + limit),
      total: all.length,
      // seq starts at 1; a higher first seq means older events were dropped.
      trimmed: all.length > 0 && all[0].seq > 1,
    };
  } catch (err) {
    console.warn("[perpetual] Could not read the event log.", err);
    return { events: [], total: 0, trimmed: false };
  }
}

/** Keeps the log bounded. Called opportunistically, not on every append. */
export async function trimEvents(projectId: string): Promise<void> {
  try {
    const database = await db();
    const keys = (await database.getAllKeys(
      EVENT_STORE,
      IDBKeyRange.bound([projectId, -Infinity], [projectId, Infinity])
    )) as [string, number][];
    if (keys.length <= MAX_EVENTS_PER_PROJECT) return;
    const drop = keys.slice(0, keys.length - MAX_EVENTS_PER_PROJECT);
    const tx = database.transaction(EVENT_STORE, "readwrite");
    await Promise.all([...drop.map((k) => tx.objectStore(EVENT_STORE).delete(k)), tx.done]);
  } catch {
    // Trimming is housekeeping; failing it must not break recording.
  }
}

// ─── Workflows ───

export async function listWorkflows(): Promise<Workflow[]> {
  try {
    const all = (await (await db()).getAll(WORKFLOW_STORE)) as Workflow[];
    return all.filter(isCurrentWorkflow).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.warn("[perpetual] Could not list workflows.", err);
    return [];
  }
}

/** Guards the UI against a record written by an older version of the app. */
function isCurrentWorkflow(w: unknown): w is Workflow {
  return !!w && typeof w === "object" && (w as Workflow).version === 2 && !!(w as Workflow).observed;
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  try {
    const found = (await (await db()).get(WORKFLOW_STORE, id)) as Workflow | undefined;
    return isCurrentWorkflow(found) ? found : null;
  } catch {
    return null;
  }
}

export async function putWorkflow(workflow: Workflow): Promise<void> {
  await (await db()).put(WORKFLOW_STORE, workflow);
}

export async function deleteWorkflow(id: string): Promise<void> {
  await (await db()).delete(WORKFLOW_STORE, id);
}
