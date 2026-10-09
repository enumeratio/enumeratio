import { box, type Engine, type Expr, isSymbol, type Json, operandsOf } from "@enumeratio/engine";
import {
  addTo,
  affine,
  and,
  compareLinear,
  compact,
  hasPiecewise,
  isNonReal,
  type Linear,
  linear,
  or,
  piecewise,
  q,
  type Q,
  qAdd,
  qDiv,
  qIsZero,
  qJson,
  qMul,
  qNeg,
  qNum,
  rationalAt,
  relation,
  scaled,
  sortedByWolfram,
  togetherJson,
  constantValue,
} from "./piecewise-linear.ts";
import {
  cmpNum,
  type Interval,
  intervalOf,
  type Knowledge,
  narrowPiecewise,
  num,
  type Num,
  numQ,
  ratioInterval,
} from "./piecewise-assumptions.ts";

// The PiecewiseExpand rewrites for the step-like heads, in Wolfram's own form: the same
// branch conditions (`a - b >= 0`, `x <= 2`), the same branch order, and the same default.
//
//   - Min, Max, UnitStep, Clip, UnitBox, UnitTriangle expand over any argument, with no
//     assumption: unlike Abs and Sign, nothing about them needs a real argument. What the
//     assumptions decide of their conditions is dropped (`UnitBox(x)` on `0 < x < 2` is `x <= 1/2`).
//   - Floor, Ceil, Round, IntegerPart, FractionalPart, Mod, Quotient, SawtoothWave,
//     SquareWave, TriangleWave expand over a bounded argument, as Wolfram does from
//     `Assuming`'s or the second argument's `0 < x < 3`. A span of 100 cells or more is left alone,
//     as Wolfram leaves it. The argument is a symbol, or linear in one (`Floor(2 x)`), or a power
//     (`Floor(x^2)`) or square root of one over an interval where it is monotone; a modulus is a
//     number, a constant such as Pi, or a symbol (`Mod(k, m)` with `0 <= k <= 3 m` reads off `k/m`).
//
// A branch whose value is 0 is the Piecewise default (0 when omitted); with none, the last
// branch in value order is the default and carries no condition.

// -- Min, Max -----------------------------------------------------------------------------------

/** Every argument of a Max or Min with the condition under which it is the value: exclusive, a tie going to the later one. */
export function minMaxPieces(kind: "Max" | "Min", given: readonly Expr[]): { value: Expr; cond: Json }[] | undefined {
  const args = given.length === 1 && given[0].operator === "List" ? operandsOf(given[0]) : given;
  if (args.length < 2 || !args.every((a) => !hasPiecewise(a) && !isNonReal(a))) return undefined;
  const sorted = sortedByWolfram(args, (e) => e);
  // An argument that differs from another by a constant never wins (Max) or always loses (Min) to it.
  const beaten = (i: number, j: number): boolean => {
    const d = linear(sorted[i]);
    addTo(d, linear(sorted[j]), q(-1));
    if (compact(d).length > 0) return false;
    const c = qNum(d.constant);
    return kind === "Max" ? c < 0 || (c === 0 && i < j) : c > 0 || (c === 0 && i < j);
  };
  const a = sorted.filter((_, i) => !sorted.some((_, j) => j !== i && beaten(i, j)));
  if (a.length === 1) return [{ value: a[0], cond: "True" as Json }];
  const pieces: { value: Expr; cond: Json }[] = [];
  for (let i = 0; i < a.length; i++) {
    // Wins over an earlier argument strictly, over a later one on a tie.
    const conds: Json[] = [];
    for (let j = 0; j < a.length; j++) {
      if (j === i) continue;
      const cond =
        j < i
          ? relation(kind === "Max" ? "Less" : "Greater", a[j], a[i])
          : relation(kind === "Max" ? "GreaterEqual" : "LessEqual", a[i], a[j]);
      if (cond === undefined) return undefined;
      conds.push(cond);
    }
    pieces.push({ value: a[i], cond: and(conds) });
  }
  return pieces;
}

function minMax(kind: "Max" | "Min", given: readonly Expr[]): Json | undefined {
  const pieces = minMaxPieces(kind, given);
  return pieces && assemble(pieces);
}

