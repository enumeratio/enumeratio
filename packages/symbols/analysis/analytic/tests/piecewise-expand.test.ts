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
  // An argument that is not monotone over the interval, a bound on another unknown's range only, a modulus unrelated to the bound.
  for (const [fn, assumptions] of [
    [
      ["Floor", ["Power", "x", 2]],
      ["Less", -2, "x", 2],
    ],
    [
      ["Floor", ["Multiply", "x", "y"]],
      ["Less", 0, "x", 2],
    ],
    [
      ["Floor", "x"],
      ["Less", 0, "x", "y"],
    ],
    [
      ["Floor", "x"],
      ["Less", ["Abs", "x"], 2],
    ],
    [
      ["Mod", "k", "m"],
      ["LessEqual", 0, "k", ["Multiply", 3, "j"]],
    ],
    [
      ["Mod", "k", 4],
      ["LessEqual", 0, "k", ["Multiply", 3, "m"]],
    ],
  ] as [unknown[], unknown][]) {
    expect(expand(fn, assumptions), JSON.stringify([fn, assumptions])).toEqual(fn);
  }
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

test("a relation is not entered", () => {
  const relation = ["LessEqual", -1, ["Max", "x", "y"], 1];
  expect(expand(relation)).toEqual(relation);
});

// -- Fractional and symbolic moduli, other arguments, curved and linked bounds, narrowing, composition --

const R = (n: number, d: number) => ["Rational", n, d];

test("Mod and Quotient by a fraction or a constant match their values", () => {
  const moduli: [number, unknown][] = [
    [1.5, R(3, 2)],
    [0.5, R(1, 2)],
    [2 / 3, R(2, 3)],
    [Math.PI, "Pi"],
    [Math.PI / 2, ["Divide", "Pi", 2]],
  ];
  for (const [p, modulus] of moduli) {
    for (const d of domains) {
      for (const [fn, ref] of [
        [["Mod", "x", modulus], (x: number) => x - p * floor(x / p)],
        [["Quotient", "x", modulus], (x: number) => floor(x / p)],
      ] as [unknown[], (x: number) => number][]) {
        const pw = expand(fn, chain(d));
        for (const x of gridIn(d))
          expect(at(pw, { x }), `${JSON.stringify(fn)} on ${JSON.stringify(d)} at ${x}`).toBeCloseTo(ref(x), 12);
      }
    }
  }
});

test("a fractional modulus is written in Wolfram's order: by the numerator over a common denominator", () => {
  expect(expand(["Mod", "x", R(3, 2)], ["LessEqual", 0, "x", 4])).toEqual([
    "Piecewise",
    ["List", ["List", ["Add", "x", -3], ["LessEqual", 3, "x"]], ["List", "x", ["Less", "x", R(3, 2)]]],
    ["Multiply", R(1, 2), ["Add", ["Multiply", 2, "x"], -3]],
  ]);
  expect(expand(["Quotient", "x", R(3, 2)], ["LessEqual", 0, "x", 4])).toEqual([
    "Piecewise",
    ["List", ["List", 1, ["And", ["LessEqual", R(3, 2), "x"], ["Less", "x", 3]]], ["List", 2, ["LessEqual", 3, "x"]]],
    0,
  ]);
  // Several fractional cells: the integer offsets first, then the others by their numerators.
  expect(expand(["Mod", "x", R(1, 2)], ["LessEqual", 0, "x", 2])).toEqual([
    "Piecewise",
    [
      "List",
      ["List", ["Add", "x", -2], ["LessEqual", 2, "x"]],
      ["List", ["Add", "x", -1], ["And", ["LessEqual", 1, "x"], ["Less", "x", R(3, 2)]]],
      ["List", "x", ["Less", "x", R(1, 2)]],
      [
        "List",
        ["Multiply", R(1, 2), ["Add", ["Multiply", 2, "x"], -3]],
        ["And", ["LessEqual", R(3, 2), "x"], ["Less", "x", 2]],
      ],
    ],
    ["Multiply", R(1, 2), ["Add", ["Multiply", 2, "x"], -1]],
  ]);
  // A constant modulus keeps its multiples in the bounds.
  expect(expand(["Mod", "x", "Pi"], ["Less", 0, "x", 10])).toEqual([
    "Piecewise",
    [
      "List",
      ["List", "x", ["Less", "x", "Pi"]],
      ["List", ["Add", "x", ["Multiply", -3, "Pi"]], ["LessEqual", ["Multiply", 3, "Pi"], "x"]],
      [
        "List",
        ["Add", "x", ["Multiply", -2, "Pi"]],
        ["And", ["LessEqual", ["Multiply", 2, "Pi"], "x"], ["Less", "x", ["Multiply", 3, "Pi"]]],
      ],
    ],
    ["Add", "x", ["Negate", "Pi"]],
  ]);
});

