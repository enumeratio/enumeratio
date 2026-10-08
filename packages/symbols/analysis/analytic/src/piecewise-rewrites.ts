import { bigRationalAt, box, type Engine, type Expr, isSymbol, type Json, operandsOf } from "@enumeratio/engine";

// The PiecewiseExpand rewrites for the step-like heads, in Wolfram's own form: the same
// branch conditions (`a - b >= 0`, `x <= 2`), the same branch order, and the same default.
//
//   - Min, Max, UnitStep, Clip, UnitBox, UnitTriangle expand over any argument, with no
//     assumption: unlike Abs and Sign, nothing about them needs a real argument.
//   - Floor, Ceil, Round, IntegerPart, FractionalPart, Mod, Quotient, SawtoothWave,
//     SquareWave, TriangleWave expand over a symbol bounded on both sides, as Wolfram does
//     from `Assuming`'s or the second argument's `0 < x < 3`. A span of 100 or more is left
//     alone, as Wolfram leaves it.
//
// A branch whose value is 0 is the Piecewise default (0 when omitted); with none, the last
// branch in value order is the default and carries no condition.

// Exact small rationals: breakpoints are integers, halves and quarters.
type Q = readonly [number, number];
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const q = (n: number, d = 1): Q => {
  const sign = d < 0 ? -1 : 1;
  const g = gcd(n, d) || 1;
  return [(sign * n) / g, (sign * d) / g];
};
const qAdd = (a: Q, b: Q): Q => q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const qMul = (a: Q, b: Q): Q => q(a[0] * b[0], a[1] * b[1]);
const qNeg = (a: Q): Q => [-a[0], a[1]];
const qDiv = (a: Q, b: Q): Q => q(a[0] * b[1], a[1] * b[0]);
const qNum = (a: Q): number => a[0] / a[1];
const qJson = (a: Q): Json => (a[1] === 1 ? a[0] : (["Rational", a[0], a[1]] as Json));
const qIsZero = (a: Q): boolean => a[0] === 0;

const rationalAt = (e: Expr): Q | undefined => {
  const r = bigRationalAt(e);
  if (r === undefined) return undefined;
  const [n, d] = r;
  return Number.isSafeInteger(Number(n)) && Number.isSafeInteger(Number(d)) ? q(Number(n), Number(d)) : undefined;
};

// -- Linear forms: `a - b >= 0` is written with its constant moved across ---------------------

interface Atom {
  readonly atom: Json;
  readonly constant: boolean;
  coeff: Q;
}

interface Linear {
  readonly atoms: Map<string, Atom>;
  constant: Q;
}

/** A number written with no unknown in it (`Pi`, `Sqrt(2)`): a constant, though not a rational one. */
const isConstant = (e: Expr): boolean => e.unknowns.length === 0;

const addTo = (into: Linear, from: Linear, scale: Q): void => {
  into.constant = qAdd(into.constant, qMul(from.constant, scale));
  for (const [key, { atom, coeff, constant }] of from.atoms) {
    const have = into.atoms.get(key);
    if (have) have.coeff = qAdd(have.coeff, qMul(coeff, scale));
    else into.atoms.set(key, { atom, constant, coeff: qMul(coeff, scale) });
  }
};

function linear(e: Expr): Linear {
  const out: Linear = { atoms: new Map(), constant: q(0) };
  const value = rationalAt(e);
  if (value !== undefined) {
    out.constant = value;
    return out;
  }
  const ops = operandsOf(e);
  if (e.operator === "Add") for (const o of ops) addTo(out, linear(o), q(1));
  else if (e.operator === "Subtract" && ops.length === 2) {
    addTo(out, linear(ops[0]), q(1));
    addTo(out, linear(ops[1]), q(-1));
  } else if (e.operator === "Negate" && ops.length === 1) addTo(out, linear(ops[0]), q(-1));
  else if (
    e.operator === "Divide" &&
    ops.length === 2 &&
    rationalAt(ops[1]) !== undefined &&
    !qIsZero(rationalAt(ops[1])!)
  )
    addTo(out, linear(ops[0]), qDiv(q(1), rationalAt(ops[1])!));
  else if (e.operator === "Multiply") {
    const scale = ops.map(rationalAt).filter((c): c is Q => c !== undefined);
    const rest = ops.filter((o) => rationalAt(o) === undefined);
    const factor = scale.reduce(qMul, q(1));
    if (rest.length === 1) addTo(out, linear(rest[0]), factor);
    else if (rest.length > 1 && scale.length > 0) {
      const product = ["Multiply", ...rest.map((r) => r.json)] as Json;
      out.atoms.set(JSON.stringify(product), { atom: product, constant: rest.every(isConstant), coeff: factor });
    } else out.atoms.set(JSON.stringify(e.json), { atom: e.json, constant: isConstant(e), coeff: q(1) });
  } else out.atoms.set(JSON.stringify(e.json), { atom: e.json, constant: isConstant(e), coeff: q(1) });
  return out;
}

