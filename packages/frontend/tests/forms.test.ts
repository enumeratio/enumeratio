// Every reference example's forms, as the printers and transpilers make them today, are the
// ones its implementations record pins (https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data §2): our `epsil`, `tex`, `notatio`
// `traditional` and `fullform`, and each other system's `in`. A printer or transpiler change
// shows up here as a data diff to commit, in the same PR. No kernel needed.

import { toFullForm } from "@enumeratio/formats/fullform";
import { loadReferenceData, PACKAGES } from "@enumeratio/reference/node";
import { fromWolfram, toWolfram } from "@enumeratio/wolfram";
import { expect, test } from "vite-plus/test";
import { fullFormBack, recordWithForms } from "../scripts/forms.ts";

const FIX = "regenerate: UPDATE_FORMS=1 node packages/frontend/scripts/collect-forms.ts";

const { heads } = loadReferenceData(PACKAGES);

// One head's printing, past the 5 s default on a CI runner: MinValue's TimeConstrained example
// takes seconds in InputForm (compute-engine's Epsil formatter re-lays out every level).
const HEAD_BUDGET_MS = 20_000;

// One test per head: all of them together take a minute on a CI runner.
test.each(heads.map((h) => [`${h.package}/${h.head}`, h] as const))(
  "%s pins the forms the printers make",
  (_, h) => {
    expect(recordWithForms(h.entry.examples, h.implementations), FIX).toEqual(h.implementations ?? {});
  },
  HEAD_BUDGET_MS,
);

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

// FullForm is the tree: read back, every example and every expected value is the expression
// it came from, uncanonicalised. Canonically, `e` and `i` become ExponentialE and the
// imaginary unit, so that comparison would not hold.
test("every example's FullForm reads back as the example", () => {
  const lossy: string[] = [];
  for (const { head, entry } of heads)
    for (const { id, expr, expected } of entry.examples)
      for (const json of [expr, expected])
        if (fullFormBack(json as never, toFullForm(json as never)) !== undefined) lossy.push(`${head}#${id}`);
  expect(lossy).toEqual([]);
});

// The vdom markup is FullForm: read back, every example is the expression it came from.
// A row in triage gets no forms, so it has no markup to read back.
test("every example's markup reads back as the example", () => {
  const lossy: string[] = [];
  for (const { head, entry, implementations } of heads) {
    const triage = new Set(entry.examples.filter((e) => e.role === "triage").map((e) => e.id));
    for (const [id, rows] of Object.entries(implementations ?? {}))
      if (!triage.has(id) && (rows["notatio"]?.in === undefined || rows["notatio"].back !== undefined))
        lossy.push(`${head}#${id}`);
  }
  expect(lossy).toEqual([]);
});