// -- UnitStep, UnitBox, UnitTriangle ------------------------------------------------------------

const plain = (a: Expr): boolean => a.operator !== "List" && !hasPiecewise(a) && !isNonReal(a);

function unitStep(ce: Engine, args: readonly Expr[]): Json | undefined {
  if (args.length === 0 || !args.every(plain)) return undefined;
  const zero = box(ce, 0);
  const conds = args.map((a) => relation("GreaterEqual", a, zero));
  return conds.every((c) => c !== undefined) ? piecewise([[1, and(conds)]], 0) : undefined;
}

export function chain(lo: Json, loClosed: boolean, x: Json, hi: Json, hiClosed: boolean): Json {
  if (loClosed === hiClosed) return [loClosed ? "LessEqual" : "Less", lo, x, hi] as Json;
  return ["And", [loClosed ? "LessEqual" : "Less", lo, x], [hiClosed ? "LessEqual" : "Less", x, hi]] as Json;
}

/** `lo <= u <= hi` (or the strict forms), solved for `u`'s atom when `u` is affine in one. */
function between(u: Expr, lo: Q, hi: Q, loClosed: boolean, hiClosed: boolean): Json {
  const f = affine(u);
  if (!f) return chain(qJson(lo), loClosed, u.json, qJson(hi), hiClosed);
  const at = (end: Q): Q => qDiv(qAdd(end, qNeg(f.shift)), f.scale);
  return qNum(f.scale) < 0
    ? chain(qJson(at(hi)), hiClosed, f.atom, qJson(at(lo)), loClosed)
    : chain(qJson(at(lo)), loClosed, f.atom, qJson(at(hi)), hiClosed);
}

function unitBox(args: readonly Expr[]): Json | undefined {
  if (args.length === 0 || !args.every(plain)) return undefined;
  return piecewise([[1, and(args.map((u) => between(u, q(-1, 2), q(1, 2), true, true)))]], 0);
}

/**
 * 1 - u on 0 <= u <= 1, 1 + u on -1 <= u <= 0, 0 elsewhere; the branch whose value falls with x first. The peak, where
 * both give 1, goes to the branch right of it when it is at or left of 0 and to the one left of it when it is right of 0.
 */
function unitTriangle(args: readonly Expr[]): Json | undefined {
  if (args.length !== 1 || !plain(args[0])) return undefined;
  const [u] = args;
  const f = affine(u);
  if (f === undefined) return undefined;
  const l = linear(u);
  const peak = qDiv(qNeg(f.shift), f.scale);
  const downGetsPeak = qNum(peak) <= 0 === qNum(f.scale) > 0;
  const down = [togetherJson(scaled(l, q(-1), q(1))), between(u, q(0), q(1), downGetsPeak, true)] as const;
  const up = [togetherJson(scaled(l, q(1), q(1))), between(u, q(-1), q(0), true, !downGetsPeak)] as const;
  return piecewise(qNum(f.scale) > 0 ? [down, up] : [up, down], 0);
}

// -- Clip ---------------------------------------------------------------------------------------

/** The branches in value order; a zero-valued piece, else the last, is the default and drops its condition. */
function assemble(pieces: readonly { value: Expr; cond: Json }[]): Json {
  const ordered = sortedByWolfram(pieces, (p) => p.value);
  const zero = ordered.findIndex((p) => {
    const value = rationalAt(p.value);
    return value !== undefined && qIsZero(value);
  });
  const fallback = zero >= 0 ? zero : ordered.length - 1;
  return piecewise(
    ordered.filter((_, i) => i !== fallback).map((p) => [p.value.json, p.cond] as const),
    ordered[fallback].value.json,
  );
}

