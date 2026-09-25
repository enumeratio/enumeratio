import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  bigIntegerAt,
  bigRationalAt,
  defineMessages,
  emit,
  operandsOf,
  symbolNameOf,
  widenSignature,
  wrapOperator,
} from "@enumeratio/boxed";
import { gcd, mod } from "./arith.ts";
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

/** The first two congruences no integer satisfies together, with the gcd that rules it out. */
export function clash(
  xs: readonly (readonly [bigint, bigint])[],
): [readonly [bigint, bigint], readonly [bigint, bigint], bigint] | undefined {
  for (const [i, x] of xs.entries()) {
    for (const y of xs.slice(i + 1)) {
      const g = gcd(x[1], y[1]);
      if (mod(x[0] - y[0], g) !== 0n) return [x, y, g];
    }
  }
  return undefined;
}

export function declareIntegerMod(ce: ComputeEngine): void {
  const write = (x: IntegerMod | undefined): BoxedExpression | undefined =>
    x === undefined ? undefined : integerModExpression(ce, x);

  // After Wolfram's PowerMod::ninv and ChineseRemainder::nsol.
  defineMessages(ce, INTEGER_MOD, { ninv: "`1` is not a unit mod `2`; gcd(`1`, `2`) = `3`." });
  defineMessages(ce, "ChineseRemainder", {
    nsol: "No integer is `1` mod `2` and `3` mod `4`: gcd(`2`, `4`) = `5` does not divide their difference.",
  });
  const notUnit = (a: bigint, m: bigint): undefined => {
    const r = mod(a, m);
    emit(ce, INTEGER_MOD, "ninv", [r, m, gcd(r, m)]);
    return undefined;
  };
  const inconsistent = (xs: readonly (readonly [bigint, bigint])[]): undefined => {
    const found = clash(xs);
    if (found !== undefined) {
      const [[r1, m1], [r2, m2], g] = found;
      emit(ce, "ChineseRemainder", "nsol", [r1, m1, r2, m2, g]);
    }
    return undefined;
  };

  // Evaluating the constructor normalises into [0, m), and declines a non-unit denominator.
  ce.declare(INTEGER_MOD, {
    description: "a mod m as an element of ℤ/m; a rational a = u/v reads as u·v⁻¹.",
    signature: "(any, integer) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      // IntegerMod(IntegerMod(a, m), n) for n | m: the same class, read in the smaller ring
      // -- what `a \pmod{m} + b \pmod{m}` parses to.
      const inner = integerModOf(ops[0]);
      const n = bigIntegerAt(ops[1]);
      if (inner !== undefined && n !== undefined && n >= 1n && inner.modulus % n === 0n) {
        return write({ residue: mod(inner.residue, n), modulus: n });
      }
      const x = integerModOf(ce.function(INTEGER_MOD, ops));
      if (x !== undefined) return write(x);
      const r = bigRationalAt(ops[0]);
      const m = bigIntegerAt(ops[1]);
      return r !== undefined && m !== undefined && m >= 1n ? notUnit(r[1], m) : undefined;
    },
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
    2,
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
  wrapOperator(
    ce,
    ["Divide", "x", "y"],
    anyIntegerMod,
    () =>
      fold((x, y) => {
        const q = Z.divide(x, y);
        return q ?? notUnit(y.residue, gcd(x.modulus, y.modulus));
      }),
    2,
  );
  wrapOperator(
    ce,
    ["Negate", "x"],
    anyIntegerMod,
    () => (ops) => {
      const x = integerModOf(ops[0]);
      return write(x === undefined ? undefined : Z.negate(x));
    },
    1,
  );
  wrapOperator(
    ce,
    ["Power", "x", "y"],
    (ops) => isIntegerMod(ops[0]),
    () => (ops) => {
      const x = integerModOf(ops[0]);
      const e = bigIntegerAt(ops[1]);
      if (x === undefined || e === undefined) return undefined;
      return write(Z.power(x, e) ?? notUnit(x.residue, x.modulus));
    },
    2,
  );

  // ChineseRemainder(IntegerMod(r₁, m₁), …): the class mod lcm(mᵢ) reducing to each — the
  // native (residues, moduli) form is untouched.
  widenSignature(ce, "ChineseRemainder", "(any+) -> any", (op) => op.operator === "List");
  wrapOperator(
    ce,
    ["ChineseRemainder", "x", "y"],
    // `ops.every` is vacuously true on an empty call — guard the arity explicitly rather
    // than let a zero-argument ChineseRemainder() slip through as "every IntegerMod".
    (ops) => ops.length > 0 && ops.every(isIntegerMod),
    () => (ops) => {
      const xs = ops.map(integerModOf);
      if (!xs.every((x) => x !== undefined)) return undefined;
      return write(Z.chineseRemainder(xs)) ?? inconsistent(xs.map((x) => [x.residue, x.modulus]));
    },
  );
  // The native (residues, moduli) form declines an inconsistent system silently.
  const integers = (op: BoxedExpression | undefined): bigint[] | undefined => {
    if (op?.operator !== "List") return undefined;
    const xs = operandsOf(op).map(bigIntegerAt);
    return xs.every((x) => x !== undefined) ? xs : undefined;
  };
  wrapOperator(
    ce,
    ["ChineseRemainder", "x", "y"],
    (ops) => integers(ops[0]) !== undefined && integers(ops[1]) !== undefined,
    (native) => (ops, options) => {
      const answer = native?.(ops, options);
      if (answer !== undefined) return answer;
      const [rs, ms] = [integers(ops[0])!, integers(ops[1])!];
      return rs.length === ms.length && ms.every((m) => m >= 1n)
        ? inconsistent(rs.map((r, i) => [r, ms[i]!]))
        : undefined;
    },
    2,
  );
  // Wolfram's ChineseRemainder[rs, ms, d]: the smallest solution x ≥ d, rather than the least
  // non-negative one. Solutions repeat with period lcm(ms).
  wrapOperator(
    ce,
    ["ChineseRemainder", "x", "y"],
    (ops) =>
      integers(ops[0]) !== undefined &&
      integers(ops[1]) !== undefined &&
      bigIntegerAt(ops[2]) !== undefined,
    (native) => (ops, options) => {
      const [ms, d] = [integers(ops[1]), bigIntegerAt(ops[2])];
      if (ms === undefined || d === undefined || !ms.every((m) => m >= 1n)) return undefined;
      const x = bigIntegerAt(native?.(ops.slice(0, 2), options));
      if (x === undefined) return undefined;
      const period = ms.reduce((a, b) => (a * b) / gcd(a, b), 1n);
      const gap = d - x;
      const steps = gap >= 0n ? (gap + period - 1n) / period : -(-gap / period); // ⌈gap/period⌉
      return ce.number(x + steps * period);
    },
    3,
  );
}
