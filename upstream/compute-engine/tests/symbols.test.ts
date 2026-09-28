import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { PATCHES, patchSymbols, symbols } from "../src/index.ts";

// Every patch's heads are cheap to list -- no engine needed (design/upstreaming.md §10). For
// a plain-record patch that's just `Object.keys(patch.library)`; for a function-form patch
// (one that captures a native handler) the manifest states `heads` explicitly, since the
// function's keys aren't knowable without an engine.

test("a function-form patch's `heads` matches the keys its library function actually returns", () => {
  const ce = new ComputeEngine();
  for (const patch of PATCHES) {
    if (typeof patch.library !== "function") continue;
    expect(patch.heads, patch.id).toBeDefined();
    const returned = Object.keys(patch.library(ce)).sort();
    expect(returned, patch.id).toEqual([...patch.heads!].sort());
  }
});

test("symbols() is the union of every patch's heads", () => {
  const union = new Set(PATCHES.flatMap((p) => patchSymbols(p)));
  expect(new Set(symbols())).toEqual(union);
});

test("every patch declares at least one head", () => {
  for (const patch of PATCHES) expect(patchSymbols(patch).length, patch.id).toBeGreaterThan(0);
});