test("Mod and Quotient by a symbol read the bounds off k/m", () => {
  const ratios = [0, 0.25, 0.5, 1, 1.25, 2, 2.75, 3];
  for (const m of [1, 2, 0.5]) {
    for (const [fn, ref] of [
      [["Mod", "k", "m"], (k: number) => k - m * floor(k / m)],
      [["Quotient", "k", "m"], (k: number) => floor(k / m)],
      [["Mod", "k", ["Multiply", 2, "m"]], (k: number) => k - 2 * m * floor(k / (2 * m))],
      [["Mod", "k", ["Divide", "m", 2]], (k: number) => k - (m / 2) * floor(k / (m / 2))],
    ] as [unknown[], (k: number) => number][]) {
      const pw = expand(fn, ["LessEqual", 0, "k", ["Multiply", 3, "m"]]);
      expect(head(pw), JSON.stringify(fn)).toBe("Piecewise");
      for (const r of ratios) {
        const k = r * m;
        expect(at(pw, { k, m }), `${JSON.stringify(fn)} at k=${k}, m=${m}`).toBeCloseTo(ref(k), 12);
      }
    }
  }
  // The bound 0 <= k <= 3 m reads as 0 <= k/m <= 3.
  const km = ["Divide", "k", "m"];
  expect(expand(["Mod", "k", "m"], ["LessEqual", 0, "k", ["Multiply", 3, "m"]])).toEqual([
    "Piecewise",
    [
      "List",
      ["List", "k", ["Less", km, 1]],
      ["List", ["Add", "k", ["Multiply", -3, "m"]], ["LessEqual", 3, km]],
      ["List", ["Add", "k", ["Multiply", -2, "m"]], ["And", ["LessEqual", 2, km], ["Less", km, 3]]],
    ],
    ["Add", "k", ["Negate", "m"]],
  ]);
  // An open end has no cell of its own.
  expect(expand(["Quotient", "a", "b"], ["And", ["Less", 0, "a"], ["Less", "a", ["Multiply", 2, "b"]]])).toEqual([
    "Piecewise",
    ["List", ["List", 1, ["LessEqual", 1, ["Divide", "a", "b"]]]],
    0,
  ]);
});

