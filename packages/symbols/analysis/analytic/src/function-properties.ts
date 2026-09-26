import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/boxed";

// The Wolfram `Function*` property family (FunctionDomain, FunctionRange,
// FunctionMonotonicity, FunctionConvexity, FunctionSign, FunctionInjective,
// FunctionSurjective, FunctionSingularities, FunctionDiscontinuities,
// FunctionAnalytic, FunctionMeromorphic, FunctionPeriod), for an ELEMENTARY
// expression in one real variable.
//
// Every head is built on ONE shared classifier (`recognize`, below): it walks the
// expression and, when it can, reduces it to one of a small closed set of shapes --
// a polynomial, a rational function P/Q, sqrt/log of an affine-or-quadratic argument,
// exp of an affine argument, or sin/cos/tan of an affine argument. Each shape carries
// exact, real coefficients, so every fact this file states about it (domain, sign,
// monotonicity, ...) is a closed-form calculus fact about that shape, not a heuristic.
//
// Anything the classifier does not recognize -- another symbol (multivariate),
// a transcendental composed with something other than an affine/quadratic argument,
// a denominator or radicand of degree > 2 that is not a bare monomial, a non-affine
// Log argument, complex domains -- makes `recognize` return `undefined`, and every
// head declined below leaves the call unevaluated rather than guess. See each
// head's reference entry for the precise list of what is and isn't covered.

const MAX_DEGREE = 8;

// ---- plain-number polynomial arithmetic (ascending coefficients) -------------------

/** Drop trailing zero coefficients so `coeffs.length - 1` is the true degree
 * (`[0]` for the identically-zero polynomial, `.length === 0` never occurs). */
function trim(coeffs: readonly number[]): number[] {
  const c = coeffs.slice();
  while (c.length > 1 && c[c.length - 1] === 0) c.pop();
  return c;
}

function addPoly(a: readonly number[], b: readonly number[]): number[] {
  const n = Math.max(a.length, b.length);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push((a[i] ?? 0) + (b[i] ?? 0));
  return trim(out);
}

function mulPoly(a: readonly number[], b: readonly number[]): number[] {
  const out: number[] = Array.from({ length: a.length + b.length - 1 }, () => 0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j]! += a[i]! * b[j]!;
  return trim(out);
}

function derivPoly(coeffs: readonly number[]): number[] {
  if (coeffs.length <= 1) return [0];
  return trim(coeffs.slice(1).map((c, i) => c * (i + 1)));
}

function degreeOf(coeffs: readonly number[]): number {
  const t = trim(coeffs);
  return t.length === 1 && t[0] === 0 ? -1 : t.length - 1;
}

// ---- reading a real coefficient polynomial in `x` out of a boxed expression --------

/** Is `expr` exactly the bare symbol named `x`? */
const isSym = (expr: BoxedExpression, x: string): boolean => symbolNameOf(expr) === x;

/** Does `expr` mention the symbol named `x` anywhere in its tree? Exported for
 * `optimize-core.ts`, which needs the same free-variable test when parsing an interval
 * constraint's endpoints. */
export function containsVar(expr: BoxedExpression, x: string): boolean {
  if (symbolNameOf(expr) === x) return true;
  return operandsOf(expr).some((o) => containsVar(o, x));
}

/** Does `expr` mention any symbol OTHER than `x`? A guard: our whole approach is
 * built and verified for one real variable, closed-form numeric coefficients --
 * anything with a second symbol (another variable, or a named constant like `Pi`
 * we do not special-case) declines rather than risk a wrong answer. */
function hasForeignSymbol(expr: BoxedExpression, x: string): boolean {
  const name = symbolNameOf(expr);
  if (name !== undefined) return name !== x;
  return operandsOf(expr).some((o) => hasForeignSymbol(o, x));
}

/**
 * `isNumberLiteral` lives on compute-engine's NARROWED expression interface (like
 * `.ops`/`.symbol` — see `@enumeratio/boxed`'s header comment); `BoxedExpression` is
 * an alias for the public `Expression` union, which doesn't carry it. Read it
 * structurally rather than casting to the internal type.
 */
const isNumberLiteral = (expr: BoxedExpression): boolean =>
  (expr as { isNumberLiteral?: unknown }).isNumberLiteral === true;

/** A subtree with no occurrence of `x` reduces to a plain number by construction
 * (no foreign symbols reach here — `hasForeignSymbol` gates the caller), so a
 * numeric evaluation is exact rather than a guess. */
