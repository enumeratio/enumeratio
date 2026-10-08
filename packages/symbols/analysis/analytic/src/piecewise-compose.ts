import { box, type Engine, type Expr, type Json, operandsOf } from "@enumeratio/engine";
import {
  cmpNum,
  type Constraint,
  constraintOfJson,
  entails,
  extend,
  isEmpty,
  type Knowledge,
  numNeg,
  type Num,
  numQ,
  type Op,
  opposite,
  pairsOfJson,
  RELATIONS,
} from "./piecewise-assumptions.ts";
import {
  compact,
  compareLinear,
  linear,
  or,
  piecewise,
  type Q,
  qDiv,
  qJson,
  qNeg,
  qNum,
  togetherJson,
} from "./piecewise-linear.ts";
import { chain, expandStep, minMaxPieces, STEP_HEADS } from "./piecewise-rewrites.ts";

// Piecewise composition: a sum, product or power of Piecewise values, or a step head over them,
// is one Piecewise. Each combination of branches gives a value and the conditions of its
// branches together; values that agree share their conditions; a zero value, else the last
// in Wolfram's order, is the default. Conditions are kept as a union of conjunctions of linear
// relations and cut down as far as the assumptions and each other allow: an impossible
// conjunction goes, a relation the rest imply goes, and bounds on one unknown merge into an
// interval (`x <= 0` and `x >= 0` are `x == 0`).

interface Atom {
  /** `a op b` as it is written. */
  readonly json: Json;
  readonly c: Constraint;
  readonly key: string;
}
type Conj = readonly Atom[];
/** A union of conjunctions: `[]` is false, `[[]]` true. */
type Region = readonly Conj[];

const TRUE: Region = [[]];
const FALSE: Region = [];

interface Ctx {
  readonly ce: Engine;
  readonly k: Knowledge;
}

const keyOf = ({ lin, strict }: Constraint): string =>
  `${[...lin.atoms.entries()]
    .map(([key, { coeff }]) => `${key}:${coeff[0]}/${coeff[1]}`)
    .toSorted()
    .join(",")}|${lin.constant.v}|${strict}`;

const negated = ({ lin, strict }: Constraint): Constraint => {
  const atoms = new Map([...lin.atoms].map(([key, a]) => [key, { ...a, coeff: qNeg(a.coeff) }] as const));
  return { lin: { atoms, constant: numNeg(lin.constant) }, strict: !strict };
};

function atomOf(ce: Engine, op: Op, a: Json, b: Json): Atom | undefined {
  const c = constraintOfJson(ce, op, a, b);
  return c && { json: [op, a, b] as Json, c, key: keyOf(c) };
}

/** `cond` as a region, or `undefined` for a condition that is not made of relations. */
function parse(ce: Engine, cond: Json): Region | undefined {
  if (cond === "True") return TRUE;
  if (cond === "False") return FALSE;
  if (!Array.isArray(cond)) return undefined;
  const [head, ...rest] = cond as [string, ...Json[]];
  if (head === "And") {
    const parts = rest.map((r) => parse(ce, r));
    if (parts.some((p) => p === undefined)) return undefined;
    return (parts as Region[]).reduce<Region>((acc, p) => acc.flatMap((x) => p.map((y) => [...x, ...y])), TRUE);
  }
  if (head === "Or") {
    const parts = rest.map((r) => parse(ce, r));
    return parts.some((p) => p === undefined) ? undefined : (parts as Region[]).flat();
  }
  if (head === "Equal" && rest.length === 2) {
    const [lower, upper] = [atomOf(ce, "LessEqual", rest[0], rest[1]), atomOf(ce, "GreaterEqual", rest[0], rest[1])];
    return lower && upper ? [[lower, upper]] : undefined;
  }
  if (RELATIONS.has(head) && rest.length >= 2) {
    const atoms = pairsOfJson(cond).map(([op, a, b]) => atomOf(ce, op, a, b));
    return atoms.every((a) => a !== undefined) ? [atoms as Atom[]] : undefined;
  }
  return undefined;
}

const dedupe = (atoms: readonly Atom[]): Atom[] => {
  const seen = new Set<string>();
  return atoms.filter((a) => (seen.has(a.key) ? false : (seen.add(a.key), true)));
};

const knowing = (cx: Ctx, atoms: readonly Atom[]): Knowledge =>
  extend(
    cx.k,
    atoms.map((a) => a.c),
  );