test("a staircase over an argument linear in x is solved for x", () => {
  const args: [unknown, (x: number) => number][] = [
    [["Multiply", 2, "x"], (x) => 2 * x],
    [["Negate", "x"], (x) => -x],
    [["Divide", "x", 2], (x) => x / 2],
    [["Add", "x", R(1, 2)], (x) => x + 0.5],
    [["Subtract", ["Multiply", 3, "x"], 1], (x) => 3 * x - 1],
    [["Subtract", 1, "x"], (x) => 1 - x],
  ];
  const heads: [string, (u: number) => number][] = [
    ["Floor", floor],
    ["Ceil", ceil],
    ["Round", roundEven],
    ["IntegerPart", trunc],
    ["FractionalPart", (u) => u - trunc(u)],
    ["SawtoothWave", frac],
    ["SquareWave", (u) => (frac(u) < 0.5 ? 1 : -1)],
  ];
  for (const [g, gf] of args) {
    for (const [name, f] of heads) {
      for (const d of domains.slice(0, 4)) {
        const pw = expand([name, g], chain(d));
        for (const x of gridIn(d)) {
          expect(at(pw, { x }), `${name}(${JSON.stringify(g)}) on ${JSON.stringify(d)} at ${x}`).toBeCloseTo(
            f(gf(x)),
            12,
          );
        }
      }
    }
  }
  expect(expand(["Floor", ["Multiply", 2, "x"]], ["Less", 0, "x", 2])).toEqual([
    "Piecewise",
    [
      "List",
      ["List", 1, ["And", ["LessEqual", R(1, 2), "x"], ["Less", "x", 1]]],
      ["List", 2, ["And", ["LessEqual", 1, "x"], ["Less", "x", R(3, 2)]]],
      ["List", 3, ["LessEqual", R(3, 2), "x"]],
    ],
    0,
  ]);
  // A falling argument flips which end of each cell the condition names.
  expect(expand(["Floor", ["Negate", "x"]], ["Less", 0, "x", 3])).toEqual([
    "Piecewise",
    ["List", ["List", -3, ["Less", 2, "x"]], ["List", -2, ["And", ["Less", 1, "x"], ["LessEqual", "x", 2]]]],
    -1,
  ]);
  // The forms Wolfram writes for the values: a common factor out in front.
  expect(expand(["FractionalPart", ["Multiply", 2, "x"]], ["Less", 0, "x", 2])).toEqual([
    "Piecewise",
    [
      "List",
      ["List", ["Multiply", 2, ["Add", "x", -1]], ["And", ["LessEqual", 1, "x"], ["Less", "x", R(3, 2)]]],
      ["List", ["Multiply", 2, "x"], ["Less", "x", R(1, 2)]],
      ["List", ["Add", ["Multiply", 2, "x"], -3], ["LessEqual", R(3, 2), "x"]],
    ],
    ["Add", ["Multiply", 2, "x"], -1],
  ]);
});

test("a staircase over the square or square root of x is in x, or in the root", () => {
  const spans: [number, number, boolean, boolean][] = [
    [0, 3, true, true],
    [0.5, 2.5, false, true],
    [1, 4, false, false],
    [-3, 0, true, true],
    [-2.5, -0.5, false, true],
  ];
  const heads: [string, (u: number) => number][] = [
    ["Floor", floor],
    ["Ceil", ceil],
    ["Round", roundEven],
    ["IntegerPart", trunc],
  ];
  for (const d of spans) {
    for (const [name, f] of heads) {
      const pw = expand([name, ["Power", "x", 2]], chain(d));
      expect(head(pw), `${name}(x^2) on ${JSON.stringify(d)}`).toBe("Piecewise");
      for (const x of gridIn(d))
        expect(at(pw, { x }), `${name}(x^2) on ${JSON.stringify(d)} at ${x}`).toBeCloseTo(f(x * x), 12);
    }
  }
  for (const d of spans.slice(0, 3)) {
    const pw = expand(["Floor", ["Sqrt", "x"]], chain(d));
    for (const x of gridIn(d))
      expect(at(pw, { x }), `Floor(Sqrt(x)) on ${JSON.stringify(d)} at ${x}`).toBeCloseTo(floor(Math.sqrt(x)), 12);
  }
  // Roots are exact where they are, and Sqrt where they are not; Sqrt(x) is compared as it stands.
  expect(expand(["Floor", ["Power", "x", 2]], ["Less", 0, "x", 2])).toEqual([
    "Piecewise",
    [
      "List",
      ["List", 1, ["And", ["LessEqual", 1, "x"], ["Less", "x", ["Sqrt", 2]]]],
      ["List", 2, ["And", ["LessEqual", ["Sqrt", 2], "x"], ["Less", "x", ["Sqrt", 3]]]],
      ["List", 3, ["LessEqual", ["Sqrt", 3], "x"]],
    ],
    0,
  ]);
  expect(expand(["Floor", ["Sqrt", "x"]], ["Less", 0, "x", 5])).toEqual([
    "Piecewise",
    [
      "List",
      ["List", 1, ["And", ["LessEqual", 1, ["Sqrt", "x"]], ["Less", ["Sqrt", "x"], 2]]],
      ["List", 2, ["LessEqual", 2, ["Sqrt", "x"]]],
    ],
    0,
  ]);
});

