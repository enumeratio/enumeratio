import { OWN_FORMS as OWN_FORM_NAMES } from "@enumeratio/entry";
import { DIVERGENCE_KINDS, emit } from "@enumeratio/oracle";
import { expect, test } from "vite-plus/test";
import { referenceData, referenceEntries } from "../src/node.ts";

// The implementations records a scan (scripts/oracle-scan.ts) writes, one per head. Not
// regenerated here -- that needs a kernel -- so these are consistency checks: every row short
// of agreement carries a real classification, every row still describes a current example,
// and a Wolfram row's `in` is what we'd still emit today.

const data = referenceData();
const OWN_FORMS = new Set<string>(OWN_FORM_NAMES);
const entries = referenceEntries(data);
// The record the site shows for each head: the one beside the entry it chose.
const records = data.heads.filter((h) => h.implementations && data.packageOf.get(h.head) === h.package);

// A row waiting in triage is a mismatch no lane has classified yet: the checks below skip it.
const triageIds = (examples: readonly { id: string; role?: string }[]): Set<string> =>
  new Set(examples.filter((e) => e.role === "triage").map((e) => e.id));

// One assertion per test, over the failures collected: a row is checked about thirty thousand
// times, and an `expect` per row dominates the run. A failing test still names every offending row.
const explained = (row: { note?: string }): boolean => (row.note ?? "").length > 20;

test("every row that is not an agreement is classified, with a note", () => {
  const failures: string[] = [];
  for (const { head, entry, implementations } of records) {
    const triage = triageIds(entry.examples);
    for (const [id, bySystem] of Object.entries(implementations!)) {
      if (triage.has(id)) continue;
      for (const [system, row] of Object.entries(bySystem)) {
        const fail = (why: string) => failures.push(`${head}/${id} (${system}): ${why}`);
        if (row.tolerance !== undefined) {
          // A loosened comparison is a stated choice, so it is explained like a divergence.
          if (!(row.tolerance > 0 && row.tolerance < 1)) fail(`tolerance ${row.tolerance} is not in (0, 1)`);
          if (!explained(row)) fail("a tolerance needs a note");
        }
        // Ours means the other system is right, which is only acceptable with an issue open.
        if (row.kind === "ours") {
          if (!(Number.isInteger(row.issue) && row.issue! > 0)) fail("kind ours needs an issue");
        } else if (row.issue !== undefined) fail("an issue belongs to kind ours");
        // Our own forms, a transpiled `in` no kernel has answered yet, or an agreement.
        if (OWN_FORMS.has(system) || row.out === undefined) continue;
        if (row.verdict === undefined || row.verdict === "agree") continue;
        if (row.kind === "unclassified") fail("is unclassified");
        if (row.kind === undefined || !(row.kind in DIVERGENCE_KINDS))
          fail(`kind ${String(row.kind)} is not a divergence kind`);
        if (!explained(row)) fail("a divergence needs a note");
      }
    }
  }
  expect(failures).toEqual([]);
});

// `<system>.skip` in examples.tsv: the scan leaves the row out of that lane, so it holds no answer
// and no classification, only the reason.
test("a skipped row says why and holds no scan", () => {
  const failures: string[] = [];
  for (const { head, implementations } of records)
    for (const [id, bySystem] of Object.entries(implementations!))
      for (const [system, row] of Object.entries(bySystem)) {
        if (row.skip === undefined) continue;
        const fail = (why: string) => failures.push(`${head}/${id} (${system}): ${why}`);
        if (row.skip !== true) fail("skip is not true");
        if (OWN_FORMS.has(system)) fail("our own forms are not skipped");
        if (!explained(row)) fail("a skip needs a note");
        if ([row.out, row.verdict, row.kind].some((held) => held !== undefined)) fail("a skipped row holds no scan");
      }
  expect(failures).toEqual([]);
});

test("every scanned row still describes a current, non-aspirational example", () => {
  const stale: string[] = [];
  for (const { head, entry, implementations } of records) {
    const ids = new Set(entry.examples.filter((e) => e.role !== "aspirational").map((e) => e.id));
    for (const [id, rows] of Object.entries(implementations!))
      for (const [system, row] of Object.entries(rows))
        if (!OWN_FORMS.has(system) && row.out !== undefined && !ids.has(id)) stale.push(`${head}/${id} (${system})`);
  }
  expect(stale).toEqual([]);
});

test("a Wolfram disagree row has a note, and a live input", () => {
  for (const entry of entries) {
    for (const example of entry.examples) {
      const row = example.others?.wolfram;
      if (row === undefined || row.verdict !== "disagree" || example.role === "triage") continue;
      const label = `${entry.name} example/${example.id}`;
      expect(row.note, label).toBeTruthy();
      // `freeSymbols` (emit.ts) is present whenever the expression carries a free variable —
      // an extra, informational field alongside `ok`/`source`, not a live-input mismatch.
      expect(emit(example.expr, "wolfram"), label).toMatchObject({ ok: true, source: row.input });
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
