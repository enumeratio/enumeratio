import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/boxed";

// DSolveValue(eqn, y(x), x) / DSolveValue({eqn, ic1, ic2, ...}, y(x), x): linear
// constant-coefficient ODEs of order 1 or 2. `y'`/`y''` are written the way
// compute-engine itself represents an undifferentiated function's derivative — `D(y(x),
// x)` / `D(y(x), x, x)`, which box to `Apply(Derivative(y, 1), x)` / `Apply(Derivative(y,
// 2), x)` (confirmed by boxing directly; no new notation introduced here) — and an
// initial condition is the same shape applied at a NUMBER instead of `x`:
// `Equal(Apply(Derivative(y, 1), 0), b)` for `y'(0) == b`. Arbitrary constants print as
// `C(1)`/`C(2)`, matching Wolfram's own `C[1]`/`C[2]` (compute-engine's native `C` is an
// unbound constant symbol; calling it, `C(1)`, stays a plain, inert two-element
// expression — confirmed by boxing it directly — exactly like Wolfram's own `C[1]`).
//
// Homogeneous part: the characteristic polynomial's roots, in every case order <= 2 can
// produce — a single real root (order 1); two distinct real roots; a repeated real root
// (`(C(1) + C(2) x) e^(rx)`); or a complex-conjugate pair (`e^(px)(C(1)cos(qx) +
// C(2)sin(qx))`).
//
// Nonhomogeneous part, by undetermined coefficients, ONE forcing shape at a time (not
// sums of different shapes — matches the brief's three families as alternatives):
// a polynomial in `x` (any degree), `A e^(cx)`, or `A sin(wx) + B cos(wx)` (`w > 0`).
// Each gets `x^s` times its own trial-function basis, `s` = how many times the
// forcing's own characteristic value (0, `c`, or `+/- wi`) already appears as a
// homogeneous root — the standard resonance bump. The trial's unknown coefficients are
// solved by evaluating the residual `L[trial] - forcing` at as many sample points as
// there are unknowns (falling back through a short candidate list when a point
// degenerates), each row read off by a unit-vector substitution — exact the whole way
// through since every coefficient involved is confirmed a real number literal.
//
// Every solution is checked before being returned: the FULL solution (homogeneous +
// particular, THEN initial conditions if given) is substituted back with `D`, and the
// residual must come back exactly `0` symbolically or measure below `1e-9` at several
// numeric points — declining (not guessing) if neither holds. See `verifySolution`.
//
// Declined: order > 2, a non-constant or non-numeric-literal coefficient (including a
// leading coefficient of 0), a nonlinear term (`y(x)^2`, `Sin(y(x))`, a product of `y`
// derivatives, ...), forcing that mixes shapes or isn't one of the three above, and
// initial conditions at anything but a plain real-number point.

const opAt = (expr: BoxedExpression, i: number): BoxedExpression => operandsOf(expr)[i];
const isSym = (x: BoxedExpression, name: string): boolean => symbolNameOf(x) === name;
const hasVar = (expr: BoxedExpression, name: string): boolean => expr.has(name);
const isRealLiteral = (expr: BoxedExpression): boolean => expr.im === 0 && Number.isFinite(expr.re);
const ZERO_EPS = 1e-9;

// ---- reading the equation: which order, whose coefficients, what forcing ------------

/** `0` for bare `y(x)`, `k` for `Apply(Derivative(y, k), x)` — the one derivative-of-y
 * shape this file recognizes. `undefined` otherwise (including `y` applied to anything
 * but the plain variable `x`). */
function derivativeOrderOf(term: BoxedExpression, yName: string, xName: string): number | undefined {
  if (term.operator === yName) {
    const ops = operandsOf(term);
    return ops.length === 1 && isSym(ops[0]!, xName) ? 0 : undefined;
  }
  if (term.operator === "Apply") {
    const head = opAt(term, 0);
    const arg = opAt(term, 1);
    if (head.operator === "Derivative" && symbolNameOf(opAt(head, 0)) === yName && isSym(arg, xName)) {
      const k = opAt(head, 1);
      return k.im === 0 && Number.isInteger(k.re) && k.re >= 0 ? k.re : undefined;
    }
  }
  return undefined;
}

/** Does `expr` mention `y` (applied to `x`, to a derivative, or to anything else)
 * anywhere in its tree? Used to separate the linear `y`-terms from the forcing, and to
 * catch a nonlinear mixture (`y(x)^2`, `Sin(y(x))`, ...) so it declines instead of
 * silently mis-filing it as forcing. */
