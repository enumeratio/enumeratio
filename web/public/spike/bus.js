// Spike: IndexedDB as the kernel's store, BroadcastChannel as its doorbell. Shared by the page
// and the engines.
//
// - `inputs`: one record per call as written (version, format, text), with its status, its
//   progress, and once answered a pointer to its value record (or its value, when that isn't
//   kept).
// - `values`: one record per canonical expression, for answers worth keeping.

export const DB = "kernel-spike";
export const CHANNEL = "kernel-spike";
export const VERSION = "spike-2";

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

/** One read-write transaction over `stores`: `fn` gets them, and `done(v)` sets the result. */
export function rw(db, stores, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    let value;
    const handles = Object.fromEntries(stores.map((s) => [s, tx.objectStore(s)]));
    Promise.resolve(fn(handles, (v) => (value = v))).catch(reject);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const req = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
