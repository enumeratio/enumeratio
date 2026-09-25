// Localhost BacklogSource: the dev plugin's REVIEW.md file is the one source of
// truth (see AGENTS.md), but localStorage is still always written first (via
// localStorage.ts) so an edit is never lost to a dropped request or a dev server that
// stopped mid-session. `load()` flushes anything still-unsynced into the file before
// resolving, merging by id -- see ../../review/merge.ts for the pure logic.
import { mergeAfterFlush, pendingFlush } from "../../review/merge.ts";
import { markLocalSynced, putLocalEntry, readLocalEntries } from "./localStorage.ts";
import type { BacklogSource } from "./source.ts";
import { httpBacklogSource } from "./source.ts";

async function flushLocal(): Promise<void> {
  for (const item of pendingFlush(readLocalEntries())) {
    try {
      const saved = await httpBacklogSource.createItem(item);
      markLocalSynced(item.id, saved);
    } catch {
      // Server unreachable or the write failed -- stays unsynced, retried on the
      // next load (including the one triggered by the next onChange event).
    }
  }
}

export const fileSource: BacklogSource = {
  async load() {
    await flushLocal();
    const backlog = await httpBacklogSource.load();
    return { ...backlog, items: mergeAfterFlush(backlog.items, readLocalEntries()) };
  },
  async save(item) {
    putLocalEntry(item, false);
    const updated = await httpBacklogSource.save(item);
    markLocalSynced(item.id, updated);
    return updated;
  },
  async createItem(item) {
    putLocalEntry(item, false);
    const updated = await httpBacklogSource.createItem(item);
    markLocalSynced(item.id, updated);
    return updated;
  },
  onChange(cb) {
    return httpBacklogSource.onChange(cb);
  },
};