/** No point satisfies every atom: a bound runs out, or one atom's opposite follows from the others. */
function impossible(cx: Ctx, atoms: readonly Atom[]): boolean {
  const known = knowing(cx, atoms);
  return isEmpty(known) || atoms.some((a) => entails(known, negated(a.c)));
}

function and(cx: Ctx, a: Region, b: Region): Region {
  const out: Conj[] = [];
  for (const x of a)
    for (const y of b) {
      const conj = dedupe([...x, ...y]);
      if (!impossible(cx, conj)) out.push(conj);
    }
  return out;
}

const negate = (a: Atom): Atom => {
  const [[op, x, y]] = pairsOfJson(a.json);
  const json = opposite(op, x, y);
  const c = negated(a.c);
  return { json, c, key: keyOf(c) };
};

/** Everything the region leaves out. */
function not(cx: Ctx, region: Region): Region {
  let out = TRUE;
  for (const conj of region)
    out = and(
      cx,
      out,
      conj.map((a) => [negate(a)]),
    );
  return out;
}

/** Relations the assumptions already settle are not written. */
function trimmed(cx: Ctx, conj: Conj): Conj {
  return conj.filter((a) => !entails(cx.k, a.c));
}

/** Whether every point of `a` is in `b`. */
function within(cx: Ctx, a: Conj, b: Conj): boolean {
  const known = knowing(cx, a);
  return b.every((atom) => entails(known, atom.c));
}

function simplify(cx: Ctx, region: Region): Region {
  let terms = region.filter((conj) => !impossible(cx, conj)).map((conj) => trimmed(cx, conj));
  // A term inside another is redundant.
  terms = terms.filter((a, i) => !terms.some((b, j) => j !== i && within(cx, a, b) && (!within(cx, b, a) || j < i)));
  // A lone relation and a term that has its opposite: the term can do without it.
  for (const lone of terms.filter((t) => t.length === 1)) {
    const flip = negate(lone[0]).key;
    terms = terms.map((t) => (t.length > 1 && t.some((x) => x.key === flip) ? t.filter((x) => x.key !== flip) : t));
  }
  // Terms that differ in one relation and its opposite are one term without it.
  for (let merged = true; merged;) {
    merged = false;
    outer: for (let i = 0; i < terms.length; i++)
      for (let j = i + 1; j < terms.length; j++) {
        const [a, b] = [terms[i], terms[j]];
        if (a.length !== b.length) continue;
        const only = a.filter((x) => !b.some((y) => y.key === x.key));
        const other = b.filter((y) => !a.some((x) => x.key === y.key));
        if (only.length === 1 && other.length === 1 && negate(only[0]).key === other[0].key) {
          terms = terms.filter((_, n) => n !== i && n !== j);
          terms.push(
            trimmed(
              cx,
              a.filter((x) => x !== only[0]),
            ),
          );
          merged = true;
          break outer;
        }
      }
  }
  return terms;
}

function union(cx: Ctx, a: Region, b: Region): Region {
  return simplify(cx, [...a, ...b]);
}

// -- Writing a region -----------------------------------------------------------------------------------

interface Bound {
  readonly at: Q;
  readonly closed: boolean;
}

/** A relation of one unknown against a rational: which unknown, and which side it bounds. */
function singleBound(a: Atom): { symbol: Json; side: "lo" | "hi"; bound: Bound } | undefined {
  const entries = [...a.c.lin.atoms.values()];
  const { constant } = a.c.lin;
  if (entries.length !== 1 || typeof entries[0].atom !== "string" || !constant.q) return undefined;
  const { atom, coeff } = entries[0];
  const at = qDiv(qNeg(constant.q), coeff);
  return { symbol: atom, side: qNum(coeff) > 0 ? "hi" : "lo", bound: { at, closed: !a.c.strict } };
}

interface Span {
  lo?: Bound;
  hi?: Bound;
}

const tighter = (side: "lo" | "hi", a: Bound, b: Bound | undefined): Bound => {
  if (!b) return a;
  const c = cmpNum(numQ(a.at), numQ(b.at));
  if (c === 0) return { at: a.at, closed: a.closed && b.closed };
  return (side === "lo" ? c > 0 : c < 0) ? a : b;
};

function spanOf(conj: Conj): { spans: Map<string, Span>; rest: Atom[] } {
  const spans = new Map<string, Span>();
  const rest: Atom[] = [];
  for (const a of conj) {
    const s = singleBound(a);
    if (!s) {
      rest.push(a);
      continue;
    }
    const span = spans.get(s.symbol as string) ?? {};
    span[s.side] = tighter(s.side, s.bound, span[s.side]);
    spans.set(s.symbol as string, span);
  }
  return { spans, rest };
}