function clip(ce: Engine, args: readonly Expr[]): Json | undefined {
  const [v, limits, levels] = args;
  if (!v || args.length > 3 || !plain(v)) return undefined;
  const ends = (e: Expr | undefined, fallback: readonly [Expr, Expr]): readonly [Expr, Expr] | undefined => {
    if (e === undefined) return fallback;
    const both = e.operator === "List" ? operandsOf(e) : [];
    return both.length === 2 && both.every(plain) ? [both[0], both[1]] : undefined;
  };
  const bounds = ends(limits, [box(ce, -1), box(ce, 1)]);
  const values = bounds && ends(levels, bounds);
  if (!bounds || !values) return undefined;
  const [lo, hi] = bounds;
  const [loNumber, hiNumber] = [rationalAt(lo), rationalAt(hi)];
  const numeric = loNumber !== undefined && hiNumber !== undefined;
  if (numeric && qNum(loNumber) > qNum(hiNumber)) return undefined;
  const below = relation("Greater", lo, v);
  const above = relation("Less", hi, v);
  const notBelow = relation("LessEqual", lo, v);
  const notAbove = relation("GreaterEqual", hi, v);
  if (!below || !above || !notBelow || !notAbove) return undefined;
  return assemble([
    { value: values[0], cond: below },
    { value: values[1], cond: numeric ? above : and([above, notBelow]) },
    { value: v, cond: numeric ? between(v, loNumber, hiNumber, true, true) : and([notBelow, notAbove]) },
  ]);
}

// -- Bounded staircases -------------------------------------------------------------------------

/** Wolfram leaves a staircase alone from a span of 100. */
const MAX_SPAN = 100;

interface NumericType {
  readonly kind?: string;
  readonly type?: string;
  readonly lower?: number;
  readonly upper?: number;
  readonly lowerOpen?: boolean;
  readonly upperOpen?: boolean;
}

/** A double as the small rational it is, when it is one. */
function snap(v: number): Num {
  for (const d of [1, 2, 3, 4, 5, 6, 8, 10, 12, 16]) {
    const n = Math.round(v * d);
    if (Math.abs(v * d - n) < 1e-12) return numQ(q(n, d));
  }
  return num(v);
}

/** The bounds compute-engine inferred for a symbol: what an assumption made through the engine directly leaves. */
function typedInterval(x: Expr): Interval | undefined {
  const t = x.type.type as NumericType | string;
  if (typeof t !== "object" || t.kind !== "numeric" || (t.type !== "real" && t.type !== "finite_real"))
    return undefined;
  const { lower, upper } = t;
  if (lower === undefined || upper === undefined || !Number.isFinite(lower) || !Number.isFinite(upper))
    return undefined;
  if (upper < lower) return undefined;
  return { lo: snap(lower), hi: snap(upper), loOpen: t.lowerOpen === true, hiOpen: t.upperOpen === true };
}

/** One stretch of the unit coordinate where the function is one expression. */
interface Region {
  readonly lo: Q;
  readonly hi: Q;
  readonly loClosed: boolean;
  readonly hiClosed: boolean;
  readonly value: Json;
  /** Branches go in ascending `order` unless every value is a number or a linear form. */
  readonly order: number;
  readonly linear?: Linear;
}

/** Every region of period `k`: a family lists the cells of one period, and the loop covers the domain. */
type Family = (k: number) => readonly Region[];

/** Where the conditions live: the variable they compare, and how the unit coordinate the cells are laid out in maps onto it. */
interface Axis {
  readonly variable: Json;
  /** The unit coordinate falls as the variable rises. */
  readonly falling: boolean;
  /** The variable where the unit coordinate is `e`. */
  readonly at: (e: Q) => Json;
  /** The range of the unit coordinate. */
  readonly domain: Interval;
}

/** The region cut to the domain, and which of its ends the domain does not already say. */
function cut(r: Region, d: Interval): { lower: boolean; upper: boolean } | undefined {
  const [rlo, rhi] = [numQ(r.lo), numQ(r.hi)];
  const lo = cmpNum(rlo, d.lo);
  const hi = cmpNum(rhi, d.hi);
  const loIn = lo > 0 ? r.loClosed : lo < 0 ? !d.loOpen : r.loClosed && !d.loOpen;
  const hiIn = hi < 0 ? r.hiClosed : hi > 0 ? !d.hiOpen : r.hiClosed && !d.hiOpen;
  const span = cmpNum(lo > 0 ? rlo : d.lo, hi < 0 ? rhi : d.hi);
  if (span > 0 || (span === 0 && !(loIn && hiIn))) return undefined;
  return {
    lower: !(lo < 0 || (lo === 0 && (r.loClosed || d.loOpen))),
    upper: !(hi > 0 || (hi === 0 && (r.hiClosed || d.hiOpen))),
  };
}

