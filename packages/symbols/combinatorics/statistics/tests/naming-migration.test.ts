// Symbol-metadata step 3 (design/speculative/symbol-metadata.md), completed: naming.ts's
// RENAMED is gone; `blessedName` reads a generated table instead (naming-data.ts), rebuilt
// from every head's `formerly:` field by scripts/collect-naming.ts -- naming.ts runs in the
// browser too, so it can't parse YAML at runtime. This pins that the generated table is
// current; coverage.test.ts (unchanged by this migration) exercises `blessedName` itself.

import { readEntries } from "@enumeratio/entry/node";
import { expect, test } from "vite-plus/test";
import { RENAMED_DATA } from "../src/naming-data.ts";

// Mirrors collect-naming.ts's one hand-carried exception: StandardTableauCount is a
// cardinality answered by Count over a collection, not a head with a record of its own
// (cardinalities.ts), so its rename cannot come from a `formerly:` field.
const NO_HEAD: Readonly<Record<string, string>> = { NumberOfStandardTableaux: "StandardTableauCount" };

test("naming-data.ts is what the current records collect to", () => {
  const entries = readEntries(new URL("../reference/", import.meta.url));
  const rebuilt: Record<string, string> = { ...NO_HEAD };
  for (const entry of entries) for (const oldName of entry.formerly ?? []) rebuilt[oldName] = entry.name;
  expect(RENAMED_DATA).toEqual(rebuilt);
});
