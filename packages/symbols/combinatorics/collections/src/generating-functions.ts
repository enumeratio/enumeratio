import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigRationalAt, symbolNameOf } from "@enumeratio/boxed";

// GeneratingFunction / ExponentialGeneratingFunction / FindSequenceFunction / DiscreteRatio
// (Wolfram frontier). The three sequence-recognition heads share one pipeline: sample the
// sequence exactly (as bigint fractions) at n = 0..SAMPLE_COUNT-1, then look for structure —
// a linear recurrence with CONSTANT coefficients (Berlekamp–Massey over ℚ, which covers every
// C-finite sequence: geometric terms, polynomials in n, Fibonacci-like sequences, and any
// linear combination of those) or, failing that, a handful of named non-C-finite sequences
// (Catalan, factorial-growth) recognised by direct comparison against the compute-engine's own
// natives. Nothing here is family-specific: `Count(DyckPaths(n))` is not special-cased, it is
// simply the sequence 1,1,2,5,14,… once sampled, same as `CatalanNumber(n)` itself.
//
// A rational OGF falls straight out of the recurrence (standard construction, no root-finding).
// An EGF needs the characteristic roots, so it is only built in closed form for order ≤ 2
// (covers every named example we cross-check: Fibonacci, doubling/geometric growth, `n·2^n`
// shape) — higher orders and non-C-finite EGFs (besides the small registry below) stay
// unevaluated, same as Wolfram does when it can't find a closed form either.

const SAMPLE_COUNT = 24;
/** Berlekamp–Massey only certifies a recurrence of order L when 2L ≤ N (N = sample count);
 *  a "fit" found past that bound could be an artifact of too little data. */
const MAX_CERTIFIED_ORDER = Math.floor(SAMPLE_COUNT / 2) - 1;

// ─── exact rational arithmetic (bigint fractions) ──────────────────────────────────────────

type Frac = readonly [bigint, bigint]; // normalized: denominator > 0, gcd(|num|, den) = 1

const bgcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};

const frac = (num: bigint, den: bigint): Frac => {
  if (den === 0n) throw new RangeError("zero denominator");
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  if (num === 0n) return [0n, 1n];
  const g = bgcd(num, den);
  return [num / g, den / g];
};

