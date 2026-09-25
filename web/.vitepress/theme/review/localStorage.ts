// Thin localStorage IO for the review backlog, keyed by item id. The actual
// merge/flush decisions live in ../../review/merge.ts (DOM-free, unit-tested); this
// file only reads and writes the one JSON blob, wrapped in try/catch throughout --
// private browsing, quota, or blocked storage should degrade to "nothing persists",
// never throw into the caller.
import type { BacklogItem } from "../../review/backlog.ts";
import type { LocalEntries } from "../../review/merge.ts";

const KEY = "review:local-items";

export function readLocalEntries(): LocalEntries {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalEntries) : {};
  } catch {
    return {};
  }
}

function writeLocalEntries(entries: LocalEntries): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

/** Cache an item's current state, marking it synced or not. Called on every save --
 * including ones that also go to the file -- so feedback is always collected here
 * first (see AGENTS.md's LocalStorageSource requirement). */
export function putLocalEntry(item: BacklogItem, synced: boolean): void {
  const entries = readLocalEntries();
  entries[item.id] = { item, synced };
  writeLocalEntries(entries);
}

/** Mark an entry synced with the server's own (possibly slightly different, e.g.
 * reparsed) copy of the item, without deleting it -- see merge.ts's LocalEntry doc. */
export function markLocalSynced(id: string, item: BacklogItem): void {
  const entries = readLocalEntries();
  entries[id] = { item, synced: true };
  writeLocalEntries(entries);
}