function referencesY(expr: BoxedExpression, yName: string): boolean {
  if (expr.operator === yName) return true;
  if (expr.operator === "Derivative" && symbolNameOf(opAt(expr, 0)) === yName) return true;
  return operandsOf(expr).some((o) => referencesY(o, yName));
}

interface ODEShape {
  readonly order: number;
  /** Ascending: `coeffs[k]` is the coefficient of the order-`k` derivative. */
  readonly coeffs: readonly BoxedExpression[];
  readonly forcing: BoxedExpression;
}

/** `diff = LHS - RHS` (already `Subtract`'d and evaluated) classified into the linear
 * `y`-term coefficients and the `x`-only forcing — or `undefined`: a nonlinear term, a
 * `y`-coefficient that still contains `x`, or no `y`-term at all. */
function classifyODE(ce: ComputeEngine, diff: BoxedExpression, yName: string, xName: string): ODEShape | undefined {
  const terms = diff.operator === "Add" ? operandsOf(diff) : [diff];
  const coeffMap = new Map<number, BoxedExpression>();
  const forcingParts: BoxedExpression[] = [];
  for (const rawTerm of terms) {
    if (!referencesY(rawTerm, yName)) {
      forcingParts.push(rawTerm);
      continue;
    }
    let coeff: BoxedExpression = ce.One;
    let core = rawTerm;
    if (core.operator === "Negate") {
      coeff = ce.function("Negate", [coeff]).evaluate();
      core = opAt(core, 0);
    }
    if (core.operator === "Multiply") {
      const ops = operandsOf(core);
      const yOps = ops.filter((o) => referencesY(o, yName));
      const restOps = ops.filter((o) => !referencesY(o, yName));
      if (yOps.length !== 1 || restOps.some((o) => hasVar(o, xName))) return undefined;
      core = yOps[0]!;
      coeff = restOps.length === 0 ? coeff : ce.function("Multiply", [coeff, ...restOps]).evaluate();
    }
    const k = derivativeOrderOf(core, yName, xName);
    if (k === undefined) return undefined;
    const existing = coeffMap.get(k);
    coeffMap.set(k, existing === undefined ? coeff : ce.function("Add", [existing, coeff]).evaluate());
  }
  if (coeffMap.size === 0) return undefined;
  const order = Math.max(...coeffMap.keys());
  const coeffs: BoxedExpression[] = [];
  for (let i = 0; i <= order; i++) coeffs.push(coeffMap.get(i) ?? ce.Zero);
  if (coeffs.some((c) => hasVar(c, xName) || !isRealLiteral(c))) return undefined;
  if (coeffs[order]!.re === 0) return undefined; // a degenerate leading coefficient
  const forcing =
    forcingParts.length === 0
      ? ce.Zero
      : ce
          .function("Negate", [forcingParts.length === 1 ? forcingParts[0]! : ce.function("Add", forcingParts)])
          .evaluate();
  return { order, coeffs, forcing };
}

// ---- characteristic roots ------------------------------------------------------------

type Roots =
  | { readonly kind: "order1"; readonly r: BoxedExpression }
  | { readonly kind: "distinct"; readonly r1: BoxedExpression; readonly r2: BoxedExpression }
  | { readonly kind: "repeated"; readonly r: BoxedExpression }
  | { readonly kind: "complex"; readonly p: BoxedExpression; readonly q: BoxedExpression };

/** `a` is ascending, ALREADY normalized so `a[order] = 1`. */
function characteristicRoots(ce: ComputeEngine, a: readonly BoxedExpression[], order: number): Roots | undefined {
  if (order === 1) return { kind: "order1", r: ce.function("Negate", [a[0]!]).evaluate() };
  const [a0, a1] = a as [BoxedExpression, BoxedExpression];
  const disc = ce.function("Subtract", [ce.function("Power", [a1, 2]), ce.function("Multiply", [4, a0])]).evaluate();
  if (!isRealLiteral(disc)) return undefined;
  if (disc.re > 0) {
    const sq = ce.function("Sqrt", [disc]).evaluate();
    const r1 = ce.function("Divide", [ce.function("Add", [ce.function("Negate", [a1]), sq]), 2]).evaluate();
    const r2 = ce
      .function("Divide", [ce.function("Add", [ce.function("Negate", [a1]), ce.function("Negate", [sq])]), 2])
      .evaluate();
    return { kind: "distinct", r1, r2 };
  }
  if (disc.re === 0) {
    return { kind: "repeated", r: ce.function("Divide", [ce.function("Negate", [a1]), 2]).evaluate() };
  }
  const p = ce.function("Divide", [ce.function("Negate", [a1]), 2]).evaluate();
  const q = ce.function("Divide", [ce.function("Sqrt", [ce.function("Negate", [disc])]), 2]).evaluate();
  return { kind: "complex", p, q };
}

