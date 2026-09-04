/**
 * An in-memory stand-in for IndexedDB.
 *
 * Some browsing contexts refuse storage outright — a sandboxed frame, a
 * partitioned third-party context, a profile with site data blocked. The
 * getter for `window.indexedDB` throws `SecurityError` and every read fails.
 * Agent browsers do this: opening the editor through one showed "Opening your
 * projects…" forever, with six tools registered out of thirty-three, because
 * the editor never mounted and so never registered the other twenty-seven.
 *
 * Refusing to load is the wrong response to that. The editor's actual
 * dependency is a place to put a document, not a durable one — so when storage
 * is unavailable we keep everything in memory and say so. Everything works;
 * nothing survives a reload. `isEphemeral()` is what the UI warns from.
 *
 * This implements only the slice of the `idb` surface `persistence.ts` uses,
 * and it is not a general shim.
 */

/** How each store derives a record's key. `null` means the caller supplies it. */
const KEY_PATHS: Record<string, string | string[] | null> = {
  doc: null,
  projects: "id",
  assets: "id",
  blobs: null,
  analyses: "assetId",
  events: ["projectId", "seq"],
  workflows: "id",
  mattes: null,
};

type Key = string | number | (string | number)[];

/** Stable, order-preserving encoding, so compound keys sort like IndexedDB's. */
function encode(key: Key): string {
  return JSON.stringify(Array.isArray(key) ? key : [key]);
}

function keyOf(store: string, value: any, explicit?: Key): Key {
  if (explicit !== undefined) return explicit;
  const path = KEY_PATHS[store];
  if (path === null || path === undefined) {
    throw new Error(`The ${store} store needs an explicit key.`);
  }
  return Array.isArray(path) ? path.map((p) => value[p]) : value[path];
}

/**
 * Range matching, by duck-typing rather than `instanceof IDBKeyRange` — the
 * whole point is that this runs where the IndexedDB globals may be missing.
 *
 * Every range this app builds is `bound([id, -Infinity], [id, Infinity])`:
 * every row belonging to one project. So comparing the leading component is
 * enough, and an unbounded range matches everything.
 */
function inRange(key: Key, range: any): boolean {
  if (!range) return true;
  const lower = range.lower, upper = range.upper;
  if (lower === undefined && upper === undefined) return true;
  const head = Array.isArray(key) ? key[0] : key;
  const lowerHead = Array.isArray(lower) ? lower[0] : lower;
  const upperHead = Array.isArray(upper) ? upper[0] : upper;
  if (lowerHead !== undefined && head < lowerHead) return false;
  if (upperHead !== undefined && head > upperHead) return false;
  return true;
}

export interface MemoryDb {
  readonly version: number;
  readonly objectStoreNames: { contains: (name: string) => boolean };
  get(store: string, key: Key): Promise<any>;
  getAll(store: string, range?: any): Promise<any[]>;
  getAllKeys(store: string, range?: any): Promise<Key[]>;
  put(store: string, value: any, key?: Key): Promise<void>;
  delete(store: string, key: Key): Promise<void>;
  transaction(names: string | string[], mode?: string): MemoryTx;
  close(): void;
}

interface MemoryTx {
  objectStore(name: string): MemoryStore;
  readonly done: Promise<void>;
}

interface MemoryStore {
  put(value: any, key?: Key): Promise<void>;
  delete(key: Key): Promise<void>;
  clear(): Promise<void>;
  getAll(range?: any): Promise<any[]>;
  openCursor(range?: any, direction?: string): Promise<{ value: any } | null>;
}

export function createMemoryDb(): MemoryDb {
  const stores = new Map<string, Map<string, { key: Key; value: any }>>();
  for (const name of Object.keys(KEY_PATHS)) stores.set(name, new Map());

  const of = (name: string) => {
    let store = stores.get(name);
    if (!store) stores.set(name, (store = new Map()));
    return store;
  };

  /** Sorted by encoded key, which matches IndexedDB's ordering for our keys. */
  const rows = (name: string, range?: any) =>
    [...of(name).entries()]
      .filter(([, row]) => inRange(row.key, range))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, row]) => row);

  const store = (name: string): MemoryStore => ({
    async put(value, key) {
      const k = keyOf(name, value, key);
      of(name).set(encode(k), { key: k, value });
    },
    async delete(key) {
      of(name).delete(encode(key));
    },
    async clear() {
      of(name).clear();
    },
    async getAll(range) {
      return rows(name, range).map((r) => r.value);
    },
    async openCursor(range, direction) {
      const found = rows(name, range);
      const row = direction === "prev" ? found.at(-1) : found[0];
      return row ? { value: row.value } : null;
    },
  });

  return {
    version: 0,
    objectStoreNames: { contains: (name) => stores.has(name) },
    async get(name, key) {
      return of(name).get(encode(key))?.value;
    },
    async getAll(name, range) {
      return rows(name, range).map((r) => r.value);
    },
    async getAllKeys(name, range) {
      return rows(name, range).map((r) => r.key);
    },
    async put(name, value, key) {
      await store(name).put(value, key);
    },
    async delete(name, key) {
      await store(name).delete(key);
    },
    transaction(names, _mode) {
      void names;
      void _mode;
      return { objectStore: store, done: Promise.resolve() };
    },
    close() {},
  };
}
