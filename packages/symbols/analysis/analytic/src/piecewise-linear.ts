import { bigRationalAt, type Expr, isSymbol, type Json, operandsOf } from "@enumeratio/engine";

// The exact arithmetic under the PiecewiseExpand rewrites: small rationals, linear forms over
// atoms, the conditions Wolfram writes for them (`a - b >= 0`, `x <= 2`), and Wolfram's own
// ordering of the values a Piecewise carries.

// -- Exact small rationals: breakpoints are integers, halves and quarters -------------------------

export type Q = readonly [number, number];
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;
export const q = (n: number, d = 1): Q => {
  const sign = d < 0 ? -1 : 1;
  const g = gcd(n, d) || 1;
  return [(sign * n) / g, (sign * d) / g];
};
export const qAdd = (a: Q, b: Q): Q => q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
export const qMul = (a: Q, b: Q): Q => q(a[0] * b[0], a[1] * b[1]);
export const qNeg = (a: Q): Q => [-a[0], a[1]];
export const qDiv = (a: Q, b: Q): Q => q(a[0] * b[1], a[1] * b[0]);
export const qNum = (a: Q): number => a[0] / a[1];
export const qJson = (a: Q): Json => (a[1] === 1 ? a[0] : (["Rational", a[0], a[1]] as Json));
export const qIsZero = (a: Q): boolean => a[0] === 0;
export const qCmp = (a: Q, b: Q): number => a[0] * b[1] - b[0] * a[1];

export const rationalAt = (e: Expr): Q | undefined => {
  const r = bigRationalAt(e);
  if (r === undefined) return undefined;
  const [n, d] = r;
  return Number.isSafeInteger(Number(n)) && Number.isSafeInteger(Number(d)) ? q(Number(n), Number(d)) : undefined;
};

// -- Linear forms: `a - b >= 0` is written with its constant moved across ---------------------

export interface Atom {
  readonly atom: Json;
  readonly constant: boolean;
  coeff: Q;
}

export interface Linear {
  readonly atoms: Map<string, Atom>;
  constant: Q;
}

/** A number written with no unknown in it (`Pi`, `Sqrt(2)`): a constant, though not a rational one. */
export const isConstant = (e: Expr): boolean => e.unknowns.length === 0;

export const addTo = (into: Linear, from: Linear, scale: Q): void => {
  into.constant = qAdd(into.constant, qMul(from.constant, scale));
  for (const [key, { atom, coeff, constant }] of from.atoms) {
    const have = into.atoms.get(key);
    if (have) have.coeff = qAdd(have.coeff, qMul(coeff, scale));
    else into.atoms.set(key, { atom, constant, coeff: qMul(coeff, scale) });
  }
};

export const emptyLinear = (): Linear => ({ atoms: new Map(), constant: q(0) });