function buildHomogeneous(
  ce: ComputeEngine,
  roots: Roots,
  xSym: BoxedExpression,
  C1: BoxedExpression,
  C2: BoxedExpression | undefined,
): BoxedExpression {
  const expOf = (r: BoxedExpression) => ce.function("Exp", [ce.function("Multiply", [r, xSym])]);
  switch (roots.kind) {
    case "order1":
      return ce.function("Multiply", [C1, expOf(roots.r)]).evaluate();
    case "distinct":
      return ce
        .function("Add", [
          ce.function("Multiply", [C1, expOf(roots.r1)]),
          ce.function("Multiply", [C2!, expOf(roots.r2)]),
        ])
        .evaluate();
    case "repeated":
      return ce
        .function("Multiply", [ce.function("Add", [C1, ce.function("Multiply", [C2!, xSym])]), expOf(roots.r)])
        .evaluate();
    case "complex": {
      const cosT = ce.function("Cos", [ce.function("Multiply", [roots.q, xSym])]);
      const sinT = ce.function("Sin", [ce.function("Multiply", [roots.q, xSym])]);
      return ce
        .function("Multiply", [
          expOf(roots.p),
          ce.function("Add", [ce.function("Multiply", [C1, cosT]), ce.function("Multiply", [C2!, sinT])]),
        ])
        .evaluate();
    }
  }
}

/** Every real root this shape carries (for resonance-order counting): 1 value for
 * `order1`/`repeated` (doubled for `repeated`, matching its multiplicity), 2 for
 * `distinct`, none (real) for `complex`. */
function realRootMultiplicity(roots: Roots, target: BoxedExpression): number {
  const eq = (a: BoxedExpression) => a.re === target.re && a.im === target.im;
  switch (roots.kind) {
    case "order1":
      return eq(roots.r) ? 1 : 0;
    case "repeated":
      return eq(roots.r) ? 2 : 0;
    case "distinct":
      return (eq(roots.r1) ? 1 : 0) + (eq(roots.r2) ? 1 : 0);
    case "complex":
      return 0;
  }
}

/** Whether `+/- w*i` is exactly this shape's complex-conjugate pair. */
function isComplexPairRoot(roots: Roots, w: BoxedExpression): boolean {
  return roots.kind === "complex" && roots.p.re === 0 && roots.p.im === 0 && roots.q.re === w.re;
}

// ---- polynomial forcing --------------------------------------------------------------

/** Ascending real coefficients of a polynomial in `x` — `Add`/`Negate`/`Multiply`/an
 * integer `Power`/a constant `Divide`, same shape `function-properties.ts`'s `polyOf`
 * reads, but keeping each coefficient as an exact `BoxedExpression` rather than a
 * `number` (this file's coefficients feed straight back into exact CE arithmetic). */
