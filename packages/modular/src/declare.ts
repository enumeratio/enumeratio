import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  bigIntegerAt,
  bigRationalAt,
  integerAt,
  operandsOf,
  stringAt,
  widenSignature,
  wrapOperator,
} from "@enumeratio/boxed";
import { continuedFractionKOf, convergentsOf } from "./convergents.ts";
import { kroneckerSymbol } from "./kronecker.ts";
import {
  areFareyNeighbours,
  classify,
  conjugacyClassName,
  fareySequence,
  fromSternBrocotPath,
  hyperbolicClasses,
  invert,
  isPrimitiveWord,
  type Matrix,
  multiply,
  positiveWord,
  power,
  sternBrocotPath,
  stWord,
  stWordToMatrix,
  trace,
  wordToMatrix,
} from "./psl2z.ts";
import {
  actOn,
  automorph,
  classNumber,
  cycleOf,
  discriminant as formDiscriminant,
  evaluateForm,
  type Form,
  formClasses,
  isIndefinite,
  isReduced,
  pellSolution,
  reduceForm,
  reducedForms,
  rho,
} from "./forms.ts";
import {
  dedekindSum,
  linkingWithTrefoil,
  rademacherPhi,
  rademacherSymbol,
  wordSymbol,
} from "./rademacher.ts";

// Wiring the modular group to compute-engine.
//
// A matrix is written `ModularMatrix(a, b, c, d)`, and every head that wants one also
// accepts a WORD — `ModularMatrix("LRRL")` or just the string — because for this group
// the word is the more natural spelling and it is what the conjugacy classes are made of.

/** `.symbol` lives on compute-engine's narrowed interfaces, not on `Expression`. */
const symbolAt = (expr: BoxedExpression | undefined): string | undefined => {
  const name = (expr as { symbol?: unknown } | undefined)?.symbol;
  return typeof name === "string" ? name : undefined;
};

/**
 * The string an expression carries. `["String", x]` boxes as a String function whose
 * canonical `.json` is the literal `'…'`, with inner double quotes added for anything
 * non-numeric — so both layers have to come off. (Same trap as the group algebras.)
 */

/** Read a matrix: `ModularMatrix(a,b,c,d)`, a nested list, or an LR word. */
function matrixOf(expr: BoxedExpression | undefined): Matrix | undefined {
  if (expr === undefined) return undefined;
  const word = stringAt(expr);
  if (word !== undefined && /^[LR]+$/.test(word)) return wordToMatrix(word);
  const ops = operandsOf(expr);
  if (expr.operator === "ModularMatrix") {
    if (ops.length === 1) return matrixOf(ops[0]);
    const entries = ops.map(integerAt);
    return entries.length === 4 && entries.every((x): x is number => x !== undefined)
      ? [entries[0], entries[1], entries[2], entries[3]]
      : undefined;
  }
  if (expr.operator === "List" && ops.length === 2) {
    const rows = ops.map((row) => operandsOf(row).map(integerAt));
    const flat = rows.flat();
    return flat.length === 4 && flat.every((x): x is number => x !== undefined)
      ? [flat[0], flat[1], flat[2], flat[3]]
      : undefined;
  }
  return undefined;
}

/** Read an LR word, either as a string or as a matrix that has one. */
function wordOf(expr: BoxedExpression | undefined): string | undefined {
  if (expr === undefined) return undefined;
  const direct = stringAt(expr);
  if (direct !== undefined && /^[LR]+$/.test(direct)) return direct;
  const m = matrixOf(expr);
  return m === undefined ? undefined : positiveWord(m);
}

