// Every example's own TeX (as written and as evaluated, in StandardForm and TraditionalForm)
// typesets in KaTeX once `portableTeX` has rewritten compute-engine's MathLive-only commands:
// the reference page's cells draw them that way.

import { portableTeX } from "@enumeratio/formats/tex";
import { referenceData } from "@enumeratio/reference/node";
import katex from "katex";
import { expect, test } from "vite-plus/test";

test("every example's TeX typesets in KaTeX", { timeout: 60_000 }, () => {
  const failed: string[] = [];
  let typeset = 0;
  for (const { head, implementations } of referenceData().heads) {
    for (const [id, forms] of Object.entries(implementations ?? {})) {
      for (const system of ["tex", "traditional"] as const) {
        const form = forms[system];
        for (const latex of [form?.in, form?.out]) {
          if (!latex) continue;
          typeset++;
          try {
            katex.renderToString(portableTeX(latex), { throwOnError: true, strict: false });
          } catch (e) {
            failed.push(`${head}/${id} ${system}: ${latex} -- ${(e as Error).message.split("\n")[0]}`);
          }
        }
      }
    }
  }
  expect(typeset).toBeGreaterThan(10_000);
  expect(failed).toEqual([]);
});