/** The region's condition on the axis's variable, from the ends of it the domain does not already say. */
function conditionOf(axis: Axis, r: Region, edges: { lower: boolean; upper: boolean }): Json {
  const { variable: x, falling } = axis;
  // The unit coordinate's low edge is the variable's high end when it falls.
  const low = falling
    ? { edge: r.hi, closed: r.hiClosed, explicit: edges.upper }
    : { edge: r.lo, closed: r.loClosed, explicit: edges.lower };
  const high = falling
    ? { edge: r.lo, closed: r.loClosed, explicit: edges.lower }
    : { edge: r.hi, closed: r.hiClosed, explicit: edges.upper };
  if (low.explicit && high.explicit) return chain(axis.at(low.edge), low.closed, x, axis.at(high.edge), high.closed);
  if (low.explicit) return [low.closed ? "GreaterEqual" : "Greater", x, axis.at(low.edge)] as Json;
  if (high.explicit) return [high.closed ? "LessEqual" : "Less", x, axis.at(high.edge)] as Json;
  return "True";
}

interface Group {
  readonly value: Json;
  readonly order: number;
  readonly linear?: Linear;
  readonly conds: Json[];
}

function staircase(axis: Axis, family: Family): Json | undefined {
  const d = axis.domain;
  if (!Number.isFinite(d.lo.v) || !Number.isFinite(d.hi.v) || d.hi.v - d.lo.v >= MAX_SPAN) return undefined;
  const groups = new Map<string, Group>();
  for (let k = Math.floor(d.lo.v) - 1; k <= Math.ceil(d.hi.v) + 1; k++) {
    for (const r of family(k)) {
      const edges = cut(r, d);
      if (!edges) continue;
      const cond = conditionOf(axis, r, edges);
      const key = JSON.stringify(r.value);
      const group = groups.get(key);
      if (group) group.conds.push(cond);
      else groups.set(key, { value: r.value, order: r.order, linear: r.linear, conds: [cond] });
    }
  }
  const all = [...groups.values()];
  if (all.length === 0) return undefined;
  const ordered = all.every((g) => typeof g.value === "number")
    ? all.toSorted((a, b) => (a.value as number) - (b.value as number))
    : all.every((g) => g.linear !== undefined)
      ? all.toSorted((a, b) => compareLinear(a.linear!, b.linear!))
      : all.toSorted((a, b) => a.order - b.order);
  const zero = ordered.findIndex((g) => g.value === 0);
  const fallback = zero >= 0 ? zero : ordered.length - 1;
  return piecewise(
    ordered
      .filter((_, i) => i !== fallback)
      .map((g) => {
        // Ascending in the variable, whichever way the unit coordinate runs.
        const conds = axis.falling ? g.conds.toReversed() : g.conds;
        return [g.value, or(conds)] as const;
      }),
    ordered[fallback].value,
  );
}

const half = q(1, 2);
const cell = (lo: Q, hi: Q, closed: readonly [boolean, boolean], value: Json, order: number): Region => ({
  lo,
  hi,
  loClosed: closed[0],
  hiClosed: closed[1],
  value,
  order,
});

const floorCell: Family = (k) => [cell(q(k), q(k + 1), [true, false], k, k)];
const ceilCell: Family = (k) => [cell(q(k - 1), q(k), [false, true], k, k)];

/** Round half to even: an even integer owns both ends of its stretch, an odd one neither. */
const roundCell: Family = (k) => [cell(q(2 * k - 1, 2), q(2 * k + 1, 2), [k % 2 === 0, k % 2 === 0], k, k)];

/** Toward zero: (-1, 1) is 0, and each stretch beyond it is bounded by the integer nearer zero. */
const integerPartCell: Family = (k) => [
  k >= 1
    ? cell(q(k), q(k + 1), [true, false], k, k)
    : k === 0
      ? cell(q(-1), q(1), [false, false], 0, 0)
      : cell(q(k - 1), q(k), [false, true], k, k),
];