const compact = (l: Linear): Atom[] => [...l.atoms.values()].filter((a) => !qIsZero(a.coeff));

type Relation = "Less" | "LessEqual" | "Greater" | "GreaterEqual";
const FLIP: Record<Relation, Relation> = {
  Less: "Greater",
  LessEqual: "GreaterEqual",
  Greater: "Less",
  GreaterEqual: "LessEqual",
};

const termJson = (coeff: Q, atom: Json): Json =>
  qNum(coeff) === 1
    ? atom
    : qNum(coeff) === -1
      ? (["Negate", atom] as Json)
      : (["Multiply", qJson(coeff), atom] as Json);

/** `a op b` as Wolfram writes it: one unknown against a constant (`x <= 2`, `x <= Pi`), else the difference against 0 (`x - y >= 0`). */
function relation(op: Relation, a: Expr, b: Expr): Json | undefined {
  const diff = linear(a);
  addTo(diff, linear(b), q(-1));
  const atoms = compact(diff);
  if (atoms.length === 0) return undefined;
  const unknowns = atoms.filter((t) => !t.constant);
  const constants = atoms.filter((t) => t.constant);
  if (unknowns.length === 1 && constants.length === 0) {
    const { atom, coeff } = unknowns[0];
    return [qNum(coeff) < 0 ? FLIP[op] : op, atom, qJson(qDiv(qNeg(diff.constant), coeff))] as Json;
  }
  if (unknowns.length === 1 && Math.abs(qNum(unknowns[0].coeff)) === 1) {
    // x * k + C op 0 with k = +-1 reads x op' -C / k
    const { atom, coeff } = unknowns[0];
    const rest = linearJson({ atoms: new Map(constants.map((t, i) => [String(i), t])), constant: diff.constant });
    return [qNum(coeff) < 0 ? FLIP[op] : op, atom, qNum(coeff) > 0 ? negated(rest) : rest] as Json;
  }
  return [op, ["Add", ...atoms.map(({ atom, coeff }) => termJson(coeff, atom))], qJson(qNeg(diff.constant))] as Json;
}

const negated = (j: Json): Json => (typeof j === "number" ? -j : (["Negate", j] as Json));

const and = (conds: readonly Json[]): Json => (conds.length === 1 ? conds[0] : (["And", ...conds] as Json));
const clause = ([value, cond]: readonly [Json, Json]): Json => ["List", value, cond] as Json;
const piecewise = (branches: readonly (readonly [Json, Json])[], fallback: Json): Json =>
  branches.length === 0 ? fallback : (["Piecewise", ["List", ...branches.map(clause)] as Json, fallback] as Json);

// -- Wolfram's canonical order, as far as these rewrites need it ------------------------------

/** Wolfram sorts names without regard to case, lowercase first on a tie. */
const nameOrder = (a: string, b: string): number =>
  a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : a === b ? 0 : a > b ? -1 : 1;

const firstSymbol = (e: Expr): string | undefined => {
  if (isSymbol(e)) return e.symbol;
  for (const o of operandsOf(e)) {
    const s = firstSymbol(o);
    if (s !== undefined) return s;
  }
  return undefined;
};

const leaves = (e: Expr): number => {
  const ops = operandsOf(e);
  return ops.length === 0 ? 1 : ops.reduce((n, o) => n + leaves(o), 0);
};

