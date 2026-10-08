import { box, type Engine, type Expr, isSymbol, type Json, operandsOf } from "@enumeratio/engine";
import {
  type Atom,
  compact,
  constantValue,
  emptyLinear,
  type Linear,
  linear,
  q,
  type Q,
  qAdd,
  qCmp,
  qDiv,
  qIsZero,
  qMul,
  qNeg,
  qNum,
} from "./piecewise-linear.ts";

// What PiecewiseExpand knows about its variables, from the assumptions it was given (the second
// argument, or an enclosing `Assuming`): an interval per unknown, read off bounds that are
// linear, or a power of one unknown against a constant. Wolfram solves `x^2 < 3` and `0 < x < 3 y`
// with `0 < y < 1` into bounds on x, and a condition the bounds decide is dropped from the
// Piecewise it writes.

// -- The conditions in force ------------------------------------------------------------------------

const stacks = new WeakMap<Engine, Expr[][]>();

/** Runs `body` with `conds` among the assumed conditions, so a rewrite inside it can read them back. */
export function withAssumed<T>(ce: Engine, conds: readonly Expr[], body: () => T): T {
  const stack = stacks.get(ce) ?? [];
  stacks.set(ce, stack);
  stack.push([...conds]);
  try {
    return body();
  } finally {
    stack.pop();
  }
}

const assumedBy = (ce: Engine): readonly Expr[] => (stacks.get(ce) ?? []).flat();

// -- Numbers that stay exact while they can ---------------------------------------------------------

/** A bound: exact when it came from rationals, otherwise a double. */
export interface Num {
  readonly v: number;
  readonly q?: Q;
}
export const num = (v: number): Num => ({ v });
export const numQ = (r: Q): Num => ({ v: qNum(r), q: r });
const NEG_INF: Num = { v: -Infinity };
const POS_INF: Num = { v: Infinity };

export const numAdd = (a: Num, b: Num): Num => ({ v: a.v + b.v, ...(a.q && b.q ? { q: qAdd(a.q, b.q) } : {}) });
export const numScale = (a: Num, c: Q): Num => ({ v: a.v * qNum(c), ...(a.q ? { q: qMul(a.q, c) } : {}) });
export const numNeg = (a: Num): Num => numScale(a, q(-1));

/** Ties are exact between rationals; otherwise within a rounding error of each other. */
export function cmpNum(a: Num, b: Num): number {
  if (a.q && b.q) return qCmp(a.q, b.q);
  if (a.v === b.v) return 0;
  if (!Number.isFinite(a.v) || !Number.isFinite(b.v)) return a.v < b.v ? -1 : 1;
  const scale = Math.max(1, Math.abs(a.v), Math.abs(b.v));
  return Math.abs(a.v - b.v) <= 1e-12 * scale ? 0 : a.v < b.v ? -1 : 1;
}

export interface Interval {
  readonly lo: Num;
  readonly hi: Num;
  readonly loOpen: boolean;
  readonly hiOpen: boolean;
}

const everything: Interval = { lo: NEG_INF, hi: POS_INF, loOpen: true, hiOpen: true };
export const isBounded = (i: Interval): boolean => Number.isFinite(i.lo.v) && Number.isFinite(i.hi.v);

// -- Conditions as linear forms ---------------------------------------------------------------------

/** `sum of coeff * unknown + constant`, the unknowns by their JSON. */
export interface Lin {
  readonly atoms: Map<string, { readonly atom: Json; coeff: Q }>;
  constant: Num;
}

/** `lin <= 0`, or `lin < 0` when strict. */
export interface Constraint {
  readonly lin: Lin;
  readonly strict: boolean;
}

function toLin(l: Linear, constantOf: (a: Atom) => number | undefined): Lin | undefined {
  const out: Lin = { atoms: new Map(), constant: numQ(l.constant) };
  for (const a of compact(l)) {
    if (a.constant) {
      const value = constantOf(a);
      if (value === undefined) return undefined;
      out.constant = numAdd(out.constant, num(value * qNum(a.coeff)));
    } else out.atoms.set(JSON.stringify(a.atom), { atom: a.atom, coeff: a.coeff });
  }
  return out;
}