/** The primes up to `limit`, ascending, with 0 before the first. */
function primesUpTo(limit: number): number[] {
  const composite = new Uint8Array(limit + 1);
  const primes: number[] = [];
  for (let n = 2; n <= limit; n++) {
    if (composite[n]) continue;
    primes.push(n);
    for (let m = n * n; m <= limit; m += n) composite[m] = 1;
  }
  return primes;
}

/** The sieve is only built this far; past it the staircase is left alone. */
const MAX_PRIME_BOUND = 1_000_000;

/** `PrimePi` is its count `i` on `[p_i, p_(i+1))`, and 0 below 2. */
function primeCells(top: number): Family | undefined {
  if (!(top <= MAX_PRIME_BOUND)) return undefined;
  // A prime gap below a million is under 120, so this reaches the first prime past `top`.
  const primes = primesUpTo(Math.ceil(top) + 200);
  const at = new Map(primes.map((p, i) => [p, i] as const));
  return (k) => {
    const i = at.get(k);
    if (i === undefined) return k <= 1 ? [cell(q(k), q(k + 1), [true, false], 0, 0)] : [];
    return [cell(q(k), q(primes[i + 1]!), [true, false], i + 1, i + 1)];
  };
}

const constantLinear = (c: Q): Linear => ({ atoms: new Map(), constant: c });
const withLinear = (r: Region, l: Linear): Region => ({ ...r, value: togetherJson(l), linear: l });

/** `g - k` over the cell of `trunc`: `FractionalPart(g)`. */
const fractionalPartCell =
  (g: Linear): Family =>
  (k) =>
    integerPartCell(k).map((r) => withLinear({ ...r, order: -k }, valueOf(g, constantLinear(q(1)), k)));

/** `g - k p` over the unit cell `[k, k + 1)`: `Mod(g, p)`, and the sawtooth with `p = 1`. */
const floorCells =
  (g: Linear, p: Linear): Family =>
  (k) => [withLinear(cell(q(k), q(k + 1), [true, false], 0, -k), valueOf(g, p, k))];

function valueOf(g: Linear, p: Linear, k: number): Linear {
  const out = scaled(g, q(1), q(0));
  addTo(out, p, q(-k));
  return out;
}

const squareCells: Family = (k) => [
  cell(q(k), qAdd(q(k), half), [true, false], 1, 1),
  cell(qAdd(q(k), half), q(k + 1), [true, false], -1, -1),
];

/** Rising 4 (g - k) on [k - 1/4, k + 1/4), falling 2 - 4 (g - k) on [k + 1/4, k + 3/4). */
const triangleCells =
  (g: Linear): Family =>
  (k) => [
    withLinear(cell(q(4 * k - 1, 4), q(4 * k + 1, 4), [true, false], 0, 0), scaled(g, q(4), q(-4 * k))),
    withLinear(cell(q(4 * k + 1, 4), q(4 * k + 3, 4), [true, false], 0, 0), scaled(g, q(-4), q(4 * k + 2))),
  ];

// -- The argument and the modulus -----------------------------------------------------------------------

/** What a staircase's argument is a function of: a symbol, linearly (`2 x - 1`, or bare), or a power or root of one. */
type Argument =
  | { kind: "affine"; symbol: string; a: Q; b: Q; lin: Linear }
  | { kind: "power"; symbol: string; n: number }
  | { kind: "sqrt"; symbol: string }
  | { kind: "cuberoot"; symbol: string };

function argumentOf(g: Expr): Argument | undefined {
  const l = linear(g);
  const atoms = compact(l);
  if (atoms.length === 1 && typeof atoms[0].atom === "string" && !atoms[0].constant)
    return { kind: "affine", symbol: atoms[0].atom, a: atoms[0].coeff, b: l.constant, lin: l };
  const ops = operandsOf(g);
  const base = ops[0] && isSymbol(ops[0]) ? ops[0].symbol : undefined;
  if (base === undefined || base === "Pi") return undefined;
  if (g.operator === "Sqrt" && ops.length === 1) return { kind: "sqrt", symbol: base };
  if (g.operator === "CubeRoot" && ops.length === 1) return { kind: "cuberoot", symbol: base };
  if (g.operator === "Root" && ops.length === 2 && ops[1].is(3)) return { kind: "cuberoot", symbol: base };
  const n = ops[1]?.re;
  if (g.operator === "Power" && ops.length === 2 && ops[1].im === 0 && Number.isInteger(n) && (n as number) >= 2)
    return { kind: "power", symbol: base, n: n as number };
  return undefined;
}