export function linear(e: Expr): Linear {
  const out = emptyLinear();
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

export const compact = (l: Linear): Atom[] => [...l.atoms.values()].filter((a) => !qIsZero(a.coeff));

export type Relation = "Less" | "LessEqual" | "Greater" | "GreaterEqual";
export const FLIP: Record<Relation, Relation> = {
  Less: "Greater",
  LessEqual: "GreaterEqual",
  Greater: "Less",
  GreaterEqual: "LessEqual",
};

export const termJson = (coeff: Q, atom: Json): Json =>
  qNum(coeff) === 1
    ? atom
    : qNum(coeff) === -1
      ? (["Negate", atom] as Json)
      : (["Multiply", qJson(coeff), atom] as Json);

export function linearJson(l: Linear): Json {
  const terms = compact(l).map(({ atom, coeff }) => termJson(coeff, atom));
  if (!qIsZero(l.constant)) terms.push(qJson(l.constant));
  return terms.length === 0 ? 0 : terms.length === 1 ? terms[0] : (["Add", ...terms] as Json);
}

const negated = (j: Json): Json => (typeof j === "number" ? -j : (["Negate", j] as Json));

/** `a op b` as Wolfram writes it: one unknown against a constant (`x <= 2`, `x <= Pi`), else the difference against 0 (`x - y >= 0`). */
export function relation(op: Relation, a: Expr, b: Expr): Json | undefined {
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
  // The first unknown is written with a positive coefficient: `x - y <= 0`, not `-x + y >= 0`.
  const flip = qNum(sortedAtoms(diff)[0].coeff) < 0;
  const [sign, rel] = flip ? [q(-1), FLIP[op]] : [q(1), op];
  return [
    rel,
    ["Add", ...atoms.map(({ atom, coeff }) => termJson(qMul(coeff, sign), atom))],
    qJson(qMul(qNeg(diff.constant), sign)),
  ] as Json;
}

export const and = (conds: readonly Json[]): Json => (conds.length === 1 ? conds[0] : (["And", ...conds] as Json));
export const or = (conds: readonly Json[]): Json => (conds.length === 1 ? conds[0] : (["Or", ...conds] as Json));
const clause = ([value, cond]: readonly [Json, Json]): Json => ["List", value, cond] as Json;
export const piecewise = (branches: readonly (readonly [Json, Json])[], fallback: Json): Json =>
  branches.length === 0 ? fallback : (["Piecewise", ["List", ...branches.map(clause)] as Json, fallback] as Json);

// -- Wolfram's canonical order, as far as these rewrites need it ------------------------------

/** Wolfram sorts names without regard to case, lowercase first on a tie. */
export const nameOrder = (a: string, b: string): number =>
  a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : a === b ? 0 : a > b ? -1 : 1;

export const firstSymbol = (e: Expr): string | undefined => {
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
export const constantValue = (e: Expr): number | undefined => {
  const r = rationalAt(e);
  if (r !== undefined) return qNum(r);
  if (!isConstant(e)) return undefined;
  const value = e.N();
  return value.im === 0 && Number.isFinite(value.re) ? value.re : undefined;
};

/** The value as a linear form when it is one in plain unknowns (no products, powers or calls). */
function plainLinear(e: Expr): Linear | undefined {
  const l = linear(e);
  return compact(l).every((a) => typeof a.atom === "string") ? l : undefined;
}

/** Numbers first, then linear forms in Wolfram's order (`x - y` before `x + y`), then the rest by the leading symbol and the simpler expression. */
export function sortedByWolfram<T>(items: readonly T[], of: (t: T) => Expr): T[] {
  const keyed = items.map((item, index) => ({
    item,
    index,
    e: of(item),
    number: constantValue(of(item)),
    lin: plainLinear(of(item)),
  }));
  keyed.sort((a, b) => {
    if (a.number !== undefined && b.number !== undefined) return a.number - b.number;
    if (a.number !== undefined) return -1;
    if (b.number !== undefined) return 1;
    if (a.lin && b.lin) return compareLinear(a.lin, b.lin) || a.index - b.index;
    const bySymbol = nameOrder(firstSymbol(a.e) ?? "", firstSymbol(b.e) ?? "");
    return bySymbol || leaves(a.e) - leaves(b.e) || a.index - b.index;
  });
  return keyed.map((k) => k.item);
}

export const hasPiecewise = (e: Expr): boolean => e.operator === "Piecewise" || operandsOf(e).some(hasPiecewise);
export const isNonReal = (e: Expr): boolean => Number.isFinite(e.im) && e.im !== 0;

/** `u` as `scale * atom + shift`, when it is linear in one atom. */
export function affine(u: Expr): { atom: Json; scale: Q; shift: Q } | undefined {
  const l = linear(u);
  const atoms = compact(l);
  return atoms.length === 1 ? { atom: atoms[0].atom, scale: atoms[0].coeff, shift: l.constant } : undefined;
}

export const scaled = (l: Linear, factor: Q, shift: Q): Linear => {
  const out: Linear = { atoms: new Map(), constant: shift };
  addTo(out, l, factor);
  return out;
};

// -- A linear value as Wolfram's Together writes it ----------------------------------------------

/** An atom's place in a term list: symbols alphabetically (`Pi` before `x`), anything compound before them. */
const atomOrder = (a: Atom, b: Atom): number => {
  const [sa, sb] = [typeof a.atom === "string", typeof b.atom === "string"];
  if (sa && sb) return nameOrder(a.atom as string, b.atom as string);
  if (sa !== sb) return sa ? 1 : -1;
  return JSON.stringify(a.atom) < JSON.stringify(b.atom) ? -1 : JSON.stringify(a.atom) > JSON.stringify(b.atom) ? 1 : 0;
};

const sortedAtoms = (l: Linear): Atom[] => compact(l).toSorted(atomOrder);

/** `scale * inner`: `inner` has integer coefficients, no common factor, and a positive leading unknown once a factor was taken out. */
export interface Together {
  readonly scale: Q;
  readonly inner: Linear;
}

/**
 * The form Wolfram's `Together` gives a linear value: the common denominator over the whole
 * numerator, its common integer factor written out in front (`2*(-1 + x)`, `(-3 + 2*x)/2`).
 * A sum with no common factor is left as it is (`(1 - x)/2`, `-1 + 2*x`), and a lone term is
 * its atom with the coefficient in front.
 */
export function together(l: Linear): Together {
  const atoms = sortedAtoms(l);
  if (atoms.length === 0) return { scale: q(1), inner: { atoms: new Map(), constant: l.constant } };
  const terms = [...atoms.map((a) => a.coeff), ...(qIsZero(l.constant) ? [] : [l.constant])];
  if (atoms.length === 1 && qIsZero(l.constant)) {
    const only = new Map([[JSON.stringify(atoms[0].atom), { ...atoms[0], coeff: q(1) }]]);
    return { scale: atoms[0].coeff, inner: { atoms: only, constant: q(0) } };
  }
  const den = terms.reduce((d, t) => lcm(d, t[1]), 1);
  const nums = (c: Q): number => (c[0] * den) / c[1];
  const content = terms.reduce((g, t) => gcd(g, nums(t)), 0);
  const sign = content > 1 && atoms.length > 0 && nums(atoms[0].coeff) < 0 ? -1 : 1;
  const factor = content > 1 ? content : 1;
  const inner: Linear = { atoms: new Map(), constant: q((sign * nums(l.constant)) / factor) };
  for (const a of atoms) inner.atoms.set(JSON.stringify(a.atom), { ...a, coeff: q((sign * nums(a.coeff)) / factor) });
  return { scale: q(sign * factor, den), inner };
}

export const togetherJson = (l: Linear): Json => {
  const { scale, inner } = together(l);
  const body = linearJson(inner);
  return qNum(scale) === 1 || body === 0 ? body : (["Multiply", qJson(scale), body] as Json);
};

/**
 * Wolfram's order on two `Together` forms: the terms of the numerator from the last unknown
 * back, comparing which unknown and then its coefficient (a missing term sorts first), then the
 * constant (a missing one is 0), then the factor in front.
 */
export function compareTogether(a: Together, b: Together): number {
  const [ta, tb] = [sortedAtoms(a.inner), sortedAtoms(b.inner)];
  for (let i = 1; i <= Math.min(ta.length, tb.length); i++) {
    const [x, y] = [ta[ta.length - i], tb[tb.length - i]];
    const byAtom = atomOrder(x, y);
    if (byAtom !== 0) return byAtom;
    const byCoeff = qCmp(x.coeff, y.coeff);
    if (byCoeff !== 0) return byCoeff;
  }
  if (ta.length !== tb.length) return ta.length - tb.length;
  return qCmp(a.inner.constant, b.inner.constant) || qCmp(a.scale, b.scale);
}

export const compareLinear = (a: Linear, b: Linear): number => compareTogether(together(a), together(b));
