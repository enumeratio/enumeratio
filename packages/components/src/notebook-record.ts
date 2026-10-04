// A notebook's record (https://github.com/enumeratio/enumeratio/wiki/Speculative-Sessions-as-Data):
// its cells as the reader left them, kept in IndexedDB so a reload or another tab shows the
// same notebook. A notebook is reactive, so its state follows from its cells: the record holds
// sources, not a history, and the answers are worked out again from them.

/** One cell as kept: its stable id and its source. */
export interface RecordCell {
  readonly id: number;
  readonly value: string;
}

export interface NotebookRecord {
  /** Which notebook: its page and its place on it (`notebookKey`). */
  readonly key: string;
  readonly cells: readonly RecordCell[];
  /** The author's seed the reader started from, so a changed one can be offered (Reset). */
  readonly seed: string;
}

/** Where records are kept: IndexedDB in a browser, anything with the same shape in a test. */
export interface RecordStore {
  get(key: string): Promise<NotebookRecord | undefined>;
  put(record: NotebookRecord): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * A notebook's key: the page's path, and the notebook's `id` or else its position among the
 * page's notebooks. Position is enough for a guide whose notebooks don't move; an author who
 * reorders them gives each an `id`.
 */
export function notebookKey(path: string, id: string, index: number): string {
  return `${path}#${id === "" ? `notebook-${index}` : id}`;
}

/** The cells a notebook opens with: the reader's own when there's a record, else the seed's. */
export function openingCells(record: NotebookRecord | undefined, seeded: readonly string[]): RecordCell[] {
  if (record !== undefined && record.cells.length > 0) return [...record.cells];
  return seeded.map((value, i) => ({ id: i + 1, value }));
}

/** Whether `cells` (the trailing blank aside) are just the seed: then Reset has nothing to undo. */
export function isSeed(cells: readonly RecordCell[], seeded: readonly string[]): boolean {
  const filled = cells.at(-1)?.value.trim() === "" ? cells.slice(0, -1) : cells;
  return filled.length === seeded.length && filled.every((c, i) => c.value === seeded[i]);
}

const DB = "notatio-notebooks";
const STORE = "notebooks";

let opening: Promise<IDBDatabase> | undefined;
const open = (): Promise<IDBDatabase> =>
  (opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));

const run = <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
  open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const request = fn(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );

/** The browser's store, or `undefined` where there's no IndexedDB (a notebook then keeps nothing). */
export function browserStore(): RecordStore | undefined {
  if (typeof indexedDB === "undefined") return undefined;
  return {
    get: (key) => run("readonly", (s) => s.get(key) as IDBRequest<NotebookRecord | undefined>).catch(() => undefined),
    put: (record) => run("readwrite", (s) => s.put(record)).then(() => undefined),
    delete: (key) => run("readwrite", (s) => s.delete(key)).then(() => undefined),
  };
}

/** Tells this origin's other tabs that a notebook's record changed. */
export const RECORD_CHANNEL = "notatio-notebooks";