type Modulus =
  | { kind: "number"; p: Q }
  | { kind: "constant"; atom: Json; rho: Q; value: number; lin: Linear }
  | { kind: "symbol"; atom: string; rho: Q; lin: Linear };

/** A positive number, a positive multiple of a constant such as Pi, or of a symbol. */
function modulusOf(ce: Engine, e: Expr | undefined): Modulus | undefined {
  if (!e) return { kind: "number", p: q(1) };
  const l = linear(e);
  const atoms = compact(l);
  if (atoms.length === 0) return qNum(l.constant) > 0 ? { kind: "number", p: l.constant } : undefined;
  if (atoms.length !== 1 || !qIsZero(l.constant) || qNum(atoms[0].coeff) <= 0) return undefined;
  const [{ atom, coeff, constant }] = atoms;
  if (constant) {
    const value = constantValue(box(ce, atom));
    return value !== undefined && value > 0
      ? { kind: "constant", atom, rho: coeff, value: value * qNum(coeff), lin: l }
      : undefined;
  }
  return typeof atom === "string" ? { kind: "symbol", atom, rho: coeff, lin: l } : undefined;
}

/** `r` times an atom: `Pi`, `3 Pi`, `3/2 Pi`. */
const multiple = (r: Q, atom: Json): Json =>
  qIsZero(r) ? 0 : qNum(r) === 1 ? atom : (["Multiply", qJson(r), atom] as Json);

const qPow = (r: Q, n: number): Q => (n === 0 ? q(1) : qMul(r, qPow(r, n - 1)));

/** The `n`th root of a non-negative rational, exactly when it has one in the rationals. */
function exactRoot(e: Q, n: number): Q | undefined {
  const root = (x: number): number | undefined => {
    const r = Math.round(Math.pow(x, 1 / n));
    return r ** n === x ? r : undefined;
  };
  const [top, bottom] = [root(e[0]), root(e[1])];
  return top !== undefined && bottom !== undefined ? q(top, bottom) : undefined;
}

const rootJson = (e: Q, n: number): Json => {
  const exact = exactRoot(e, n);
  if (exact !== undefined) return qJson(exact);
  // Wolfram writes the root of 1/2 as 1/Sqrt[2], and keeps Sqrt[3/2] as it is.
  if (n === 2 && e[0] === 1) return ["Divide", 1, ["Sqrt", e[1]]] as Json;
  return n === 2 ? (["Sqrt", qJson(e)] as Json) : (["Root", qJson(e), n] as Json);
};

function rootNum(x: Num, n: number): Num {
  const exact = x.q && qNum(x.q) >= 0 ? exactRoot(x.q, n) : undefined;
  return exact ? numQ(exact) : num(Math.pow(x.v, 1 / n));
}

const powNum = (x: Num, n: number): Num => (x.q ? numQ(qPow(x.q, n)) : num(x.v ** n));

/** The unit coordinate of `(a s + b) / p` over an interval for `s`: affine, so its ends map to ends. */
function affineAxis(i: Interval, a: Q, b: Q, p: Q, variable: Json): Axis {
  const slope = qDiv(a, p);
  const toUnit = (end: Num): Num => ({
    v: end.v * qNum(slope) + qNum(qDiv(b, p)),
    ...(end.q ? { q: qAdd(qMul(end.q, slope), qDiv(b, p)) } : {}),
  });
  const [lo, hi] = [toUnit(i.lo), toUnit(i.hi)];
  const falling = qNum(slope) < 0;
  return {
    variable,
    falling,
    at: (e) => qJson(qDiv(qAdd(qMul(e, p), qNeg(b)), a)),
    domain: falling
      ? { lo: hi, hi: lo, loOpen: i.hiOpen, hiOpen: i.loOpen }
      : { lo, hi, loOpen: i.loOpen, hiOpen: i.hiOpen },
  };
}

