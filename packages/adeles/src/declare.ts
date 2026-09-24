import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  bigIntegerAt,
  bigRationalAt,
  integerAt,
  operandsOf,
  symbolNameOf,
  widenSignature,
  wrapOperator,
} from "@enumeratio/boxed";
import { ADIC, adicOf, adic } from "@enumeratio/numerals";
import * as I from "./idele.ts";
import type { IdeleFinite } from "./idele.ts";
import { profiniteDecomposition } from "./matrix.ts";
import * as P from "./profinite.ts";
import type { Profinite } from "./profinite.ts";
import * as Q from "./rational.ts";
import type { Q as Rational } from "./rational.ts";

// Hertogh's adèles over Q as compute-engine values. Three value heads:
//
//   ProfiniteNumber(x, m)        x + mẐ in Q̂ = Ẑ ⊗ Q; modulus 0 is just the rational x
//   Adele(r, z)                  a real r beside a profinite z; Adele(q) is q at every place
//   Idele(r, q)                  the principal idèle of q at every finite prime
//   Idele(r, s, {c_p, …})        p^{v_p(s)}·c_p at each listed prime, a unit elsewhere
//
// Like AdicNumeral they are function expressions, so the arithmetic heads are wrapped to
// answer when one turns up. Existing heads learn the new values rather than new heads
// appearing: Fibonacci and LucasL take profinite arguments (Lenstra's profinite
// Fibonacci), Numerator/Denominator split a profinite number, AdicNumeral(p, z) projects
// one to Q_p, and ProfiniteNumber({AdicNumeral(…), …}) glues p-adics back by CRT.

export const PROFINITE = "ProfiniteNumber";
export const ADELE = "Adele";
export const IDELE = "Idele";

type Evaluate = (ops: readonly BoxedExpression[]) => BoxedExpression | undefined;

const rationalAt = (expr: BoxedExpression | undefined): Rational | undefined => {
  const r = bigRationalAt(expr);
  return r === undefined ? undefined : Q.q(r[0], r[1]);
};

/** A profinite number, a rational read exactly, or `undefined`. */
export function profiniteOf(expr: BoxedExpression | undefined): Profinite | undefined {
  if (expr === undefined) return undefined;
  if (expr.operator === PROFINITE) {
    const [x, m] = operandsOf(expr);
    const value = rationalAt(x);
    const modulus = m === undefined ? Q.ZERO : rationalAt(m);
    return value === undefined || modulus === undefined ? undefined : P.profinite(value, modulus);
  }
  const r = rationalAt(expr);
  return r === undefined ? undefined : P.exact(r);
}

const numberOf = (ce: ComputeEngine, x: Rational): BoxedExpression =>
  ce.number(Q.isInteger(x) ? x[0] : [x[0], x[1]]);

export const profiniteExpression = (ce: ComputeEngine, x: Profinite): BoxedExpression =>
  P.isExact(x)
    ? numberOf(ce, x.value)
    : ce.function(PROFINITE, [numberOf(ce, x.value), numberOf(ce, x.modulus)]);

// ── adèles and idèles: a real part beside a finite one ──────────────────────────────

interface Adele {
  readonly real: BoxedExpression;
  readonly finite: Profinite;
}

interface Idele {
  readonly real: BoxedExpression;
  readonly finite: IdeleFinite;
}

/** A real constant: an exact or approximate number, or a closed form like π. */
const isRealNumber = (expr: BoxedExpression): boolean => {
  const n = expr.N();
  return n.im === 0 && Number.isFinite(n.re);
};

function adeleOf(expr: BoxedExpression): Adele | undefined {
  if (expr.operator === ADELE) {
    const [real, finite] = operandsOf(expr);
    const z = profiniteOf(finite);
    return real === undefined || z === undefined || !isRealNumber(real)
      ? undefined
      : { real, finite: z };
  }
  const r = rationalAt(expr);
  return r === undefined ? undefined : { real: expr, finite: P.exact(r) };
}

const adeleExpression = (ce: ComputeEngine, x: Adele): BoxedExpression =>
  ce.function(ADELE, [x.real, profiniteExpression(ce, x.finite)]);

