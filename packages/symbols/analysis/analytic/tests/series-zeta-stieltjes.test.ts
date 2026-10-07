// unstable: a bare engine to declare the analytic library against
import { ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// compute-engine's Series stops the Laurent series of Zeta at 1 after the constant; ours goes
// on with (-1)^k γ_k (s-1)^k / k!.

const ce = new ComputeEngine();
declareAnalytic(ce);

const series = (order?: number) =>
  ce.box(["Series", ["Zeta", "x"], "x", 1, ...(order === undefined ? [] : [order])] as never).evaluate();

test("Series of Zeta at 1 carries the Stieltjes constants through the requested order", () => {
  const text = JSON.stringify(series(3).json);
  expect(text).toContain('["StieltjesGamma",3]');
  expect(text).not.toContain('["StieltjesGamma",4]');
  expect(JSON.stringify(series().json)).toContain('["StieltjesGamma",5]');
  expect(JSON.stringify(series(0).json)).not.toContain("StieltjesGamma");
});

test("the truncated series approaches Zeta", () => {
  const normal = ce.box(["Normal", ["Series", ["Zeta", "x"], "x", 1, 3]] as never).evaluate();
  for (const s of [1.1, 0.9, 1.25]) {
    const approx = normal.subs({ x: ce.number(s) }).N().re;
    const exact = ce.box(["Zeta", s] as never).N().re;
    // The next term is γ_4 (s-1)^4 / 24, well under 1e-5 here.
    expect(approx, String(s)).toBeCloseTo(exact, 4);
  }
});