/** `s / (rho C)` for a constant `C`: the ends are numbers, snapped to the multiples of `C` they are. */
function constantAxis(i: Interval, m: { atom: Json; rho: Q; value: number }, variable: Json): Axis {
  const scale = (end: Num): Num => (end.q && qIsZero(end.q) ? numQ(q(0)) : snap(end.v / m.value));
  return {
    variable,
    falling: false,
    at: (e) => multiple(qMul(e, m.rho), m.atom),
    domain: { lo: scale(i.lo), hi: scale(i.hi), loOpen: i.loOpen, hiOpen: i.hiOpen },
  };
}

/** `k / (rho m)`: the conditions compare `k / m`, and the cells are `rho` wide in it. */
function ratioAxis(r: Interval, rho: Q, k: Json, m: Json): Axis {
  const inv = qDiv(q(1), rho);
  const scale = (n: Num): Num => ({ v: n.v * qNum(inv), ...(n.q ? { q: qMul(n.q, inv) } : {}) });
  return {
    variable: ["Divide", k, m] as Json,
    falling: false,
    at: (e) => qJson(qMul(e, rho)),
    domain: { lo: scale(r.lo), hi: scale(r.hi), loOpen: r.loOpen, hiOpen: r.hiOpen },
  };
}

/** `s^n` where it is monotone over `s`: a power past 0 on one side, or an odd one anywhere. */
function powerAxis(i: Interval, n: number, s: Json): Axis | undefined {
  // Wolfram writes the root of a cube or higher power as a `Root` object, which is not rewritten here.
  if (n !== 2) return undefined;
  const rising = n % 2 === 1 || i.lo.v >= 0;
  const falling = !rising && i.hi.v <= 0;
  if (!rising && !falling) return undefined;
  const [lo, hi] = [powNum(falling ? i.hi : i.lo, n), powNum(falling ? i.lo : i.hi, n)];
  return {
    variable: s,
    falling,
    at: (e) => {
      // x is the root of e: negative below zero for an odd power, and on the falling side of an even one.
      const negative = n % 2 === 1 ? qNum(e) < 0 : falling;
      const root = rootJson(n % 2 === 1 && negative ? qNeg(e) : e, n);
      return negative ? (["Negate", root] as Json) : root;
    },
    domain: { lo, hi, loOpen: falling ? i.hiOpen : i.loOpen, hiOpen: falling ? i.loOpen : i.hiOpen },
  };
}

/** The `n`th root of `s` over `s >= 0`: the conditions compare it as it stands. */
function rootAxis(i: Interval, n: number, variable: Json): Axis | undefined {
  if (i.lo.v < 0) return undefined;
  return {
    variable,
    falling: false,
    at: (e) => qJson(e),
    domain: { lo: rootNum(i.lo, n), hi: rootNum(i.hi, n), loOpen: i.loOpen, hiOpen: i.hiOpen },
  };
}

/** The heads whose second argument is a multiple to round to. */
const STEPS_TO_MULTIPLE = new Set(["Floor", "Ceil", "Ceiling", "Round"]);

/** Heads that are one integer on each unit cell, whatever the argument's form. */
const INTEGER_VALUED = new Set(["Floor", "Ceil", "Ceiling", "Round", "IntegerPart"]);

/** `Floor(g, p)`: the multiple of `p` at or below `g`, on the cells of `g / p`. */
const multiples =
  (family: Family, p: Linear): Family =>
  (k) =>
    family(k).map((r) => withLinear(r, scaled(p, q(r.value as number), q(0))));