function ideleOf(expr: BoxedExpression): Idele | undefined {
  if (expr.operator === IDELE) {
    const [real, scale, units] = operandsOf(expr);
    const s = rationalAt(scale);
    if (real === undefined || s === undefined || Q.isZero(s) || !isRealNumber(real))
      return undefined;
    if (real.is(0)) return undefined;
    if (units === undefined) return { real, finite: { kind: "principal", value: s } };
    const components = operandsOf(units).map((u) => (u.operator === ADIC ? adicOf(u) : undefined));
    if (units.operator !== "List" || components.some((c) => c === undefined)) return undefined;
    const finite = I.local(s, components as adic.Adic[]);
    return finite === undefined ? undefined : { real, finite };
  }
  const r = rationalAt(expr);
  return r === undefined || Q.isZero(r)
    ? undefined
    : { real: expr, finite: { kind: "principal", value: r } };
}

function adicExpression(ce: ComputeEngine, u: adic.Adic): BoxedExpression {
  const ops = [ce.number(u.base), numberOf(ce, [u.num, u.den])];
  if (u.prec !== undefined) ops.push(ce.number(u.prec));
  return ce.function(ADIC, ops);
}

function ideleExpression(ce: ComputeEngine, x: Idele): BoxedExpression {
  const { real, finite } = x;
  if (finite.kind === "principal") return ce.function(IDELE, [real, numberOf(ce, finite.value)]);
  const units = [...finite.units.values()].map((u) => adicExpression(ce, u));
  return ce.function(IDELE, [real, numberOf(ce, finite.scale), ce.function("List", units)]);
}