function polyCoeffsBoxed(ce: ComputeEngine, expr: BoxedExpression, xName: string): BoxedExpression[] | undefined {
  if (!hasVar(expr, xName)) return isRealLiteral(expr) ? [expr] : undefined;
  if (isSym(expr, xName)) return [ce.Zero, ce.One];
  const op = expr.operator;
  const ops = operandsOf(expr);
  const addPoly = (a: readonly BoxedExpression[], b: readonly BoxedExpression[]): BoxedExpression[] => {
    const n = Math.max(a.length, b.length);
    const out: BoxedExpression[] = [];
    for (let i = 0; i < n; i++) out.push(ce.function("Add", [a[i] ?? ce.Zero, b[i] ?? ce.Zero]).evaluate());
    return out;
  };
  const mulPoly = (a: readonly BoxedExpression[], b: readonly BoxedExpression[]): BoxedExpression[] => {
    const out: BoxedExpression[] = Array.from({ length: a.length + b.length - 1 }, () => ce.Zero);
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        out[i + j] = ce.function("Add", [out[i + j]!, ce.function("Multiply", [a[i]!, b[j]!])]).evaluate();
      }
    }
    return out;
  };
  if (op === "Negate" && ops.length === 1) {
    const p = polyCoeffsBoxed(ce, ops[0]!, xName);
    return p?.map((c) => ce.function("Negate", [c]).evaluate());
  }
  if (op === "Add") {
    let acc: BoxedExpression[] = [ce.Zero];
    for (const o of ops) {
      const p = polyCoeffsBoxed(ce, o, xName);
      if (p === undefined) return undefined;
      acc = addPoly(acc, p);
    }
    return acc;
  }
  if (op === "Subtract" && ops.length === 2) {
    const a = polyCoeffsBoxed(ce, ops[0]!, xName);
    const b = polyCoeffsBoxed(ce, ops[1]!, xName);
    if (a === undefined || b === undefined) return undefined;
    return addPoly(
      a,
      b.map((c) => ce.function("Negate", [c]).evaluate()),
    );
  }
  if (op === "Multiply") {
    let acc: BoxedExpression[] = [ce.One];
    for (const o of ops) {
      const p = polyCoeffsBoxed(ce, o, xName);
      if (p === undefined) return undefined;
      acc = mulPoly(acc, p);
    }
    return acc;
  }
  if (op === "Power" && ops.length === 2) {
    const n = ops[1]!;
    if (!isRealLiteral(n) || !Number.isInteger(n.re) || n.re < 0 || n.re > 8) return undefined;
    const base = polyCoeffsBoxed(ce, ops[0]!, xName);
    if (base === undefined) return undefined;
    let acc: BoxedExpression[] = [ce.One];
    for (let i = 0; i < n.re; i++) acc = mulPoly(acc, base);
    return acc;
  }
  if (op === "Divide" && ops.length === 2) {
    if (hasVar(ops[1]!, xName)) return undefined;
    const num = polyCoeffsBoxed(ce, ops[0]!, xName);
    if (num === undefined) return undefined;
    return num.map((c) => ce.function("Divide", [c, ops[1]!]).evaluate());
  }
  return undefined;
}

// ---- exponential / sinusoidal forcing ------------------------------------------------

/** `a*x` (any sign; `Negate` folds through, same convention as this repo's other
 * transform tables) — bare `x` gives `a = 1`. */
function linearCoeffSigned(ce: ComputeEngine, expr: BoxedExpression, name: string): BoxedExpression | undefined {
  if (isSym(expr, name)) return ce.One;
  if (expr.operator === "Negate") {
    const inner = linearCoeffSigned(ce, opAt(expr, 0), name);
    return inner === undefined ? undefined : ce.function("Negate", [inner]).evaluate();
  }
  if (expr.operator === "Multiply") {
    const ops = operandsOf(expr);
    const xFactors = ops.filter((o) => isSym(o, name));
    const rest = ops.filter((o) => !isSym(o, name));
    if (xFactors.length !== 1 || rest.some((o) => hasVar(o, name))) return undefined;
    return rest.length === 1 ? rest[0] : ce.function("Multiply", rest).evaluate();
  }
  return undefined;
}

type Forcing =
  | { readonly kind: "zero" }
  | { readonly kind: "poly"; readonly coeffs: readonly BoxedExpression[] }
  | { readonly kind: "exp"; readonly amp: BoxedExpression; readonly c: BoxedExpression }
  | { readonly kind: "trig"; readonly a: BoxedExpression; readonly b: BoxedExpression; readonly w: BoxedExpression };