test("bounds that are curved, scaled or linked to another unknown's range give the interval", () => {
  // x^2 < 3 is -sqrt(3) < x < sqrt(3): the cells are the integers in it.
  const circle = expand(["Floor", "x"], ["Less", ["Power", "x", 2], 3]);
  expect(circle).toEqual([
    "Piecewise",
    [
      "List",
      ["List", -2, ["Less", "x", -1]],
      ["List", -1, ["And", ["LessEqual", -1, "x"], ["Less", "x", 0]]],
      ["List", 1, ["LessEqual", 1, "x"]],
    ],
    0,
  ]);
  for (const x of [-1.7, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 1.7]) expect(at(circle, { x })).toBe(floor(x));
  // A closed bound reaches its end.
  expect(expand(["Floor", "x"], ["LessEqual", ["Power", "x", 2], 4])).toEqual(
    expand(["Floor", "x"], ["LessEqual", -2, "x", 2]),
  );
  // A scaled bound, a bound through another unknown that is itself bounded, a constant such as Pi.
  expect(expand(["Floor", "x"], ["Less", 0, ["Multiply", 2, "x"], 5])).toEqual(
    expand(["Floor", "x"], ["Less", 0, "x", R(5, 2)]),
  );
  expect(
    expand(["Floor", "x"], ["And", ["Less", 0, "x"], ["Less", "x", ["Multiply", 3, "y"]], ["Less", 0, "y", 1]]),
  ).toEqual(expand(["Floor", "x"], ["Less", 0, "x", 3]));
  expect(expand(["Floor", "x"], ["Less", 0, "x", "Pi"])).toEqual(expand(["Floor", "x"], ["Less", 0, "x", 3.5]));
  // Two unknowns, each by its own bound, and their sum as one Piecewise.
  const sum = expand(
    ["Add", ["Floor", "x"], ["Round", "y"]],
    ["And", ["Less", ["Power", "x", 2], 3], ["Less", ["Power", "y", 2], 2]],
  );
  expect(head(sum)).toBe("Piecewise");
  for (const x of [-1.7, -1.2, -1, -0.5, 0, 0.5, 1, 1.7])
    for (const y of [-1.4, -1, -0.5, -0.25, 0, 0.5, 0.75, 1, 1.4])
      expect(at(sum, { x, y }), `x=${x}, y=${y}`).toBe(floor(x) + roundEven(y));
  // An enclosing Assuming says the same.
  expect(
    ce.box(["Assuming", ["Less", ["Power", "x", 2], 3], ["PiecewiseExpand", ["Floor", "x"]]] as never).evaluate().json,
  ).toEqual(circle);
});

test("what the assumptions decide of a condition is not written", () => {
  // UnitBox(x) is 1 for |x| <= 1/2: on 0 < x < 2 only the upper end is left to say.
  expect(expand(["UnitBox", "x"], ["Less", 0, "x", 2])).toEqual([
    "Piecewise",
    ["List", ["List", 1, ["LessEqual", "x", R(1, 2)]]],
    0,
  ]);
  expect(expand(["UnitBox", "x"], ["Less", 0, "x", R(1, 4)])).toBe(1);
  expect(expand(["UnitTriangle", "x"], ["Less", 0, "x", 2])).toEqual([
    "Piecewise",
    ["List", ["List", ["Add", ["Negate", "x"], 1], ["LessEqual", "x", 1]]],
    0,
  ]);
  expect(expand(["UnitTriangle", "x"], ["Greater", "x", 1])).toBe(0);
  // A branch that cannot be reached goes, and when the branches cover the interval the last is the default.
  expect(expand(["Max", "x", 2, "y"], ["Greater", "x", 3])).toEqual([
    "Piecewise",
    ["List", ["List", "x", ["LessEqual", 0, ["Add", "x", ["Negate", "y"]]]]],
    "y",
  ]);
  expect(expand(["Clip", "x", ["List", 0, 1]], ["Less", 0, "x", 3])).toEqual([
    "Piecewise",
    ["List", ["List", 1, ["Less", 1, "x"]]],
    "x",
  ]);
  // A relation between the unknowns decides a condition on their difference.
  expect(expand(["Max", "x", "y"], ["Greater", "x", "y"])).toBe("x");
  expect(expand(["Min", "x", "y"], ["Less", "x", "y"])).toBe("x");
});

