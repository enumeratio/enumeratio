// unstable: a bare engine to declare the analytic library against
import { ComputeEngine } from "@enumeratio/engine/unstable";
import { beforeEach, expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// PiecewiseExpand's step rewrites (piecewise-rewrites.ts). The forms are Wolfram's, checked
// against wolframscript; the values are checked here against plain JavaScript definitions of
// each function at sample points, boundaries included.

// A fresh engine per test: an inferred type on `x` (real, from a comparison) outlives its scope.
let ce: ComputeEngine;
beforeEach(() => {
  ce = new ComputeEngine();
  declareAnalytic(ce);
});

const expand = (fn: unknown, assumptions?: unknown) =>
  ce
    .box((assumptions === undefined ? ["PiecewiseExpand", fn] : ["PiecewiseExpand", fn, assumptions]) as never)
    .evaluate().json;

const head = (json: unknown): unknown => (Array.isArray(json) ? json[0] : json);

/** The Piecewise at a point: substitute and evaluate. */
const at = (pw: unknown, point: Record<string, number>): number => {
  const sub = Object.fromEntries(Object.entries(point).map(([name, v]) => [name, ce.number(v)]));
  return ce
    .box(pw as never)
    .subs(sub)
    .evaluate()
    .N().re;
};

const floor = Math.floor;
const ceil = Math.ceil;
const trunc = Math.trunc;
const roundEven = (x: number): number => {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
};
const frac = (x: number): number => x - floor(x);

interface Bounded {
  readonly fn: unknown[];
  readonly ref: (x: number) => number;
}
const staircases: Bounded[] = [
  { fn: ["Floor", "x"], ref: floor },
  { fn: ["Ceil", "x"], ref: ceil },
  { fn: ["Round", "x"], ref: roundEven },
  { fn: ["IntegerPart", "x"], ref: trunc },
  { fn: ["FractionalPart", "x"], ref: (x) => x - trunc(x) },
  { fn: ["Mod", "x", 3], ref: (x) => x - 3 * floor(x / 3) },
  { fn: ["Quotient", "x", 2], ref: (x) => floor(x / 2) },
  { fn: ["SawtoothWave", "x"], ref: frac },
  { fn: ["SquareWave", "x"], ref: (x) => (frac(x) < 0.5 ? 1 : -1) },
  {
    fn: ["TriangleWave", "x"],
    ref: (x) => {
      const t = frac(x);
      return t < 0.25 ? 4 * t : t < 0.75 ? 2 - 4 * t : 4 * t - 4;
    },
  },
];
const domains: [number, number, boolean, boolean][] = [
  [0, 3, true, true],
  [0, 3, false, false],
  [-2, 2, true, true],
  [-3, 0, true, true],
  [1, 4, false, true],
  [-2.5, 3.5, false, false],
];
const chain = ([lo, hi, loOpen, hiOpen]: [number, number, boolean, boolean]) =>
  loOpen === hiOpen
    ? [loOpen ? "Less" : "LessEqual", lo, "x", hi]
    : ["And", [loOpen ? "Less" : "LessEqual", lo, "x"], [hiOpen ? "Less" : "LessEqual", "x", hi]];
const gridIn = ([lo, hi, loOpen, hiOpen]: [number, number, boolean, boolean]): number[] => {
  const out: number[] = [];
  for (let k = Math.ceil(lo * 4); k <= Math.floor(hi * 4); k++) {
    const v = k / 4;
    if (!((loOpen && v === lo) || (hiOpen && v === hi))) out.push(v);
  }
  return out;
};

test("a bounded staircase is its function at every grid point of the domain, ends included", () => {
  for (const { fn, ref } of staircases) {
    for (const d of domains) {
      const pw = expand(fn, chain(d));
      expect(pw, `${JSON.stringify(fn)} on ${JSON.stringify(d)}`).not.toEqual(fn);
      for (const x of gridIn(d))
        expect(at(pw, { x }), `${JSON.stringify(fn)} on ${JSON.stringify(d)} at ${x}`).toBeCloseTo(ref(x), 12);
    }
  }
});

test("an assumption from an enclosing Assuming bounds the symbol too", () => {
  const viaAssuming = ce
    .box(["Assuming", ["Less", 0, "x", 3], ["PiecewiseExpand", ["Floor", "x"]]] as never)
    .evaluate().json;
  expect(viaAssuming).toEqual(expand(["Floor", "x"], ["Less", 0, "x", 3]));
});

test("a staircase is written in Wolfram's form: stretches in value order, the zero stretch the default", () => {
  expect(expand(["Floor", "x"], ["Less", 0, "x", 3])).toEqual([
    "Piecewise",
    ["List", ["List", 1, ["And", ["LessEqual", 1, "x"], ["Less", "x", 2]]], ["List", 2, ["LessEqual", 2, "x"]]],
    0,
  ]);
  // No zero stretch: the last one is the default, and says nothing.
  expect(expand(["Floor", "x"], ["Less", -3, "x", 0])).toEqual([
    "Piecewise",
    ["List", ["List", -3, ["Less", "x", -2]], ["List", -2, ["And", ["LessEqual", -2, "x"], ["Less", "x", -1]]]],
    -1,
  ]);
  // Fractional part goes from the top down, the lowest stretch the default.
  expect(expand(["FractionalPart", "x"], ["LessEqual", 0, "x", 2])).toEqual([
    "Piecewise",
    [
      "List",
      ["List", ["Add", "x", -2], ["LessEqual", 2, "x"]],
      ["List", ["Add", "x", -1], ["And", ["LessEqual", 1, "x"], ["Less", "x", 2]]],
    ],
    "x",
  ]);
});

test("a staircase over one stretch is that stretch's value", () => {
  expect(expand(["Floor", "x"], ["Less", 0, "x", 1])).toBe(0);
  expect(expand(["Ceil", "x"], ["Less", 0, "x", 1])).toBe(1);
});

test("a staircase is left alone with no two-sided bound, from a span of 100, or over a non-symbol", () => {
  for (const assumptions of [
    ["Less", 0, "x"],
    ["Less", "x", 3],
    ["Element", "x", "RealNumbers"],
    ["Less", 0, "x", 100],
  ]) {
    expect(expand(["Floor", "x"], assumptions), JSON.stringify(assumptions)).toEqual(["Floor", "x"]);
  }
  expect(head(expand(["Floor", "x"], ["Less", 0, "x", 99]))).toBe("Piecewise");
  expect(expand(["Floor", ["Power", "x", 2]], ["Less", 0, "x", 2])).toEqual(["Floor", ["Power", "x", 2]]);
  // A modulus other than an integer is not expanded.
  expect(expand(["Mod", "x", ["Rational", 3, 2]], ["LessEqual", 0, "x", 4])).toEqual(["Mod", "x", ["Rational", 3, 2]]);
});

const rationals = [-3, -1, -0.5, 0, 0.5, 2, 3.5];

interface Many {
  readonly fn: unknown[];
  readonly vars: string[];
  readonly ref: (v: Record<string, number>) => number;
}
const clipRef = (x: number, lo: number, hi: number, below = lo, above = hi): number =>
  x < lo ? below : x > hi ? above : x;
const many: Many[] = [
  { fn: ["Max", "x", "y"], vars: ["x", "y"], ref: (v) => Math.max(v.x, v.y) },
  { fn: ["Min", "x", "y", "z"], vars: ["x", "y", "z"], ref: (v) => Math.min(v.x, v.y, v.z) },
  { fn: ["Max", "y", 2, "x"], vars: ["x", "y"], ref: (v) => Math.max(v.x, v.y, 2) },
  { fn: ["Max", "x", "y", 0], vars: ["x", "y"], ref: (v) => Math.max(v.x, v.y, 0) },
  { fn: ["Min", ["Add", "x", 1], "y"], vars: ["x", "y"], ref: (v) => Math.min(v.x + 1, v.y) },
  { fn: ["Max", "x", "Pi"], vars: ["x"], ref: (v) => Math.max(v.x, Math.PI) },
  { fn: ["UnitStep", "x", "y"], vars: ["x", "y"], ref: (v) => (v.x >= 0 && v.y >= 0 ? 1 : 0) },
  { fn: ["UnitStep", ["Subtract", ["Multiply", 2, "x"], 3]], vars: ["x"], ref: (v) => (2 * v.x - 3 >= 0 ? 1 : 0) },
  { fn: ["UnitStep", ["Subtract", "x", "y"]], vars: ["x", "y"], ref: (v) => (v.x - v.y >= 0 ? 1 : 0) },
  { fn: ["Clip", "x"], vars: ["x"], ref: (v) => clipRef(v.x, -1, 1) },
  {
    fn: ["Clip", "x", ["List", "a", "b"]],
    vars: ["x", "a", "b"],
    ref: (v) => (v.a > v.b ? NaN : clipRef(v.x, v.a, v.b)),
  },
  { fn: ["Clip", "x", ["List", 0, 1], ["List", 5, 7]], vars: ["x"], ref: (v) => clipRef(v.x, 0, 1, 5, 7) },
  { fn: ["Clamp", "x", "a", "b"], vars: ["x", "a", "b"], ref: (v) => (v.a > v.b ? NaN : clipRef(v.x, v.a, v.b)) },
  { fn: ["UnitBox", ["Subtract", "x", 1]], vars: ["x"], ref: (v) => (Math.abs(v.x - 1) <= 0.5 ? 1 : 0) },
  { fn: ["UnitBox", "x", "y"], vars: ["x", "y"], ref: (v) => (Math.abs(v.x) <= 0.5 && Math.abs(v.y) <= 0.5 ? 1 : 0) },
  { fn: ["UnitTriangle", ["Multiply", -2, "x"]], vars: ["x"], ref: (v) => Math.max(0, 1 - Math.abs(2 * v.x)) },
];

function* points(vars: string[]): Generator<Record<string, number>> {
  const rec = function* (i: number, acc: Record<string, number>): Generator<Record<string, number>> {
    if (i === vars.length) yield { ...acc };
    else for (const v of rationals) yield* rec(i + 1, { ...acc, [vars[i]]: v });
  };
  yield* rec(0, {});
}

test("Min, Max, UnitStep, Clip, UnitBox and UnitTriangle match their values, and need no assumption", () => {
  for (const { fn, vars, ref } of many) {
    const pw = expand(fn);
    expect(JSON.stringify(pw), JSON.stringify(fn)).toContain("Piecewise");
    for (const point of points(vars)) {
      const want = ref(point);
      if (Number.isNaN(want)) continue;
      expect(at(pw, point), `${JSON.stringify(fn)} at ${JSON.stringify(point)}`).toBeCloseTo(want, 12);
    }
  }
});

test("Min and Max are written as Wolfram writes them", () => {
  expect(expand(["Max", "x", "y"])).toEqual([
    "Piecewise",
    ["List", ["List", "x", ["LessEqual", 0, ["Add", "x", ["Negate", "y"]]]]],
    "y",
  ]);
  // A constant bound is `x <= 2`, the constant sorts first, and a branch beats earlier ones strictly.
  expect(expand(["Max", "x", 2, "y"])).toEqual([
    "Piecewise",
    [
      "List",
      ["List", 2, ["And", ["LessEqual", "x", 2], ["LessEqual", "y", 2]]],
      ["List", "x", ["And", ["Less", 2, "x"], ["LessEqual", 0, ["Add", "x", ["Negate", "y"]]]]],
    ],
    "y",
  ]);
  // A zero-valued branch is the default, so the others carry their full conditions.
  expect(expand(["Max", "x", 0])).toEqual(["Piecewise", ["List", ["List", "x", ["Less", 0, "x"]]], 0]);
});

test("a complex assumption on the arguments does not stop them", () => {
  expect(expand(["Max", "x", "y"], ["Element", "x", "ComplexNumbers"])).toEqual(expand(["Max", "x", "y"]));
});

test("a branch an assumption decides is settled", () => {
  expect(
    ce.box(["Assuming", ["Greater", "x", 0], ["PiecewiseExpand", ["UnitStep", "x"]]] as never).evaluate().json,
  ).toBe(1);
});

test("Abs and Sign still need a real argument, and RealNumbers makes every variable real", () => {
  expect(expand(["Abs", "x"])).toEqual(["Abs", "x"]);
  expect(head(expand(["Abs", "x"], "RealNumbers"))).toBe("Piecewise");
  expect(expand(["Argument", "x"], ["Element", "x", "RealNumbers"])).toEqual([
    "Piecewise",
    ["List", ["List", "Pi", ["Less", "x", 0]]],
    0,
  ]);
});

test("a Max over an argument that itself expands, and a relation, stay as written", () => {
  const maxOfAbs = ["Max", ["Abs", "x"], ["Abs", "y"]];
  expect(expand(maxOfAbs, "RealNumbers")).toEqual(maxOfAbs);
  const relation = ["LessEqual", -1, ["Max", "x", "y"], 1];
  expect(expand(relation)).toEqual(relation);
});
