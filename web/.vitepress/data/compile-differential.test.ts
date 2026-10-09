// Compiled code against the interpreter on an engine with every library declared: where a head compiles,
// it must give what `.N()` gives, and where it can't (a generator, an operand the built-in lowering has no
// form for) it must fail to compile rather than compile to something else.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { JavaScriptTarget } from "@cortex-js/compute-engine/compile";
import { expect, test } from "vite-plus/test";
import { CATALOGUE } from "../theme/worker-catalogue.ts";
import { makeEngine } from "./prerender.ts";

type Sample = {
  readonly expr: unknown;
  readonly types?: Record<string, string>;
  readonly at?: Record<string, number>;
  /** `closed`: compiling must fail. Otherwise it may compile only to what `.N()` gives. */
  readonly closed?: boolean;
};

const SAMPLES: readonly Sample[] = [
  { expr: ["Sin", "x"], at: { x: 0.5 } },
  { expr: ["Gamma", "x"], at: { x: 0.5 } },
  { expr: ["Add", ["Sin", "x"], ["Multiply", 2, ["Cos", "x"]]], at: { x: 1.25 } },
  { expr: ["Ln", -2] },
  { expr: ["Ln", ["Rational", -3, 2]] },
  { expr: ["Arcsin", 2] },
  { expr: ["Arccos", ["Rational", 5, 2]] },
  { expr: ["Sin", ["Arccos", 2]] },
  { expr: ["Sign", ["Subtract", ["Multiply", 2, ["Cos", ["Divide", "Pi", 3]]], 1]] },
  { expr: ["Floor", ["Subtract", ["Multiply", 2, ["Cos", ["Divide", "Pi", 3]]], 1]] },
  { expr: ["GCD", ["Rational", 1, 2], ["Rational", 1, 3]] },
  { expr: ["Binomial", "n", "k"], types: { n: "integer", k: "integer" }, at: { n: 6, k: 2 } },
  { expr: ["Binomial", "n", "k"], at: { n: 2.5, k: 1.5 }, closed: true },
  { expr: ["BesselJ", 0, "x"], at: { x: 1.5 } },
  { expr: ["BesselJ", "n", "x"], at: { n: 0.5, x: 1.5 }, closed: true },
  { expr: ["Multiply", "i_1", "i_1"], at: { i_1: 1 }, closed: true },
  { expr: ["Conjugate", "i_1"], at: { i_1: 1 }, closed: true },
  { expr: ["Add", 1, ["Multiply", 2, "i_1"]], at: { i_1: 1 }, closed: true },
  { expr: ["Zeta", "s", "a"], at: { s: 2, a: 1 }, closed: true },
];

const numbers = (value: unknown): [number, number] | undefined => {
  if (typeof value === "number") return [value, 0];
  const complex = value as { re?: unknown; im?: unknown } | undefined;
  return typeof complex?.re === "number" && typeof complex.im === "number" ? [complex.re, complex.im] : undefined;
};

/** As the plot path compiles: free variables typed, `undefined` when the target refuses. */
function compileTyped(
  ce: ComputeEngine,
  expr: unknown,
  types: Record<string, string>,
): { run: (scope: Record<string, number>) => unknown } | undefined {
  ce.pushScope();
  try {
    for (const [name, type] of Object.entries(types)) ce.declare(name, type);
    const result = new JavaScriptTarget().compile(ce.box(expr as never)) as {
      success?: boolean;
      run?: (scope: Record<string, number>) => unknown;
    };
    return result.success === true && result.run !== undefined ? { run: result.run } : undefined;
  } catch {
    return undefined;
  } finally {
    ce.popScope();
  }
}

async function engine(): Promise<ComputeEngine> {
  const ce = await makeEngine();
  for (const library of CATALOGUE) await library.declare(ce);
  return ce;
}

test("compiled code agrees with the interpreter, or fails to compile", async () => {
  const ce = await engine();
  for (const { expr, types, at = {}, closed } of SAMPLES) {
    const names = Object.keys(at);
    const compiled = compileTyped(ce, expr, types ?? Object.fromEntries(names.map((name) => [name, "real"])));
    const label = JSON.stringify(expr);
    if (closed) {
      expect(compiled, `${label} must not compile`).toBeUndefined();
      continue;
    }
    if (compiled === undefined) continue;
    const value = ce
      .box(expr as never)
      .subs(Object.fromEntries(Object.entries(at).map(([name, v]) => [name, ce.number(v)])))
      .N();
    const interpreted: [number, number] = [value.re, value.im];
    const lowered = numbers(compiled.run(at)) ?? [NaN, NaN];
    expect(lowered[0], `${label} real part`).toBeCloseTo(interpreted[0], 9);
    expect(lowered[1], `${label} imaginary part`).toBeCloseTo(interpreted[1], 9);
  }
});

test("the common numeric heads do compile on that engine", async () => {
  const ce = await engine();
  for (const { expr, types, at = {} } of SAMPLES.slice(0, 3)) {
    const compiled = compileTyped(ce, expr, types ?? Object.fromEntries(Object.keys(at).map((name) => [name, "real"])));
    expect(compiled, JSON.stringify(expr)).toBeDefined();
  }
});