interface Composed {
  readonly fn: unknown[];
  readonly vars: string[];
  readonly ref: (v: Record<string, number>) => number;
  readonly grid?: number[];
}
const absOf = (x: unknown) => ["Abs", x];
const step = (v: number) => (v >= 0 ? 1 : 0);
const composed: Composed[] = [
  { fn: ["Add", ["Max", "x", 0], ["UnitStep", "x"]], vars: ["x"], ref: (v) => Math.max(v.x, 0) + step(v.x) },
  { fn: ["Multiply", ["Max", "x", 0], ["UnitStep", "x"]], vars: ["x"], ref: (v) => Math.max(v.x, 0) * step(v.x) },
  { fn: ["Add", ["Max", "x", 0], "x"], vars: ["x"], ref: (v) => Math.max(v.x, 0) + v.x },
  { fn: ["Max", absOf("x"), absOf("y")], vars: ["x", "y"], ref: (v) => Math.max(Math.abs(v.x), Math.abs(v.y)) },
  {
    fn: ["Max", absOf("x"), absOf("y"), absOf("z")],
    vars: ["x", "y", "z"],
    ref: (v) => Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)),
    grid: [-2, -1, 0, 1, 3],
  },
  { fn: ["Add", absOf("x"), absOf("y")], vars: ["x", "y"], ref: (v) => Math.abs(v.x) + Math.abs(v.y) },
  { fn: ["Multiply", absOf("x"), absOf("y")], vars: ["x", "y"], ref: (v) => Math.abs(v.x) * Math.abs(v.y) },
  { fn: ["Add", absOf("x"), absOf(["Subtract", "x", 1])], vars: ["x"], ref: (v) => Math.abs(v.x) + Math.abs(v.x - 1) },
  { fn: ["Min", absOf("x"), 1], vars: ["x"], ref: (v) => Math.min(Math.abs(v.x), 1) },
  { fn: ["Add", ["UnitStep", "x"], ["UnitStep", ["Negate", "x"]]], vars: ["x"], ref: (v) => step(v.x) + step(-v.x) },
  { fn: ["Add", ["Max", "x", 0], ["Min", "x", 0]], vars: ["x"], ref: (v) => v.x },
  { fn: ["Add", ["UnitStep", "x"], ["UnitStep", "y"]], vars: ["x", "y"], ref: (v) => step(v.x) + step(v.y) },
  { fn: ["Max", ["UnitStep", "x"], ["UnitStep", "y"]], vars: ["x", "y"], ref: (v) => Math.max(step(v.x), step(v.y)) },
  { fn: ["Power", ["Max", "x", 0], 2], vars: ["x"], ref: (v) => Math.max(v.x, 0) ** 2 },
  { fn: ["Sin", ["UnitStep", "x"]], vars: ["x"], ref: (v) => (v.x >= 0 ? Math.sin(1) : 0) },
  { fn: ["Add", ["Max", "x", "y"], ["Min", "x", "y"]], vars: ["x", "y"], ref: (v) => v.x + v.y },
];

