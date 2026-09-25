import { expect, test } from "vite-plus/test";
import { catalogPlan, planned } from "../src/generate.ts";
import { generateWolfram } from "../src/generators/wolfram.ts";
import { PROTOCOL } from "../src/protocol.ts";

const plan = catalogPlan();
const script = generateWolfram(plan)["bench.wl"] as string;

test("every planned case is in the script, held", () => {
  for (const c of planned(plan, "wolfram")) expect(script).toContain(`"${c.name}" -> <|`);
  expect(script).not.toMatch(/"calls" -> \{[^}]*ToExpression/);
});

test("the protocol numbers are embedded, not restated", () => {
  expect(script).toContain(`"samples" -> ${PROTOCOL.samples}`);
  expect(script).toContain(`"minSampleMs" -> ${PROTOCOL.minSampleMs}`);
});

test("machine-precision cases keep long decimals at machine precision", () => {
  expect(script).toMatch(/HurwitzZeta\[2\.5`, 0\.3`\]/);
  expect(script).not.toMatch(/Gamma\[\d+\.\d{15,}\]/);
});
