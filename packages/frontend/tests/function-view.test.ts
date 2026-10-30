// The function view each numeric head implies: golden JSON compared with `toEqual` (AGENTS.md),
// regenerated with `UPDATE_FUNCTION_VIEW=1 vp test` after an intended change. Pure data: the
// manifest's typed signatures in, the plot and controls out.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseExpression } from "@enumeratio/formats/expression";
import { parseParameters, SYMBOLS, winningOverload } from "@enumeratio/manifest";
import { expect, test } from "vite-plus/test";
import { functionViewOf, type FunctionSignature, type FunctionView, returnTypeOf } from "../src/function-view.ts";
import { inferPlotOver, numericDomainOf } from "../src/infer-controls.ts";

/** Every head with a numeric result: its view, or none where it has no numeric argument. */
const views = new Map<string, FunctionView>();
for (const info of Object.values(SYMBOLS)) {
  const type = winningOverload(info.overloads)?.type;
  const parameters = type === undefined ? undefined : parseParameters(type, info.params);
  if (type === undefined || parameters === undefined) continue;
  const signature: FunctionSignature = {
    head: info.name,
    parameters: parameters.map(({ name, type, optional, variadic }) => ({
      ...(name === undefined ? {} : { name }),
      type,
      optional,
      variadic,
    })),
    ...(returnTypeOf(type) === undefined ? {} : { returns: returnTypeOf(type) }),
  };
  const view = functionViewOf(signature, info);
  if (view !== undefined) views.set(info.name, view);
}

const GOLDEN = fileURLToPath(new URL("./function-view.golden.json", import.meta.url));
const updating = process.env.UPDATE_FUNCTION_VIEW === "1";

test("the function view of each numeric head", () => {
  const fresh = Object.fromEntries([...views].toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
  expect(fresh).toEqual(JSON.parse(readFileSync(GOLDEN, "utf8")));
});

// A head with a numeric argument and a numeric result has a view, or is here with the reason
// it cannot: each takes a structured argument (a distribution, list, function, algebra) that
// no control draws, so there is no head-applied-to-sliders to plot.
const NO_VIEW: Readonly<Record<string, string>> = {
  BellY: "argument xs of type list has no control",
  CentralMoment: "argument dist of type distribution has no control",
  CharacteristicFunction: "argument dist of type distribution has no control",
  Cumulant: "argument dist of type distribution has no control",
  DivisorSum: "argument f of type function has no control",
  Dual: "argument algebra of type clifford_algebra has no control",
  EvaluateForm: "argument form of type expression<QuadraticForm> has no control",
  FactorialMoment: "argument dist of type distribution has no control",
  HeckeT: "argument permutation of type list<integer> has no control",
  HypergeometricPFQ: "argument a of type list has no control",
  InterpolatingFunction: "argument p1 of type list<any> has no control",
  InverseCDF: "argument dist of type distribution has no control",
  Limit: "argument f of type function has no control",
  MeijerG: "argument p1 of type list has no control",
  Moment: "argument dist of type distribution has no control",
  MomentGeneratingFunction: "argument dist of type distribution has no control",
  MultiplicativeOrder: "argument a of type value has no control",
  NIntegrate: "argument f of type function has no control",
  NLimit: "argument p1 of type function has no control",
  OrbitInventory: "argument p2 of type list has no control",
  PolynomialRoot: "argument p of type any has no control",
  QuiverCompose: "argument quiver of type expression<LinearQuiver> | expression<Quiver> | symbol has no control",
  QuiverPath: "argument arrows of type list<integer> has no control",
  QuiverPathEnd: "argument quiver of type expression<LinearQuiver> | expression<Quiver> | symbol has no control",
  SloaneA: "argument id of type string has no control",
  Series: "argument p1 of type expression has no control",
  Vee: "argument p3 of type clifford_algebra has no control",
};

test("every numeric head has a view or is allowed none, with its reason", () => {
  const bare = Object.fromEntries([...views].filter(([, v]) => v.views.length === 0).map(([h, v]) => [h, v.reason]));
  expect(bare).toEqual(NO_VIEW);
});

test("each view is a plot its axis's domain allows, over a body that parses", () => {
  for (const [head, view] of views) {
    for (const plot of view.views) {
      const over = inferPlotOver([plot.variable], {
        types: { [plot.variable]: plot.note === undefined ? view.axisDomain : "real" },
      });
      expect(plot.head, head).toBe(over?.head);
      for (const source of [plot.body, `Plot(${plot.body}, ${plot.window})`]) {
        expect(parseExpression(source).errors, `${head}: ${source}`).toEqual([]);
      }
    }
    if (view.params !== "") expect(parseExpression(`[${view.params.replaceAll("; ", ", ")}]`).errors, head).toEqual([]);
  }
});

test("the window is a range the axis's domain reads, and the record's wins", () => {
  for (const [head, view] of views) {
    if (view.views.length === 0) continue;
    expect(view.window.length, head).toBe(view.axisDomain === "complex" ? 4 : 2);
    expect(view.window[0]!, head).toBeLessThan(view.window[1]!);
  }
  const sig: FunctionSignature = { head: "F", parameters: [{ name: "a", type: "real" }], returns: "number" };
  expect(functionViewOf(sig)?.window).toEqual([-10, 10]);
  expect(functionViewOf(sig, { plot: { window: [0, 3] } })?.window).toEqual([0, 3]);
  expect(functionViewOf(sig, { plot: { window: [3, 0] } })?.window).toEqual([-10, 10]);
});

test("the axis is the last required numeric argument unless the record names one", () => {
  const sig: FunctionSignature = {
    head: "F",
    parameters: [
      { name: "s", type: "complex" },
      { name: "z", type: "complex" },
      { name: "w", type: "complex", optional: true },
    ],
    returns: "number",
  };
  expect(functionViewOf(sig)?.axis).toEqual({ name: "z", position: 1 });
  expect(functionViewOf(sig, { plot: { axis: "s" } })?.axis).toEqual({ name: "z", position: 0 });
  expect(functionViewOf(sig, { plot: { axis: "q" } })?.reason).toMatch(/plot\.axis/);
});

test("a head the complex emitter cannot lower is the real slice, with the reason", () => {
  const sig: FunctionSignature = { head: "F", parameters: [{ name: "z", type: "complex" }], returns: "number" };
  expect(functionViewOf(sig)?.views.map((v) => v.head)).toEqual(["ComplexPlot", "Plot"]);
  const reduced = functionViewOf(sig, undefined, { lowers: () => false });
  expect(reduced?.views.map((v) => v.head)).toEqual(["Plot"]);
  expect(reduced?.reason).toMatch(/cannot lower/);
});

test("a result that is not a number has no view", () => {
  expect(returnTypeOf("(integer) -> boolean")).toBe("boolean");
  expect(numericDomainOf("boolean")).toBeUndefined();
  expect(functionViewOf({ head: "F", parameters: [{ type: "integer" }], returns: "boolean" })).toBeUndefined();
});