test("a sum, product, power or step head over Piecewise values is one Piecewise", () => {
  for (const { fn, vars, ref, grid } of composed) {
    const pw = expand(fn, "RealNumbers");
    expect(JSON.stringify(pw), JSON.stringify(fn)).not.toEqual(JSON.stringify(fn));
    const each = grid ?? rationals;
    const walk = (i: number, point: Record<string, number>): void => {
      if (i === vars.length) {
        expect(at(pw, point), `${JSON.stringify(fn)} at ${JSON.stringify(point)}`).toBeCloseTo(ref(point), 12);
        return;
      }
      for (const v of each) walk(i + 1, { ...point, [vars[i]]: v });
    };
    walk(0, {});
  }
});

test("a composition is written as Wolfram writes it", () => {
  // A point is `x == 0`, branches with the same value share their condition, and a zero value is the default.
  expect(expand(["Add", ["Max", "x", 0], ["UnitStep", "x"]])).toEqual([
    "Piecewise",
    ["List", ["List", 1, ["Equal", "x", 0]], ["List", ["Add", "x", 1], ["Less", 0, "x"]]],
    0,
  ]);
  expect(expand(["Multiply", ["Max", "x", 0], ["UnitStep", "x"]])).toEqual([
    "Piecewise",
    ["List", ["List", "x", ["Less", 0, "x"]]],
    0,
  ]);
  // With no zero value the last in Wolfram's order is the default.
  expect(expand(["Add", absOf("x"), 1], "RealNumbers")).toEqual([
    "Piecewise",
    ["List", ["List", ["Add", ["Negate", "x"], 1], ["Less", "x", 0]]],
    ["Add", "x", 1],
  ]);
  // Values that agree on every branch need no Piecewise.
  expect(expand(["Power", absOf("x"), 2], "RealNumbers")).toEqual(["Power", "x", 2]);
  // Linked unknowns carry the relations between them, with the first unknown positive.
  expect(expand(["Max", absOf("x"), absOf("y")], "RealNumbers")).toEqual([
    "Piecewise",
    [
      "List",
      [
        "List",
        ["Negate", "x"],
        [
          "Or",
          ["And", ["Less", "x", 0], ["Less", "y", 0], ["LessEqual", ["Add", "x", ["Negate", "y"]], 0]],
          ["And", ["Less", "x", 0], ["LessEqual", 0, "y"], ["LessEqual", ["Add", "x", "y"], 0]],
        ],
      ],
      [
        "List",
        "x",
        [
          "Or",
          ["And", ["LessEqual", 0, "x"], ["Less", "y", 0], ["LessEqual", 0, ["Add", "x", "y"]]],
          ["And", ["LessEqual", 0, "x"], ["LessEqual", 0, "y"], ["LessEqual", 0, ["Add", "x", ["Negate", "y"]]]],
        ],
      ],
      [
        "List",
        ["Negate", "y"],
        [
          "Or",
          ["And", ["Less", "x", 0], ["Less", "y", 0], ["Less", 0, ["Add", "x", ["Negate", "y"]]]],
          ["And", ["LessEqual", 0, "x"], ["Less", "y", 0], ["Less", ["Add", "x", "y"], 0]],
        ],
      ],
    ],
    "y",
  ]);
});

test("two-argument Floor, Ceil and Round are steps of the multiple", () => {
  for (const [p, modulus] of [
    [2, 2],
    [1.5, R(3, 2)],
    [Math.PI, "Pi"],
  ] as [number, unknown][]) {
    for (const [name, f] of [
      ["Floor", floor],
      ["Ceil", ceil],
      ["Round", roundEven],
    ] as [string, (u: number) => number][]) {
      for (const d of domains) {
        const pw = expand([name, "x", modulus], chain(d));
        for (const x of gridIn(d))
          expect(at(pw, { x }), `${name}(x, ${JSON.stringify(modulus)}) on ${JSON.stringify(d)} at ${x}`).toBeCloseTo(
            p * f(x / p),
            12,
          );
      }
    }
  }
  expect(expand(["Floor", "x", 2], ["Less", 0, "x", 7])).toEqual([
    "Piecewise",
    [
      "List",
      ["List", 2, ["And", ["LessEqual", 2, "x"], ["Less", "x", 4]]],
      ["List", 4, ["And", ["LessEqual", 4, "x"], ["Less", "x", 6]]],
      ["List", 6, ["LessEqual", 6, "x"]],
    ],
    0,
  ]);
  // No zero stretch: the last is the default.
  expect(expand(["Ceil", "x", 2], ["Less", 0, "x", 7])).toEqual([
    "Piecewise",
    [
      "List",
      ["List", 2, ["LessEqual", "x", 2]],
      ["List", 4, ["And", ["Less", 2, "x"], ["LessEqual", "x", 4]]],
      ["List", 6, ["And", ["Less", 4, "x"], ["LessEqual", "x", 6]]],
    ],
    8,
  ]);
});

