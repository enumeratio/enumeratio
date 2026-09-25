import { describe, expect, test } from "vite-plus/test";
import type { BacklogItem } from "./backlog.ts";
import { type LocalEntries, mergeAfterFlush, pendingFlush } from "./merge.ts";

function item(id: string, feedback = ""): BacklogItem {
  return { id, title: id, status: "open", bullets: [], feedback };
}

describe("pendingFlush", () => {
  test("returns only unsynced entries", () => {
    const local: LocalEntries = {
      a: { item: item("a", "synced already"), synced: true },
      b: { item: item("b", "not yet on disk"), synced: false },
    };
    expect(pendingFlush(local)).toEqual([item("b", "not yet on disk")]);
  });

  test("empty when everything is synced", () => {
    const local: LocalEntries = { a: { item: item("a"), synced: true } };
    expect(pendingFlush(local)).toEqual([]);
  });
});

describe("mergeAfterFlush", () => {
  test("file items win over a synced local copy of the same id", () => {
    const fileItems = [item("a", "from file")];
    const local: LocalEntries = { a: { item: item("a", "stale local copy"), synced: true } };
    expect(mergeAfterFlush(fileItems, local)).toEqual([item("a", "from file")]);
  });

  test("an unsynced local item not yet in the file is kept, not dropped", () => {
    const fileItems = [item("a")];
    const local: LocalEntries = { b: { item: item("b", "offline edit"), synced: false } };
    expect(mergeAfterFlush(fileItems, local)).toEqual([item("a"), item("b", "offline edit")]);
  });

  test("no duplicate ids: an unsynced local entry for an id already in the file is superseded", () => {
    const fileItems = [item("a", "already flushed by another tab")];
    const local: LocalEntries = { a: { item: item("a", "stale race"), synced: false } };
    const merged = mergeAfterFlush(fileItems, local);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(item("a", "already flushed by another tab"));
  });

  test("preserves items the file has that localStorage never knew about", () => {
    const fileItems = [item("a"), item("b")];
    expect(mergeAfterFlush(fileItems, {})).toEqual(fileItems);
  });
});
