import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  bigIntegerAt,
  bigRationalAt,
  operandsOf,
  symbolNameOf,
  wrapOperator,
} from "@enumeratio/boxed";
import { declined, type EvalOptions } from "./box.ts";
import { characterExponent } from "./dirichlet-l.ts";
import { gammaExactValue, type Rational } from "./widened.ts";

/** A wrapper's arity key doesn't filter calls; widened heads reach it with other arities. */
const exactly =
  (n: number, p: (ops: readonly BoxedExpression[]) => boolean) =>
  (ops: readonly BoxedExpression[]): boolean =>
    ops.length === n && p(ops);

/**
 * Every wrapper below is a pre-check ahead of an existing numeric kernel, and several
 * of those kernels reach the exact same operator recursively while computing their OWN
 * numeric answer (e.g. a 3-argument Gamma call evaluating two 2-argument calls, or
 * HarmonicNumber's continuation calling PolyGamma). If a wrapper always hands back an
 * exact symbolic expression, one of those recursive numeric calls gets a symbol instead
 * of the plain number it expects, and the caller's own `.re` turns into NaN. Respecting
 * `options.numericApproximation` here is what keeps every such nested call intact.
 */
const finish = (expr: BoxedExpression, options: EvalOptions): BoxedExpression =>
  options.numericApproximation ? expr.N() : expr.evaluate();

// #113 exact closed forms: heads that already evaluate numerically but leave an
// exact argument symbolic, where Wolfram's `FunctionExpand` (or, for a couple of
// these, its bare kernel) gives a closed form. Every identity here was checked
// against `wolframscript` before being wired up (see the lane's final report for
// the transcript); each wrapper is a pre-check in front of the existing numeric
// kernel, which still answers N() and every case the closed form doesn't cover.

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
const gcdNum = (a: number, b: number): number => (b === 0 ? a : gcdNum(b, a % b));

/** n! for a small non-negative bigint n. */
const factorial = (n: bigint): bigint => {
  let r = 1n;
  for (let k = 2n; k <= n; k++) r *= k;
  return r;
};

/** A bigint as a boxed exact integer — `ce.number` takes a bigint directly, at any magnitude. */
const intNode = (ce: ComputeEngine, v: bigint): BoxedExpression => ce.number(v);

/** An exact [numerator, denominator] bigint pair as a boxed rational (or integer, at d = 1). */
const ratNode = (ce: ComputeEngine, [n, d]: Rational): BoxedExpression =>
  d === 1n ? ce.number(n) : ce.number([n, d]);