export function declareModular(ce: ComputeEngine): void {
  const matrixExpression = (m: Matrix): BoxedExpression =>
    ce.function(
      "ModularMatrix",
      m.map((x) => ce.number(x)),
    );
  const rationalExpression = ([n, d]: readonly [number, number]): BoxedExpression =>
    ce.box(["Rational", n, d]);

  ce.declare("ModularMatrix", { signature: "(any, any?, any?, any?) -> value" });

  /** A head taking a matrix (or word) and returning a value. */
  const aboutMatrix = (
    head: string,
    signature: string,
    answer: (m: Matrix) => BoxedExpression | undefined,
  ): void => {
    ce.declare(head, {
      signature,
      evaluate: (ops: readonly BoxedExpression[]) => {
        const m = matrixOf(ops[0]);
        return m === undefined ? undefined : answer(m);
      },
    });
  };

  /** A head taking an LR word. */
  const aboutWord = (
    head: string,
    signature: string,
    answer: (word: string) => BoxedExpression | undefined,
  ): void => {
    ce.declare(head, {
      signature,
      evaluate: (ops: readonly BoxedExpression[]) => {
        const word = wordOf(ops[0]);
        return word === undefined ? undefined : answer(word);
      },
    });
  };

  // ── the group ───────────────────────────────────────────────────────────────
  // Wolfram has no modular-group heads: a PSL(2,ℤ) element goes through Dot / Inverse /
  // MatrixPower like any integer matrix. Those natives are widened in place to take a
  // ModularMatrix or a word; any other pairing is left to the native handler.

  /** True for a value our handlers know how to read: `ModularMatrix(...)` or a word. */
  const isModularOperand = (expr: BoxedExpression): boolean =>
    expr.operator === "ModularMatrix" || /^[LR]+$/.test(stringAt(expr) ?? "");

  const matrixType = ce.type("matrix");

  widenSignature(ce, "Dot", "(value, value) -> value", (op) =>
    op.type.matches(ce.type("matrix | tuple | vector")),
  );
  wrapOperator(
    ce,
    ["Dot", 1, 1],
    (ops) =>
      ops.length === 2 &&
      ops.some(isModularOperand) &&
      ops.every((op) => matrixOf(op) !== undefined),
    () => (ops) => {
      const [m, n] = ops.map(matrixOf) as [Matrix, Matrix];
      return matrixExpression(multiply(m, n));
    },
  );

  widenSignature(
    ce,
    "MatrixPower",
    "(value, real) -> value",
    (op) => op.type.matches(matrixType) || op.type.matches(ce.type("real")),
  );
  wrapOperator(
    ce,
    ["MatrixPower", 1, 1],
    (ops) =>
      isModularOperand(ops[0]) && matrixOf(ops[0]) !== undefined && integerAt(ops[1]) !== undefined,
    () => (ops) => {
      const m = matrixOf(ops[0])!;
      const k = integerAt(ops[1])!;
      const result = power(m, k);
      return result === undefined ? undefined : matrixExpression(result);
    },
  );

  widenSignature(ce, "Inverse", "(value) -> value", (op) => op.type.matches(matrixType));
  wrapOperator(
    ce,
    ["Inverse", 1],
    (ops) => isModularOperand(ops[0]) && matrixOf(ops[0]) !== undefined,
    () => (ops) => {
      const inverse = invert(matrixOf(ops[0])!);
      return inverse === undefined ? undefined : matrixExpression(inverse);
    },
  );

  aboutMatrix("ModularTrace", "(value) -> integer", (m) => ce.number(trace(m)));
  /** Identity, Elliptic, Parabolic or Hyperbolic — the trichotomy by |trace| against 2. */
  aboutMatrix("ModularKind", "(value) -> string", (m) => {
    const kind = classify(m);
    return kind === undefined ? undefined : ce.string(kind.charAt(0).toUpperCase() + kind.slice(1));
  });

  // ── words ───────────────────────────────────────────────────────────────────

  /** The unique positive word in L and R, for a matrix with non-negative entries. */
  aboutMatrix("ModularWord", "(value) -> string", (m) => {
    const word = positiveWord(m);
    return word === undefined ? undefined : ce.string(word);
  });
  /** The alternating S/T factorisation, as its list of T-exponents. */
  aboutMatrix("ModularSTWord", "(value) -> list", (m) => {
    const word = stWord(m);
    return word === undefined
      ? undefined
      : ce.function(
          "List",
          word.exponents.map((e) => ce.number(e)),
        );
  });
  ce.declare("ModularFromSTWord", {
    signature: "(list) -> value",
    evaluate: (ops) => {
      const exponents = operandsOf(ops[0] as BoxedExpression).map(integerAt);
      if (!exponents.every((e): e is number => e !== undefined)) return undefined;
      const m = stWordToMatrix({ exponents });
      return m === undefined ? undefined : matrixExpression(m);
    },
  });

  // ── continued fractions, Stern–Brocot, Farey ────────────────────────────────

  // NOTE: `ContinuedFraction` and `FromContinuedFraction` are NOT declared here.
  // compute-engine already has both, and its versions are complete — rationals, floats,
  // and `ContinuedFraction(x, n)` for the first n terms of an irrational, which is
  // Wolfram's signature. We used to declare a two-argument form meaning (numerator,
  // denominator), which silently gave that native signature a different meaning:
  // `ContinuedFraction(355, 113)` returned our expansion of 355/113 rather than
  // compute-engine's 113 terms of the integer 355. Use `ContinuedFraction(355/113)`.
  // The pure-TS `continuedFraction` in psl2z.ts stays — the Stern–Brocot code uses it.

  ce.declare("SternBrocotPath", {
    signature: "(integer, integer) -> string",
    evaluate: (ops) => {
      const [p, q] = [integerAt(ops[0]), integerAt(ops[1])];
      if (p === undefined || q === undefined) return undefined;
      const path = sternBrocotPath(p, q);
      return path === undefined ? undefined : ce.string(path);
    },
  });
  ce.declare("FromSternBrocotPath", {
    signature: "(string) -> number",
    evaluate: (ops) => {
      const path = stringAt(ops[0]);
      if (path === undefined || !/^[LR]*$/.test(path)) return undefined;
      const value = fromSternBrocotPath(path);
      return value === undefined ? undefined : rationalExpression(value);
    },
  });
  ce.declare("FareySequence", {
    signature: "(integer) -> list",
    evaluate: (ops) => {
      const n = integerAt(ops[0]);
      const terms = n === undefined ? undefined : fareySequence(n);
      return terms === undefined ? undefined : ce.function("List", terms.map(rationalExpression));
    },
  });
  /** The Farey-neighbour test, |ps − qr| = 1 — which is a determinant in disguise. */
  ce.declare("FareyNeighbours", {
    signature: "(integer, integer, integer, integer) -> boolean",
    evaluate: (ops) => {
      const parts = ops.map(integerAt);
      if (parts.length !== 4 || !parts.every((x): x is number => x !== undefined)) {
        return undefined;
      }
      const [p, q, r, t] = parts;
      return ce.symbol(areFareyNeighbours(p, q, r, t) ? "True" : "False");
    },
  });

  // ── Convergents, ContinuedFractionK, IsQuadraticIrrational ──────────────────

  /** A bigint `[numerator, denominator]`, built the way `Rational` reduces automatically. */
  const bigRationalExpression = ([n, d]: readonly [bigint, bigint]): BoxedExpression =>
    ce.box(["Rational", ce.number(n), ce.number(d)]);

  ce.declare("Convergents", {
    signature: "(value, integer?) -> list",
    evaluate: (ops: readonly BoxedExpression[]) => {
      // A bare list is read as the terms of a continued fraction directly; anything
      // else goes through compute-engine's own `ContinuedFraction` first — exact for a
      // rational, or `n` terms of one for anything it can evaluate numerically.
      const termsExpr =
        ops.length === 1 && ops[0]?.operator === "List"
          ? ops[0]
          : ops.length === 1
            ? ce.function("ContinuedFraction", [ops[0]!]).evaluate()
            : ops.length === 2
              ? ce.function("ContinuedFraction", [ops[0]!, ops[1]!]).evaluate()
              : undefined;
      if (termsExpr === undefined || termsExpr.operator !== "List") return undefined;
      const terms = operandsOf(termsExpr).map(bigIntegerAt);
      if (terms.length === 0 || !terms.every((t): t is bigint => t !== undefined)) {
        return undefined;
      }
      return ce.function("List", convergentsOf(terms).map(bigRationalExpression));
    },
  });

  ce.declare("ContinuedFractionK", {
    signature: "(any, any, tuple) -> value",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [fExpr, gExpr, iterExpr] = ops;
      if (fExpr === undefined || gExpr === undefined || iterExpr?.operator !== "Tuple") {
        return undefined;
      }
      const [varExpr, iminExpr, imaxExpr] = operandsOf(iterExpr);
      const varName = (varExpr as { symbol?: unknown } | undefined)?.symbol;
      const imin = integerAt(iminExpr);
      if (typeof varName !== "string" || imin === undefined) return undefined;
      const infinite =
        (imaxExpr as { symbol?: unknown } | undefined)?.symbol === "PositiveInfinity";
      const imax = infinite ? undefined : integerAt(imaxExpr);

      const dependsOnVar = (expr: BoxedExpression): boolean =>
        (expr as { symbol?: unknown }).symbol === varName || operandsOf(expr).some(dependsOnVar);

      if (infinite) {
        // Only the constant case has a closed form: x = f/(g + x) solves the quadratic
        // x² + g·x − f = 0, whose positive root is the periodic infinite fraction's value.
        if (dependsOnVar(fExpr) || dependsOnVar(gExpr)) return undefined;
        const f = fExpr.evaluate();
        const g = gExpr.evaluate();
        return ce
          .box([
            "Divide",
            ["Add", ["Negate", g], ["Sqrt", ["Add", ["Square", g], ["Multiply", 4, f]]]],
            2,
          ])
          .evaluate();
      }

      if (imax === undefined || imax < imin) return undefined;
      const terms: (readonly [readonly [bigint, bigint], readonly [bigint, bigint]])[] = [];
      for (let i = imin; i <= imax; i++) {
        const fi = bigRationalAt(fExpr.subs({ [varName]: i }).evaluate());
        const gi = bigRationalAt(gExpr.subs({ [varName]: i }).evaluate());
        if (fi === undefined || gi === undefined) return undefined;
        terms.push([fi, gi]);
      }
      const result = continuedFractionKOf(terms);
      return result === undefined ? undefined : bigRationalExpression(result);
    },
  });

  // compute-engine folds a numeric surd like `Sqrt(2)` or `3·Sqrt(2)` straight into an
  // EXACT numeric value rather than keeping a `Sqrt`/`Multiply` function node — its
  // `.operator` reads "Real", and `.json` is the only place the `Sqrt` shape survives.
  // `.numericValue` is where the fold is readable back out: `rational * √radical`, with
  // `radical` kept squarefree, so `radical > 1` is exactly "genuinely irrational surd".
  interface ExactRadical {
    readonly im: number;
    readonly rational: readonly [number, number];
    readonly radical: number;
    readonly imRadical: number;
  }
  const radicalOf = (expr: BoxedExpression): ExactRadical | undefined =>
    (expr as { numericValue?: unknown }).numericValue as ExactRadical | undefined;
  /** A folded `rational · √radical`, real and genuinely irrational (`radical` not 1). */
  const isIrrationalSurd = (expr: BoxedExpression): boolean => {
    const r = radicalOf(expr);
    return (
      r !== undefined && r.im === 0 && r.imRadical === 1 && r.radical > 1 && r.rational[0] !== 0
    );
  };
  /**
   * Whether `expr` is a quadratic irrational: an irrational root of a quadratic with
   * integer coefficients — equivalently, a rational affine combination with exactly one
   * irrational `Sqrt` term, at any rational scale: `Sqrt(n)`, `3·Sqrt(2)`, `1 + Sqrt(5)`,
   * `(1 + Sqrt(5))/2`, `1 − Sqrt(3)`. A rational is excluded (not irrational); anything
   * else (another algebraic degree, a transcendental constant, an unrecognised shape)
   * reads as `False`, not "unknown" — same as Wolfram's `…Q` predicates.
   */
  const quadraticIrrational = (expr: BoxedExpression): boolean => {
    if (isIrrationalSurd(expr)) return true;
    if (bigRationalAt(expr) !== undefined) return false;
    if (expr.operator === "Negate") return quadraticIrrational(operandsOf(expr)[0]!);
    if (expr.operator === "Divide") {
      const [num, den] = operandsOf(expr);
      const denRational = bigRationalAt(den);
      return denRational !== undefined && denRational[0] !== 0n && num !== undefined
        ? quadraticIrrational(num)
        : false;
    }
    if (expr.operator === "Add" || expr.operator === "Multiply") {
      const ops = operandsOf(expr);
      const rationalTerms = ops.filter((o) => bigRationalAt(o) !== undefined);
      const otherTerms = ops.filter((o) => bigRationalAt(o) === undefined);
      return (
        otherTerms.length === 1 &&
        rationalTerms.length === ops.length - 1 &&
        quadraticIrrational(otherTerms[0]!)
      );
    }
    return false;
  };
  ce.declare("IsQuadraticIrrational", {
    signature: "(value) -> boolean",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const x = ops[0];
      return x === undefined ? undefined : ce.symbol(quadraticIrrational(x) ? "True" : "False");
    },
  });

  // ── the flow: conjugacy classes, and the Rademacher symbol ──────────────────

  /** The canonical name of a conjugacy class: the least rotation of its word. */
  aboutWord("ModularClass", "(value) -> string", (word) => {
    const name = conjugacyClassName(word);
    return name === undefined ? undefined : ce.string(name);
  });
  aboutWord("IsPrimitiveClass", "(value) -> boolean", (word) =>
    ce.symbol(isPrimitiveWord(word) ? "True" : "False"),
  );
  /** Every closed geodesic whose word has the given length, as a list of class names. */
  ce.declare("ModularClasses", {
    signature: "(integer, boolean?) -> list",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = integerAt(ops[0]);
      const primitiveOnly = symbolAt(ops[1]) === "True";
      const classes = n === undefined ? undefined : hyperbolicClasses(n, primitiveOnly);
      return classes === undefined
        ? undefined
        : ce.function(
            "List",
            classes.map((word) => ce.string(word)),
          );
    },
  });

  ce.declare("DedekindSum", {
    signature: "(integer, integer) -> number",
    evaluate: (ops) => {
      const [h, k] = [integerAt(ops[0]), integerAt(ops[1])];
      if (h === undefined || k === undefined) return undefined;
      const sum = dedekindSum(h, k);
      return sum === undefined ? undefined : rationalExpression(sum);
    },
  });
  aboutMatrix("RademacherPhi", "(value) -> integer", (m) => {
    const phi = rademacherPhi(m);
    return phi === undefined ? undefined : ce.number(phi);
  });
  aboutMatrix("RademacherSymbol", "(value) -> integer", (m) => {
    const symbol = rademacherSymbol(m);
    return symbol === undefined ? undefined : ce.number(symbol);
  });
  /** Ghys's theorem, as a head: the modular knot's linking number with the trefoil. */
  aboutMatrix("LinkingWithTrefoil", "(value) -> integer", (m) => {
    const linking = linkingWithTrefoil(m);
    return linking === undefined ? undefined : ce.number(linking);
  });
  /** The same number counted off the word, which is how it is cheap. */
  aboutWord("WordSymbol", "(value) -> integer", (word) => {
    const symbol = wordSymbol(word);
    return symbol === undefined ? undefined : ce.number(symbol);
  });

  // ── indefinite binary quadratic forms ───────────────────────────────────────

  const formExpression = (f: Form): BoxedExpression =>
    ce.function("QuadraticForm", [ce.number(f.a), ce.number(f.b), ce.number(f.c)]);
  const formListExpression = (forms: readonly Form[]): BoxedExpression =>
    ce.function("List", forms.map(formExpression));

  /** Read `QuadraticForm(a, b, c)`. */
  const formOf = (expr: BoxedExpression | undefined): Form | undefined => {
    if (expr === undefined || expr.operator !== "QuadraticForm") return undefined;
    const values = operandsOf(expr).map(integerAt);
    return values.length === 3 && values.every((x): x is number => x !== undefined)
      ? { a: values[0], b: values[1], c: values[2] }
      : undefined;
  };

  ce.declare("QuadraticForm", { signature: "(integer, integer, integer) -> value" });

  /** A head taking a form. */
  const aboutForm = (
    head: string,
    signature: string,
    answer: (f: Form) => BoxedExpression | undefined,
  ): void => {
    ce.declare(head, {
      signature,
      evaluate: (ops: readonly BoxedExpression[]) => {
        const f = formOf(ops[0]);
        return f === undefined ? undefined : answer(f);
      },
    });
  };

  /** A head taking a discriminant. */
  const aboutDiscriminant = (
    head: string,
    signature: string,
    answer: (d: number) => BoxedExpression | undefined,
  ): void => {
    ce.declare(head, {
      signature,
      evaluate: (ops: readonly BoxedExpression[]) => {
        const d = integerAt(ops[0]);
        return d === undefined ? undefined : answer(d);
      },
    });
  };

  aboutForm("FormDiscriminant", "(value) -> integer", (f) => ce.number(formDiscriminant(f)));
  aboutForm("IsIndefinite", "(value) -> boolean", (f) =>
    ce.symbol(isIndefinite(f) ? "True" : "False"),
  );
  aboutForm("IsReducedForm", "(value) -> boolean", (f) =>
    ce.symbol(isReduced(f) ? "True" : "False"),
  );
  aboutForm("ReduceForm", "(value) -> value", (f) => {
    const reduced = reduceForm(f);
    return reduced === undefined ? undefined : formExpression(reduced);
  });
  /** One step round the cycle — the continued-fraction step, in form coordinates. */
  aboutForm("FormRho", "(value) -> value", (f) => {
    const next = rho(f);
    return next === undefined ? undefined : formExpression(next);
  });
  /** The whole cycle: the class, listed. Its length is always even. */
  aboutForm("FormCycle", "(value) -> list", (f) => {
    const cycle = cycleOf(f);
    return cycle === undefined ? undefined : formListExpression(cycle);
  });
  /** The automorph: the hyperbolic matrix generating the form's stabiliser. */
  aboutForm("FormAutomorph", "(value) -> value", (f) => {
    const m = automorph(f);
    return m === undefined ? undefined : matrixExpression(m);
  });

  aboutDiscriminant("ReducedForms", "(integer) -> list", (d) => {
    const forms = reducedForms(d);
    return forms === undefined ? undefined : formListExpression(forms);
  });
  aboutDiscriminant("FormClasses", "(integer) -> list", (d) => {
    const classes = formClasses(d);
    return classes === undefined ? undefined : ce.function("List", classes.map(formListExpression));
  });
  aboutDiscriminant("FormClassNumber", "(integer) -> integer", (d) => {
    const h = classNumber(d);
    return h === undefined ? undefined : ce.number(h);
  });
  /** The fundamental solution of t² − Du² = 4, as the pair (t, u). */
  aboutDiscriminant("PellSolution", "(integer) -> list", (d) => {
    const pell = pellSolution(d);
    return pell === undefined
      ? undefined
      : ce.function("List", [ce.number(pell.t), ce.number(pell.u)]);
  });

  ce.declare("FormAction", {
    signature: "(value, value) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const f = formOf(ops[0]);
      const m = matrixOf(ops[1]);
      if (f === undefined || m === undefined) return undefined;
      const image = actOn(f, m);
      return image === undefined ? undefined : formExpression(image);
    },
  });
  ce.declare("EvaluateForm", {
    signature: "(value, integer, integer) -> integer",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const f = formOf(ops[0]);
      const [x, y] = [integerAt(ops[1]), integerAt(ops[2])];
      return f === undefined || x === undefined || y === undefined
        ? undefined
        : ce.number(evaluateForm(f, x, y));
    },
  });

  // ── the Kronecker symbol ─────────────────────────────────────────────────────

  /** (a/n) for any integers a, n — the full extension of Jacobi/Legendre. Bignum-safe. */
  ce.declare("KroneckerSymbol", {
    signature: "(integer, integer) -> integer",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [a, n] = [bigIntegerAt(ops[0]), bigIntegerAt(ops[1])];
      return a === undefined || n === undefined ? undefined : ce.number(kroneckerSymbol(a, n));
    },
  });
}