test("a triangle gives its peak to the branch right of it at or left of 0, and left of it otherwise", () => {
  // Wolfram writes the shifted triangles this way.
  expect(expand(["UnitTriangle", ["Subtract", "x", 1]])).toEqual([
    "Piecewise",
    [
      "List",
      ["List", ["Add", ["Negate", "x"], 2], ["And", ["Less", 1, "x"], ["LessEqual", "x", 2]]],
      ["List", "x", ["LessEqual", 0, "x", 1]],
    ],
    0,
  ]);
  expect(expand(["UnitTriangle", ["Add", "x", 1]])).toEqual([
    "Piecewise",
    [
      "List",
      ["List", ["Negate", "x"], ["LessEqual", -1, "x", 0]],
      ["List", ["Add", "x", 2], ["And", ["LessEqual", -2, "x"], ["Less", "x", -1]]],
    ],
    0,
  ]);
  for (const [shift, value] of [
    [-2, -2],
    [-1, -1],
    [R(-1, 2), -0.5],
    [0, 0],
    [R(1, 2), 0.5],
    [1, 1],
  ] as [unknown, number][]) {
    const pw = expand(["UnitTriangle", ["Add", "x", shift]]);
    for (const x of [-3, -2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3])
      expect(at(pw, { x }), `shift ${value} at ${x}`).toBeCloseTo(Math.max(0, 1 - Math.abs(x + value)), 12);
  }
});

test("a triangle wave of a linear argument", () => {
  for (const d of domains) {
    const pw = expand(["TriangleWave", ["Multiply", 2, "x"]], chain(d));
    for (const x of gridIn(d)) {
      const t = frac(2 * x);
      expect(at(pw, { x }), `at ${x}`).toBeCloseTo(t < 0.25 ? 4 * t : t < 0.75 ? 2 - 4 * t : 4 * t - 4, 12);
    }
  }
});

test("Max and Min drop an argument that differs from another by a constant, and order sums as Wolfram does", () => {
  expect(expand(["Max", "x", ["Add", "x", 1]])).toEqual(["Add", "x", 1]);
  expect(expand(["Min", "x", ["Add", "x", 1]])).toBe("x");
  // `x - y` is before `x + y`, so it wins ties with `0` strictly and with `x + y` on y >= 0.
  expect(expand(["Min", ["Add", "x", "y"], ["Subtract", "x", "y"], 0])).toEqual([
    "Piecewise",
    [
      "List",
      [
        "List",
        ["Add", "x", ["Negate", "y"]],
        ["And", ["Less", ["Add", "x", ["Negate", "y"]], 0], ["LessEqual", 0, "y"]],
      ],
      ["List", ["Add", "x", "y"], ["And", ["Less", ["Add", "x", "y"], 0], ["Less", "y", 0]]],
    ],
    0,
  ]);
});

test("a condition is cut by what the other conditions in its branch say", () => {
  // x > 1 and y < 0 make x - y > 0 needless.
  const pw = expand(["Min", "x", 0, "y"], ["Greater", "x", 1]);
  expect(JSON.stringify(pw)).not.toContain('"Add"');
  for (const [x, y] of [
    [2, -1],
    [2, 0.5],
    [3, 5],
    [1.5, 0],
  ])
    expect(at(pw, { x, y })).toBe(Math.min(x, 0, y));
});
