// A plot's expression compiled to source a page runs with no engine: the code reads its
// variables and wildcards from the scope `_`, and compute-engine's helpers from `_SYS`.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { JavaScriptTarget } from "@cortex-js/compute-engine/compile";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "@enumeratio/analytic";
import { compilePlot } from "../src/plot-compile.ts";

const ce = new ComputeEngine();
const SYS = (new JavaScriptTarget().compile(ce.box(["Power", "x", 3])).run as unknown as { SYS: unknown }).SYS;
const run = (code: string | undefined, scope: Record<string, unknown>): unknown =>
  // oxlint-disable-next-line no-implied-eval -- the compiled code under test
  new Function("_SYS", "_", `return (${code});`)(SYS, scope);

test("a curve compiles to code over its variable, and a wildcard is read from the scope", () => {
  const plot = compilePlot(ce, ["Add", ["Power", "x", 3], ["Multiply", "_a", ["Sin", "x"]]], { target: "javascript" });
  expect(plot.unknowns).toEqual(["_a", "x"]);
  expect(plot.list).toBe(false);
  const [item] = plot.items;
  expect(run(item!.code, { x: 2, _a: 0 })).toBe(8);
  expect(run(item!.code, { x: Math.PI / 2, _a: 3 })).toBeCloseTo(Math.PI ** 3 / 8 + 3);
});

test("each element of a list compiles on its own, and a pair of numbers is a point", () => {
  const curves = compilePlot(ce, ["List", ["Sin", "x"], ["Cos", "x"]], { target: "javascript", each: true });
  expect(curves.list).toBe(true);
  expect(curves.items.map((i) => run(i.code, { x: 0 }))).toEqual([0, 1]);
  const data = compilePlot(ce, ["List", ["List", 1, 2], ["List", 3, ["Sqrt", 4]]], {
    target: "javascript",
    each: true,
  });
  expect(data.items.map((i) => i.point)).toEqual([
    [1, 2],
    [3, 2],
  ]);
});

test("a surface compiles to a WGSL plotFn over its two variables, its wildcards compiled in", () => {
  const plot = compilePlot(ce, ["Multiply", "_k", "x", "y"], { target: "wgsl", vars: ["x", "y"], bindings: { _k: 2 } });
  expect(plot.unknowns).toEqual(["x", "y"]);
  expect(plot.items[0]!.code).toMatch(/fn plotFn\(x: f32, y: f32\) -> f32 \{ return .*2.*; \}/);
});

test("a plot of Sin(x) compiles to Math.sin on an engine with analytic declared", () => {
  const withAnalytic = new ComputeEngine();
  declareAnalytic(withAnalytic);
  const plot = compilePlot(withAnalytic, ["Sin", "x"], { target: "javascript" });
  expect(plot.items[0]?.code).toBe("Math.sin(_.x)");
});