export function declareAdeles(ce: ComputeEngine): void {
  const real = (head: string, ...xs: BoxedExpression[]): BoxedExpression =>
    ce.function(head, xs).evaluate();

  // ── ProfiniteNumber ───────────────────────────────────────────────────────────

  ce.declare(PROFINITE, {
    description:
      "x + mẐ: the rational x known modulo the rational m in Q̂ = Ẑ ⊗ Q; ProfiniteNumber({AdicNumeral(p, x, n), …}) glues p-adics by CRT.",
    signature: "(any, number?) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [first, second] = ops;
      if (first === undefined) return undefined;
      if (second === undefined && (first.operator === "List" || first.operator === ADIC)) {
        const adics = first.operator === "List" ? operandsOf(first) : [first];
        const components: { p: bigint; value: Rational; prec: number }[] = [];
        for (const expr of adics) {
          const a = expr.operator === ADIC ? adicOf(expr) : undefined;
          if (a === undefined || a.prec === undefined || !adic.isPrime(a.base)) return undefined;
          components.push({ p: a.base, value: Q.q(a.num, a.den), prec: a.prec });
        }
        const glued = P.fromPadics(components);
        return glued === undefined ? undefined : profiniteExpression(ce, glued);
      }
      const x = profiniteOf(ce.function(PROFINITE, ops));
      return x === undefined ? undefined : profiniteExpression(ce, x);
    },
  });

  // ── the arithmetic heads ──────────────────────────────────────────────────────

  const has =
    (head: string) =>
    (ops: readonly BoxedExpression[]): boolean =>
      ops.some((op) => op.operator === head);

  /** Fold a variadic head over values read by `read`, with `step` combining two. */
  function fold<T>(
    read: (e: BoxedExpression) => T | undefined,
    step: (x: T, y: T) => T | undefined,
    write: (x: T) => BoxedExpression,
  ): Evaluate {
    return (ops) => {
      const values = ops.map(read);
      if (values.length === 0 || values.some((v) => v === undefined)) return undefined;
      let acc: T | undefined = values[0];
      for (const next of values.slice(1)) {
        if (acc === undefined) return undefined;
        acc = step(acc, next as T);
      }
      return acc === undefined ? undefined : write(acc);
    };
  }

  const writeProfinite = (x: Profinite): BoxedExpression => profiniteExpression(ce, x);
  const onProfinite = has(PROFINITE);
  // Adèles and idèles never mix with each other or with a bare profinite number.
  const onlyProfinite = (ops: readonly BoxedExpression[]): boolean =>
    onProfinite(ops) && !has(ADELE)(ops) && !has(IDELE)(ops);

  wrapOperator(ce, ["Add", "x", "y"], onlyProfinite, () =>
    fold(profiniteOf, P.add, writeProfinite),
  );
  wrapOperator(ce, ["Multiply", "x", "y"], onlyProfinite, () =>
    fold(profiniteOf, P.multiply, writeProfinite),
  );
  wrapOperator(ce, ["Divide", "x", "y"], onlyProfinite, () =>
    fold(profiniteOf, P.divide, writeProfinite),
  );
  wrapOperator(ce, ["Negate", "x"], onlyProfinite, () => (ops) => {
    const x = profiniteOf(ops[0]);
    return x === undefined ? undefined : writeProfinite(P.negate(x));
  });
  wrapOperator(
    ce,
    ["Power", "x", "y"],
    (ops) => ops[0]?.operator === PROFINITE,
    () => (ops) => {
      const x = profiniteOf(ops[0]);
      const n = bigIntegerAt(ops[1]);
      const result = x === undefined || n === undefined ? undefined : P.power(x, n);
      return result === undefined ? undefined : writeProfinite(result);
    },
  );

  // Adèles: componentwise; a rational beside an adèle is the diagonal adèle.
  const onAdele = (ops: readonly BoxedExpression[]): boolean =>
    has(ADELE)(ops) && !has(IDELE)(ops) && !onProfinite(ops);
  const writeAdele = (x: Adele): BoxedExpression => adeleExpression(ce, x);
  const adeleStep =
    (head: string, finite: (x: Profinite, y: Profinite) => Profinite | undefined) =>
    (x: Adele, y: Adele): Adele | undefined => {
      const z = finite(x.finite, y.finite);
      return z === undefined ? undefined : { real: real(head, x.real, y.real), finite: z };
    };
  wrapOperator(ce, ["Add", "x", "y"], onAdele, () =>
    fold(adeleOf, adeleStep("Add", P.add), writeAdele),
  );
  wrapOperator(ce, ["Multiply", "x", "y"], onAdele, () =>
    fold(adeleOf, adeleStep("Multiply", P.multiply), writeAdele),
  );
  wrapOperator(ce, ["Divide", "x", "y"], onAdele, () =>
    fold(adeleOf, adeleStep("Divide", P.divide), writeAdele),
  );
  wrapOperator(ce, ["Negate", "x"], onAdele, () => (ops) => {
    const x = ops[0] === undefined ? undefined : adeleOf(ops[0]);
    return x === undefined
      ? undefined
      : writeAdele({ real: real("Negate", x.real), finite: P.negate(x.finite) });
  });
  wrapOperator(
    ce,
    ["Power", "x", "y"],
    (ops) => ops[0]?.operator === ADELE,
    () => (ops) => {
      const x = ops[0] === undefined ? undefined : adeleOf(ops[0]);
      const n = bigIntegerAt(ops[1]);
      const finite = x === undefined || n === undefined ? undefined : P.power(x.finite, n);
      return finite === undefined || x === undefined
        ? undefined
        : writeAdele({ real: real("Power", x.real, ops[1]!), finite });
    },
  );

  // Idèles form a group: multiplication, division, integer powers.
  const onIdele = (ops: readonly BoxedExpression[]): boolean =>
    has(IDELE)(ops) && !has(ADELE)(ops) && !onProfinite(ops);
  const writeIdele = (x: Idele): BoxedExpression => ideleExpression(ce, x);
  const ideleStep =
    (head: string, finite: (x: IdeleFinite, y: IdeleFinite) => IdeleFinite | undefined) =>
    (x: Idele, y: Idele): Idele | undefined => {
      const z = finite(x.finite, y.finite);
      return z === undefined ? undefined : { real: real(head, x.real, y.real), finite: z };
    };
  const ideleDivide = (x: IdeleFinite, y: IdeleFinite): IdeleFinite | undefined => {
    const inverse = I.invert(y);
    return inverse === undefined ? undefined : I.multiply(x, inverse);
  };
  wrapOperator(ce, ["Multiply", "x", "y"], onIdele, () =>
    fold(ideleOf, ideleStep("Multiply", I.multiply), writeIdele),
  );
  wrapOperator(ce, ["Divide", "x", "y"], onIdele, () =>
    fold(ideleOf, ideleStep("Divide", ideleDivide), writeIdele),
  );
  wrapOperator(
    ce,
    ["Power", "x", "y"],
    (ops) => ops[0]?.operator === IDELE,
    () => (ops) => {
      const x = ops[0] === undefined ? undefined : ideleOf(ops[0]);
      const n = bigIntegerAt(ops[1]);
      const finite = x === undefined || n === undefined ? undefined : I.power(x.finite, n);
      return finite === undefined || x === undefined
        ? undefined
        : writeIdele({ real: real("Power", x.real, ops[1]!), finite });
    },
  );

  // Hertogh's equality — the represented sets meet — for all three.
  const equalValues = (a: BoxedExpression, b: BoxedExpression): boolean | undefined => {
    const heads = [a.operator, b.operator];
    if (heads.includes(IDELE)) {
      const [x, y] = [ideleOf(a), ideleOf(b)];
      if (x === undefined || y === undefined) return undefined;
      return real("Equal", x.real, y.real).is(true) && I.equal(x.finite, y.finite);
    }
    if (heads.includes(ADELE)) {
      const [x, y] = [adeleOf(a), adeleOf(b)];
      if (x === undefined || y === undefined) return undefined;
      return real("Equal", x.real, y.real).is(true) && P.equal(x.finite, y.finite);
    }
    const [x, y] = [profiniteOf(a), profiniteOf(b)];
    return x === undefined || y === undefined ? undefined : P.equal(x, y);
  };
  const onAny = (ops: readonly BoxedExpression[]): boolean =>
    ops.some((op) => op.operator === PROFINITE || op.operator === ADELE || op.operator === IDELE);
  for (const [head, negate] of [
    ["Equal", false],
    ["NotEqual", true],
  ] as const) {
    wrapOperator(ce, [head, "x", "y"], onAny, () => (ops) => {
      const [a, b] = ops;
      if (a === undefined || b === undefined || ops.length !== 2) return undefined;
      const answer = equalValues(a, b);
      return answer === undefined ? undefined : ce.symbol(answer !== negate ? "True" : "False");
    });
  }

  // ── the constructors ──────────────────────────────────────────────────────────

  ce.declare(ADELE, {
    description:
      "An adèle of Q: a real component beside a profinite one. Adele(q) puts q at every place; Adele(idèle) is the adèle it determines.",
    signature: "(any, any?) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [first, second] = ops;
      if (first === undefined) return undefined;
      if (second === undefined) {
        if (first.operator === IDELE) {
          const x = ideleOf(first);
          const finite = x === undefined ? undefined : I.toProfinite(x.finite);
          return finite === undefined || x === undefined
            ? undefined
            : writeAdele({ real: x.real, finite });
        }
        const r = rationalAt(first);
        return r === undefined ? undefined : writeAdele({ real: first, finite: P.exact(r) });
      }
      const x = adeleOf(ce.function(ADELE, ops));
      return x === undefined ? undefined : writeAdele(x);
    },
  });

  ce.declare(IDELE, {
    description:
      "An idèle of Q. Idele(q) and Idele(r, q) are principal; Idele(r, s, {AdicNumeral(p, c, n), …}) has p^{v_p(s)}·c at each listed prime and p^{v_p(s)} times an unknown unit elsewhere.",
    signature: "(any, any?, list?) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [first, second] = ops;
      if (first === undefined) return undefined;
      if (second === undefined) {
        const r = rationalAt(first);
        return r === undefined || Q.isZero(r)
          ? undefined
          : writeIdele({ real: first, finite: { kind: "principal", value: r } });
      }
      const x = ideleOf(ce.function(IDELE, ops));
      return x === undefined ? undefined : writeIdele(x);
    },
  });

  // ── existing heads learn profinite arguments ──────────────────────────────────

  const sequence = (head: string, kernel: (x: Profinite) => Profinite | undefined): void => {
    widenSignature(ce, head, "(integer | value) -> integer | value");
    wrapOperator(
      ce,
      [head, "n"],
      (ops) => ops[0]?.operator === PROFINITE,
      () => (ops) => {
        const x = profiniteOf(ops[0]);
        const y = x === undefined ? undefined : kernel(x);
        return y === undefined ? undefined : writeProfinite(y);
      },
    );
  };
  sequence("Fibonacci", P.fibonacci);
  sequence("LucasL", P.lucas);

  widenSignature(ce, "Numerator", "(number | value) -> nothing | number | value");
  wrapOperator(
    ce,
    ["Numerator", "x"],
    (ops) => ops[0]?.operator === PROFINITE,
    () => (ops) => {
      const x = profiniteOf(ops[0]);
      return x === undefined ? undefined : writeProfinite(P.numerator(x));
    },
  );
  widenSignature(ce, "Denominator", "(number | value) -> nothing | number | value");
  wrapOperator(
    ce,
    ["Denominator", "x"],
    (ops) => ops[0]?.operator === PROFINITE,
    () => (ops) => {
      const x = profiniteOf(ops[0]);
      return x === undefined ? undefined : ce.number(P.denominator(x));
    },
  );

  // AdicNumeral(p, z): the image of z in Q_p, known modulo p^{v_p(m)}.
  wrapOperator(
    ce,
    [ADIC, "b", "x"],
    (ops) => ops[1]?.operator === PROFINITE,
    () => (ops) => {
      const p = bigIntegerAt(ops[0]);
      const x = profiniteOf(ops[1]);
      if (p === undefined || x === undefined || !adic.isPrime(p)) return undefined;
      const image = P.toPadic(x, p);
      if (image.prec !== undefined && image.prec < 1) return undefined;
      const cap = integerAt(ops[2]);
      const prec =
        image.prec === undefined ? cap : cap === undefined ? image.prec : Math.min(cap, image.prec);
      const args = [ce.number(p), numberOf(ce, image.value)];
      if (prec !== undefined) args.push(ce.number(prec));
      return ce.function(ADIC, args).evaluate();
    },
  );

  // ── the matrix factorisation ──────────────────────────────────────────────────

  ce.declare("ProfiniteDecomposition", {
    description:
      "{b, a} with m = b·a, b ∈ GL_n(Ẑ) and a ∈ GL_n⁺(Q) upper triangular — strong approximation for a matrix over Q̂ (Hertogh's Algorithm 8.4); d is det m, by default that of the value matrix.",
    signature: "(list, number?) -> list",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const rows = operandsOf(ops[0]).map((row) => operandsOf(row).map(profiniteOf));
      if (rows.some((row) => row.some((x) => x === undefined))) return undefined;
      const det = ops[1] === undefined ? undefined : rationalAt(ops[1]);
      if (ops[1] !== undefined && det === undefined) return undefined;
      const found = profiniteDecomposition(rows as Profinite[][], det);
      if (found === undefined) return undefined;
      const matrix = <T>(m: T[][], write: (x: T) => BoxedExpression): BoxedExpression =>
        ce.function(
          "List",
          m.map((row) => ce.function("List", row.map(write))),
        );
      return ce.function("List", [
        matrix(found.b, writeProfinite),
        matrix(found.a, (x) => numberOf(ce, x)),
      ]);
    },
  });

  declareProfinitePlot(ce);
}