function classifyForcing(ce: ComputeEngine, forcing: BoxedExpression, xName: string): Forcing | undefined {
  if (forcing.re === 0 && forcing.im === 0) return { kind: "zero" };
  const poly = polyCoeffsBoxed(ce, forcing, xName);
  if (poly !== undefined) return { kind: "poly", coeffs: poly };

  const asExp = (term: BoxedExpression): { amp: BoxedExpression; c: BoxedExpression } | undefined => {
    const isE = (o: BoxedExpression) => symbolNameOf(o) === "ExponentialE";
    if (term.operator === "Power" && isE(opAt(term, 0))) {
      const c = linearCoeffSigned(ce, opAt(term, 1), xName);
      return c === undefined ? undefined : { amp: ce.One, c };
    }
    if (term.operator === "Multiply") {
      const ops = operandsOf(term);
      const expOps = ops.filter((o) => o.operator === "Power" && isE(opAt(o, 0)));
      const rest = ops.filter((o) => !(o.operator === "Power" && isE(opAt(o, 0))));
      if (expOps.length !== 1 || rest.some((o) => hasVar(o, xName))) return undefined;
      const c = linearCoeffSigned(ce, opAt(expOps[0]!, 1), xName);
      if (c === undefined) return undefined;
      const amp = rest.length === 0 ? ce.One : rest.length === 1 ? rest[0]! : ce.function("Multiply", rest).evaluate();
      return { amp, c };
    }
    return undefined;
  };
  const expMatch = asExp(forcing);
  if (expMatch !== undefined) return { kind: "exp", ...expMatch };

  const asTrigTerm = (
    term: BoxedExpression,
  ): { readonly fn: "Sin" | "Cos"; readonly coeff: BoxedExpression; readonly w: BoxedExpression } | undefined => {
    let coeff: BoxedExpression = ce.One;
    let core = term;
    if (core.operator === "Negate") {
      coeff = ce.function("Negate", [coeff]).evaluate();
      core = opAt(core, 0);
    }
    if (core.operator === "Multiply") {
      const ops = operandsOf(core);
      const trigOps = ops.filter((o) => o.operator === "Sin" || o.operator === "Cos");
      const rest = ops.filter((o) => !(o.operator === "Sin" || o.operator === "Cos"));
      if (trigOps.length !== 1 || rest.some((o) => hasVar(o, xName))) return undefined;
      core = trigOps[0]!;
      coeff = rest.length === 0 ? coeff : ce.function("Multiply", [coeff, ...rest]).evaluate();
    }
    if (core.operator !== "Sin" && core.operator !== "Cos") return undefined;
    const w = linearCoeffSigned(ce, opAt(core, 0), xName);
    if (w === undefined || w.isPositive !== true) return undefined;
    return { fn: core.operator, coeff, w };
  };
  const trigTerms = forcing.operator === "Add" ? operandsOf(forcing) : [forcing];
  if (trigTerms.length <= 2) {
    const parsed = trigTerms.map(asTrigTerm);
    if (parsed.every((p) => p !== undefined) && parsed.length > 0) {
      const ps = parsed as Array<NonNullable<(typeof parsed)[number]>>;
      const wVals = new Set(ps.map((p) => p.w.re));
      if (wVals.size === 1 && new Set(ps.map((p) => p.fn)).size === ps.length) {
        const sinTerm = ps.find((p) => p.fn === "Sin");
        const cosTerm = ps.find((p) => p.fn === "Cos");
        return {
          kind: "trig",
          a: sinTerm?.coeff ?? ce.Zero,
          b: cosTerm?.coeff ?? ce.Zero,
          w: ps[0]!.w,
        };
      }
    }
  }
  return undefined;
}

// ---- solving for the trial's unknown coefficients ------------------------------------

/** Solve the `n x n` system `M . c = rhs` by Cramer's rule (`n <= 3`, exact CE
 * arithmetic throughout) — `undefined` if `M` is singular or `n > 3`. */
function solveLinear(ce: ComputeEngine, M: BoxedExpression[][], rhs: BoxedExpression[]): BoxedExpression[] | undefined {
  const n = M.length;
  if (n === 0 || n > 3) return undefined;
  const det = (m: BoxedExpression[][]): BoxedExpression => {
    if (m.length === 1) return m[0]![0]!;
    if (m.length === 2) {
      return ce
        .function("Subtract", [
          ce.function("Multiply", [m[0]![0]!, m[1]![1]!]),
          ce.function("Multiply", [m[0]![1]!, m[1]![0]!]),
        ])
        .evaluate();
    }
    // 3x3, cofactor expansion along the first row.
    let sum: BoxedExpression = ce.Zero;
    for (let j = 0; j < 3; j++) {
      const minor: BoxedExpression[][] = [0, 1, 2]
        .filter((i) => i !== 0)
        .map((i) => [0, 1, 2].filter((k) => k !== j).map((k) => m[i]![k]!));
      const cofactor = ce
        .function("Multiply", [j % 2 === 0 ? ce.One : ce.NegativeOne, m[0]![j]!, det(minor)])
        .evaluate();
      sum = ce.function("Add", [sum, cofactor]).evaluate();
    }
    return sum;
  };
  const d = det(M);
  if (!isRealLiteral(d) || d.re === 0) return undefined;
  const out: BoxedExpression[] = [];
  for (let col = 0; col < n; col++) {
    const Mi = M.map((row, i) => row.map((v, j) => (j === col ? rhs[i]! : v)));
    out.push(ce.function("Divide", [det(Mi), d]).evaluate());
  }
  return out;
}

/** The candidate `x`-substitutions to try when reading a linear coefficient off a
 * residual — enough to almost always avoid an accidental zero row (an exact
 * resonance-degeneracy check would need to reason about the trial's own structure;
 * trying several small values and taking the first non-singular set is simpler and
 * just as safe, since `solveLinear` itself refuses a singular matrix). */
