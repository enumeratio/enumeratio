import { DIVERGENCE_KINDS, emit } from "@enumeratio/oracle/src";
import { expect, test } from "vite-plus/test";
import { referenceData, referenceEntries } from "../src/node.ts";

// The implementations records a scan (scripts/oracle-scan.ts) writes, one per head. Not
// regenerated here -- that needs a kernel -- so these are consistency checks: every row short
// of agreement carries a real classification, every row still describes a current example,
// and a Wolfram row's `in` is what we'd still emit today.

const data = referenceData();
const entries = referenceEntries(data);
// The record the site shows for each head: the one beside the entry it chose.
const records = data.heads.filter((h) => h.implementations && data.packageOf.get(h.head) === h.package);

test("every row that is not an agreement is classified, with a note", () => {
  for (const { head, implementations } of records) {
    for (const [id, bySystem] of Object.entries(implementations!)) {
      for (const [system, row] of Object.entries(bySystem)) {
        const label = `${head}/${id} (${system})`;
        if (row.tolerance !== undefined) {
          // A loosened comparison is a stated choice, so it is explained like a divergence.
          expect(row.tolerance, label).toBeGreaterThan(0);
          expect(row.tolerance, label).toBeLessThan(1);
          expect((row.note ?? "").length, label).toBeGreaterThan(20);
        }
        // Ours means the other system is right, which is only acceptable with an issue open.
        if (row.kind === "ours") expect(Number.isInteger(row.issue) && row.issue! > 0, label).toBe(true);
        else expect(row.issue, label).toBeUndefined();
        // Unscanned (a note about a system the scan can't reach), or an agreement.
        if (row.out === undefined) {
          expect((row.note ?? "").length, label).toBeGreaterThan(20);
          continue;
        }
        if (row.verdict === undefined || row.verdict === "agree") continue;
        expect(row.kind, label).not.toBe("unclassified");
        expect(Object.keys(DIVERGENCE_KINDS), label).toContain(row.kind);
        expect((row.note ?? "").length, label).toBeGreaterThan(20);
      }
    }
  }
});

test("every row still describes a current, non-aspirational example", () => {
  for (const { head, entry, implementations } of records) {
    const ids = new Set(entry.examples.filter((e) => e.aspirational !== true).map((e) => e.id));
    for (const id of Object.keys(implementations!)) expect(ids.has(id), `${head}/${id}`).toBe(true);
  }
});

test("a Wolfram disagree row has a note, and a live input", () => {
  for (const entry of entries) {
    for (const example of entry.examples) {
      const row = example.others?.wolfram;
      if (row === undefined || row.verdict !== "disagree") continue;
      const label = `${entry.name} example/${example.id}`;
      expect(row.note, label).toBeTruthy();
      expect(emit(example.expr, "wolfram"), label).toEqual({ ok: true, source: row.input });
    }
  }
});

// A scan that produced nothing readable would be a broken kernel, not a golden.
test("the corpus has substantial Wolfram agreement", () => {
  let agree = 0;
  for (const entry of entries)
    for (const example of entry.examples) if (example.others?.wolfram?.verdict === "agree") agree++;
  expect(agree).toBeGreaterThan(600);
});
