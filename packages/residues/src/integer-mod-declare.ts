import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  bigIntegerAt,
  bigRationalAt,
  operandsOf,
  symbolNameOf,
  widenSignature,
  wrapOperator,
} from "@enumeratio/boxed";
import { gcd } from "./arith.ts";
import * as Z from "./integer-mod.ts";
import type { IntegerMod } from "./integer-mod.ts";

// The value head for ℤ/m and the ring it lives in, after Sage's Mod(a, m) / Zmod(m):
//
//   IntegerMod(a, m)    a mod m as an element of ℤ/m; a rational a = u/v reads as u·v⁻¹
//   IntegerModRing(m)   ℤ/m itself, as a finite collection of those elements
//
// As with AdicNumeral there is no number-type extension point, so `Add`, `Multiply`,
// `Negate`, `Divide` and `Power` are wrapped to answer when an IntegerMod shows up.

export const INTEGER_MOD = "IntegerMod";
export const INTEGER_MOD_RING = "IntegerModRing";

const isIntegerMod = (expr: BoxedExpression | undefined): boolean => expr?.operator === INTEGER_MOD;

/** Read `IntegerMod(a, m)`, normalised. */
export function integerModOf(expr: BoxedExpression | undefined): IntegerMod | undefined {
  if (!isIntegerMod(expr)) return undefined;
  const [a, m] = operandsOf(expr);
  const value = bigRationalAt(a);
  const modulus = bigIntegerAt(m);
  return value === undefined || modulus === undefined
    ? undefined
    : Z.integerMod(value[0], value[1], modulus);
}

const modulusOf = (expr: BoxedExpression | undefined): bigint | undefined => {
  if (expr?.operator !== INTEGER_MOD_RING) return undefined;
  const m = bigIntegerAt(operandsOf(expr)[0]);
  return m === undefined || m < 1n ? undefined : m;
};

export const integerModExpression = (ce: ComputeEngine, x: IntegerMod): BoxedExpression =>
  ce.function(INTEGER_MOD, [ce.number(x.residue), ce.number(x.modulus)]);

export function declareIntegerMod(ce: ComputeEngine): void {
  const write = (x: IntegerMod | undefined): BoxedExpression | undefined =>
    x === undefined ? undefined : integerModExpression(ce, x);

  // Evaluating the constructor normalises into [0, m), and declines a non-unit denominator.
  ce.declare(INTEGER_MOD, {
    description: "a mod m as an element of ℤ/m; a rational a = u/v reads as u·v⁻¹.",
    signature: "(number, integer) -> value",
    evaluate: (ops: readonly BoxedExpression[]) =>
      write(integerModOf(ce.function(INTEGER_MOD, ops))),
  });

  ce.declare(INTEGER_MOD_RING, {
    description: "The ring ℤ/m, as the finite collection of its m residue classes.",
    signature: "(integer) -> set",
    collection: {
      count: (ring) => {
        const m = modulusOf(ring);
        return m === undefined ? undefined : Number(m);
      },
      isFinite: (ring) => modulusOf(ring) !== undefined,
      isEnumerable: (ring) => modulusOf(ring) !== undefined,
      isEmpty: () => false,
      iterator: (ring) => {
        const m = modulusOf(ring);
        if (m === undefined) return undefined;
        let k = 0n;
        return {
          next: () =>
            k < m
              ? { value: integerModExpression(ce, { residue: k++, modulus: m }), done: false }
              : { value: undefined, done: true },
        };
      },
      contains: (ring, target) => {
        const m = modulusOf(ring);
        const x = integerModOf(target);
        return m === undefined || x === undefined ? undefined : x.modulus === m;
      },
    },
  });

  // compute-engine's QuotientRing(Integers, m) — what `\mathbb{Z}/m\mathbb{Z}` parses to — is
  // inert; over the integers it specialises to IntegerModRing(m).
  wrapOperator(
    ce,
    ["QuotientRing", "Integers", 2],
    (ops) =>
      ops[0] !== undefined &&
      symbolNameOf(ops[0]) === "Integers" &&
      (bigIntegerAt(ops[1]) ?? 0n) >= 1n,
    () => (ops) => ce.function(INTEGER_MOD_RING, [ops[1]!]),
  );

  /** Every operand as an element of the ring the IntegerMod operands meet in. */
  const lift = (ops: readonly BoxedExpression[]): IntegerMod[] | undefined => {
    const moduli = ops.map((op) => integerModOf(op)?.modulus).filter((m) => m !== undefined);
    if (moduli.length === 0) return undefined;
    const ring = moduli.reduce(gcd);
    const values = ops.map((op) => {
      if (isIntegerMod(op)) return integerModOf(op);
      const r = bigRationalAt(op);
      return r === undefined ? undefined : Z.integerMod(r[0], r[1], ring);
    });
    return values.every((v) => v !== undefined) ? values : undefined;
  };

  const anyIntegerMod = (ops: readonly BoxedExpression[]): boolean => ops.some(isIntegerMod);

  const fold =
    (step: (x: IntegerMod, y: IntegerMod) => IntegerMod | undefined) =>
    (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const values = lift(ops);
      if (values === undefined) return undefined;
      let acc: IntegerMod | undefined = values[0];
      for (const next of values.slice(1)) acc = acc === undefined ? undefined : step(acc, next);
      return write(acc);
    };

  wrapOperator(ce, ["Add", "x", "y"], anyIntegerMod, () => fold(Z.add));
  wrapOperator(ce, ["Multiply", "x", "y"], anyIntegerMod, () => fold(Z.multiply));
  wrapOperator(ce, ["Divide", "x", "y"], anyIntegerMod, () => fold(Z.divide));
  wrapOperator(ce, ["Negate", "x"], anyIntegerMod, () => (ops) => {
    const x = integerModOf(ops[0]);
    return write(x === undefined ? undefined : Z.negate(x));
  });
  wrapOperator(
    ce,
    ["Power", "x", "y"],
    (ops) => isIntegerMod(ops[0]),
    () => (ops) => {
      const x = integerModOf(ops[0]);
      const e = bigIntegerAt(ops[1]);
      return write(x === undefined || e === undefined ? undefined : Z.power(x, e));
    },
  );

  // ChineseRemainder(IntegerMod(r₁, m₁), …): the class mod lcm(mᵢ) reducing to each — the
  // native (residues, moduli) form is untouched.
  widenSignature(ce, "ChineseRemainder", "(any+) -> any", (op) => op.operator === "List");
  wrapOperator(
    ce,
    ["ChineseRemainder", "x", "y"],
    (ops) => ops.every(isIntegerMod),
    () => (ops) => {
      const xs = ops.map(integerModOf);
      return xs.every((x) => x !== undefined) ? write(Z.chineseRemainder(xs)) : undefined;
    },
  );
}
