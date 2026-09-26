// Before/after equivalence for symbol-metadata step 4 (design/speculative/symbol-metadata.md):
// `to-wolfram.ts`'s `HEADS` now also lives as `names.wolfram` / `names.wolframIdentity` on
// each head's <Head>.yaml (packages/reference/scripts/migrate/wolfram-heads-to-yaml.ts). This
// pins that the two agree while both exist; a follow-up commit deletes `HEADS`'s hand literal
// and this test switches to asserting `toWolfram`'s output is unchanged instead.

import { HEADS } from "@enumeratio/wolfram/src";
import { expect, test } from "vite-plus/test";
import { loadReferenceData, PACKAGES } from "../src/node.ts";

const { heads } = loadReferenceData(PACKAGES);

// Every head keeps at most one copy of `names.wolfram`/`wolframIdentity` -- reference's own
// when the head has two documenting packages (design/examples-as-data.md §9), so this reads
// every loaded head rather than `referenceData()`'s canonical-only view: the migration writes
// the canonical copy, and a stale duplicate copy would only show up here.
const wolframFromYaml: Record<string, string> = {};
for (const { head, entry } of heads) {
  const names = entry.names;
  if (!names) continue;
  if (names.wolfram !== undefined) wolframFromYaml[head] = names.wolfram;
  else if (names.wolframIdentity) wolframFromYaml[head] = head;
}

test("every HEADS entry is recorded as names.wolfram or names.wolframIdentity", () => {
  expect(wolframFromYaml).toEqual(HEADS);
});

test("wolfram and wolframIdentity are never both set", () => {
  for (const { head, entry } of heads) {
    if (entry.names?.wolfram !== undefined) expect(entry.names?.wolframIdentity, head).toBeUndefined();
  }
});

test("wolframIdentity is only true, never false", () => {
  for (const { head, entry } of heads) {
    if (entry.names?.wolframIdentity !== undefined) expect(entry.names.wolframIdentity, head).toBe(true);
  }
});