export const RELATIONS = new Set(["Less", "LessEqual", "Greater", "GreaterEqual"]);
export type Op = "Less" | "LessEqual" | "Greater" | "GreaterEqual";
const INEQUALITY_OPS = new Set<string>(RELATIONS);

/** The pairs `a op b` in a relation or an `Inequality` chain. */
function pairsOf(e: Expr): { op: Op; a: Expr; b: Expr }[] | undefined {
  const ops = operandsOf(e);
  if (RELATIONS.has(e.operator) && ops.length >= 2)
    return ops.slice(1).map((b, i) => ({ op: e.operator as Op, a: ops[i], b }));
  if (e.operator === "Inequality" && ops.length >= 3 && ops.length % 2 === 1) {
    const out: { op: Op; a: Expr; b: Expr }[] = [];
    for (let i = 0; i + 2 < ops.length; i += 2) {
      const mid = ops[i + 1];
      const op = isSymbol(mid) ? mid.symbol : undefined;
      if (op === undefined || !INEQUALITY_OPS.has(op)) return undefined;
      out.push({ op: op as Op, a: ops[i], b: ops[i + 2] });
    }
    return out;
  }
  return undefined;
}

/** `a op b` as a constraint on `a - b` (or `b - a`). */
function constraintOf(
  op: Op,
  a: Expr,
  b: Expr,
  constantOf: (atom: Atom) => number | undefined,
): { constraint: Constraint } | undefined {
  const flipped = op === "Greater" || op === "GreaterEqual";
  const l = emptyLinear();
  for (const [e, sign] of [
    [a, flipped ? -1 : 1],
    [b, flipped ? 1 : -1],
  ] as const) {
    const part = linear(e);
    l.constant = qAdd(l.constant, qMul(part.constant, q(sign)));
    for (const [key, atom] of part.atoms) {
      const have = l.atoms.get(key);
      if (have) have.coeff = qAdd(have.coeff, qMul(atom.coeff, q(sign)));
      else l.atoms.set(key, { ...atom, coeff: qMul(atom.coeff, q(sign)) });
    }
  }
  const lin = toLin(l, constantOf);
  if (!lin) return undefined;
  return { constraint: { lin, strict: op === "Less" || op === "Greater" } };
}

/** A single unknown raised to an integer power, as `linear` reads it: `Power(x, n)`. */
function powerAtom(atom: Json): { symbol: string; n: number } | undefined {
  if (!Array.isArray(atom) || atom[0] !== "Power" || atom.length !== 3) return undefined;
  const [, base, exponent] = atom as [string, Json, Json];
  return typeof base === "string" && typeof exponent === "number" && Number.isInteger(exponent) && exponent >= 2
    ? { symbol: base, n: exponent }
    : undefined;
}

function nthRoot(t: number, n: number): Num {
  const r = n === 2 ? Math.sqrt(t) : n === 3 ? Math.cbrt(t) : Math.pow(t, 1 / n);
  const exact = Math.round(r);
  return Math.abs(exact ** n - t) === 0 ? numQ(q(exact)) : num(r);
}

// -- What the assumptions say -------------------------------------------------------------------------

export interface Knowledge {
  readonly constraints: readonly Constraint[];
  /** An interval per unknown, by the unknown's JSON. */
  readonly box: ReadonlyMap<string, Interval>;
}

const none: Knowledge = { constraints: [], box: new Map() };

// The conditions of a held call are not canonical (`Rational(5, 2)` is still a call), and `linear` reads numbers.
const flatten = (given: Expr): Expr[] => {
  const e = given.canonical;
  return e.operator === "And" || e.operator === "List" ? operandsOf(e).flatMap(flatten) : [e];
};

/** Intersects a bound into the interval for `key`; false when it was already known. */
function narrowBox(boxed: Map<string, Interval>, key: string, side: "lo" | "hi", bound: Num, open: boolean): boolean {
  const have = boxed.get(key) ?? everything;
  const c = cmpNum(bound, have[side]);
  const tighter = side === "lo" ? c > 0 : c < 0;
  const moreOpen = c === 0 && open && !(side === "lo" ? have.loOpen : have.hiOpen);
  if (!tighter && !moreOpen) return false;
  boxed.set(key, side === "lo" ? { ...have, lo: bound, loOpen: open } : { ...have, hi: bound, hiOpen: open });
  return true;
}