function writeSpan(symbol: Json, { lo, hi }: Span): Json {
  if (lo && hi) {
    if (cmpNum(numQ(lo.at), numQ(hi.at)) === 0 && lo.closed && hi.closed)
      return ["Equal", symbol, qJson(lo.at)] as Json;
    return chain(qJson(lo.at), lo.closed, symbol, qJson(hi.at), hi.closed);
  }
  if (lo) return [lo.closed ? "GreaterEqual" : "Greater", symbol, qJson(lo.at)] as Json;
  return [hi!.closed ? "LessEqual" : "Less", symbol, qJson(hi!.at)] as Json;
}

const nameOrder = (a: string, b: string): number =>
  a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0;

function writeConj(conj: Conj): Json {
  const { spans, rest } = spanOf(conj);
  const parts: Json[] = [...spans.entries()]
    .toSorted(([a], [b]) => nameOrder(a, b))
    .map(([symbol, span]) => writeSpan(symbol, span));
  const written = new Set<Atom>();
  for (const a of rest) {
    // `L <= 0` with `L >= 0` is `L == 0`.
    const twin = rest.find(
      (b) =>
        b !== a &&
        !written.has(b) &&
        !a.c.strict &&
        !b.c.strict &&
        keyOf(negated(a.c)) === keyOf({ ...b.c, strict: true }),
    );
    if (written.has(a)) continue;
    if (twin) {
      written.add(twin);
      const [, left, right] = a.json as [string, Json, Json];
      parts.push(["Equal", left, right] as Json);
    } else parts.push(a.json);
  }
  return parts.length === 0 ? "True" : parts.length === 1 ? parts[0] : (["And", ...parts] as Json);
}

/** Terms that are all bounds on one unknown: its intervals, merged where they touch, lowest first. */
function intervalsOf(region: Region): { symbol: string; spans: Span[] } | undefined {
  let symbol: string | undefined;
  const spans: Span[] = [];
  for (const conj of region) {
    const { spans: found, rest } = spanOf(conj);
    if (rest.length > 0 || found.size !== 1) return undefined;
    const [[name, span]] = [...found.entries()];
    if (symbol !== undefined && name !== symbol) return undefined;
    symbol = name;
    spans.push(span);
  }
  if (symbol === undefined) return undefined;
  const at = (b: Bound): Num => numQ(b.at);
  const sorted = spans.toSorted((a, b) => (a.lo && b.lo ? cmpNum(at(a.lo), at(b.lo)) : a.lo ? 1 : b.lo ? -1 : 0));
  const merged: Span[] = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (!last) merged.push({ ...s });
    else if (last.hi === undefined) continue;
    else {
      const c = s.lo ? cmpNum(at(s.lo), at(last.hi)) : -1;
      if (c < 0 || (c === 0 && (s.lo!.closed || last.hi.closed))) {
        const higher = s.hi === undefined ? 1 : cmpNum(at(s.hi), at(last.hi)) || (s.hi.closed ? 1 : 0);
        if (higher > 0) last.hi = s.hi;
      } else merged.push({ ...s });
    }
  }
  // Wolfram lists the higher interval first.
  return { symbol, spans: merged.toReversed() };
}

function writeRegion(region: Region): Json {
  if (region.some((conj) => conj.length === 0)) return "True";
  const intervals = intervalsOf(region);
  if (intervals) return or(intervals.spans.map((s) => writeSpan(intervals.symbol, s)));
  return or(region.map(writeConj));
}

// -- Cells of a Piecewise, and the composition ----------------------------------------------------------------

interface Cell {
  readonly value: Json;
  readonly region: Region;
}

/** The stretches of a Piecewise: each branch where it is reached, and the default where none is. */
function cellsOf(cx: Ctx, pw: Json): Cell[] | undefined {
  if (!Array.isArray(pw) || pw[0] !== "Piecewise") return undefined;
  const [, clauses, fallback] = pw as [string, Json, Json?];
  if (!Array.isArray(clauses) || clauses[0] !== "List") return undefined;
  const cells: Cell[] = [];
  let before: Region = FALSE;
  for (const clause of (clauses as Json[]).slice(1)) {
    if (!Array.isArray(clause) || clause[0] !== "List" || clause.length !== 3) return undefined;
    const region = parse(cx.ce, clause[2] as Json);
    if (!region) return undefined;
    const reached = simplify(cx, and(cx, region, not(cx, before)));
    if (reached.length > 0) cells.push({ value: clause[1] as Json, region: reached });
    before = union(cx, before, region);
  }
  const rest = simplify(cx, not(cx, before));
  if (rest.length > 0) cells.push({ value: fallback ?? 0, region: rest });
  return cells;
}

