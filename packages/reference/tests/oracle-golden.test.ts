import { DIVERGENCE_KINDS, emit } from "@enumeratio/oracle/src";
import { expect, test } from "vite-plus/test";
import { entryFiles, oracleSidecars } from "../src/index.ts";

// The goldens a scan (scripts/oracle-scan.ts) writes: one `<stem>.oracle.json` sidecar per
// entries file. Not regenerated here — that needs a kernel — so these are consistency
// checks: every disagreement carries a real classification, every sidecar row still
// describes a current example, and a Wolfram row's `input` is what we'd still emit today.

// Keyed by stem AND head: a head name isn't unique across domains (`IntegerDigits`
// documents both compute-engine's own head, in number-theory, and the numeral-system
// widening, in numerals) but a stem's own entries are exactly what its sidecar keys against.
const KEYS_BY_STEM_HEAD = new Map<string, Set<string>>();
for (const { stem, entries } of entryFiles) {
  for (const entry of entries) {
    const keys = new Set(
      entry.examples
        .filter((example) => example.aspirational !== true)
        .map((example) => JSON.stringify(example.expr)),
    );
    KEYS_BY_STEM_HEAD.set(`${stem}::${entry.name}`, keys);
  }
}

test("every disagreement is classified, with a note", () => {
  for (const [stem, sidecar] of Object.entries(oracleSidecars)) {
    for (const [head, byKey] of Object.entries(sidecar.examples ?? {})) {
      for (const [key, bySystem] of Object.entries(byKey)) {
        for (const [system, row] of Object.entries(bySystem)) {
          if (row.verdict !== "disagree") continue;
          const label = `${stem}/${head} ${key} (${system})`;
          expect(row.kind, label).not.toBe("unclassified");
          expect(Object.keys(DIVERGENCE_KINDS), label).toContain(row.kind);
          expect((row.note ?? "").length, label).toBeGreaterThan(20);
        }
      }
    }
  }
});

test("every sidecar row still describes a current, non-aspirational example", () => {
  for (const [stem, sidecar] of Object.entries(oracleSidecars)) {
    for (const [head, byKey] of Object.entries(sidecar.examples ?? {})) {
      const keys = KEYS_BY_STEM_HEAD.get(`${stem}::${head}`);
      for (const key of Object.keys(byKey)) {
        expect(keys?.has(key), `${stem}/${head} ${key}`).toBe(true);
      }
    }
  }
});

test("a Wolfram disagree row's example has divergence.wolfram prose, and a live input", () => {
  for (const { entries } of entryFiles) {
    for (const entry of entries) {
      for (const example of entry.examples) {
        const row = example.others?.wolfram;
        if (row === undefined || row.verdict !== "disagree") continue;
        const label = `${entry.name} ${JSON.stringify(example.expr)}`;
        expect(example.divergence?.wolfram, label).toBeTruthy();
        expect(emit(example.expr, "wolfram"), label).toEqual({ ok: true, source: row.input });
      }
    }
  }
});

// A scan that produced nothing readable would be a broken kernel, not a golden.
test("the corpus has substantial Wolfram agreement", () => {
  let agree = 0;
  for (const { entries } of entryFiles) {
    for (const entry of entries) {
      for (const example of entry.examples) {
        if (example.others?.wolfram?.verdict === "agree") agree++;
      }
    }
  }
  expect(agree).toBeGreaterThan(600);
});