/** The interval a linear form ranges over, the unknowns taken independently. */
export function rangeOf(lin: Lin, boxed: ReadonlyMap<string, Interval>, skip?: string): Interval {
  let lo = lin.constant;
  let hi = lin.constant;
  let loOpen = false;
  let hiOpen = false;
  for (const [key, { coeff }] of lin.atoms) {
    if (key === skip) continue;
    const i = boxed.get(key) ?? everything;
    const [a, b, aOpen, bOpen] = qNum(coeff) >= 0 ? [i.lo, i.hi, i.loOpen, i.hiOpen] : [i.hi, i.lo, i.hiOpen, i.loOpen];
    const [low, high] = [numScale(a, coeff), numScale(b, coeff)];
    lo = numAdd(lo, low);
    hi = numAdd(hi, high);
    loOpen = loOpen || aOpen;
    hiOpen = hiOpen || bOpen;
  }
  return { lo, hi, loOpen, hiOpen };
}

/** Bounds on each unknown from every constraint, repeated while they tighten. */
function propagate(constraints: readonly Constraint[], boxed: Map<string, Interval>): void {
  for (let round = 0; round < 8; round++) {
    let changed = false;
    for (const { lin, strict } of constraints) {
      for (const [key, { coeff }] of lin.atoms) {
        const rest = rangeOf(lin, boxed, key);
        if (!Number.isFinite(rest.lo.v)) continue;
        // coeff * x + rest <= 0 and rest >= rest.lo  =>  coeff * x <= -rest.lo
        const limit = numScale(numNeg(rest.lo), qDiv(q(1), coeff));
        const open = strict || rest.loOpen;
        changed = narrowBox(boxed, key, qNum(coeff) > 0 ? "hi" : "lo", limit, open) || changed;
      }
    }
    if (!changed) return;
  }
}

/** What the conditions in `conds` say about their unknowns, on top of what `base` already says. */
export function learn(ce: Engine, conds: readonly Expr[], base: Knowledge = none): Knowledge {
  const constantOf = (a: Atom): number | undefined => constantValue(box(ce, a.atom));
  const constraints: Constraint[] = [...base.constraints];
  const boxed = new Map<string, Interval>(base.box);
  for (const cond of conds.flatMap(flatten)) {
    for (const pair of pairsOf(cond) ?? []) {
      const made = constraintOf(pair.op, pair.a, pair.b, constantOf);
      if (!made) continue;
      const atoms = [...made.constraint.lin.atoms.values()];
      // Power(x, n) against a constant: x between the roots, or past one of them.
      const power = atoms.length === 1 ? powerAtom(atoms[0].atom) : undefined;
      if (power) solvePower(boxed, power, atoms[0].coeff, made.constraint);
      else if (atoms.length > 0 && atoms.every((a) => typeof a.atom === "string")) constraints.push(made.constraint);
    }
  }
  if (constraints.length === 0 && boxed.size === 0) return none;
  propagate(constraints, boxed);
  return { constraints, box: boxed };
}

/** `a x^n + c <= 0` (or `< 0`): `x^n <= -c/a` when a > 0, `x^n >= -c/a` when a < 0. */
function solvePower(
  boxed: Map<string, Interval>,
  power: { symbol: string; n: number },
  coeff: Q,
  { lin, strict }: Constraint,
): void {
  const target = numScale(numNeg(lin.constant), qDiv(q(1), coeff));
  const key = JSON.stringify(power.symbol);
  const upper = qNum(coeff) > 0;
  if (power.n % 2 === 1) {
    const root = target.v < 0 ? numNeg(nthRoot(-target.v, power.n)) : nthRoot(target.v, power.n);
    narrowBox(boxed, key, upper ? "hi" : "lo", root, strict);
    return;
  }
  // An even power is bounded on both sides only by an upper bound on it.
  if (!upper) return;
  if (target.v < 0 || (target.v === 0 && strict)) return;
  const root = nthRoot(target.v, power.n);
  narrowBox(boxed, key, "hi", root, strict);
  narrowBox(boxed, key, "lo", numNeg(root), strict);
}