/** The value of a number or a constant such as `Pi`, or `undefined` for anything with an unknown in it. */
const constantValue = (e: Expr): number | undefined => {
  const r = rationalAt(e);
  if (r !== undefined) return qNum(r);
  if (!isConstant(e)) return undefined;
  const value = e.N();
  return value.im === 0 && Number.isFinite(value.re) ? value.re : undefined;
};

/** Numbers first, then by the leading symbol (`x` before `Abs(y)`, `Sqrt(x)` before `y`), then the simpler expression. */
function sortedByWolfram<T>(items: readonly T[], of: (t: T) => Expr): T[] {
  const keyed = items.map((item, index) => ({ item, index, e: of(item), number: constantValue(of(item)) }));
  keyed.sort((a, b) => {
    if (a.number !== undefined && b.number !== undefined) return a.number - b.number;
    if (a.number !== undefined) return -1;
    if (b.number !== undefined) return 1;
    const bySymbol = nameOrder(firstSymbol(a.e) ?? "", firstSymbol(b.e) ?? "");
    return bySymbol || leaves(a.e) - leaves(b.e) || a.index - b.index;
  });
  return keyed.map((k) => k.item);
}

const hasPiecewise = (e: Expr): boolean => e.operator === "Piecewise" || operandsOf(e).some(hasPiecewise);
const isNonReal = (e: Expr): boolean => Number.isFinite(e.im) && e.im !== 0;

// -- Min, Max -----------------------------------------------------------------------------------

function minMax(kind: "Max" | "Min", given: readonly Expr[]): Json | undefined {
  const args = given.length === 1 && given[0].operator === "List" ? operandsOf(given[0]) : given;
  if (args.length < 2 || !args.every((a) => !hasPiecewise(a) && !isNonReal(a))) return undefined;
  const a = sortedByWolfram(args, (e) => e);
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
  return assemble(pieces);
}

// -- UnitStep, UnitBox, UnitTriangle ------------------------------------------------------------

const plain = (a: Expr): boolean => a.operator !== "List" && !hasPiecewise(a) && !isNonReal(a);

function unitStep(ce: Engine, args: readonly Expr[]): Json | undefined {
  if (args.length === 0 || !args.every(plain)) return undefined;
  const zero = box(ce, 0);
  const conds = args.map((a) => relation("GreaterEqual", a, zero));
  return conds.every((c) => c !== undefined) ? piecewise([[1, and(conds)]], 0) : undefined;
}

/** `u` as `scale * atom + shift`, when it is linear in one atom. */
function affine(u: Expr): { atom: Json; scale: Q; shift: Q } | undefined {
  const l = linear(u);
  const atoms = compact(l);
  return atoms.length === 1 ? { atom: atoms[0].atom, scale: atoms[0].coeff, shift: l.constant } : undefined;
}