function candidatePoints(ce: ComputeEngine, w: BoxedExpression | undefined): BoxedExpression[] {
  const base = [ce.Zero, ce.One, ce.number(2), ce.number(-1), ce.number(3)];
  if (w === undefined) return base;
  const quarterPeriod = ce.function("Divide", [ce.Pi, ce.function("Multiply", [2, w])]).evaluate();
  return [ce.Zero, quarterPeriod, ...base];
}

/** `L[f](x) = sum_k a[k] * f^(k)(x)` — computed via repeated symbolic `D`, matching the
 * ODE's own linear operator. */
function applyOperator(
  ce: ComputeEngine,
  f: BoxedExpression,
  xSym: BoxedExpression,
  a: readonly BoxedExpression[],
): BoxedExpression {
  let deriv = f;
  const terms: BoxedExpression[] = [ce.function("Multiply", [a[0]!, f])];
  for (let k = 1; k < a.length; k++) {
    deriv = ce.function("D", [deriv, xSym]).evaluate();
    terms.push(ce.function("Multiply", [a[k]!, deriv]));
  }
  return ce.function("Add", terms).evaluate();
}

/** Solve `trial = x^s * sum_k c_k basis_k(x)` for the `c_k` so that `L[trial] =
 * forcing`, by sampling the (linear-in-`c_k`) residual at `basis.length` points. */
function solveUndetermined(
  ce: ComputeEngine,
  basis: readonly BoxedExpression[],
  s: number,
  forcing: BoxedExpression,
  a: readonly BoxedExpression[],
  xSym: BoxedExpression,
  w: BoxedExpression | undefined,
): BoxedExpression | undefined {
  const n = basis.length;
  const cs = basis.map((_, i) => ce.symbol(`_dsolveC${i}`));
  const xPowS = s === 0 ? ce.One : ce.function("Power", [xSym, s]);
  const trial = ce
    .function("Multiply", [
      xPowS,
      ce.function(
        "Add",
        cs.map((c, i) => ce.function("Multiply", [c, basis[i]!])),
      ),
    ])
    .evaluate();
  const residual = ce.function("Subtract", [applyOperator(ce, trial, xSym, a), forcing]).evaluate();
  const xName = symbolNameOf(xSym)!;
  // Build an n x n system from n of the candidate sample points (a sliding window over
  // the candidate list, since a single point can degenerate — e.g. x=0 under an x^s
  // trial can zero out a row — but `solveLinear` itself is what actually rejects a
  // singular window, this just tries a few until one works).
  const points = candidatePoints(ce, w);
  for (let start = 0; start + n <= points.length; start++) {
    const pts = points.slice(start, start + n);
    const M: BoxedExpression[][] = [];
    const rhs: BoxedExpression[] = [];
    let ok = true;
    for (const pt of pts) {
      const constantRow = residual
        .subs({ [xName]: pt, ...Object.fromEntries(cs.map((c) => [symbolNameOf(c)!, 0])) })
        .evaluate();
      if (!isRealLiteral(constantRow)) {
        ok = false;
        break;
      }
      const row: BoxedExpression[] = [];
      for (let i = 0; i < n; i++) {
        const unit = Object.fromEntries(cs.map((c, j) => [symbolNameOf(c)!, i === j ? 1 : 0]));
        const withOne = residual.subs({ [xName]: pt, ...unit }).evaluate();
        const coeff = ce.function("Subtract", [withOne, constantRow]).evaluate();
        if (!isRealLiteral(coeff)) {
          ok = false;
          break;
        }
        row.push(coeff);
      }
      if (!ok) break;
      M.push(row);
      rhs.push(ce.function("Negate", [constantRow]).evaluate());
    }
    if (!ok) continue;
    const solved = solveLinear(ce, M, rhs);
    if (solved === undefined) continue;
    return trial.subs(Object.fromEntries(cs.map((c, i) => [symbolNameOf(c)!, solved[i]!]))).evaluate();
  }
  return undefined;
}