/** The knowledge from the assumed conditions plus `extra`, the explicit argument of the call among them. */
export function knowledgeOf(ce: Engine, extra: readonly Expr[] = []): Knowledge {
  const conds = [...assumedBy(ce), ...extra];
  return conds.length === 0 ? none : learn(ce, conds);
}

/** The interval `symbol` ranges over, when it is bounded on both sides. */
export function intervalOf(k: Knowledge, symbol: Json): Interval | undefined {
  const i = k.box.get(JSON.stringify(symbol));
  return i && isBounded(i) ? i : undefined;
}

/**
 * Bounds on `k / m` from `lo m <= k <= hi m`: the unknowns the constraints relate, with no
 * constant between them. A lower bound `k >= c` with a constant c >= 0 reads as k / m > 0.
 */
export function ratioInterval(c: Knowledge, kKey: string, mKey: string): Interval | undefined {
  let lo: { n: Q; open: boolean } | undefined;
  let hi: { n: Q; open: boolean } | undefined;
  for (const { lin, strict } of c.constraints) {
    if (![...lin.atoms.keys()].every((key) => key === kKey || key === mKey)) continue;
    const a = lin.atoms.get(kKey)?.coeff;
    const b = lin.atoms.get(mKey)?.coeff;
    if (a === undefined || qIsZero(a)) continue;
    if (b === undefined) {
      // a k + c <= 0 with a < 0 is k >= c / -a: a lower bound on the ratio only when that is not below 0.
      const bound = lin.constant.v / -qNum(a);
      if (qNum(a) < 0 && bound >= 0 && !lo) lo = { n: q(0), open: bound > 0 || strict };
      continue;
    }
    if (lin.constant.v !== 0) continue;
    // a k + b m <= 0  =>  k <= -b/a m (a > 0), k >= -b/a m (a < 0)
    const ratio = qNeg(qDiv(b, a));
    if (qNum(a) > 0) hi = { n: ratio, open: strict };
    else lo = { n: ratio, open: strict };
  }
  if (!lo || !hi) return undefined;
  return { lo: numQ(lo.n), hi: numQ(hi.n), loOpen: lo.open, hiOpen: hi.open };
}

// -- Deciding a condition under the assumptions -----------------------------------------------------------

/** `lin` is `factor * other` for some positive `factor`. */
function proportional(a: Lin, b: Lin): boolean {
  if (a.atoms.size !== b.atoms.size || a.atoms.size === 0) return false;
  let factor: Q | undefined;
  for (const [key, { coeff }] of a.atoms) {
    const other = b.atoms.get(key)?.coeff;
    if (other === undefined) return false;
    const f = qDiv(coeff, other);
    if (factor && qCmp(f, factor) !== 0) return false;
    factor = f;
  }
  if (!factor || qNum(factor) <= 0) return false;
  return cmpNum(a.constant, numScale(b.constant, factor)) === 0;
}

/** Whether the knowledge says `c` (`lin <= 0` or `< 0`) holds: a bound on its range, or a constraint that is the same form. */
export function entails(k: Knowledge, c: Constraint): boolean {
  const range = rangeOf(c.lin, k.box);
  const above = cmpNum(range.hi, num(0));
  if (above < 0 || (above === 0 && (!c.strict || range.hiOpen))) return true;
  return k.constraints.some((d) => proportional(c.lin, d.lin) && (d.strict || !c.strict));
}

/** `true` or `false` when the assumptions decide `a op b`, else `undefined`. */
export function decide(ce: Engine, k: Knowledge, op: Op, a: Expr, b: Expr): boolean | undefined {
  const made = constraintOf(op, a, b, (atom) => constantValue(box(ce, atom.atom)));
  if (!made || made.constraint.lin.atoms.size === 0) return undefined;
  const { lin, strict } = made.constraint;
  if (entails(k, { lin, strict })) return true;
  // The opposite relation: `lin <= 0` fails exactly when `-lin < 0` holds.
  const negated: Lin = { atoms: new Map(), constant: numNeg(lin.constant) };
  for (const [key, { atom, coeff }] of lin.atoms) negated.atoms.set(key, { atom, coeff: qNeg(coeff) });
  return entails(k, { lin: negated, strict: !strict }) ? false : undefined;
}

