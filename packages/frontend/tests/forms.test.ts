// Every reference example's forms, as the printers and transpilers make them today, agree with
// what its record pins (https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data §2):
// each other system's `in`, and our own forms' snapshots in examples.tsv -- any pinned `in` or
// `out`, and every `back`/`backOut`, the round trips that lose something. A printer or
// transpiler change shows up here as a data diff to commit, in the same PR. No kernel needed.

import { loadReferenceData, PACKAGES } from "@enumeratio/reference/node";
import { fromWolfram, toWolfram } from "@enumeratio/wolfram";
import { expect, test } from "vite-plus/test";
import { headForms, recordWithForms } from "../scripts/forms.ts";

const FIX = "regenerate: UPDATE_FORMS=1 node packages/frontend/scripts/collect-forms.ts";

const { heads } = loadReferenceData(PACKAGES);

// One head's printing, past the 5 s default on a CI runner: MinValue's TimeConstrained example
// takes seconds in InputForm (compute-engine's Epsil formatter re-lays out every level).
const HEAD_BUDGET_MS = 20_000;

// One test per head: all of them together take a minute on a CI runner.
test.each(heads.map((h) => [`${h.package}/${h.head}`, h] as const))(
  "%s pins the forms the printers make",
  (_, h) => {
    const forms = headForms(h.entry.examples);
    expect(recordWithForms(h.entry.examples, h.implementations, forms), FIX).toEqual(h.implementations ?? {});
  },
  HEAD_BUDGET_MS,
);

// FullForm is the tree and the markup is FullForm as JSX: each reads back as the expression
// it came from, `in` as the example and `out` as its result, so no record pins a loss for
// them. (FullForm compares uncanonicalised: canonically, `e` and `i` become ExponentialE and
// the imaginary unit.)
test("FullForm and markup read back exactly", () => {
  const lossy: string[] = [];
  for (const { head, implementations } of heads)
    for (const [id, rows] of Object.entries(implementations ?? {}))
      for (const form of ["fullform", "notatio"])
        if (rows[form]?.back !== undefined || rows[form]?.backOut !== undefined) lossy.push(`${head}#${id} ${form}`);
  expect(lossy).toEqual([]);
});

// A transpiler that stopped emitting, or a reader that stopped reading, would show here first.
test("most examples make the trip to Wolfram and back exactly", () => {
  let exact = 0;
  for (const { entry } of heads)
    for (const { expr } of entry.examples) {
      try {
        if (JSON.stringify(fromWolfram(toWolfram(expr as never))) === JSON.stringify(expr)) exact++;
      } catch {
        // a head with no Wolfram spelling
      }
    }
  expect(exact).toBeGreaterThan(3500);
});