function solveParticular(
  ce: ComputeEngine,
  forcing: Forcing,
  roots: Roots,
  a: readonly BoxedExpression[],
  xSym: BoxedExpression,
): BoxedExpression | undefined {
  switch (forcing.kind) {
    case "zero":
      return ce.Zero;
    case "poly": {
      const d = forcing.coeffs.length - 1;
      const s = realRootMultiplicity(roots, ce.Zero);
      const basis = Array.from({ length: d + 1 }, (_, i) => ce.function("Power", [xSym, d - i]).evaluate());
      const forcingExpr = ce
        .function(
          "Add",
          forcing.coeffs.map((c, i) => ce.function("Multiply", [c, ce.function("Power", [xSym, i])])),
        )
        .evaluate();
      return solveUndetermined(ce, basis, s, forcingExpr, a, xSym, undefined);
    }
    case "exp": {
      const s = realRootMultiplicity(roots, forcing.c);
      const basis = [ce.function("Exp", [ce.function("Multiply", [forcing.c, xSym])]).evaluate()];
      const forcingExpr = ce.function("Multiply", [forcing.amp, basis[0]!]).evaluate();
      return solveUndetermined(ce, basis, s, forcingExpr, a, xSym, undefined);
    }
    case "trig": {
      const s = isComplexPairRoot(roots, forcing.w) ? 1 : 0;
      const cosT = ce.function("Cos", [ce.function("Multiply", [forcing.w, xSym])]).evaluate();
      const sinT = ce.function("Sin", [ce.function("Multiply", [forcing.w, xSym])]).evaluate();
      const basis = [cosT, sinT];
      const forcingExpr = ce
        .function("Add", [ce.function("Multiply", [forcing.a, sinT]), ce.function("Multiply", [forcing.b, cosT])])
        .evaluate();
      return solveUndetermined(ce, basis, s, forcingExpr, a, xSym, forcing.w);
    }
  }
}

// ---- initial conditions --------------------------------------------------------------

/** `y(p) == v` or `Apply(Derivative(y, k), p) == v`, `p` a real-number literal. */
function parseIC(
  ic: BoxedExpression,
  yName: string,
): { readonly k: number; readonly point: BoxedExpression; readonly value: BoxedExpression } | undefined {
  if (ic.operator !== "Equal") return undefined;
  const lhs = opAt(ic, 0);
  const value = opAt(ic, 1);
  if (lhs.operator === yName) {
    const ops = operandsOf(lhs);
    if (ops.length !== 1 || !isRealLiteral(ops[0]!)) return undefined;
    return { k: 0, point: ops[0]!, value };
  }
  if (lhs.operator === "Apply") {
    const head = opAt(lhs, 0);
    const point = opAt(lhs, 1);
    if (head.operator === "Derivative" && symbolNameOf(opAt(head, 0)) === yName && isRealLiteral(point)) {
      const k = opAt(head, 1);
      if (k.im === 0 && Number.isInteger(k.re) && k.re >= 0) return { k: k.re, point, value };
    }
  }
  return undefined;
}

function applyInitialConditions(
  ce: ComputeEngine,
  y: BoxedExpression,
  Cs: readonly BoxedExpression[],
  ics: readonly BoxedExpression[],
  yName: string,
  xSym: BoxedExpression,
): BoxedExpression | undefined {
  if (ics.length !== Cs.length) return undefined;
  const parsed = ics.map((ic) => parseIC(ic, yName));
  if (parsed.some((p) => p === undefined)) return undefined;
  const xName = symbolNameOf(xSym)!;
  const derivs: BoxedExpression[] = [y];
  const maxK = Math.max(...(parsed as Array<NonNullable<(typeof parsed)[number]>>).map((p) => p.k));
  for (let k = 1; k <= maxK; k++) derivs.push(ce.function("D", [derivs[k - 1]!, xSym]).evaluate());
  const cNames = Cs.map((c) => symbolNameOf(c)!);
  const M: BoxedExpression[][] = [];
  const rhs: BoxedExpression[] = [];
  for (const p of parsed as Array<NonNullable<(typeof parsed)[number]>>) {
    const atPoint = derivs[p.k]!.subs({ [xName]: p.point });
    const constant = atPoint.subs(Object.fromEntries(cNames.map((n) => [n, 0]))).evaluate();
    if (!isRealLiteral(constant)) return undefined;
    const row: BoxedExpression[] = [];
    for (let i = 0; i < cNames.length; i++) {
      const unit = Object.fromEntries(cNames.map((n, j) => [n, i === j ? 1 : 0]));
      const withOne = atPoint.subs(unit).evaluate();
      const coeff = ce.function("Subtract", [withOne, constant]).evaluate();
      if (!isRealLiteral(coeff)) return undefined;
      row.push(coeff);
    }
    M.push(row);
    rhs.push(ce.function("Subtract", [p.value, constant]).evaluate());
  }
  const solved = solveLinear(ce, M, rhs);
  if (solved === undefined) return undefined;
  return y.subs(Object.fromEntries(cNames.map((n, i) => [n, solved[i]!]))).evaluate();
}