// -- Narrowing a Piecewise ----------------------------------------------------------------------------------

const isTrue = (j: Json): boolean => j === "True";
const isFalse = (j: Json): boolean => j === "False";

/** `cond` with every part the assumptions decide taken out: `"True"` or `"False"` when nothing is left to say. */
function narrowCondition(ce: Engine, k: Knowledge, cond: Json): Json {
  if (!Array.isArray(cond)) return cond;
  const [head, ...rest] = cond as [string, ...Json[]];
  if (head === "And") {
    let parts = rest.map((c) => narrowCondition(ce, k, c));
    if (parts.some(isFalse)) return "False";
    parts = parts.filter((p) => !isTrue(p));
    // Each part is also cut by what the others say.
    for (let i = parts.length - 1; i >= 0 && parts.length > 1; i--) {
      const others = parts.filter((_, j) => j !== i).flatMap((p) => constraintsOfJson(ce, p));
      const narrowed = narrowCondition(ce, extend(k, others), parts[i]);
      if (isFalse(narrowed)) return "False";
      if (isTrue(narrowed)) parts = parts.filter((_, j) => j !== i);
      else parts[i] = narrowed;
    }
    return parts.length === 0 ? "True" : parts.length === 1 ? parts[0] : (["And", ...parts] as Json);
  }
  if (head === "Or") {
    const parts = rest.map((c) => narrowCondition(ce, k, c));
    if (parts.some(isTrue)) return "True";
    const kept = parts.filter((p) => !isFalse(p));
    return kept.length === 0 ? "False" : kept.length === 1 ? kept[0] : (["Or", ...kept] as Json);
  }
  if (!RELATIONS.has(head) || rest.length < 2) return cond;
  const decided: (boolean | undefined)[] = [];
  for (let i = 0; i + 1 < rest.length; i++)
    decided.push(decide(ce, k, head as Op, box(ce, rest[i]), box(ce, rest[i + 1])));
  if (decided.some((d) => d === false)) return "False";
  if (decided.every((d) => d === true)) return "True";
  if (decided.every((d) => d === undefined)) return cond;
  const kept = decided.flatMap((d, i) => (d === undefined ? [[head, rest[i], rest[i + 1]] as Json] : []));
  return kept.length === 1 ? kept[0] : (["And", ...kept] as Json);
}

type Conjunction = Json[];

/** `cond` as an Or of Ands of relations, or `undefined` for anything else. */
function dnf(cond: Json): Conjunction[] | undefined {
  if (!Array.isArray(cond)) return undefined;
  const [head, ...rest] = cond as [string, ...Json[]];
  if (head === "Or") {
    const parts = rest.map(dnf);
    return parts.every((p) => p !== undefined) ? parts.flat() : undefined;
  }
  if (head === "And") {
    const parts = rest.map(dnf);
    if (!parts.every((p) => p !== undefined)) return undefined;
    return (parts as Conjunction[][]).reduce<Conjunction[]>(
      (acc, p) => acc.flatMap((x) => p.map((y) => [...x, ...y])),
      [[]],
    );
  }
  return RELATIONS.has(head) && rest.length >= 2 ? [[cond]] : undefined;
}

/** The relation that holds exactly when `a op b` does not. */
export const opposite = (op: Op, a: Json, b: Json): Json =>
  (op === "Less"
    ? ["LessEqual", b, a]
    : op === "LessEqual"
      ? ["Less", b, a]
      : op === "Greater"
        ? ["LessEqual", a, b]
        : ["Less", a, b]) as Json;

