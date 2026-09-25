// Every reference example's forms, as the printers and transpilers make them today, are the
// ones its implementations record pins (design/examples-as-data.md §2): our `epsil`, `tex`
// and `traditional`, each other system's `in`, and Wolfram's `back` wherever `in` doesn't
// read back as the example. A printer or transpiler change shows up here as a data diff to
// commit, in the same PR. No kernel needed.

import { isDeepStrictEqual } from "node:util";
import { loadReferenceData, PACKAGES } from "@enumeratio/reference/node";
import { expect, test } from "vite-plus/test";
import { recordWithForms } from "../scripts/forms.ts";

const FIX = "regenerate: UPDATE_FORMS=1 node packages/notatio/scripts/collect-forms.ts";

const { heads } = loadReferenceData(PACKAGES);

test("every record pins the forms the printers and transpilers make", () => {
  const stale = heads
    .filter((h) => !isDeepStrictEqual(recordWithForms(h.entry.examples, h.implementations), h.implementations ?? {}))
    .map((h) => h.head);
  expect(stale, FIX).toEqual([]);
});

test("the Wolfram round trip is exact for all but a few", () => {
  let exact = 0;
  let lossy = 0;
  for (const { implementations } of heads)
    for (const rows of Object.values(implementations ?? {}))
      if (rows["wolfram"]?.in) rows["wolfram"].back === undefined ? exact++ : lossy++;
  // Each `back` is a head with no Wolfram of its own to reverse from; the records list them.
  expect(exact).toBeGreaterThan(2500);
  expect(lossy / (exact + lossy)).toBeLessThan(0.1);
});