// ── the profinite graph ───────────────────────────────────────────────────────────

/** The largest level drawn: 6! = 720 cells a side. */
export const MAX_PLOT_LEVEL = 6;

/**
 * The position of the residue a mod k! along Hertogh's visualisation map
 * φ(α) = Σ dᵢ/(i+1)!, where dᵢ are the factorial digits of α: residues with the same low
 * digits sit together, so each coarser residue class is one contiguous block.
 */
export function visualPosition(a: bigint, level: number): number {
  let position = 0n;
  let rest = a;
  let block = 1n;
  for (let i = 2; i <= level; i++) block *= BigInt(i);
  for (let i = 1; i < level; i++) {
    const digit = rest % BigInt(i + 1);
    rest /= BigInt(i + 1);
    block /= BigInt(i + 1);
    position += digit * block;
  }
  return Number(position);
}

function declareProfinitePlot(ce: ComputeEngine): void {
  // ProfinitePlot(f, x, k): the graph of f: Ẑ → Ẑ at precision k (Lenstra's picture, as in
  // Hertogh's ProfiniteGraph). Each cell is a pair of residue classes mod k!, laid out by
  // φ; a cell is filled when f maps its column class into its row class — f is evaluated
  // on x = ProfiniteNumber(a, k!) and its image, known modulo some M, meets every row class
  // congruent to it mod gcd(M, k!). The picture it evaluates to is an ArrayPlot.
  ce.declare("ProfinitePlot", {
    description:
      "The graph of f: Ẑ → Ẑ in the variable x at precision k (default 5): residue classes mod k! laid out by their factorial digits, drawn as an ArrayPlot.",
    signature: "(any, symbol, integer?) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [f, x, levelExpr] = ops;
      const variable = x === undefined ? undefined : symbolNameOf(x);
      const level = levelExpr === undefined ? 5 : integerAt(levelExpr.evaluate());
      if (f === undefined || typeof variable !== "string" || level === undefined) return undefined;
      if (level < 2 || level > MAX_PLOT_LEVEL) return undefined;
      let size = 1n;
      for (let i = 2; i <= level; i++) size *= BigInt(i);
      const n = Number(size);
      const cells = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
      for (let a = 0n; a < size; a++) {
        const input = ce.function(PROFINITE, [ce.number(a), ce.number(size)]);
        const image = profiniteOf(f.subs({ [variable]: input }).evaluate());
        if (image === undefined || !P.isIntegral(image)) return undefined;
        const step = P.isExact(image) ? size : Q.gcdQ(image.modulus, [size, 1n])[0];
        const column = visualPosition(a, level);
        for (let b = adic.mod(image.value[0], step); b < size; b += step)
          cells[n - 1 - visualPosition(b, level)]![column] = 1;
      }
      return ce.function("ArrayPlot", [
        ce.function(
          "List",
          cells.map((row) =>
            ce.function(
              "List",
              row.map((v) => ce.number(v)),
            ),
          ),
        ),
      ]);
    },
  });
}