/** A value as Wolfram writes it: a value linear in its unknowns the way `Together` has it (`2 (x - 1)`), any other as evaluated. */
function valueJson(ce: Engine, value: Json): Json {
  const e = box(ce, value).evaluate();
  const l = linear(e);
  return compact(l).every((a) => typeof a.atom === "string") ? togetherJson(l) : e.json;
}

/** Heads whose value at a point is a function of their arguments' values there. */
const POINTWISE = new Set([
  "Add",
  "Multiply",
  "Power",
  "Sqrt",
  "Negate",
  "Divide",
  "Subtract",
  "Exp",
  "Ln",
  "Log",
  "Sin",
  "Cos",
  "Tan",
  "Sinh",
  "Cosh",
  "Tanh",
  "Arctan",
]);
const MAX_COMBINATIONS = 64;

/**
 * `op` applied to operands some of which are Piecewise, as one Piecewise; `undefined` when the
 * head is not pointwise, a condition is not made of relations, or there are too many branches.
 */
export function compose(ce: Engine, k: Knowledge, op: string, operands: readonly Expr[]): Expr | undefined {
  if (!POINTWISE.has(op) && !STEP_HEADS.has(op)) return undefined;
  const cx: Ctx = { ce, k };
  const factors = operands.map((o) => (o.operator === "Piecewise" ? cellsOf(cx, o.json) : null));
  if (factors.some((f) => f === undefined) || factors.every((f) => f === null)) return undefined;
  // A piecewise buried in an operand that is not one cannot be composed here.
  if (operands.some((o, i) => factors[i] === null && JSON.stringify(o.json).includes('"Piecewise"'))) return undefined;
  const size = factors.reduce((n, f) => n * (f?.length ?? 1), 1);
  if (size > MAX_COMBINATIONS) return undefined;

  const entries: { value: Json; region: Region }[] = [];
  const walk = (i: number, picked: readonly (Cell | null)[], region: Region): void => {
    if (region.length === 0) return;
    if (i === factors.length) {
      const args = operands.map((o, n) => picked[n]?.value ?? o.json);
      let value = box(ce, [op, ...args] as Json).evaluate();
      let nested: Cell[] | undefined;
      if (value.operator === "Max" || value.operator === "Min") {
        // Every argument's own condition: the last one's is not the complement of the others'.
        const pieces = minMaxPieces(value.operator, operandsOf(value));
        const regions = pieces?.map((p) => parse(ce, p.cond));
        if (pieces && regions?.every((r) => r !== undefined))
          nested = pieces.map((p, n) => ({ value: p.value.json, region: regions[n]! }));
      } else if (STEP_HEADS.has(value.operator)) {
        const expanded = expandStep(ce, value, k);
        if (expanded) value = expanded;
      }
      if (!nested && value.operator === "Piecewise") nested = cellsOf(cx, value.json);
      if (!nested && value.operator === "Piecewise") return void entries.push({ value: value.json, region });
      for (const cell of nested ?? [{ value: value.json, region: TRUE }]) {
        const joined = and(cx, region, cell.region);
        if (joined.length > 0) entries.push({ value: valueJson(ce, cell.value), region: joined });
      }
      return;
    }
    const cells = factors[i];
    if (cells === null) return walk(i + 1, [...picked, null], region);
    for (const cell of cells!) walk(i + 1, [...picked, cell], and(cx, region, cell.region));
  };
  walk(0, [], TRUE);
  if (entries.length === 0) return undefined;

  const groups = new Map<string, { value: Json; region: Region }>();
  for (const { value, region } of entries) {
    const key = JSON.stringify(value);
    const have = groups.get(key);
    groups.set(key, { value, region: have ? union(cx, have.region, region) : simplify(cx, region) });
  }
  const all = [...groups.values()];
  if (all.length === 1) return box(ce, all[0].value).evaluate();
  const ordered = all.toSorted((a, b) => compareLinear(linear(box(ce, a.value)), linear(box(ce, b.value))));
  const zero = ordered.findIndex((g) => g.value === 0);
  const fallback = zero >= 0 ? zero : ordered.length - 1;
  const json = piecewise(
    ordered.filter((_, i) => i !== fallback).map((g) => [g.value, writeRegion(g.region)] as const),
    ordered[fallback].value,
  );
  return box(ce, json).evaluate();
}
