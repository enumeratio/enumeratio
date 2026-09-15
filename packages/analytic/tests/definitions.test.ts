import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import type { Json } from "../src/bernoulli.ts";
import { DEFINITIONS } from "../src/definitions.ts";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// Three things about the definitions in src/definitions.ts:
//
//   1. each one AGREES with the kernel it documents — the differential oracle that stops a
//      second implementation from rotting (design/namespaces.md §6);
//   2. every head stays SYMBOLIC under evaluate() and produces a number only under N();
//   3. the derivatives attached to `Derivative` are the right ones.
//
// The definitions are series and quadratures, so they are held to a tolerance, not to
// equality. Exact values live in special-functions.test.ts.

const ce = new ComputeEngine();
declareAnalytic(ce);

type Expr = Json;
const box = (expr: Expr) => ce.box(expr as unknown as Parameters<ComputeEngine["box"]>[0]);
const num = (expr: Expr): number => box(expr).N().re;

/** `DEFINITIONS[head]` with each wildcard bound, in the order it first appears. */
function unfold(head: string, ...args: readonly Expr[]): Expr {
  const definition = DEFINITIONS[head];
  if (definition === undefined) throw new Error(`no definition for ${head}`);
  const order: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string" && node.startsWith("_") && !order.includes(node)) order.push(node);
    else if (Array.isArray(node)) for (const child of node) walk(child);
  };
  walk(definition);
  const bindings = Object.fromEntries(order.map((name, index) => [name, args[index]]));
  const substitute = (node: Json): Json =>
    typeof node === "string" && node in bindings
      ? (bindings[node] as Json)
      : Array.isArray(node)
        ? node.map(substitute)
        : node;
  return substitute(definition);
}

// --- The definition agrees with the kernel ------------------------------------------

// The infinite-series definitions are summed by compute-engine's own series evaluator, which
// only converges for an INTEGER order — `Sum (n+a)^{-5/2}` is left unevaluated. So the series
// heads are checked at integer orders; the non-integer orders are the kernel's alone, and the
// definition stands as the specification rather than as a second evaluator.
const AGREEMENT: readonly [string, readonly Expr[], number][] = [
  ["HurwitzZeta", [3, ["Rational", 1, 2]], 1e-11],
  ["HurwitzZeta", [4, 2], 1e-11],
  ["HurwitzZeta", [5, ["Rational", 1, 4]], 1e-8],
  ["LerchPhi", [0.5, 2, 1.5], 1e-11],
  ["LerchPhi", [["Rational", 1, 3], 3, 1], 1e-11],
  ["ClausenCl", [2, 1], 1e-11],
  ["ClausenCl", [3, 1], 1e-11],
  ["ClausenCl", [4, 2.5], 1e-11],
  ["LogGamma", [2.5], 1e-9],
  ["LogGamma", [7.25], 1e-8],
  ["LogBarnesG", [4], 1e-9],
  ["LogBarnesG", [2.5], 1e-9],
  ["BarnesG", [6], 1e-6],
  ["DirichletEta", [3], 1e-11],
  ["DirichletBeta", [3], 1e-11],
  ["DirichletL", [5, 2, 3], 1e-9],
  ["HarmonicNumber", [2.5], 1e-11],
  ["HarmonicNumber", [3], 1e-11], // exact at the integers too: ψ(n+1) + γ = H_n
];

for (const [head, args, tolerance] of AGREEMENT) {
  test(`${head}(${args.map((a) => JSON.stringify(a)).join(", ")}) matches its definition`, () => {
    const kernel = num([head, ...args]);
    expect(num(unfold(head, ...args))).toBeCloseTo(kernel, -Math.log10(tolerance));
  });
}

// --- Symbolic under evaluate, numeric under N ----------------------------------------

const GATED: readonly Expr[] = [
  ["HurwitzZeta", ["Rational", 5, 2], ["Rational", 1, 3]],
  ["LerchPhi", ["Rational", 1, 2], ["Rational", 5, 2], ["Rational", 1, 3]],
  ["BarnesG", ["Rational", 5, 2]],
  ["LogBarnesG", ["Rational", 5, 2]],
  ["LogGamma", ["Rational", 5, 3]],
  ["ClausenCl", 2, ["Rational", 1, 3]],
  ["DirichletEta", ["Rational", 1, 2]],
  ["DirichletBeta", ["Rational", 1, 2]],
  ["StieltjesGamma", 3, ["Rational", 1, 3]],
  ["HarmonicNumber", ["Rational", 5, 3]],
];

for (const expr of GATED) {
  const head = (expr as readonly Expr[])[0] as string;
  test(`${head} holds its form under evaluate and gives a number under N`, () => {
    expect(box(expr).evaluate().json).toEqual(box(expr).json);
    expect(Number.isFinite(num(expr))).toBe(true);
  });
}

// --- Derivatives ----------------------------------------------------------------------

/** d/dx f(x) at `at`, by central difference — an independent check on the closed form. */
const centralDifference = (f: (x: number) => Expr, at: number, h = 1e-5): number =>
  (num(f(at + h)) - num(f(at - h))) / (2 * h);