/** Whether no point the assumptions allow fails every one of `conds`: the default of a Piecewise with them is never reached. */
function defaultUnreachable(ce: Engine, k: Knowledge, conds: readonly Json[]): boolean {
  // Not (c1 or c2 or ...) is the And of each c's negation, and the negation of an And of relations is an Or of them.
  let combos: Conjunction[] = [[]];
  for (const cond of conds) {
    const terms = dnf(cond);
    if (!terms) return false;
    const negated = terms.map((term) => term.flatMap((r) => pairsOfJson(r)).map(([op, a, b]) => opposite(op, a, b)));
    // Each term must fail: pick one of its relations to fail.
    for (const term of negated) {
      combos = combos.flatMap((combo) => term.map((r) => [...combo, r]));
      if (combos.length > 256) return false;
    }
  }
  return combos.every((combo) => impossible(ce, k, combo));
}

/** Whether the relations in `combo` cannot all hold under what `k` says: one is decided false, or together they empty an interval. */
function impossible(ce: Engine, k: Knowledge, combo: readonly Json[]): boolean {
  const exprs = combo.map((r) => box(ce, r));
  const together = learn(ce, exprs, k);
  if (isEmpty(together)) return true;
  return combo.some((r) => {
    const [[op, a, b]] = pairsOfJson(r);
    return decide(ce, together, op, box(ce, a), box(ce, b)) === false;
  });
}

/** The `a op b` pairs of a relation Json, a chain's among them. */
export function pairsOfJson(r: Json): [Op, Json, Json][] {
  const [head, ...rest] = r as [string, ...Json[]];
  return rest.slice(1).map((b, i) => [head as Op, rest[i], b]);
}

/** The constraints a relation Json (a chain among them) states; none for anything else. */
function constraintsOfJson(ce: Engine, cond: Json): Constraint[] {
  if (!Array.isArray(cond) || !RELATIONS.has(cond[0] as string)) return [];
  return pairsOfJson(cond).flatMap(([op, a, b]) => constraintOfJson(ce, op, a, b) ?? []);
}

/** A Piecewise with the branches the assumptions rule out dropped and its conditions cut to what they leave open. */
export function narrowPiecewise(ce: Engine, k: Knowledge, pw: Json): Json {
  if (k.constraints.length === 0 && k.box.size === 0) return pw;
  if (!Array.isArray(pw) || pw[0] !== "Piecewise") return pw;
  const [, clauses, fallback] = pw as [string, Json, Json];
  const branches = (clauses as unknown as Json[]).slice(1) as [string, Json, Json][];
  const kept: (readonly [Json, Json])[] = [];
  let tail: Json = fallback;
  let reachable = true;
  for (const [, value, cond] of branches) {
    const narrowed = narrowCondition(ce, k, cond);
    if (isFalse(narrowed)) continue;
    if (isTrue(narrowed)) {
      tail = value;
      reachable = false;
      break;
    }
    kept.push([value, narrowed]);
  }
  // When the branches cover everything the assumptions allow, the last one needs no condition.
  if (
    reachable &&
    kept.length > 0 &&
    defaultUnreachable(
      ce,
      k,
      branches.map(([, , cond]) => cond),
    )
  ) {
    tail = kept.pop()![0];
  }
  return kept.length === 0
    ? tail
    : (["Piecewise", ["List", ...kept.map(([v, c]) => ["List", v, c] as Json)] as Json, tail] as Json);
}

/** `a op b` (the sides as JSON) as a constraint. */
export function constraintOfJson(ce: Engine, op: Op, a: Json, b: Json): Constraint | undefined {
  return constraintOf(op, box(ce, a), box(ce, b), (atom) => constantValue(box(ce, atom.atom)))?.constraint;
}

/** What `k` says, and more: linear constraints joined to it. */
export function extend(k: Knowledge, more: readonly Constraint[]): Knowledge {
  const constraints = [
    ...k.constraints,
    ...more.filter((c) => [...c.lin.atoms.values()].every((a) => typeof a.atom === "string")),
  ];
  const boxed = new Map(k.box);
  propagate(constraints, boxed);
  return { constraints, box: boxed };
}

/** Whether the bounds in `k` leave no value for some unknown. */
export function isEmpty(k: Knowledge): boolean {
  for (const i of k.box.values()) {
    const c = cmpNum(i.lo, i.hi);
    if (c > 0 || (c === 0 && (i.loOpen || i.hiOpen))) return true;
  }
  return false;
}
