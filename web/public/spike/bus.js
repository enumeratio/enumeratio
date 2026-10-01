// Spike: IndexedDB as the kernel's store, BroadcastChannel as its doorbell. Shared by the page
// and the engines.
//
// - `inputs`: one record per call as written (version, format, text), with its status, its
//   owner and attempt, and once answered a pointer to its value record.
// - `values`: one record per canonical expression, for answers worth keeping.
//
// Everything goes in batches: a worker claims several calls in one transaction and writes
// their answers in one, a page submits what it asked for in a tick in one, and the watchdog
// reads every claimed call in one. Heartbeats go on the bell.

export const DB = "kernel-spike";
export const CHANNEL = "kernel-spike";
export const VERSION = "spike-3";

export function openDb() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => {
      const inputs = open.result.createObjectStore("inputs", { keyPath: "key" });
      inputs.createIndex("status", "status");
      open.result.createObjectStore("values", { keyPath: "key" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

/** One transaction over `stores`: `fn` gets them, and `done(v)` sets the result. */
export function tx(db, stores, fn, mode = "readwrite") {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let value;
    const handles = Object.fromEntries(stores.map((s) => [s, t.objectStore(s)]));
    Promise.resolve(fn(handles, (v) => (value = v))).catch(reject);
    t.oncomplete = () => resolve(value);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const req = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
