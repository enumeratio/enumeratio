// Symbol-metadata step 4 (design/speculative/symbol-metadata.md), completed: `to-wolfram.ts`'s
// hand `HEADS` literal is gone; it reads a generated table instead (`wolfram-names-data.ts`,
// `packages/reference/scripts/collect-wolfram-names.ts`), rebuilt from every head's
// `names.wolfram` / `names.wolframIdentity` field -- `to-wolfram.ts` runs in the browser too,
// so it can't parse YAML at runtime. This pins that the generated table is current;
// `packages/notatio/tests/forms.test.ts` (unchanged by this migration -- 0 records rewritten
// on regen) is the proof `toWolfram`'s output over every reference example didn't move, and
// `packages/wolfram/tests/*` (also unchanged) is the proof for that package's own suite.

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

test("wolfram-names-data.ts is what the current records collect to", () => {
  expect(HEADS).toEqual(wolframFromYaml);
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