// ---- verification ---------------------------------------------------------------------

/** `y`, substituted back through `L[y] - forcing`: exactly `0` symbolically, or every
 * sample point's numeric residual under `1e-9` — `false` declines the whole solve. */
function verifySolution(
  ce: ComputeEngine,
  y: BoxedExpression,
  a: readonly BoxedExpression[],
  forcing: BoxedExpression,
  xSym: BoxedExpression,
): boolean {
  const residual = ce.function("Subtract", [applyOperator(ce, y, xSym, a), forcing]).evaluate();
  if (residual.re === 0 && residual.im === 0) return true;
  const xName = symbolNameOf(xSym)!;
  const samples = [0.37, 1.91, -0.53, 2.7];
  return samples.every((v) => {
    const n = residual.subs({ [xName]: v }).N();
    const mag = Math.hypot(n.re ?? NaN, n.im ?? 0);
    return Number.isFinite(mag) && mag < ZERO_EPS;
  });
}

// ---- entry point ------------------------------------------------------------------------

function solveODE(
  ce: ComputeEngine,
  eqn: BoxedExpression,
  ics: readonly BoxedExpression[],
  yName: string,
  xName: string,
): BoxedExpression | undefined {
  if (eqn.operator !== "Equal") return undefined;
  const diff = ce.function("Subtract", [opAt(eqn, 0), opAt(eqn, 1)]).evaluate();
  const shape = classifyODE(ce, diff, yName, xName);
  if (shape === undefined || (shape.order !== 1 && shape.order !== 2)) return undefined;
  const lead = shape.coeffs[shape.order]!;
  const a = shape.coeffs.map((c) => ce.function("Divide", [c, lead]).evaluate());
  const forcing = ce.function("Divide", [shape.forcing, lead]).evaluate();
  const roots = characteristicRoots(ce, a, shape.order);
  if (roots === undefined) return undefined;
  const xSym = ce.symbol(xName);
  // Bare placeholder symbols stand in for the arbitrary constants throughout the algebra
  // below (`.subs()` substitutes a symbol BY NAME, and `C(1)` is a compound expression,
  // not a symbol, so it can't be a `.subs()` target itself) — renamed to `C(1)`/`C(2)`
  // only in the final, no-initial-conditions output; with initial conditions given,
  // `applyInitialConditions` solves for their actual values directly instead.
  const C1 = ce.symbol("_dsolveConst1");
  const C2 = shape.order === 2 ? ce.symbol("_dsolveConst2") : undefined;
  const yh = buildHomogeneous(ce, roots, xSym, C1, C2);
  const forcingShape = classifyForcing(ce, forcing, xName);
  if (forcingShape === undefined) return undefined;
  const yp = solveParticular(ce, forcingShape, roots, a, xSym);
  if (yp === undefined) return undefined;
  let y = ce.function("Add", [yh, yp]).evaluate();
  if (!verifySolution(ce, y, a, forcing, xSym)) return undefined;
  if (ics.length > 0) {
    const Cs = C2 === undefined ? [C1] : [C1, C2];
    const solved = applyInitialConditions(ce, y, Cs, ics, yName, xSym);
    if (solved === undefined) return undefined;
    y = solved;
    if (!verifySolution(ce, y, a, forcing, xSym)) return undefined;
    return y;
  }
  const rename: Record<string, BoxedExpression> = { _dsolveConst1: ce.function("C", [1]) };
  if (C2 !== undefined) rename._dsolveConst2 = ce.function("C", [2]);
  return y.subs(rename).evaluate();
}

export function declareDSolveValue(ce: ComputeEngine): void {
  ce.declare("DSolveValue", {
    signature: "(any, any, symbol) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [spec, yApplied, xExpr] = ops;
      if (spec === undefined || yApplied === undefined || xExpr === undefined || ops.length !== 3) return undefined;
      const xName = symbolNameOf(xExpr);
      if (xName === undefined) return undefined;
      const yName = yApplied.operator;
      const yOps = operandsOf(yApplied);
      if (yName === undefined || yOps.length !== 1 || !isSym(yOps[0]!, xName)) return undefined;
      let eqn: BoxedExpression;
      let ics: readonly BoxedExpression[];
      if (spec.operator === "List") {
        const parts = operandsOf(spec);
        if (parts.length === 0) return undefined;
        eqn = parts[0]!;
        ics = parts.slice(1);
      } else {
        eqn = spec;
        ics = [];
      }
      return solveODE(ce, eqn, ics, yName, xName);
    },
  });
}