export function declareClosedForms113(ce: ComputeEngine): void {
  // GammaLn(n) = ln((n−1)!) at a positive integer n, matching Wolfram's bare
  // LogGamma[5] = Log[24] (wolframscript-checked) — GammaLn's own signature is the
  // principal log, no branch ambiguity for a positive real. Threading (broadcastable,
  // set in threading-113.ts) calls this same scalar handler once per list element, so
  // GammaLn({1,2,3}) closes for free alongside the bare-integer call.
  wrapOperator(
    ce,
    ["GammaLn", 1],
    exactly(1, (ops) => {
      const n = bigIntegerAt(ops[0]);
      return n !== undefined && n >= 1n;
    }),
    () => (ops, options) => {
      const n = bigIntegerAt(ops[0])!;
      return finish(ce.function("Ln", [ce.function("Factorial", [intNode(ce, n - 1n)])]), options);
    },
  );

  // ζ(s, ½) = (2ˢ − 1)ζ(s), true for every s (split the Dirichlet series into even
  // and odd n); gated on a concrete numeric s so the separate symbolic-s identity
  // (a different lane's item) is untouched. ζ(2, ¼) = π² + 8G has no such general
  // form in ¼ (the Catalan constant is special to s = 2), so that one is pinned
  // to s = 2 exactly.
  wrapOperator(
    ce,
    ["HurwitzZeta", 2],
    exactly(2, (ops) => {
      const a = bigRationalAt(ops[1]);
      return (
        ops[0] !== undefined &&
        (ops[0] as { symbol?: unknown }).symbol === undefined &&
        a !== undefined &&
        a[0] === 1n &&
        a[1] === 2n
      );
    }),
    () => (ops, options) => {
      const s = ops[0];
      return finish(
        ce.function("Multiply", [
          ce.function("Subtract", [ce.function("Power", [2, s]), 1]),
          ce.function("Zeta", [s]),
        ]),
        options,
      );
    },
  );
  wrapOperator(
    ce,
    ["HurwitzZeta", 2],
    exactly(2, (ops) => {
      const a = bigRationalAt(ops[1]);
      return bigIntegerAt(ops[0]) === 2n && a !== undefined && a[0] === 1n && a[1] === 4n;
    }),
    () => (_ops, options) =>
      finish(
        ce.function("Add", [
          ce.function("Power", ["Pi", 2]),
          ce.function("Multiply", [8, "Catalan"]),
        ]),
        options,
      ),
  );

  // Li₃(½) = (7/8)ζ(3) − (π²ln2)/12 + (ln³2)/6 and Li₂(2) = π²/4 − iπln2 — both
  // standard dilogarithm/trilogarithm special values (FunctionExpand[PolyLog[3,1/2]]
  // and N[PolyLog[2,2]] agree, wolframscript-checked); Wolfram's bare kernel leaves
  // both unevaluated, same as every other exact-argument closed form in this file.
  wrapOperator(
    ce,
    ["PolyLog", 2],
    exactly(
      2,
      (ops) =>
        bigIntegerAt(ops[0]) === 3n &&
        bigRationalAt(ops[1])?.[0] === 1n &&
        bigRationalAt(ops[1])?.[1] === 2n,
    ),
    () => (_ops, options) =>
      finish(
        ce.function("Add", [
          ce.function("Multiply", [ce.function("Rational", [7, 8]), ce.function("Zeta", [3])]),
          ce.function("Negate", [
            ce.function("Multiply", [
              ce.function("Rational", [1, 12]),
              ce.function("Power", ["Pi", 2]),
              ce.function("Ln", [2]),
            ]),
          ]),
          ce.function("Multiply", [
            ce.function("Rational", [1, 6]),
            ce.function("Power", [ce.function("Ln", [2]), 3]),
          ]),
        ]),
        options,
      ),
  );
  wrapOperator(
    ce,
    ["PolyLog", 2],
    exactly(2, (ops) => bigIntegerAt(ops[0]) === 2n && bigIntegerAt(ops[1]) === 2n),
    () => (_ops, options) =>
      finish(
        ce.function("Subtract", [
          ce.function("Multiply", [
            ce.function("Rational", [1, 4]),
            ce.function("Power", ["Pi", 2]),
          ]),
          ce.function("Multiply", ["ImaginaryUnit", "Pi", ce.function("Ln", [2])]),
        ]),
        options,
      ),
  );

  // Gauss's digamma theorem at the two required denominators. ψ(1/4) and ψ(1/3) are
  // this lane's items; ψ(3/4) and ψ(2/3) come along for free from the same reflection
  // formula ψ(1−x) = ψ(x) + π·cot(πx), and closing the pair rather than only the odd
  // half avoids leaving an inconsistent asymmetric gap in the same head.
  wrapOperator(
    ce,
    ["Digamma", 1],
    exactly(1, (ops) => {
      const q = bigRationalAt(ops[0]);
      return q !== undefined && (q[1] === 3n || q[1] === 4n) && q[0] > 0n && q[0] < q[1];
    }),
    () => (ops, options) => {
      const [p, q] = bigRationalAt(ops[0])!;
      const ln = (n: number) => ce.function("Ln", [n]);
      const base =
        q === 4n
          ? ce.function("Add", [
              ce.function("Negate", ["EulerGamma"]),
              ce.function("Multiply", [-3, ln(2)]),
            ])
          : ce.function("Add", [
              ce.function("Negate", ["EulerGamma"]),
              ce.function("Multiply", [ce.function("Rational", [-3, 2]), ln(3)]),
            ]);
      const cotTerm =
        q === 4n
          ? ce.function("Multiply", [ce.function("Rational", [1, 2]), "Pi"])
          : ce.function("Divide", ["Pi", ce.function("Multiply", [2, ce.function("Sqrt", [3])])]);
      // p = 1 is the "before the reflection point" branch (−cot term); the other
      // valid numerator for these two denominators (p = 3 for q = 4, p = 2 for q = 3)
      // is its reflection (+cot term).
      const sign = p === 1n ? -1 : 1;
      return finish(ce.function("Add", [base, ce.function("Multiply", [sign, cotTerm])]), options);
    },
  );

  // ψ'(1/4) = π² + 8G and ψ'(3/4) = π² − 8G (Catalan's constant G), from the trigamma
  // reflection ψ'(x) + ψ'(1−x) = π²/sin²(πx) = 2π² at x = 1/4, combined with the
  // known ψ'(1/4) − ψ'(3/4) = 8G. Only this lane's denominator; every other
  // PolyGamma(1, ·) case is left to the numeric kernel or another lane.
  wrapOperator(
    ce,
    ["PolyGamma", 2],
    exactly(2, (ops) => {
      const q = bigRationalAt(ops[1]);
      return (
        bigIntegerAt(ops[0]) === 1n &&
        q !== undefined &&
        q[1] === 4n &&
        (q[0] === 1n || q[0] === 3n)
      );
    }),
    () => (ops, options) => {
      const [p] = bigRationalAt(ops[1])!;
      const sign = p === 1n ? 1 : -1;
      return finish(
        ce.function("Add", [
          ce.function("Power", ["Pi", 2]),
          ce.function("Multiply", [sign * 8, "Catalan"]),
        ]),
        options,
      );
    },
  );

  // PolyGamma(0, z) IS Digamma(z) — the same function under compute-engine's own
  // two-head split (wolframscript: PolyGamma[1/4] itself prints as PolyGamma[0, 1/4],
  // confirming Wolfram treats them as one). Digamma carries the positive-integer exact
  // reduction (widened.ts) and now the two Gauss cases above; routing PolyGamma's
  // order-0 case through it means StieltjesGamma(0, a) = −PolyGamma(0, a) — which
  // compute-engine's own native handler already produces symbolically — collapses the
  // rest of the way for any a where Digamma itself has an exact value, closing
  // StieltjesGamma(0, 1) = γ without touching stieltjes.ts or special-functions.ts.
  //
  // Digamma's OWN native scope is narrower than PolyGamma(0, ·)'s, though (no complex
  // support, in particular) — regression-caught: routing unconditionally broke
  // PolyGamma(0, Complex(1,1)) and, transitively, HarmonicNumber's continuation formula,
  // which calls PolyGamma(0, ·) internally at a complex argument. `declined` gates this
  // to cases Digamma actually improves on and falls back to PolyGamma's own native
  // handler (not just `undefined`) for everything else, so no existing capability is lost.
  wrapOperator(
    ce,
    ["PolyGamma", 2],
    exactly(2, (ops) => bigIntegerAt(ops[0]) === 0n),
    (native) => (ops, options) => {
      const reduced = ce.function("Digamma", [ops[1]]).evaluate();
      if (declined(reduced, "Digamma")) return native?.(ops, options);
      return finish(reduced, options);
    },
  );

  // γₙ(1) = γₙ (Wolfram: StieltjesGamma[3,1] prints as StieltjesGamma[3]) — the
  // two-argument form at a = 1 is just the classical constant.
  wrapOperator(
    ce,
    ["StieltjesGamma", 2],
    exactly(2, (ops) => bigIntegerAt(ops[1]) === 1n),
    () => (ops, options) => finish(ce.function("StieltjesGamma", [ops[0]]), options),
  );

  // I_x(a, b) = Σ_{j=a}^{a+b−1} C(a+b−1, j) xʲ(1−x)^{a+b−1−j} at a rational x and
  // positive integer a, b — the standard finite closed form for the regularized
  // incomplete beta function (wolframscript-checked at (1/2, 2, 3) = 11/16).
  wrapOperator(
    ce,
    ["BetaRegularized", 3],
    exactly(3, (ops) => {
      const x = bigRationalAt(ops[0]);
      const a = bigIntegerAt(ops[1]);
      const b = bigIntegerAt(ops[2]);
      return (
        x !== undefined &&
        x[0] > 0n &&
        x[0] < x[1] &&
        a !== undefined &&
        a >= 1n &&
        a <= 200n &&
        b !== undefined &&
        b >= 1n &&
        b <= 200n
      );
    }),
    () => (ops, options) => {
      const [p, q] = bigRationalAt(ops[0])!;
      const a = bigIntegerAt(ops[1])!;
      const b = bigIntegerAt(ops[2])!;
      const n = a + b - 1n;
      // C(n, j), built incrementally rather than via two factorials of n.
      let binom = 1n;
      for (let i = 0n; i < a; i++) binom = (binom * (n - i)) / (i + 1n);
      let numSum = 0n;
      const denom = q ** n;
      const qp = q - p; // q·(1 − x)'s numerator, since 1 − p/q = (q − p)/q
      for (let j = a; j <= n; j++) {
        numSum += binom * p ** j * qp ** (n - j);
        binom = (binom * (n - j)) / (j + 1n); // C(n, j+1) from C(n, j)
      }
      const g = gcd(numSum, denom) || 1n;
      return finish(ratNode(ce, [numSum / g, denom / g]), options);
    },
  );

  // Γ(n, x) = (n−1)! e⁻ˣ Σ_{k<n} xᵏ/k! and its regularized form Q(n, x) = e⁻ˣ Σ_{k<n} xᵏ/k!,
  // for a positive integer order n — the standard finite closed form (FunctionExpand
  // in Wolfram; the bare kernel also leaves Gamma[2, x] unevaluated, wolframscript-checked).
  // Two arguments only: the three-argument case (z₀, z₁ both given) is a different
  // lane's item. `x` can be any expression, exact or symbolic — the sum is finite
  // regardless, which is also what makes each entry of the matrix example reduce.
  for (const [head, regularized] of [
    ["Gamma", false],
    ["GammaRegularized", true],
  ] as const) {
    wrapOperator(
      ce,
      [head, 2],
      (ops) => {
        if (ops.length !== 2) return false;
        const n = bigIntegerAt(ops[0]);
        return n !== undefined && n >= 1n && n <= 64n;
      },
      () => (ops, options) => {
        const n = bigIntegerAt(ops[0])!;
        const x = ops[1];
        const terms: BoxedExpression[] = [];
        for (let k = 0n; k < n; k++) {
          // k = 0's term is exactly 1 by definition of the sum -- built directly rather
          // than through Power(x, 0), which compute-engine leaves symbolic (and, at x = 0
          // itself, treats as indeterminate) since it won't assert x^0 = 1 without knowing
          // x ≠ 0. Every other term evaluates on its own for the same reason Add doesn't
          // re-simplify an already-built Power node once it's inside the sum.
          const xk =
            k === 0n ? intNode(ce, 1n) : ce.function("Power", [x, intNode(ce, k)]).evaluate();
          terms.push(ce.function("Divide", [xk, intNode(ce, factorial(k))]).evaluate());
        }
        const sum = ce.function("Add", terms);
        const scaled = regularized
          ? sum
          : ce.function("Multiply", [intNode(ce, factorial(n - 1n)), sum]);
        // This same 2-argument operator is what a 3-argument Gamma(s, z0, z1) call
        // reduces to internally (Γ(s,z0) − Γ(s,z1)), often under N() -- `finish` is what
        // keeps that recursive call a plain number instead of a stuck exact expression.
        return finish(
          ce.function("Multiply", [
            scaled,
            ce.function("Power", ["ExponentialE", ce.function("Negate", [x])]),
          ]),
          options,
        );
      },
    );
  }

  // LogGamma at an exact half-integer, reusing the same Γ(x) closed form as Gamma's
  // half-integer reduction (widened.ts's `gammaExactValue`). Positive half-integers
  // have Γ > 0 so the principal log is just Ln(Γ(x)); a negative one accumulates
  // −iπ once for each pole the continuation passes crossing down to it (ceil(−x) of
  // them for x = p/2, p < 0 odd) — wolframscript-checked at ±3/2, and the same
  // formula reproduces mpmath's loggamma(−1/2) = ln(2√π) − iπ as a sanity check.
  wrapOperator(
    ce,
    ["LogGamma", 1],
    exactly(1, (ops) => bigRationalAt(ops[0])?.[1] === 2n),
    () => (ops, options) => {
      const q = bigRationalAt(ops[0])!;
      const g = gammaExactValue(ce, q);
      if (g === undefined) return undefined;
      if (q[0] > 0n) return finish(ce.function("Ln", [g]), options);
      const k = (-q[0] + 1n) / 2n; // ceil(−x) for x = p/2, p negative odd
      return finish(
        ce.function("Subtract", [
          ce.function("Ln", [ce.function("Abs", [g])]),
          ce.function("Multiply", [intNode(ce, k), "ImaginaryUnit", "Pi"]),
        ]),
        options,
      );
    },
  );

  // H_{1/2} = 2 − 2ln2 and H_{1/4} = 4 − π/2 − 3ln2, from H_z = ψ(z+1) + γ combined
  // with ψ(3/2) = 2 − γ − 2ln2 and ψ(5/4) = 4 − γ − π/2 − 3ln2 (both plain
  // consequences of ψ(z+1) = ψ(z) + 1/z at the two exact digamma values already
  // known — wolframscript's bare kernel leaves HarmonicNumber(1/2) itself
  // unevaluated, so this is the eager-reduction pattern used throughout this file,
  // not a Wolfram bare-kernel match).
  wrapOperator(
    ce,
    ["HarmonicNumber", 1],
    exactly(1, (ops) => {
      const q = bigRationalAt(ops[0]);
      return q !== undefined && q[0] === 1n && (q[1] === 2n || q[1] === 4n);
    }),
    () => (ops, options) => {
      const q = bigRationalAt(ops[0])!;
      const ln2 = ce.function("Ln", [2]);
      if (q[1] === 2n)
        return finish(ce.function("Subtract", [2, ce.function("Multiply", [2, ln2])]), options);
      return finish(
        ce.function("Subtract", [
          ce.function("Subtract", [4, ce.function("Divide", ["Pi", 2])]),
          ce.function("Multiply", [3, ln2]),
        ]),
        options,
      );
    },
  );

  // FromContinuedFraction of plain symbols: [a; b, c] = a + 1/(b + 1/c), the nested
  // fraction left UNCOMBINED (Wolfram's own FromContinuedFraction[{a,b,c}] instead
  // returns the single combined ratio, wolframscript-checked — the reference's
  // expected value is the unsimplified nested form, matching what a reader would
  // write down term by term). Only a flat list of integers/symbols with at least one
  // symbol qualifies — a periodic tail is a nested List, a different (backlog) head's
  // item, and is left alone.
  wrapOperator(
    ce,
    ["FromContinuedFraction", 1],
    exactly(1, (ops) => {
      const list = ops[0];
      if (list?.operator !== "List") return false;
      const terms = operandsOf(list);
      const plain = (t: BoxedExpression) =>
        symbolNameOf(t) !== undefined || (t.isInteger === true && operandsOf(t).length === 0);
      return (
        terms.length > 0 && terms.every(plain) && terms.some((t) => symbolNameOf(t) !== undefined)
      );
    }),
    () => (ops, options) => {
      const terms = operandsOf(ops[0]);
      let acc = terms[terms.length - 1];
      for (let i = terms.length - 2; i >= 0; i--) {
        acc = ce.function("Add", [terms[i], ce.function("Divide", [1, acc])]);
      }
      return finish(acc, options);
    },
  );

  // Mod(x, m) for an exact irrational x (an algebraic number like √28, not a float)
  // against a numeric modulus: floor the double approximation to find which residue
  // class x falls in, then build the EXACT symbolic remainder x − ⌊x/m⌋·m — the
  // subtraction is exact even though the quotient was found numerically. Wolfram:
  // Mod[Sqrt[28], 3] = 2√7 − 3, wolframscript-checked. Guarded to a wide margin from
  // either boundary so a double-precision floor is never in doubt.
  wrapOperator(
    ce,
    ["Mod", 2],
    exactly(2, (ops) => {
      const x = ops[0];
      const m = ops[1];
      if (x === undefined || m === undefined) return false;
      const xExact = (x as Partial<{ isExact: boolean }>).isExact === true;
      const mExact = (m as Partial<{ isExact: boolean }>).isExact === true;
      if (!xExact || !mExact || bigRationalAt(x) !== undefined) return false;
      const mNum = m.re;
      if (!(Number.isFinite(mNum) && mNum > 0)) return false;
      const xNum = x.re;
      if (!Number.isFinite(xNum)) return false;
      const ratio = xNum / mNum;
      return Math.abs(ratio - Math.round(ratio)) > 1e-6; // margin from a boundary case
    }),
    () => (ops, options) => {
      const [x, m] = ops;
      const k = Math.floor(x.re / m.re);
      const expr = ce.function("Subtract", [
        x,
        ce.function("Multiply", [intNode(ce, BigInt(k)), m]),
      ]);
      return options.numericApproximation ? expr.N() : expr.evaluate();
    },
  );

  // L(1, χ) for a REAL (quadratic) odd primitive character mod k: derived from the
  // Fourier expansion Σ χ(n)/n = (1/τ(χ)) Σₐ χ(a)·(−log(1 − e^{2πia/k})), whose real
  // part cancels in odd-χ pairs and whose imaginary part collapses (real χ ⇒ τ(χ) =
  // i√k) to L(1, χ) = −(π/k^{3/2}) Σₐ a·χ(a) — verified by hand at k = 3
  // (χ(1)=1, χ(2)=−1 ⇒ −π/(3√3)·(1·1+2·(−1)) = π/(3√3), matching wolframscript's
  // DirichletL[3,2,1]) and cross-checked numerically below against the existing
  // Euler–Maclaurin kernel before ever returning the exact form, since an imprimitive
  // character would silently break the τ(χ) = i√k step.
  wrapOperator(
    ce,
    ["DirichletL", 3],
    exactly(3, (ops) => {
      const k = bigIntegerAt(ops[0]);
      const j = bigIntegerAt(ops[1]);
      const s = bigIntegerAt(ops[2]);
      if (k === undefined || j === undefined || s === undefined || s !== 1n) return false;
      if (k < 1n || k > 1000n) return false;
      const kn = Number(k);
      const jn = Number(j);
      if (characterExponent(kn, jn, kn - 1)?.join("/") !== "1/2") return false; // odd: χ(−1) = −1
      // Real-valued: every value is a fourth turn at most (0 or 1/2).
      for (let a = 1; a < kn; a++) {
        if (gcdNum(a, kn) !== 1) continue;
        const q = characterExponent(kn, jn, a);
        if (q === undefined) return false;
        const [num, den] = q;
        if (!(num === 0 || 2 * num === den)) return false;
      }
      return true;
    }),
    (native) => (ops, options) => {
      const k = bigIntegerAt(ops[0])!;
      const j = bigIntegerAt(ops[1])!;
      const kn = Number(k);
      const jn = Number(j);
      let sum = 0n;
      for (let a = 1; a < kn; a++) {
        const q = characterExponent(kn, jn, a);
        if (q === undefined) continue;
        const sign = q[0] === 0 ? 1n : -1n;
        sum += BigInt(a) * sign;
      }
      // L(1, χ) = π · (−Σ) / k^{3/2} = π · (−Σ/k) / √k — no reduction needed against k
      // beyond what `evaluate()` itself does for the num/k rational.
      const exact = ce
        .function("Multiply", [
          "Pi",
          ce.function("Divide", [
            intNode(ce, -sum),
            ce.function("Multiply", [intNode(ce, k), ce.function("Sqrt", [intNode(ce, k)])]),
          ]),
        ])
        .evaluate();
      // Guard against a subtle primitivity error in the τ(χ) = i√k step: cross-check
      // against the existing numeric kernel before trusting the exact form.
      const numeric = native?.([...ops], { ...options, numericApproximation: true });
      if (numeric === undefined || !Number.isFinite(numeric.re)) return undefined;
      if (Math.abs(exact.N().re - numeric.re) > 1e-9) return undefined;
      return options.numericApproximation ? exact.N() : exact;
    },
  );
}