function constantValue(expr: BoxedExpression): number | undefined {
  try {
    const v = expr.N();
    return isNumberLiteral(v) && v.im === 0 && Number.isFinite(v.re) ? v.re : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Coefficients of `expr` as a polynomial in `x` (ascending, `coeffs[i]` is the
 * coefficient of `x^i`), built from `Add`/`Subtract`/`Negate`/`Multiply`/integer
 * `Power`/a constant `Divide`. `undefined` when `expr` is not recognizably such a
 * polynomial (an unsupported head, a non-integer or negative exponent, a
 * denominator that itself depends on `x`, or a degree above `MAX_DEGREE`).
 */
function polyOf(expr: BoxedExpression, x: string, depth = 0): number[] | undefined {
  if (depth > 64) return undefined;
  if (!containsVar(expr, x)) {
    const c = constantValue(expr);
    return c === undefined ? undefined : [c];
  }
  if (symbolNameOf(expr) === x) return [0, 1];
  const op = expr.operator;
  const ops = operandsOf(expr);
  if (op === "Negate" && ops.length === 1) {
    const p = polyOf(ops[0]!, x, depth + 1);
    return p?.map((c) => -c);
  }
  if (op === "Add") {
    let acc: number[] = [0];
    for (const o of ops) {
      const p = polyOf(o, x, depth + 1);
      if (p === undefined) return undefined;
      acc = addPoly(acc, p);
    }
    return acc;
  }
  if (op === "Subtract" && ops.length === 2) {
    const a = polyOf(ops[0]!, x, depth + 1);
    const b = polyOf(ops[1]!, x, depth + 1);
    if (a === undefined || b === undefined) return undefined;
    return addPoly(
      a,
      b.map((c) => -c),
    );
  }
  if (op === "Multiply") {
    let acc: number[] = [1];
    for (const o of ops) {
      const p = polyOf(o, x, depth + 1);
      if (p === undefined) return undefined;
      acc = mulPoly(acc, p);
      if (degreeOf(acc) > MAX_DEGREE) return undefined;
    }
    return acc;
  }
  if (op === "Power" && ops.length === 2) {
    const n = ops[1]!;
    if (!isNumberLiteral(n) || n.im !== 0 || !Number.isInteger(n.re) || n.re < 0) return undefined;
    if (n.re > MAX_DEGREE) return undefined;
    const base = polyOf(ops[0]!, x, depth + 1);
    if (base === undefined) return undefined;
    let acc: number[] = [1];
    for (let i = 0; i < n.re; i++) {
      acc = mulPoly(acc, base);
      if (degreeOf(acc) > MAX_DEGREE) return undefined;
    }
    return acc;
  }
  if (op === "Divide" && ops.length === 2) {
    if (containsVar(ops[1]!, x)) return undefined; // a genuine rational, not a polynomial
    const denomC = constantValue(ops[1]!);
    const num = polyOf(ops[0]!, x, depth + 1);
    if (denomC === undefined || denomC === 0 || num === undefined) return undefined;
    return num.map((c) => c / denomC);
  }
  return undefined;
}

// ---- the recognizer -----------------------------------------------------------------

export type Recognized =
  | { readonly tag: "poly"; readonly coeffs: readonly number[] }
  | { readonly tag: "rational"; readonly num: readonly number[]; readonly den: readonly number[] }
  | { readonly tag: "sqrt"; readonly radicand: readonly number[] }
  | { readonly tag: "log"; readonly a: number; readonly b: number }
  | { readonly tag: "exp"; readonly a: number; readonly b: number }
  | {
      readonly tag: "trig";
      readonly fn: "Sin" | "Cos" | "Tan";
      readonly a: number;
      readonly b: number;
    };

/** Classify `expr` as a function of `x` into one of the shapes above, or decline
 * (`undefined`) when it is multivariate, or built from anything outside the small
 * vocabulary this file understands. This is the single entry point every head below
 * calls before doing anything else. */
export function recognize(expr: BoxedExpression, x: string): Recognized | undefined {
  if (hasForeignSymbol(expr, x) || !containsVar(expr, x)) return undefined;

  const poly = polyOf(expr, x);
  if (poly !== undefined) return { tag: "poly", coeffs: poly };

  const op = expr.operator;
  const ops = operandsOf(expr);

  if (op === "Divide" && ops.length === 2) {
    const num = polyOf(ops[0]!, x);
    const den = polyOf(ops[1]!, x);
    if (num !== undefined && den !== undefined && degreeOf(den) >= 1) return { tag: "rational", num, den };
    return undefined;
  }
  if (op === "Power" && ops.length === 2) {
    const n = ops[1]!;
    if (isNumberLiteral(n) && n.im === 0 && Number.isInteger(n.re) && n.re < 0) {
      const base = polyOf(ops[0]!, x);
      if (base !== undefined && degreeOf(base) >= 1 && -n.re <= MAX_DEGREE) {
        let den: number[] = [1];
        for (let i = 0; i < -n.re; i++) den = mulPoly(den, base);
        return { tag: "rational", num: [1], den };
      }
      return undefined;
    }
    // Even root: Power(base, 1/2), a Sqrt spelled out.
    if (isNumberLiteral(n) && n.im === 0 && n.re === 0.5) {
      const radicand = polyOf(ops[0]!, x);
      if (radicand !== undefined && degreeOf(radicand) >= 1 && degreeOf(radicand) <= 2)
        return { tag: "sqrt", radicand };
    }
    return undefined;
  }
  if (op === "Sqrt" && ops.length === 1) {
    const radicand = polyOf(ops[0]!, x);
    if (radicand !== undefined && degreeOf(radicand) >= 1 && degreeOf(radicand) <= 2) return { tag: "sqrt", radicand };
    return undefined;
  }
  if ((op === "Ln" || op === "Log") && ops.length === 1) {
    const arg = polyOf(ops[0]!, x);
    if (arg !== undefined && degreeOf(arg) === 1) return { tag: "log", a: arg[1]!, b: arg[0]! };
    return undefined;
  }
  if (op === "Exp" && ops.length === 1) {
    const arg = polyOf(ops[0]!, x);
    if (arg !== undefined && degreeOf(arg) === 1) return { tag: "exp", a: arg[1]!, b: arg[0]! };
    return undefined;
  }
  if ((op === "Sin" || op === "Cos" || op === "Tan") && ops.length === 1) {
    const arg = polyOf(ops[0]!, x);
    if (arg !== undefined && degreeOf(arg) === 1) return { tag: "trig", fn: op, a: arg[1]!, b: arg[0]! };
    return undefined;
  }
  return undefined;
}

// ---- sign/root shape of a degree <= 2 polynomial (or a bare monomial) -------------

/**
 * The real zero set and sign shape of a polynomial the classifier above can produce
 * as a denominator or a sqrt/log argument: degree 0, 1, 2, or a bare monomial `c*x^n`
 * of any degree (only the `Power` path in `recognize`/`polyOf` produces those, and
 * their sign is elementary). `undefined` for anything else (a genuine higher-degree
 * polynomial with more than one term) — the caller declines rather than guess.
 *
 * `sign` is the shape ignoring the finite zero set already reported:
 *  - "pos"/"neg": never zero, one constant sign (0 or 2 conjugate-complex roots).
 *  - "nonneg"/"nonpos": one double real root where it touches zero, constant sign elsewhere.
 *  - "mixed": `zeros` splits the line into regions of opposite sign; `outsideSign` is
 *    the sign for x beyond the LAST zero (and, symmetrically, its negation for x
 *    below the FIRST zero when there are two zeros — see `signAt` below).
 */
export interface SignShape {
  readonly zeros: readonly number[]; // ascending, deduplicated
  readonly sign: "pos" | "neg" | "nonneg" | "nonpos" | "mixed";
  readonly outsideSign?: 1 | -1;
}

/** Exported for `optimize-core.ts`: the same degree <= 2 (or bare monomial) sign/root
 * shape, used there ONLY for structural decisions (how many real zeros, which side is
 * unbounded) -- never for the numeric VALUE of an answer, which always comes back out of
 * the original exact expression via compute-engine's own `D`/`Solve`/`Limit`/`subs`. */
export function signShape(coeffs: readonly number[]): SignShape | undefined {
  const c = trim(coeffs);
  const d = degreeOf(c);
  if (d < 0) return undefined; // identically zero: not a meaningful denominator/radicand
  if (d === 0) return { zeros: [], sign: c[0]! > 0 ? "pos" : "neg" };
  if (d === 1) {
    const [b, a] = c as [number, number];
    return { zeros: [-b / a], sign: "mixed", outsideSign: a > 0 ? 1 : -1 };
  }
  if (d === 2) {
    const [cc, b, a] = c as [number, number, number];
    const disc = b * b - 4 * a * cc;
    if (disc < 0) return { zeros: [], sign: a > 0 ? "pos" : "neg" };
    const sq = Math.sqrt(disc);
    const r1 = (-b - sq) / (2 * a);
    const r2 = (-b + sq) / (2 * a);
    const lo = Math.min(r1, r2);
    const hi = Math.max(r1, r2);
    if (disc === 0) return { zeros: [lo], sign: a > 0 ? "nonneg" : "nonpos" };
    return { zeros: [lo, hi], sign: "mixed", outsideSign: a > 0 ? 1 : -1 };
  }
  // Higher degree: only a bare monomial c*x^d (everything below the top coefficient
  // zero) has elementary, provable sign behaviour.
  if (c.slice(0, d).every((v) => v === 0)) {
    const lead = c[d]!;
    if (d % 2 === 0) return { zeros: [0], sign: lead > 0 ? "nonneg" : "nonpos" };
    return { zeros: [0], sign: "mixed", outsideSign: lead > 0 ? 1 : -1 };
  }
  return undefined;
}

/** The vertex value (extremum) of a genuine (degree-2) quadratic `a*x^2+b*x+c`. */
function vertexValue(coeffs: readonly number[]): number {
  const [c, b, a] = trim(coeffs) as [number, number, number];
  return c - (b * b) / (4 * a);
}

// ---- building boxed conditions from a sign shape ----------------------------------

/** `x` restricted to where `shape`'s polynomial is nonzero: `Or` of the open
 * intervals between (and beyond) its zeros. `undefined`/no zeros renders `True`. */
function conditionNonzero(ce: ComputeEngine, x: string, shape: SignShape): BoxedExpression {
  if (shape.zeros.length === 0) return ce.symbol("True");
  const zs = shape.zeros;
  const parts: BoxedExpression[] = [ce.function("Less", [x, zs[0]!])];
  for (let i = 0; i + 1 < zs.length; i++) parts.push(ce.function("Less", [zs[i]!, x, zs[i + 1]!]));
  parts.push(ce.function("Less", [zs[zs.length - 1]!, x]));
  return ce.function("Or", parts);
}

/**
 * `x` restricted to where `shape`'s polynomial has the wanted sign — `>= 0` (sqrt's
 * domain) or `> 0` (log's), or their complements (`<= 0` / `< 0`, for singularities).
 * Built directly from the closed-form shape, so every branch is a provable fact
 * about that specific quadratic/monomial rather than a numeric search.
 */
function conditionSign(
  ce: ComputeEngine,
  x: string,
  shape: SignShape,
  want: "nonneg" | "pos" | "nonpos" | "neg",
): BoxedExpression {
  const strict = want === "pos" || want === "neg";
  const positive = want === "nonneg" || want === "pos";
  if (shape.sign === "pos") return ce.symbol(positive ? "True" : "False");
  if (shape.sign === "neg") return ce.symbol(positive ? "False" : "True");
  if (shape.sign === "nonneg" || shape.sign === "nonpos") {
    const matches = (shape.sign === "nonneg") === positive;
    if (!strict) return ce.symbol(matches ? "True" : "False");
    // Strict: everywhere except the single touch point.
    return matches ? conditionNonzero(ce, x, shape) : ce.symbol("False");
  }
  // "mixed": one or two zeros, with a known sign on the outermost region(s).
  const wantOutside = shape.outsideSign === (positive ? 1 : -1);
  const le = strict ? "Less" : "LessEqual";
  if (shape.zeros.length === 1) {
    const z = shape.zeros[0]!;
    return wantOutside ? ce.function(le, [z, x]) : ce.function(le, [x, z]);
  }
  const [lo, hi] = shape.zeros as [number, number];
  return wantOutside
    ? ce.function("Or", [ce.function(le, [x, lo]), ce.function(le, [hi, x])])
    : ce.function(le, [lo, x, hi]);
}

// ---- domain -------------------------------------------------------------------------

/** `undefined` = decline. `isAll` = the domain is every real (needed by monotonicity,
 * convexity and sign, which Wolfram only answers definitively over the whole line). */
export function domainOf(
  ce: ComputeEngine,
  rec: Recognized,
  x: string,
): { readonly expr: BoxedExpression; readonly isAll: boolean } | undefined {
  switch (rec.tag) {
    case "poly":
      return { expr: ce.symbol("True"), isAll: true };
    case "rational": {
      const shape = signShape(rec.den);
      if (shape === undefined) return undefined;
      if (shape.zeros.length === 0) return { expr: ce.symbol("True"), isAll: true };
      return { expr: conditionNonzero(ce, x, shape), isAll: false };
    }
    case "sqrt": {
      const shape = signShape(rec.radicand);
      if (shape === undefined) return undefined;
      const expr = conditionSign(ce, x, shape, "nonneg");
      return { expr, isAll: shape.sign === "pos" || shape.sign === "nonneg" };
    }
    case "log": {
      const shape = signShape([rec.b, rec.a]);
      if (shape === undefined) return undefined;
      return { expr: conditionSign(ce, x, shape, "pos"), isAll: false };
    }
    case "exp":
      return { expr: ce.symbol("True"), isAll: true };
    case "trig":
      if (rec.fn !== "Tan") return { expr: ce.symbol("True"), isAll: true };
      // Tan(a x + b) excludes a x + b = pi/2 + k*pi — a countable set, not a finite
      // union of intervals, so this is genuinely outside FunctionDomain's interval
      // vocabulary; decline rather than approximate it as "True".
      return undefined;
  }
}

// ---- range --------------------------------------------------------------------------

export function rangeOf(ce: ComputeEngine, rec: Recognized, y: string): BoxedExpression | undefined {
  switch (rec.tag) {
    case "poly": {
      const d = degreeOf(rec.coeffs);
      if (d <= 0) return undefined; // a constant function's "range" isn't worth guessing at
      if (d % 2 === 1) return ce.symbol("True"); // odd degree: unbounded both ways, onto R
      if (d === 2) {
        const [, , a] = trim(rec.coeffs) as [number, number, number];
        const v = vertexValue(rec.coeffs);
        return a > 0 ? ce.function("LessEqual", [v, y]) : ce.function("LessEqual", [y, v]);
      }
      return undefined; // even degree > 2: no general closed-form extremum here
    }
    case "rational": {
      if (degreeOf(rec.num) !== 0) return undefined; // only a constant numerator
      const k = rec.num[0]!;
      if (k === 0) return undefined;
      if (degreeOf(rec.den) === 1) return ce.function("Or", [ce.function("Less", [y, 0]), ce.function("Less", [0, y])]);
      return undefined; // a quadratic denominator's range needs its vertex value too
    }
    case "sqrt": {
      const d = degreeOf(rec.radicand);
      if (d === 1) return ce.function("LessEqual", [0, y]);
      const [, , a] = trim(rec.radicand) as [number, number, number];
      const shape = signShape(rec.radicand);
      if (shape === undefined) return undefined;
      const v = vertexValue(rec.radicand);
      if (shape.zeros.length === 2) {
        // Two real roots: a > 0 gives two unbounded rays (range [0, ∞)); a < 0 gives
        // a bounded interval between them, peaking at the vertex (range [0, sqrt(v)]).
        return a > 0 ? ce.function("LessEqual", [0, y]) : ce.function("LessEqual", [0, y, ce.function("Sqrt", [v])]);
      }
      // No real roots (disc < 0): defined on all of R, a > 0 forced (else nowhere
      // real), minimum at the vertex.
      return ce.function("LessEqual", [ce.function("Sqrt", [v]), y]);
    }
    case "log":
      return ce.symbol("True");
    case "exp":
      return ce.function("Less", [0, y]);
    case "trig":
      if (rec.fn === "Tan") return ce.symbol("True");
      return ce.function("LessEqual", [-1, y, 1]);
  }
}

// ---- monotonicity / convexity / sign: only definitive when the domain is all of R --

export type Trend = 1 | -1 | 0 | "indeterminate";

export function monotonicityOf(rec: Recognized, domainIsAll: boolean): Trend | undefined {
  if (!domainIsAll) return "indeterminate";
  switch (rec.tag) {
    case "poly": {
      const d = derivPoly(rec.coeffs);
      if (degreeOf(d) < 0) return 0;
      const shape = signShape(d);
      if (shape === undefined) return undefined;
      if (shape.sign === "pos" || shape.sign === "nonneg") return 1;
      if (shape.sign === "neg" || shape.sign === "nonpos") return -1;
      return "indeterminate"; // a genuine, proven sign change
    }
    case "exp":
      return rec.a > 0 ? 1 : -1;
    case "rational":
    case "sqrt":
    case "log":
    case "trig":
      return "indeterminate";
  }
}

export function convexityOf(rec: Recognized, domainIsAll: boolean): Trend | undefined {
  if (!domainIsAll) return "indeterminate";
  switch (rec.tag) {
    case "poly": {
      const d2 = derivPoly(derivPoly(rec.coeffs));
      if (degreeOf(d2) < 0) return 0;
      const shape = signShape(d2);
      if (shape === undefined) return undefined;
      if (shape.sign === "pos" || shape.sign === "nonneg") return 1;
      if (shape.sign === "neg" || shape.sign === "nonpos") return -1;
      return "indeterminate";
    }
    case "exp":
      return 1; // a^2 * exp(...) > 0 always
    case "rational":
    case "sqrt":
    case "log":
    case "trig":
      return "indeterminate";
  }
}

export function signOf(rec: Recognized, domainIsAll: boolean): Trend | undefined {
  if (!domainIsAll) return rec.tag === "exp" ? 1 : "indeterminate"; // exp's sign is 1 regardless of domain-R
  switch (rec.tag) {
    case "poly": {
      const shape = signShape(rec.coeffs);
      if (shape === undefined) return undefined;
      if (shape.sign === "pos" || shape.sign === "nonneg") return 1;
      if (shape.sign === "neg" || shape.sign === "nonpos") return -1;
      return "indeterminate";
    }
    case "exp":
      return 1;
    case "sqrt":
      return 1; // domain is all of R here, so the radicand is always > 0 (never touches 0)
    case "rational": {
      const ns = signShape(rec.num);
      const ds = signShape(rec.den);
      if (ns === undefined || ds === undefined) return undefined;
      const asSign = (s: SignShape["sign"]): 1 | -1 | undefined =>
        s === "pos" || s === "nonneg" ? 1 : s === "neg" || s === "nonpos" ? -1 : undefined;
      const n = asSign(ns.sign);
      const dd = asSign(ds.sign);
      if (n === undefined || dd === undefined) return "indeterminate";
      return (n * dd) as 1 | -1;
    }
    case "log":
    case "trig":
      return "indeterminate";
  }
}

// ---- injective ------------------------------------------------------------------------

export function injectiveOf(rec: Recognized): boolean | undefined {
  switch (rec.tag) {
    case "poly": {
      const trend = monotonicityOf(rec, true);
      if (trend === 1 || trend === -1) return true;
      if (trend === 0) return false; // constant
      if (trend === "indeterminate") return degreeOf(rec.coeffs) >= 1 ? false : undefined;
      return undefined;
    }
    case "exp":
      return true;
    case "log":
      return true; // strictly increasing/decreasing on its whole (half-line) domain
    case "sqrt":
      return degreeOf(rec.radicand) === 1 ? true : undefined; // quadratic radicand: decline
    case "rational":
      // c / (a x + b): a Möbius-type map, injective wherever it's defined.
      return degreeOf(rec.num) === 0 && rec.num[0] !== 0 && degreeOf(rec.den) === 1 ? true : undefined;
    case "trig":
      return false; // periodic: many-to-one over the whole domain
  }
}

// ---- surjective (onto Reals only — the one codomain these heads support) -------------

export function surjectiveOntoRealsOf(rec: Recognized): boolean | undefined {
  switch (rec.tag) {
    case "poly": {
      const d = degreeOf(rec.coeffs);
      if (d % 2 === 1) return true; // odd degree: onto R
      return d >= 0 ? false : undefined; // even degree (incl. constant): bounded below or above
    }
    case "log":
      return true;
    case "exp":
      return false; // range (0, ∞)
    case "sqrt":
      return false; // range bounded below by 0
    case "rational":
      return degreeOf(rec.num) === 0 && rec.num[0] !== 0 && degreeOf(rec.den) === 1
        ? false // never hits 0
        : undefined;
    case "trig":
      return rec.fn === "Tan" ? true : false;
  }
}

// ---- singularities / discontinuities -------------------------------------------------

/** Where the expression fails to be (finitely) defined, as a condition in `x` —
 * `undefined` when this file can't characterise it. */
export function singularitiesOf(ce: ComputeEngine, rec: Recognized, x: string): BoxedExpression | undefined {
  switch (rec.tag) {
    case "poly":
    case "exp":
      return ce.symbol("False"); // entire: no singularities
    case "rational": {
      const shape = signShape(rec.den);
      if (shape === undefined || shape.zeros.length === 0) return ce.symbol("False");
      const equalities = shape.zeros.map((z) => ce.function("Equal", [x, z]));
      return equalities.length === 1 ? equalities[0]! : ce.function("Or", equalities);
    }
    case "sqrt": {
      const shape = signShape(rec.radicand);
      if (shape === undefined) return undefined;
      // Non-strict: Sqrt is singular not just where the radicand is negative, but
      // AT its boundary zero too (a branch point, even though the real value there
      // is defined) — confirmed against Wolfram (`FunctionSingularities[Sqrt[x],x]`
      // is `x <= 0`, not `x < 0`).
      return conditionSign(ce, x, shape, "nonpos");
    }
    case "log": {
      const shape = signShape([rec.b, rec.a]);
      if (shape === undefined) return undefined;
      return conditionSign(ce, x, shape, "nonpos");
    }
    case "trig":
      if (rec.fn === "Tan") return ce.function("Equal", [ce.function("Cos", [x]), 0]);
      return ce.symbol("False");
  }
}

/** Same set for these shapes (no removable discontinuities arise from anything the
 * classifier recognizes — a pole is a pole, a branch cut is a branch cut). */
export const discontinuitiesOf = singularitiesOf;

// ---- analytic / meromorphic (real classifier's provable, not a full complex study) --

export function analyticOf(rec: Recognized): boolean {
  switch (rec.tag) {
    case "poly":
    case "exp":
      return true; // entire
    case "trig":
      return rec.fn !== "Tan"; // Sin/Cos entire; Tan has poles
    case "rational":
    case "sqrt":
    case "log":
      return false; // a nonconstant rational function always has a complex pole;
    // sqrt/log have a branch point — neither is entire
  }
}

export function meromorphicOf(rec: Recognized): boolean {
  switch (rec.tag) {
    case "poly":
    case "exp":
    case "rational":
      return true;
    case "trig":
      return true; // Sin, Cos entire; Tan = Sin/Cos, a ratio of entire functions
    case "sqrt":
    case "log":
      return false; // a branch point is not a pole
  }
}

// ---- period -------------------------------------------------------------------------

/** `0` = provably non-periodic. `undefined` = decline. */
export function periodOf(ce: ComputeEngine, rec: Recognized): BoxedExpression | undefined {
  switch (rec.tag) {
    case "poly":
      return degreeOf(rec.coeffs) >= 1 ? ce.number(0) : undefined;
    case "rational":
    case "sqrt":
    case "log":
    case "exp":
      return ce.number(0); // monotonic-or-unbounded: a periodic function can't be
    case "trig": {
      // Exact: `Pi` (or `2*Pi`) over `|a|`, not a floating-point multiple of it.
      const basePi: BoxedExpression = rec.fn === "Tan" ? ce.symbol("Pi") : ce.function("Multiply", [2, "Pi"]);
      return ce.function("Divide", [basePi, Math.abs(rec.a)]);
    }
  }
}

// ---- continuous (2-arg: over all of R; 3-arg: over a stated domain restriction) -----

/** A half-open-or-closed real interval; `lo`/`hi` may be `+/-Infinity` (their own
 * closedness flag is then irrelevant). Used only to decide whether a stated domain
 * restriction sits entirely inside where a recognized shape is defined AND continuous —
 * never surfaced as a MathJSON condition itself. */
interface RealInterval {
  readonly lo: number;
  readonly loClosed: boolean;
  readonly hi: number;
  readonly hiClosed: boolean;
}

const ALL_REALS: RealInterval = { lo: -Infinity, loClosed: false, hi: Infinity, hiClosed: false };

/**
 * The maximal intervals where `rec`'s shape is BOTH defined and continuous — distinct
 * from `domainOf`'s condition because a boundary can be closed-and-fine (`Sqrt`'s zero:
 * defined, one-sided-continuous there) or closed-and-broken (`Log`'s zero: undefined
 * there even though it borders the domain). `undefined` = decline (an unbounded
 * discrete exclusion set, e.g. `Tan`, or a degenerate sqrt/log shape this file doesn't
 * characterise elsewhere either).
 */
function continuousIntervalsOf(rec: Recognized): readonly RealInterval[] | undefined {
  switch (rec.tag) {
    case "poly":
    case "exp":
      return [ALL_REALS];
    case "trig":
      return rec.fn === "Tan" ? undefined : [ALL_REALS];
    case "rational": {
      const shape = signShape(rec.den);
      if (shape === undefined) return undefined;
      if (shape.zeros.length === 0) return [ALL_REALS];
      // R minus each zero: open at every zero (a pole is never included).
      const zs = shape.zeros;
      const out: RealInterval[] = [{ lo: -Infinity, loClosed: false, hi: zs[0]!, hiClosed: false }];
      for (let i = 0; i + 1 < zs.length; i++) {
        out.push({ lo: zs[i]!, loClosed: false, hi: zs[i + 1]!, hiClosed: false });
      }
      out.push({ lo: zs[zs.length - 1]!, loClosed: false, hi: Infinity, hiClosed: false });
      return out;
    }
    case "sqrt": {
      const shape = signShape(rec.radicand);
      if (shape === undefined) return undefined;
      if (shape.sign === "pos" || shape.sign === "nonneg") return [ALL_REALS];
      if (shape.sign === "neg" || shape.sign === "nonpos") return undefined; // domain empty or a single point
      // "mixed": the boundary zero(s) are CLOSED — Sqrt is defined and (one-sided)
      // continuous exactly there, only strictly beyond it is it undefined.
      if (shape.zeros.length === 1) {
        const [z] = shape.zeros;
        return shape.outsideSign === 1
          ? [{ lo: z!, loClosed: true, hi: Infinity, hiClosed: false }]
          : [{ lo: -Infinity, loClosed: false, hi: z!, hiClosed: true }];
      }
      const [lo, hi] = shape.zeros as [number, number];
      return shape.outsideSign === 1
        ? [
            { lo: -Infinity, loClosed: false, hi, hiClosed: true },
            { lo, loClosed: true, hi: Infinity, hiClosed: false },
          ]
        : [{ lo, loClosed: true, hi, hiClosed: true }];
    }
    case "log": {
      const shape = signShape([rec.b, rec.a]);
      if (shape === undefined) return undefined;
      // Always "mixed", one zero (a log's argument is linear): OPEN at the boundary —
      // Log(0) itself is undefined, unlike Sqrt's touch point.
      const [z] = shape.zeros;
      return shape.outsideSign === 1
        ? [{ lo: z!, loClosed: false, hi: Infinity, hiClosed: false }]
        : [{ lo: -Infinity, loClosed: false, hi: z!, hiClosed: false }];
    }
  }
}

/** A concrete finite real value read off a subtree with no occurrence of `x` — the
 * domain restriction's bound. Mirrors `constantValue` above (not exported from here). */
function boundValue(expr: BoxedExpression, x: string): number | undefined {
  if (containsVar(expr, x)) return undefined;
  return constantValue(expr);
}

/** One relation `x <op> c` or `c <op> x`, read as a half-open-or-unbounded interval —
 * `Less`/`LessEqual`/`Greater`/`GreaterEqual`, 2-ary, or 3-ary chained (`a < x < b`). */
function oneSidedInterval(cond: BoxedExpression, x: string): Partial<RealInterval> | undefined {
  const ops = operandsOf(cond);
  const op = cond.operator;
  if (ops.length === 3 && (op === "Less" || op === "LessEqual")) {
    const [p0, p1, p2] = ops as [BoxedExpression, BoxedExpression, BoxedExpression];
    if (!isSym(p1, x)) return undefined;
    const lo = boundValue(p0, x);
    const hi = boundValue(p2, x);
    if (lo === undefined || hi === undefined) return undefined;
    const closed = op === "LessEqual";
    return { lo, loClosed: closed, hi, hiClosed: closed };
  }
  if (ops.length !== 2 || (op !== "Less" && op !== "LessEqual" && op !== "Greater" && op !== "GreaterEqual")) {
    return undefined;
  }
  const [p0, p1] = ops as [BoxedExpression, BoxedExpression];
  if (isSym(p0, x)) {
    // x <op> c
    const c = boundValue(p1, x);
    if (c === undefined) return undefined;
    if (op === "Less") return { hi: c, hiClosed: false };
    if (op === "LessEqual") return { hi: c, hiClosed: true };
    if (op === "Greater") return { lo: c, loClosed: false };
    return { lo: c, loClosed: true }; // GreaterEqual
  }
  if (isSym(p1, x)) {
    // c <op> x
    const c = boundValue(p0, x);
    if (c === undefined) return undefined;
    if (op === "Less") return { lo: c, loClosed: false };
    if (op === "LessEqual") return { lo: c, loClosed: true };
    if (op === "Greater") return { hi: c, hiClosed: false };
    return { hi: c, hiClosed: true }; // GreaterEqual
  }
  return undefined;
}

/** The domain restriction as ONE real interval — a bare relation, a 3-ary chain, or
 * `And` of two one-sided relations that together bound both sides. `undefined` =
 * decline (anything else: `Or`, `NotEqual`, a relation not in `x`, ...). */
function domainRestrictionInterval(domain: BoxedExpression, x: string): RealInterval | undefined {
  let parts: Partial<RealInterval>[];
  if (domain.operator === "And") {
    const ops = operandsOf(domain);
    if (ops.length !== 2) return undefined;
    const a = oneSidedInterval(ops[0]!, x);
    const b = oneSidedInterval(ops[1]!, x);
    if (a === undefined || b === undefined) return undefined;
    parts = [a, b];
  } else {
    const one = oneSidedInterval(domain, x);
    if (one === undefined) return undefined;
    parts = [one];
  }
  let lo = -Infinity;
  let loClosed = false;
  let hi = Infinity;
  let hiClosed = false;
  for (const p of parts) {
    if (p.lo !== undefined) {
      lo = p.lo;
      loClosed = p.loClosed ?? false;
    }
    if (p.hi !== undefined) {
      hi = p.hi;
      hiClosed = p.hiClosed ?? false;
    }
  }
  return { lo, loClosed, hi, hiClosed };
}

/** Does `outer` entirely contain `inner`, boundary-aware (an open `outer` boundary only
 * covers a matching open `inner` boundary at the same point)? */
function intervalContains(outer: RealInterval, inner: RealInterval): boolean {
  const loOk = outer.lo < inner.lo || (outer.lo === inner.lo && (outer.loClosed || !inner.loClosed));
  const hiOk = outer.hi > inner.hi || (outer.hi === inner.hi && (outer.hiClosed || !inner.hiClosed));
  return loOk && hiOk;
}

/** `FunctionContinuous(f, x)`: True iff `f` has no singularity anywhere on the reals.
 * `FunctionContinuous(f, x, domain)`: True iff the stated restriction sits entirely
 * inside one of `f`'s continuous intervals. Declines whenever the classifier, the
 * singularity set, or (3-arg) the restriction itself can't be characterised. */
function continuousOf(
  ce: ComputeEngine,
  rec: Recognized,
  x: string,
  domain: BoxedExpression | undefined,
): BoxedExpression | undefined {
  if (domain === undefined) {
    const sing = singularitiesOf(ce, rec, x);
    if (sing === undefined) return undefined;
    const isFalse = symbolNameOf(sing) === "False";
    return ce.symbol(isFalse ? "True" : "False");
  }
  const intervals = continuousIntervalsOf(rec);
  if (intervals === undefined) return undefined;
  const restriction = domainRestrictionInterval(domain, x);
  if (restriction === undefined) return undefined;
  const covered = intervals.some((iv) => intervalContains(iv, restriction));
  return ce.symbol(covered ? "True" : "False");
}

// ---- declaration ----------------------------------------------------------------------

const trendToExpr = (ce: ComputeEngine, t: Trend | undefined): BoxedExpression | undefined =>
  t === undefined ? undefined : t === "indeterminate" ? ce.symbol("Indeterminate") : ce.number(t);

/** A `(any, symbol) -> any` head over `recognize` + `f`, declining (returning
 * `undefined`, which leaves the call unevaluated) whenever `recognize` or `f` do. */
function declareUnary(
  ce: ComputeEngine,
  name: string,
  f: (ce: ComputeEngine, rec: Recognized, x: string) => BoxedExpression | undefined,
): void {
  ce.declare(name, {
    signature: "(any, symbol) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [expr, xExpr] = ops;
      const x = xExpr === undefined ? undefined : symbolNameOf(xExpr);
      if (expr === undefined || x === undefined) return undefined;
      const rec = recognize(expr, x);
      if (rec === undefined) return undefined;
      return f(ce, rec, x);
    },
  });
}

export function declareFunctionProperties(ce: ComputeEngine): void {
  declareUnary(ce, "FunctionDomain", (ce_, rec, x) => domainOf(ce_, rec, x)?.expr);

  ce.declare("FunctionRange", {
    signature: "(any, symbol, symbol) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [expr, xExpr, yExpr] = ops;
      const x = xExpr === undefined ? undefined : symbolNameOf(xExpr);
      const y = yExpr === undefined ? undefined : symbolNameOf(yExpr);
      if (expr === undefined || x === undefined || y === undefined) return undefined;
      const rec = recognize(expr, x);
      return rec === undefined ? undefined : rangeOf(ce, rec, y);
    },
  });

  declareUnary(ce, "FunctionMonotonicity", (ce_, rec, x) => {
    const d = domainOf(ce_, rec, x);
    return d === undefined ? undefined : trendToExpr(ce_, monotonicityOf(rec, d.isAll));
  });
  declareUnary(ce, "FunctionConvexity", (ce_, rec, x) => {
    const d = domainOf(ce_, rec, x);
    return d === undefined ? undefined : trendToExpr(ce_, convexityOf(rec, d.isAll));
  });
  declareUnary(ce, "FunctionSign", (ce_, rec, x) => {
    const d = domainOf(ce_, rec, x);
    return d === undefined ? undefined : trendToExpr(ce_, signOf(rec, d.isAll));
  });
  declareUnary(ce, "FunctionInjective", (ce_, rec, x) => {
    const d = domainOf(ce_, rec, x);
    if (d === undefined) return undefined;
    const b = injectiveOf(rec);
    return b === undefined ? undefined : ce_.symbol(b ? "True" : "False");
  });

  ce.declare("FunctionSurjective", {
    signature: "(any, symbol, any?) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [expr, xExpr, codomain] = ops;
      const x = xExpr === undefined ? undefined : symbolNameOf(xExpr);
      if (expr === undefined || x === undefined) return undefined;
      // Only "onto the reals" is supported — the codomain the frontier examples use.
      const codomainName = codomain === undefined ? undefined : symbolNameOf(codomain);
      if (codomain !== undefined && codomainName !== "Reals" && codomainName !== "RealNumbers") return undefined;
      const rec = recognize(expr, x);
      if (rec === undefined) return undefined;
      const b = surjectiveOntoRealsOf(rec);
      return b === undefined ? undefined : ce.symbol(b ? "True" : "False");
    },
  });

  declareUnary(ce, "FunctionSingularities", (ce_, rec, x) => singularitiesOf(ce_, rec, x));
  declareUnary(ce, "FunctionDiscontinuities", (ce_, rec, x) => discontinuitiesOf(ce_, rec, x));
  declareUnary(ce, "FunctionAnalytic", (ce_, rec) => ce_.symbol(analyticOf(rec) ? "True" : "False"));
  declareUnary(ce, "FunctionMeromorphic", (ce_, rec) => ce_.symbol(meromorphicOf(rec) ? "True" : "False"));
  declareUnary(ce, "FunctionPeriod", (ce_, rec) => periodOf(ce_, rec));

  ce.declare("FunctionContinuous", {
    signature: "(any, symbol, any?) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [expr, xExpr, domain] = ops;
      const x = xExpr === undefined ? undefined : symbolNameOf(xExpr);
      if (expr === undefined || x === undefined) return undefined;
      const rec = recognize(expr, x);
      if (rec === undefined) return undefined;
      return continuousOf(ce, rec, x, domain);
    },
  });
}