const F0: Frac = [0n, 1n];
const F1: Frac = [1n, 1n];
const fAdd = (a: Frac, b: Frac): Frac => frac(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const fSub = (a: Frac, b: Frac): Frac => frac(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const fMul = (a: Frac, b: Frac): Frac => frac(a[0] * b[0], a[1] * b[1]);
const fDiv = (a: Frac, b: Frac): Frac => frac(a[0] * b[1], a[1] * b[0]);
const fNeg = (a: Frac): Frac => [-a[0], a[1]];
const fIsZero = (a: Frac): boolean => a[0] === 0n;
const fEq = (a: Frac, b: Frac): boolean => a[0] === b[0] && a[1] === b[1];

const fracToExpr = (ce: ComputeEngine, f: Frac): BoxedExpression => ce.number([f[0], f[1]]);

// ─── sampling ───────────────────────────────────────────────────────────────────────────────

/** `expr` with `varName` bound to the integer `k`, evaluated to an exact rational — or
 *  `undefined` if it isn't one (irrational, unevaluated, non-numeric, …). */
function sampleAt(
  ce: ComputeEngine,
  expr: BoxedExpression,
  varName: string,
  k: number,
): Frac | undefined {
  const value = expr.subs({ [varName]: ce.number(k) }).evaluate();
  const r = bigRationalAt(value);
  return r === undefined ? undefined : frac(r[0], r[1]);
}

/** The first `count` exact terms of `expr(varName)` for `varName = start..start+count-1`, or
 *  `undefined` the moment one isn't an exact rational. */
function sampleTerms(
  ce: ComputeEngine,
  expr: BoxedExpression,
  varName: string,
  count: number,
  start = 0,
): Frac[] | undefined {
  const terms: Frac[] = [];
  for (let k = start; k < start + count; k++) {
    const term = sampleAt(ce, expr, varName, k);
    if (term === undefined) return undefined;
    terms.push(term);
  }
  return terms;
}

// ─── Berlekamp–Massey over ℚ ────────────────────────────────────────────────────────────────

/**
 * The shortest linear recurrence `s[i] = c[0]·s[i-1] + c[1]·s[i-2] + … + c[L-1]·s[i-L]` that
 * reproduces `s`, as `c`, or `undefined` if `s` is too short to certify one (or is the zero
 * sequence, where any order "fits" trivially and there is nothing to report).
 */
function berlekampMassey(s: readonly Frac[]): Frac[] | undefined {
  let ls: Frac[] = [];
  let cur: Frac[] = [];
  let lf = 0;
  let ld: Frac = F1;
  for (let i = 0; i < s.length; i++) {
    let t = F0;
    for (let j = 0; j < cur.length; j++) t = fAdd(t, fMul(cur[j]!, s[i - 1 - j]!));
    const delta = fSub(s[i]!, t);
    if (fIsZero(delta)) continue;
    if (cur.length === 0) {
      cur = new Array(i + 1).fill(F0);
      lf = i;
      ld = delta;
      continue;
    }
    const k = fDiv(delta, ld);
    const shift = i - lf - 1;
    const c: Frac[] = new Array(Math.max(cur.length, shift + 1 + ls.length)).fill(F0);
    for (let j = 0; j < cur.length; j++) c[j] = cur[j]!;
    c[shift] = fAdd(c[shift]!, k);
    for (let j = 0; j < ls.length; j++) c[shift + 1 + j] = fSub(c[shift + 1 + j]!, fMul(k, ls[j]!));
    if (i - cur.length >= lf - ls.length) {
      ls = cur;
      lf = i;
      ld = delta;
    }
    cur = c;
  }
  // trim trailing zero coefficients (BM can leave the order padded)
  while (cur.length > 0 && fIsZero(cur[cur.length - 1]!)) cur.pop();
  return cur;
}

/** BM's recurrence for `terms`, only if certified (`2·order ≤ terms.length`) and it
 *  reproduces every sampled term exactly (a defensive re-check, not just trust in BM). */
function findRecurrence(terms: readonly Frac[]): Frac[] | undefined {
  if (terms.every(fIsZero)) return undefined;
  const c = berlekampMassey(terms);
  if (c === undefined || c.length === 0) return undefined;
  const order = c.length;
  if (order > MAX_CERTIFIED_ORDER) return undefined;
  for (let i = order; i < terms.length; i++) {
    let t = F0;
    for (let j = 0; j < order; j++) t = fAdd(t, fMul(c[j]!, terms[i - 1 - j]!));
    if (!fEq(t, terms[i]!)) return undefined;
  }
  return c;
}

// ─── rational OGF from a certified recurrence ──────────────────────────────────────────────

/** Coefficients of `P(x)` low-to-high, given `Q(x) = 1 - c[0]x - c[1]x² - … - c[d-1]x^d` and
 *  the initial terms: `P = (A·Q) mod x^d` (everything past degree `d-1` cancels, by the
 *  recurrence). */
function numeratorFrom(coeffs: readonly Frac[], initial: readonly Frac[]): Frac[] {
  const d = coeffs.length;
  const p: Frac[] = [];
  for (let k = 0; k < d; k++) {
    let pk = initial[k]!;
    for (let i = 1; i <= k; i++) pk = fSub(pk, fMul(coeffs[i - 1]!, initial[k - i]!));
    p.push(pk);
  }
  while (p.length > 0 && fIsZero(p[p.length - 1]!)) p.pop();
  return p;
}

function polyExpr(ce: ComputeEngine, coeffs: readonly Frac[], x: BoxedExpression): BoxedExpression {
  const terms: BoxedExpression[] = [];
  for (let i = 0; i < coeffs.length; i++) {
    const c = coeffs[i]!;
    if (fIsZero(c)) continue;
    const power = i === 0 ? undefined : i === 1 ? x : ce.function("Power", [x, ce.number(i)]);
    terms.push(
      power === undefined ? fracToExpr(ce, c) : ce.function("Multiply", [fracToExpr(ce, c), power]),
    );
  }
  return terms.length === 0 ? ce.Zero : ce.function("Add", terms);
}

/** The rational OGF `P(x)/Q(x)` for a sequence with certified recurrence `c` and initial
 *  terms `initial` (must have length ≥ `c.length`). */
function rationalOgf(
  ce: ComputeEngine,
  c: readonly Frac[],
  initial: readonly Frac[],
  x: BoxedExpression,
): BoxedExpression {
  const qCoeffs: Frac[] = [F1, ...c.map(fNeg)];
  const pCoeffs = numeratorFrom(c, initial);
  const p = polyExpr(ce, pCoeffs, x);
  const q = polyExpr(ce, qCoeffs, x);
  return ce.function("Divide", [p, q]).evaluate().simplify();
}

// ─── order ≤ 2 exponential generating function from a certified recurrence ─────────────────

/** `A·exp(r·x)` for an order-1 recurrence `a_n = c[0]·a_{n-1}`, `a_0 = initial[0]`. */
function egfOrder1(
  ce: ComputeEngine,
  c: readonly Frac[],
  initial: readonly Frac[],
  x: BoxedExpression,
): BoxedExpression {
  const r = fracToExpr(ce, c[0]!);
  const a0 = fracToExpr(ce, initial[0]!);
  const exp = ce.function("Exp", [ce.function("Multiply", [r, x])]);
  return ce.function("Multiply", [a0, exp]).evaluate();
}

/** Order-2 recurrence `a_n = c0·a_{n-1} + c1·a_{n-2}`. Distinct roots `r1, r2`:
 *  `A1·exp(r1 x) + A2·exp(r2 x)`; a repeated root `r`: `(A + B·r·x)·exp(r x)`. Roots come out
 *  of the compute-engine's own `Sqrt`/arithmetic, so an irrational discriminant (Fibonacci's
 *  √5) stays exact and symbolic rather than being hand-simplified here. */
function egfOrder2(
  ce: ComputeEngine,
  c: readonly Frac[],
  initial: readonly Frac[],
  x: BoxedExpression,
): BoxedExpression | undefined {
  const [c0, c1] = c as [Frac, Frac];
  const [a0, a1] = initial as [Frac, Frac];
  const c0x = fracToExpr(ce, c0);
  const c1x = fracToExpr(ce, c1);
  const disc = ce
    .function("Add", [
      ce.function("Power", [c0x, ce.number(2)]),
      ce.function("Multiply", [ce.number(4), c1x]),
    ])
    .evaluate();
  const sqrtDisc = ce.function("Sqrt", [disc]).evaluate();
  const two = ce.number(2);
  if (sqrtDisc.is(0) === true) {
    // repeated root r = c0/2
    const r = ce.function("Divide", [c0x, two]).evaluate();
    const a0x = fracToExpr(ce, a0);
    const a1x = fracToExpr(ce, a1);
    if (r.is(0) === true) return undefined; // degenerate (eventually-zero sequence): not worth a closed form
    const b = ce.function("Subtract", [ce.function("Divide", [a1x, r]), a0x]).evaluate();
    const linear = ce.function("Add", [a0x, ce.function("Multiply", [b, r, x])]).evaluate();
    return ce
      .function("Multiply", [linear, ce.function("Exp", [ce.function("Multiply", [r, x])])])
      .evaluate()
      .simplify();
  }
  const r1 = ce.function("Divide", [ce.function("Add", [c0x, sqrtDisc]), two]).evaluate();
  const r2 = ce.function("Divide", [ce.function("Subtract", [c0x, sqrtDisc]), two]).evaluate();
  const denom = ce.function("Subtract", [r1, r2]).evaluate();
  const a0x = fracToExpr(ce, a0);
  const a1x = fracToExpr(ce, a1);
  const A1 = ce
    .function("Divide", [ce.function("Subtract", [a1x, ce.function("Multiply", [a0x, r2])]), denom])
    .evaluate();
  const A2 = ce.function("Subtract", [a0x, A1]).evaluate();
  const term1 = ce.function("Multiply", [
    A1,
    ce.function("Exp", [ce.function("Multiply", [r1, x])]),
  ]);
  const term2 = ce.function("Multiply", [
    A2,
    ce.function("Exp", [ce.function("Multiply", [r2, x])]),
  ]);
  return ce.function("Add", [term1, term2]).evaluate().simplify();
}

// ─── a small registry of named non-C-finite sequences ──────────────────────────────────────

/** Named sequences whose OGF/EGF is a well-known closed form but which are not C-finite (no
 *  constant-coefficient linear recurrence), so Berlekamp–Massey cannot find them. Matched by
 *  direct value comparison against the compute-engine's own native. */
interface NamedSequence {
  readonly nativeHead: string; // a unary CE head: nativeHead(k) gives the k-th term
  readonly ogf?: (ce: ComputeEngine, x: BoxedExpression) => BoxedExpression;
  readonly egf?: (ce: ComputeEngine, x: BoxedExpression) => BoxedExpression;
}

const NAMED_SEQUENCES: readonly NamedSequence[] = [
  {
    // Catalan numbers: C(x) = (1 - sqrt(1-4x)) / (2x) — algebraic, not rational; not C-finite.
    nativeHead: "CatalanNumber",
    ogf: (ce, x) =>
      ce
        .function("Divide", [
          ce.function("Subtract", [
            ce.One,
            ce.function("Sqrt", [
              ce.function("Subtract", [ce.One, ce.function("Multiply", [ce.number(4), x])]),
            ]),
          ]),
          ce.function("Multiply", [ce.number(2), x]),
        ])
        .evaluate(),
  },
  {
    // n! has no elementary OGF (only an asymptotic/divergent series) but a simple EGF.
    nativeHead: "Factorial",
    egf: (ce, x) =>
      ce.function("Divide", [ce.One, ce.function("Subtract", [ce.One, x])]).evaluate(),
  },
  {
    // Derangements: EGF = exp(-x)/(1-x).
    nativeHead: "Subfactorial",
    egf: (ce, x) =>
      ce
        .function("Divide", [
          ce.function("Exp", [ce.function("Negate", [x])]),
          ce.function("Subtract", [ce.One, x]),
        ])
        .evaluate(),
  },
  {
    // Bell numbers: EGF = exp(exp(x) - 1) — the classic exponential formula for set partitions.
    nativeHead: "BellNumber",
    egf: (ce, x) =>
      ce.function("Exp", [ce.function("Subtract", [ce.function("Exp", [x]), ce.One])]).evaluate(),
  },
];

function matchNamedSequence(ce: ComputeEngine, terms: readonly Frac[]): NamedSequence | undefined {
  outer: for (const candidate of NAMED_SEQUENCES) {
    for (let k = 0; k < terms.length; k++) {
      const native = ce.function(candidate.nativeHead, [ce.number(k)]).evaluate();
      const r = bigRationalAt(native);
      if (r === undefined || !fEq(frac(r[0], r[1]), terms[k]!)) continue outer;
    }
    return candidate;
  }
  return undefined;
}

// ─── GeneratingFunction / ExponentialGeneratingFunction ────────────────────────────────────

function generatingFunctionCore(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  kind: "ordinary" | "exponential",
): BoxedExpression | undefined {
  const [expr, nExpr, xExpr] = ops;
  if (expr === undefined || nExpr === undefined || xExpr === undefined) return undefined;
  const varName = symbolNameOf(nExpr);
  if (varName === undefined) return undefined;
  const x = xExpr.evaluate();

  const terms = sampleTerms(ce, expr, varName, SAMPLE_COUNT);
  if (terms === undefined) return undefined; // stay symbolic: not an exact-rational sequence

  const recurrence = findRecurrence(terms);
  if (recurrence !== undefined) {
    if (kind === "ordinary") return rationalOgf(ce, recurrence, terms, x);
    if (recurrence.length === 1) return egfOrder1(ce, recurrence, terms, x);
    if (recurrence.length === 2) return egfOrder2(ce, recurrence, terms, x);
    // order ≥ 3: closed-form roots not attempted here.
    return undefined;
  }

  const named = matchNamedSequence(ce, terms);
  if (named !== undefined) {
    const builder = kind === "ordinary" ? named.ogf : named.egf;
    if (builder !== undefined) return builder(ce, x);
  }
  return undefined; // no closed form found: stay symbolic, same as Wolfram in this case
}

function declareGeneratingFunction(ce: ComputeEngine): void {
  ce.declare("GeneratingFunction", {
    description:
      "The ordinary generating function of expr(n) in x: Σ expr(n)·xⁿ in closed form, when the sequence is C-finite (a constant-coefficient linear recurrence — Fibonacci, fixed-k binomials, polynomials in n, geometric terms, …) or a recognised algebraic sequence such as the Catalan numbers.",
    signature: "(any, symbol, symbol) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => generatingFunctionCore(ce, ops, "ordinary"),
  });
}

function declareExponentialGeneratingFunction(ce: ComputeEngine): void {
  ce.declare("ExponentialGeneratingFunction", {
    description:
      "The exponential generating function of expr(n) in x: Σ expr(n)·xⁿ/n! in closed form. Handles order ≤ 2 C-finite sequences (Fibonacci and the like) and a small registry of named factorial-growth sequences (n!, derangements, Bell numbers).",
    signature: "(any, symbol, symbol) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => generatingFunctionCore(ce, ops, "exponential"),
  });
}

// ─── DiscreteRatio ──────────────────────────────────────────────────────────────────────────

function evaluateDiscreteRatio(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
): BoxedExpression | undefined {
  const [f, nExpr] = ops;
  if (f === undefined || nExpr === undefined) return undefined;
  const varName = symbolNameOf(nExpr);
  if (varName === undefined) return undefined;
  const fNext = f.subs({ [varName]: ce.function("Add", [nExpr, ce.One]) }).evaluate();
  const ratio = ce.function("Divide", [fNext, f]).evaluate();
  return ratio.simplify();
}

function declareDiscreteRatio(ce: ComputeEngine): void {
  ce.declare("DiscreteRatio", {
    description: "f(n+1)/f(n), simplified — the ratio between consecutive terms of a sequence.",
    signature: "(any, symbol) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => evaluateDiscreteRatio(ce, ops),
  });
}

// ─── FindSequenceFunction ───────────────────────────────────────────────────────────────────

/** The list's elements as exact fractions, or `undefined` if any isn't one. */
function listTerms(ce: ComputeEngine, list: BoxedExpression): Frac[] | undefined {
  const evaluated = list.evaluate();
  const ops = (evaluated as { ops?: readonly BoxedExpression[] }).ops;
  if (evaluated.operator !== "List" || !Array.isArray(ops)) return undefined;
  const terms: Frac[] = [];
  for (const op of ops) {
    const r = bigRationalAt(op.evaluate());
    if (r === undefined) return undefined;
    terms.push(frac(r[0], r[1]));
  }
  return terms;
}

/** The degree-`d` polynomial in `n` interpolating `(0, terms[0]), …, (d, terms[d])`
 *  (Lagrange, exact), given the `(d+1)`-th finite difference of `terms` is (numerically)
 *  zero — i.e. `terms` really is a polynomial sequence of degree `d`. */
function lagrangePoly(
  ce: ComputeEngine,
  terms: readonly Frac[],
  degree: number,
  n: BoxedExpression,
): BoxedExpression {
  // Newton's forward-difference form: p(n) = Σ_{k=0}^{d} Δ^k[0] · C(n, k), which stays exact
  // over ℚ and needs only the first `degree + 1` samples.
  const diffs: Frac[][] = [terms.slice(0, degree + 1)];
  for (let k = 1; k <= degree; k++) {
    const prev = diffs[k - 1]!;
    diffs.push(prev.slice(0, -1).map((v, i) => fSub(prev[i + 1]!, v)));
  }
  const leading = diffs.map((row) => row[0]!); // Δ^k[0] for k = 0..degree
  const terms_: BoxedExpression[] = [];
  for (let k = 0; k <= degree; k++) {
    const coeff = leading[k]!;
    if (fIsZero(coeff)) continue;
    // C(n, k) = n(n-1)…(n-k+1) / k!
    const binom = k === 0 ? ce.One : ce.function("Binomial", [n, ce.number(k)]);
    terms_.push(
      k === 0 ? fracToExpr(ce, coeff) : ce.function("Multiply", [fracToExpr(ce, coeff), binom]),
    );
  }
  return (terms_.length === 0 ? ce.Zero : ce.function("Add", terms_)).evaluate().simplify();
}

/** The degree of `terms` as a polynomial sequence (the least `d` with a vanishing
 *  `(d+1)`-th finite difference across every sample), or `undefined` if it never vanishes. */
function polynomialDegree(terms: readonly Frac[]): number | undefined {
  let row = terms.slice();
  for (let d = 0; d < terms.length; d++) {
    if (row.every(fIsZero)) return d === 0 ? 0 : d - 1;
    if (row.length <= 1) return undefined;
    row = row.slice(0, -1).map((v, i) => fSub(row[i + 1]!, v));
  }
  return undefined;
}

function findSequenceFunctionCore(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
): BoxedExpression | undefined {
  const [listExpr, nExpr] = ops;
  if (listExpr === undefined || nExpr === undefined) return undefined;
  const n = nExpr.evaluate();
  const terms = listTerms(ce, listExpr);
  if (terms === undefined || terms.length < 2) return undefined;

  const named = matchNamedSequence(ce, terms);
  if (named !== undefined) return ce.function(named.nativeHead, [n]).evaluate();

  const degree = polynomialDegree(terms);
  if (degree !== undefined && degree <= terms.length - 1) return lagrangePoly(ce, terms, degree, n);

  const recurrence = findRecurrence(terms);
  if (recurrence !== undefined) {
    if (recurrence.length === 1) {
      // geometric: a_n = a_0 · r^n
      const r = fracToExpr(ce, recurrence[0]!);
      const a0 = fracToExpr(ce, terms[0]!);
      const power = ce.function("Power", [r, n]);
      return (
        terms[0]![0] === 1n && terms[0]![1] === 1n ? power : ce.function("Multiply", [a0, power])
      )
        .evaluate()
        .simplify();
    }
    if (recurrence.length === 2) {
      const [c0, c1] = recurrence as [Frac, Frac];
      const [a0, a1] = terms as [Frac, Frac];
      const c0x = fracToExpr(ce, c0);
      const c1x = fracToExpr(ce, c1);
      const disc = ce
        .function("Add", [
          ce.function("Power", [c0x, ce.number(2)]),
          ce.function("Multiply", [ce.number(4), c1x]),
        ])
        .evaluate();
      const sqrtDisc = ce.function("Sqrt", [disc]).evaluate();
      const two = ce.number(2);
      if (sqrtDisc.is(0) !== true) {
        const r1 = ce.function("Divide", [ce.function("Add", [c0x, sqrtDisc]), two]).evaluate();
        const r2 = ce
          .function("Divide", [ce.function("Subtract", [c0x, sqrtDisc]), two])
          .evaluate();
        const denom = ce.function("Subtract", [r1, r2]).evaluate();
        const a0x = fracToExpr(ce, a0);
        const a1x = fracToExpr(ce, a1);
        const A1 = ce
          .function("Divide", [
            ce.function("Subtract", [a1x, ce.function("Multiply", [a0x, r2])]),
            denom,
          ])
          .evaluate();
        const A2 = ce.function("Subtract", [a0x, A1]).evaluate();
        const term1 = ce.function("Multiply", [A1, ce.function("Power", [r1, n])]);
        const term2 = ce.function("Multiply", [A2, ce.function("Power", [r2, n])]);
        return ce.function("Add", [term1, term2]).evaluate().simplify();
      }
    }
  }
  return undefined; // no closed form recognised: stay symbolic
}

function declareFindSequenceFunction(ce: ComputeEngine): void {
  ce.declare("FindSequenceFunction", {
    description:
      "A closed form (or, failing that, undefined) for the sequence a(0), a(1), … given as a list — polynomial fits via finite differences, geometric/exponential-polynomial fits via Berlekamp–Massey (order ≤ 2), and a small registry of named sequences (Fibonacci, Catalan, factorial, derangements, Bell numbers).",
    signature: "(list, symbol) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => findSequenceFunctionCore(ce, ops),
  });
}

export function declareGeneratingFunctions(ce: ComputeEngine): void {
  declareGeneratingFunction(ce);
  declareExponentialGeneratingFunction(ce);
  declareFindSequenceFunction(ce);
  declareDiscreteRatio(ce);
}