function bounded(ce: Engine, kn: Knowledge, op: string, args: readonly Expr[]): Json | undefined {
  // `Floor(g, p)` and its kin are `p * Floor(g / p)`; `Mod` and `Quotient` always have a modulus.
  const toMultiple = STEPS_TO_MULTIPLE.has(op) && args.length === 2;
  const modular = op === "Mod" || op === "Quotient" || toMultiple;
  const [g, second] = args;
  if (!g || args.length !== (modular ? 2 : 1)) return undefined;
  const m = modulusOf(ce, modular ? second : undefined);
  const arg = argumentOf(g);
  if (!m || !arg) return undefined;
  const interval = (symbol: string): Interval | undefined => intervalOf(kn, symbol) ?? typedInterval(box(ce, symbol));
  const symbolJson: Json = arg.symbol;

  let axis: Axis | undefined;
  let family: Family | undefined;
  if (arg.kind === "affine") {
    const bare = qNum(arg.a) === 1 && qIsZero(arg.b);
    const i = interval(arg.symbol);
    if (m.kind === "number") axis = i && affineAxis(i, arg.a, arg.b, m.p, symbolJson);
    else if (bare && m.kind === "constant") axis = i && constantAxis(i, m, symbolJson);
    else if (bare && m.kind === "symbol") {
      const r = ratioInterval(kn, JSON.stringify(arg.symbol), JSON.stringify(m.atom));
      axis = r && ratioAxis(r, m.rho, symbolJson, m.atom as Json);
    }
    const pLin = m.kind === "number" ? constantLinear(m.p) : m.lin;
    switch (op) {
      case "Floor":
      case "Quotient":
        family = floorCell;
        break;
      case "Ceil":
      case "Ceiling":
        family = ceilCell;
        break;
      case "Round":
        family = roundCell;
        break;
      case "IntegerPart":
        family = integerPartCell;
        break;
      case "FractionalPart":
        family = fractionalPartCell(arg.lin);
        break;
      case "Mod":
        family = floorCells(arg.lin, pLin);
        break;
      case "SawtoothWave":
        family = floorCells(arg.lin, constantLinear(q(1)));
        break;
      case "SquareWave":
        family = squareCells;
        break;
      case "PrimePi":
        family = axis && primeCells(axis.domain.hi.v);
        break;
      case "TriangleWave":
        family = triangleCells(arg.lin);
        break;
    }
    if (toMultiple && family) family = multiples(family, pLin);
  } else if (INTEGER_VALUED.has(op) && m.kind === "number") {
    const i = interval(arg.symbol);
    if (arg.kind === "power") axis = i && powerAxis(i, arg.n, symbolJson);
    else if (arg.kind === "cuberoot") axis = i && rootAxis(i, 3, ["Power", symbolJson, ["Rational", 1, 3]] as Json);
    else axis = i && rootAxis(i, 2, g.json);
    family =
      op === "Floor" ? floorCell : op === "Round" ? roundCell : op === "IntegerPart" ? integerPartCell : ceilCell;
  }
  return axis && family ? staircase(axis, family) : undefined;
}

/** The step heads: Piecewise-expanded without a real-argument gate (Min .. UnitTriangle), or over a bounded argument. */
export const STEP_HEADS: ReadonlySet<string> = new Set([
  "Max",
  "Min",
  "UnitStep",
  "Clip",
  "Clamp",
  "UnitBox",
  "UnitTriangle",
  "Floor",
  "Ceil",
  "Ceiling",
  "Round",
  "IntegerPart",
  "FractionalPart",
  "Mod",
  "Quotient",
  "SawtoothWave",
  "SquareWave",
  "TriangleWave",
  "PrimePi",
]);

/** `e` as a Piecewise, or `undefined` when it is not a step head or not in a shape that expands. */
export function expandStep(ce: Engine, e: Expr, kn: Knowledge): Expr | undefined {
  const args = operandsOf(e);
  let json: Json | undefined;
  // What the assumptions decide of a branch's condition is not written.
  const narrow = (j: Json | undefined): Json | undefined => (j === undefined ? undefined : narrowPiecewise(ce, kn, j));
  switch (e.operator) {
    case "Max":
    case "Min":
      json = narrow(minMax(e.operator, args));
      break;
    case "UnitStep":
      json = narrow(unitStep(ce, args));
      break;
    case "Clip":
      json = narrow(clip(ce, args));
      break;
    case "Clamp":
      json = narrow(
        args.length === 3 ? clip(ce, [args[0], box(ce, ["List", args[1].json, args[2].json] as Json)]) : undefined,
      );
      break;
    case "UnitBox":
      json = narrow(unitBox(args));
      break;
    case "UnitTriangle":
      json = narrow(unitTriangle(args));
      break;
    default:
      json = bounded(ce, kn, e.operator, args);
  }
  // Evaluated, so a branch the current assumptions decide (`UnitStep(x)` with `x > 0`) is settled.
  return json === undefined ? undefined : box(ce, json).evaluate();
}
