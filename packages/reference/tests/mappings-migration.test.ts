// Symbol-metadata step 5 (design/speculative/symbol-metadata.md), completed: `mappings.ts`'s
// hand `MAPPINGS` literal is gone; it reads a generated table instead (mappings-data.ts,
// packages/reference/scripts/collect-mappings.ts), rebuilt from every head's `origin: mapped`
// `bindings:` rows -- `emit.ts` runs in the browser too, so it can't parse YAML at runtime.
// This pins that the generated table is current; packages/oracle/tests/emit.test.ts (unchanged
// by this migration) is the proof `emit`'s output over every mapped head didn't move, and the
// nightly oracle scan (untouched) is the proof for the live kernel comparisons.
//
// One `Mapping` row is a head, an optional arity, and a dict of per-system templates; the
// migration writes one `bindings:` row per system instead. This test regroups those rows back
// into the original shape (by head and arity) so the two can be compared directly.
//
// A `mapped` binding WITHOUT a `template` is a pre-existing hand-written aside (e.g. BarnesG's
// "wolfram / mpmath ... same normalisation" note) -- informal prose about a head MAPPINGS
// never covered, not one of this migration's rows -- so it is excluded from the regrouping.

import { type Mapping, MAPPINGS } from "@enumeratio/oracle/src";
import { expect, test } from "vite-plus/test";
import { loadReferenceData, PACKAGES } from "../src/node.ts";

const { heads } = loadReferenceData(PACKAGES);

const key = (head: string, arity: number | undefined): string => `${head}\0${arity ?? ""}`;

// Regroup every head's `mapped` bindings back into one Mapping row per (head, arity).
const rebuilt = new Map<string, Mapping>();
for (const { head, entry } of heads) {
  for (const b of entry.bindings ?? []) {
    if (b.origin !== "mapped" || b.template === undefined) continue;
    const k = key(head, b.arity);
    const row = rebuilt.get(k) ?? { head, arity: b.arity, emit: {} };
    (row.emit as Record<string, string>)[b.form] = b.template!;
    if (b.threadArg !== undefined) (row as { threadArg?: number }).threadArg = b.threadArg;
    if (b.note !== undefined) (row as { note?: string }).note = b.note;
    rebuilt.set(k, row);
  }
}

const original = new Map<string, Mapping>();
for (const m of MAPPINGS) original.set(key(m.head, m.arity), m);

test("mappings-data.ts is what the current records collect to", () => {
  const rebuiltNames = [...rebuilt.keys()].sort();
  const originalNames = [...original.keys()].sort();
  expect(rebuiltNames).toEqual(originalNames);
  for (const k of originalNames) {
    // arity/emit/threadArg/note only -- omit `head` (Mapping's own; every binding's is implied
    // by which record it lives on) so a missing/extra key shows up as a real mismatch.
    const { head: _h1, ...want } = original.get(k)!;
    const { head: _h2, ...got } = rebuilt.get(k)!;
    expect(got, k).toEqual(want);
  }
});

test("no head has a duplicate (form, arity) migration-generated mapped binding", () => {
  for (const { head, entry } of heads) {
    const seen = new Set<string>();
    for (const b of entry.bindings ?? []) {
      if (b.origin !== "mapped" || b.template === undefined) continue;
      const k = `${b.form} ${b.arity ?? ""}`;
      expect(seen.has(k), `${head}: duplicate ${k}`).toBe(false);
      seen.add(k);
    }
  }
});