const DERIVATIVES: readonly [string, Expr, string, (x: number) => Expr, number][] = [
  ["LogGamma", ["LogGamma", "z"], "z", (x) => ["LogGamma", x], 2.5],
  ["LogBarnesG", ["LogBarnesG", "z"], "z", (x) => ["LogBarnesG", x], 2.5],
  ["BarnesG", ["BarnesG", "z"], "z", (x) => ["BarnesG", x], 2.5],
  ["HurwitzZeta in a", ["HurwitzZeta", 3, "a"], "a", (x) => ["HurwitzZeta", 3, x], 2],
  ["LerchPhi in a", ["LerchPhi", 0.5, 2, "a"], "a", (x) => ["LerchPhi", 0.5, 2, x], 1.5],
  ["ClausenCl in theta", ["ClausenCl", 2, "t"], "t", (x) => ["ClausenCl", 2, x], 1],
  ["ClausenCl odd order", ["ClausenCl", 3, "t"], "t", (x) => ["ClausenCl", 3, x], 1],
  ["HarmonicNumber", ["HarmonicNumber", "z"], "z", (x) => ["HarmonicNumber", x], 2.5],
];

for (const [label, expr, variable, at, point] of DERIVATIVES) {
  test(`d/d${variable} ${label} is symbolic and correct`, () => {
    const derivative = box(["D", expr, variable]).evaluate();
    expect(derivative.operator).not.toBe("Apply"); // not left as an inert Derivative
    const value = derivative.subs({ [variable]: point }).N().re;
    expect(value).toBeCloseTo(centralDifference(at, point), 6);
  });
}

test("LogGamma' is the digamma function, exactly", () => {
  expect(box(["D", ["LogGamma", "z"], "z"]).evaluate().json).toEqual(
    box(["PolyGamma", 0, "z"]).evaluate().json,
  );
});

test("a partial with no closed form stays an inert Derivative", () => {
  // ∂ₛζ(s, a) has none; the honest answer is the unevaluated form, not a wrong one.
  expect(box(["D", ["HurwitzZeta", "s", 2], "s"]).evaluate().operator).toBe("Apply");
});

test("the stock derivative table still works", () => {
  expect(box(["D", ["Sin", "x"], "x"]).evaluate().json).toEqual(["Cos", "x"]);
  expect(box(["D", ["Gamma", "z"], "z"]).evaluate().json).toEqual([
    "Multiply",
    ["Digamma", "z"],
    ["Gamma", "z"],
  ]);
});

// --- Arbitrary precision -------------------------------------------------------------

// The double-precision kernels top out around 1e-15. Where a head can be routed through a
// compute-engine native that carries bignums — Zeta, PolyGamma, GammaLn — N() is asked for
// more digits and gets them. A complex result never can: a compute-engine complex number is
// a pair of doubles.
const AT_40_DIGITS: readonly [Expr, string][] = [
  [["HurwitzZeta", 3, ["Rational", 1, 2]], "8.414398322117159997798167130580149935355"],
  [["Zeta", 3, ["Rational", 1, 2]], "8.414398322117159997798167130580149935355"],
  [["LerchPhi", 1, 3, ["Rational", 1, 2]], "8.414398322117159997798167130580149935355"],
  [["LogGamma", ["Rational", 5, 2]], "0.2846828704729191596324946696827019243201"],
  [["StieltjesGamma", 0, ["Rational", 5, 2]], "-0.7031566406452431872256903336679110994735"],
];

/** A fresh engine asked for 40 digits — more than a double can carry. */
const engine40 = (): ComputeEngine => {
  const engine = new ComputeEngine();
  declareAnalytic(engine);
  engine.precision = 40;
  return engine;
};
const box40 = (engine: ComputeEngine, expr: Expr) =>
  engine.box(expr as unknown as Parameters<ComputeEngine["box"]>[0]);
const at40 = (expr: Expr): unknown => box40(engine40(), expr).N().json;

for (const [expr, digits] of AT_40_DIGITS) {
  const head = (expr as readonly Expr[])[0] as string;
  test(`${head} answers N() to the engine's precision, not a double's`, () => {
    expect(at40(expr)).toEqual({ num: digits });
  });
}

// A NON-integer order has no polygamma to fall back on. It goes through the Euler–Maclaurin
// in precise.ts — the same series as the kernel, written as an expression so compute-engine's
// own arithmetic carries it — and the answer is rounded to the digits actually asked for.
test("a non-integer order answers with as many digits as were asked for", () => {
  const value = at40(["HurwitzZeta", ["Rational", 1, 2], ["Rational", 5, 4]]) as { num: string };
  expect(value.num.replace(/[-.]/g, "").replace(/^0+/, "").length).toBe(40);
});

test("the symbolic Euler–Maclaurin agrees with compute-engine's own Zeta", () => {
  // ζ(s, 1) = ζ(s) is routed to the native Zeta, so take the Euler–Maclaurin one step off
  // and shift it back: ζ(s, 2) = ζ(s) − 1.
  const engine = engine40();
  const half: Expr = ["Rational", 1, 2];
  const viaEulerMaclaurin = box40(engine, ["Add", ["HurwitzZeta", half, 2], 1]).N().re;
  expect(viaEulerMaclaurin).toBeCloseTo(box40(engine, ["Zeta", half]).N().re, 14);
});

test("plain evaluate() is untouched by the precise path", () => {
  const engine = engine40();
  const expr: Expr = ["HurwitzZeta", ["Rational", 5, 2], ["Rational", 1, 3]];
  expect(box40(engine, expr).evaluate().json).toEqual(box40(engine, expr).json);
});
