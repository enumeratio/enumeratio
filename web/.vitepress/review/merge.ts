// Pure merge/flush logic behind the localhost `FileSource` (see
// web/.vitepress/theme/review/fileSource.ts): reconciling items collected in
// localStorage (always-on, see localStorageSource.ts) with the file's own items.
// DOM/localStorage-free so it's unit-testable without mounting anything real.
import type { BacklogItem } from "./backlog.ts";

export interface LocalEntry {
  item: BacklogItem;
  /** Has this entry's current state made it into the file? Left `true` after a
   * successful flush rather than deleted -- see AGENTS.md's note on the "flush"
   * requirement: nothing local is ever silently dropped. */
  synced: boolean;
}

export type LocalEntries = Record<string, LocalEntry>;

/** Every locally-held item that hasn't been confirmed written to the file yet --
 * ad-hoc items created offline/on a since-stopped dev server, or an edit that raced
 * a save. Order doesn't matter; the caller flushes them one at a time. */
export function pendingFlush(local: LocalEntries): BacklogItem[] {
  return Object.values(local)
    .filter((e) => !e.synced)
    .map((e) => e.item);
}

/** The item list to show after a flush attempt: the file's own items (the source of
 * truth once synced), plus any local item that *still* isn't synced (e.g. the file
 * write failed) so it doesn't vanish from the panel while it waits for the next
 * flush. Never duplicates an id -- a synced local entry is superseded by the file's
 * copy of the same id. */
export function mergeAfterFlush(fileItems: BacklogItem[], local: LocalEntries): BacklogItem[] {
  const byId = new Map(fileItems.map((i) => [i.id, i] as const));
  for (const entry of Object.values(local)) {
    if (!entry.synced && !byId.has(entry.item.id)) byId.set(entry.item.id, entry.item);
  }
  return [...byId.values()];
}
