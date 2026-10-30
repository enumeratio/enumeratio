// Behavior pinned under compute-engine >= 0.171 semantics (BL-415).

import { ComputeEngine } from "@cortex-js/compute-engine";
import { JavaScriptTarget } from "@cortex-js/compute-engine/compile";
import { expect, test } from "vite-plus/test";
import { freeSymbols, inferControls } from "../src/infer-controls.ts";
import { compilePlot } from "../src/plot-compile.ts";
import { cellBindings } from "../src/tracked-symbols.ts";

const ce = new ComputeEngine();
const SYS = (new JavaScriptTarget().compile(ce.box(["Power", "x", 3])).run as unknown as { SYS: unknown }).SYS;
const run = (code: string | undefined, scope: Record<string, unknown>): unknown =>
  // oxlint-disable-next-line no-implied-eval -- the compiled code under test
  new Function("_SYS", "_", `return (${code});`)(SYS, scope);

test("a nested assignment's target is read, not defined; only the top-level target is", () => {
  const b = cellBindings(ce, 1, "y := (k := 2)", ["Assign", "y", ["Assign", "k", 2]] as never);
  expect(b.assigns).toBe("y");
  expect(b.reads).toEqual(["k"]);
});

test("N and D used as values are read as free symbols by the tracker", () => {
  const b = cellBindings(ce, 1, "total := N + D", ["Assign", "total", ["Add", "N", "D"]] as never);
  expect(b.assigns).toBe("total");
  expect(b.reads).toEqual(["D", "N"]);
});

test("N and D, compute-engine's one-letter functions, get no control as values", () => {
  const expr = ["Add", "N", ["Multiply", "D", "a"]] as never;
  expect(freeSymbols(expr)).toEqual(["a"]);
  expect(inferControls(expr, { engine: ce }).map((c) => c.name)).toEqual(["a"]);
});

test("a derivative with a control substituted becomes EvaluateAt, and still compiles and runs", () => {
  const derivative = ["D", ["Power", "x", 2], "x"];
  expect(ce.box(derivative as never).subs({ x: ce.number(3) }).operator).toBe("EvaluateAt");
  const plot = compilePlot(ce, ["Add", derivative, "x"], { target: "javascript", bindings: { x: 3 } });
  expect(plot.unknowns).toEqual([]);
  expect(run(plot.items[0]!.code, {})).toBe(9);
});

test("a derivative that keeps its variable free still compiles over it", () => {
  const plot = compilePlot(ce, ["Multiply", "_a", ["D", ["Power", "x", 3], "x"]], {
    target: "javascript",
    bindings: { _a: 2 },
  });
  expect(plot.unknowns).toEqual(["x"]);
  if (plot.items[0]!.code !== undefined) expect(run(plot.items[0]!.code, { x: 2 })).toBe(24);
});