function chain(lo: Json, loClosed: boolean, x: Json, hi: Json, hiClosed: boolean): Json {
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

const scaled = (l: Linear, factor: Q, shift: Q): Linear => {
  const out: Linear = { atoms: new Map(), constant: shift };
  addTo(out, l, factor);
  return out;
};

function linearJson(l: Linear): Json {
  const terms = compact(l).map(({ atom, coeff }) => termJson(coeff, atom));
  if (!qIsZero(l.constant)) terms.push(qJson(l.constant));
  return terms.length === 0 ? 0 : terms.length === 1 ? terms[0] : (["Add", ...terms] as Json);
}

/** 1 - u on 0 <= u <= 1, 1 + u on -1 <= u < 0, 0 elsewhere; the branch whose value falls with x first. */
function unitTriangle(args: readonly Expr[]): Json | undefined {
  if (args.length !== 1 || !plain(args[0])) return undefined;
  const [u] = args;
  const f = affine(u);
  if (f === undefined) return undefined;
  const l = linear(u);
  const falling = [linearJson(scaled(l, q(-1), q(1))), between(u, q(0), q(1), true, true)] as const;
  const rising = [linearJson(scaled(l, q(1), q(1))), between(u, q(-1), q(0), true, false)] as const;
  return piecewise(qNum(f.scale) > 0 ? [falling, rising] : [rising, falling], 0);
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

/** What assumptions say about a symbol: `lo (<|<=) x (<|<=) hi`, finite on both sides. */
interface Domain {
  readonly lo: number;
  readonly hi: number;
  readonly loOpen: boolean;
  readonly hiOpen: boolean;
}

interface NumericType {
  readonly kind?: string;
  readonly type?: string;
  readonly lower?: number;
  readonly upper?: number;
  readonly lowerOpen?: boolean;
  readonly upperOpen?: boolean;
}

/** Wolfram leaves a staircase alone from a span of 100. */
const MAX_SPAN = 100;

function domainOf(x: Expr): Domain | undefined {
  const t = x.type.type as NumericType | string;
  if (typeof t !== "object" || t.kind !== "numeric" || (t.type !== "real" && t.type !== "finite_real"))
    return undefined;
  const { lower, upper } = t;
  if (lower === undefined || upper === undefined || !Number.isFinite(lower) || !Number.isFinite(upper))
    return undefined;
  if (upper < lower || upper - lower >= MAX_SPAN) return undefined;
  return { lo: lower, hi: upper, loOpen: t.lowerOpen === true, hiOpen: t.upperOpen === true };
}

/** One stretch of x where the function is one expression. */
interface Region {
  readonly lo: Q;
  readonly hi: Q;
  readonly loClosed: boolean;
  readonly hiClosed: boolean;
  readonly value: Json;
  /** Branches go in ascending `order`. */
  readonly order: number;
}

/** Every region of period `k`: a family lists the cells of one period, and the loop covers the domain. */
type Family = (k: number) => readonly Region[];

/** The region cut to the domain, and which of its ends the domain does not already say. */
function cut(r: Region, d: Domain): { lower: boolean; upper: boolean } | undefined {
  const [rlo, rhi] = [qNum(r.lo), qNum(r.hi)];
  const lo = rlo > d.lo ? rlo : d.lo;
  const hi = rhi < d.hi ? rhi : d.hi;
  const loIn = rlo > d.lo ? r.loClosed : rlo < d.lo ? !d.loOpen : r.loClosed && !d.loOpen;
  const hiIn = rhi < d.hi ? r.hiClosed : rhi > d.hi ? !d.hiOpen : r.hiClosed && !d.hiOpen;
  if (lo > hi || (lo === hi && !(loIn && hiIn))) return undefined;
  return {
    lower: !(rlo < d.lo || (rlo === d.lo && (r.loClosed || d.loOpen))),
    upper: !(rhi > d.hi || (rhi === d.hi && (r.hiClosed || d.hiOpen))),
  };
}

function staircase(x: Json, d: Domain, step: Q, family: Family): Json | undefined {
  const first = Math.floor(d.lo / qNum(step)) - 1;
  const last = Math.ceil(d.hi / qNum(step)) + 1;
  const groups = new Map<string, { value: Json; order: number; conds: Json[] }>();
  for (let k = first; k <= last; k++) {
    for (const r of family(k)) {
      const edges = cut(r, d);
      if (!edges) continue;
      const cond: Json =
        edges.lower && edges.upper
          ? chain(qJson(r.lo), r.loClosed, x, qJson(r.hi), r.hiClosed)
          : edges.lower
            ? ([r.loClosed ? "GreaterEqual" : "Greater", x, qJson(r.lo)] as Json)
            : ([r.hiClosed ? "LessEqual" : "Less", x, qJson(r.hi)] as Json);
      const key = JSON.stringify(r.value);
      const group = groups.get(key);
      if (group) group.conds.push(cond);
      else groups.set(key, { value: r.value, order: r.order, conds: [cond] });
    }
  }
  const ordered = [...groups.values()].toSorted((a, b) => a.order - b.order);
  if (ordered.length === 0) return undefined;
  const zero = ordered.findIndex((g) => g.value === 0);
  const fallback = zero >= 0 ? zero : ordered.length - 1;
  return piecewise(
    ordered
      .filter((_, i) => i !== fallback)
      .map((g) => [g.value, g.conds.length === 1 ? g.conds[0] : (["Or", ...g.conds] as Json)] as const),
    ordered[fallback].value,
  );
}

const half = q(1, 2);
const shifted = (x: Json, by: Q): Json => (qIsZero(by) ? x : (["Add", x, qJson(by)] as Json));
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

const fractionalPartCell =
  (x: Json): Family =>
  (k) =>
    integerPartCell(k).map((r) => ({ ...r, value: shifted(x, q(-k)), order: -k }));

/** Width-`p` floor cells: `Mod(x, p)`, `Quotient(x, p)` and the sawtooth. */
const floorCells =
  (p: Q, value: (k: number) => Json, order: (k: number) => number): Family =>
  (k) => [cell(qMul(q(k), p), qMul(q(k + 1), p), [true, false], value(k), order(k))];

const squareCells: Family = (k) => [
  cell(q(k), qAdd(q(k), half), [true, false], 1, 1),
  cell(qAdd(q(k), half), q(k + 1), [true, false], -1, -1),
];

/** Rising 4 (x - k) on [k - 1/4, k + 1/4), falling -2 (2 x - 2 k - 1) on [k + 1/4, k + 3/4); rising first, each from the top down. */
const triangleCells =
  (x: Json): Family =>
  (k) => [
    cell(q(4 * k - 1, 4), q(4 * k + 1, 4), [true, false], ["Multiply", 4, shifted(x, q(-k))] as Json, -k),
    cell(
      q(4 * k + 1, 4),
      q(4 * k + 3, 4),
      [true, false],
      ["Multiply", -2, shifted(["Multiply", 2, x] as Json, q(-(2 * k + 1)))] as Json,
      1000 - k,
    ),
  ];

function bounded(op: string, args: readonly Expr[]): Json | undefined {
  const [x, second] = args;
  if (!x || !isSymbol(x)) return undefined;
  const domain = domainOf(x);
  if (domain === undefined) return undefined;
  const s = x.json;
  const one = q(1);
  if (op === "Mod" || op === "Quotient") {
    const p = second && args.length === 2 ? rationalAt(second) : undefined;
    // Integer moduli only: Wolfram orders a fractional modulus's branches by an unrelated rule.
    if (p === undefined || p[1] !== 1 || p[0] <= 0) return undefined;
    return staircase(
      s,
      domain,
      p,
      op === "Mod"
        ? floorCells(
            p,
            (k) => shifted(s, qNeg(qMul(q(k), p))),
            (k) => -qNum(qMul(q(k), p)),
          )
        : floorCells(
            p,
            (k) => k,
            (k) => k,
          ),
    );
  }
  if (args.length !== 1) return undefined;
  switch (op) {
    case "Floor":
      return staircase(s, domain, one, floorCell);
    case "Ceil":
    case "Ceiling":
      return staircase(s, domain, one, ceilCell);
    case "Round":
      return staircase(s, domain, one, roundCell);
    case "IntegerPart":
      return staircase(s, domain, one, integerPartCell);
    case "FractionalPart":
      return staircase(s, domain, one, fractionalPartCell(s));
    case "SawtoothWave":
      return staircase(
        s,
        domain,
        one,
        floorCells(
          one,
          (k) => shifted(s, q(-k)),
          (k) => -k,
        ),
      );
    case "SquareWave":
      return staircase(s, domain, one, squareCells);
    case "TriangleWave":
      return staircase(s, domain, one, triangleCells(s));
    default:
      return undefined;
  }
}

/** The step heads: Piecewise-expanded without a real-argument gate (Min .. UnitTriangle), or over a bounded symbol. */
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
]);

/** `e` as a Piecewise, or `undefined` when it is not a step head or not in a shape that expands. */
export function expandStep(ce: Engine, e: Expr): Expr | undefined {
  const args = operandsOf(e);
  let json: Json | undefined;
  switch (e.operator) {
    case "Max":
    case "Min":
      json = minMax(e.operator, args);
      break;
    case "UnitStep":
      json = unitStep(ce, args);
      break;
    case "Clip":
      json = clip(ce, args);
      break;
    case "Clamp":
      json = args.length === 3 ? clip(ce, [args[0], box(ce, ["List", args[1].json, args[2].json] as Json)]) : undefined;
      break;
    case "UnitBox":
      json = unitBox(args);
      break;
    case "UnitTriangle":
      json = unitTriangle(args);
      break;
    default:
      json = bounded(e.operator, args);
  }
  // Evaluated, so a branch the current assumptions decide (`UnitStep(x)` with `x > 0`) is settled.
  return json === undefined ? undefined : box(ce, json).evaluate();
}
