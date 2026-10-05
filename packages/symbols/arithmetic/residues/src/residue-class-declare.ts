import {
  bigIntegerAt,
  bigRationalAt,
  defineMessages,
  defineOverload,
  emit,
  operandsOf,
  wrapOperator,
  type Engine,
  type Expr,
} from "@enumeratio/engine";
import { applyPatch, quotientRingCollection } from "@enumeratio/ce-patches";
import { gcd, mod } from "./arith.ts";
import { INTEGER_MOD, INTEGER_MOD_RING, QUOTIENT_RING, RESIDUE_CLASS } from "./names.ts";
import * as Z from "./residue-class.ts";
import type { Residue } from "./residue-class.ts";
import { SUMMARIES } from "@enumeratio/manifest/package/residues";

// Elements of ℤ/m are compute-engine's `ResidueClass(a, m)`, after Sage's Mod(a, m): canonical
// k in 0…m-1, equality, sums, products, inverses and powers inside one ring, ℤ/m itself as
// `QuotientRing(Integers, m)` and `\overline{k}_{m}` are all native. Classes of two moduli never
// combine. What is added here:
//
//   IntegerMod(a, m)           the old spelling, a ResidueClass
//   ResidueClass(ResidueClass(a, m), n)   for n | m: the same class, read in the smaller ring
//   ChineseRemainder(ResidueClass(r₁, m₁), …)   the class mod lcm(mᵢ)
//   a `ninv` message when a non-unit stops an inverse; `a \pmod{m}` is in latex.ts

export { INTEGER_MOD, INTEGER_MOD_RING, QUOTIENT_RING, RESIDUE_CLASS };

const isResidueClass = (expr: Expr | undefined): boolean => expr?.operator === RESIDUE_CLASS;

/** Read `ResidueClass(a, m)`, normalised. */
export function residueClassOf(expr: Expr | undefined): Residue | undefined {
  if (!isResidueClass(expr)) return undefined;
  const [a, m] = operandsOf(expr);
  const value = bigRationalAt(a);
  const modulus = bigIntegerAt(m);
  return value === undefined || modulus === undefined ? undefined : Z.residue(value[0], value[1], modulus);
}

export const residueClassExpression = (ce: Engine, x: Residue): Expr =>
  ce.function(RESIDUE_CLASS, [ce.number(x.residue), ce.number(x.modulus)]);

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

export function declareResidueClass(ce: Engine): void {
  const write = (x: Residue | undefined): Expr | undefined =>
    x === undefined ? undefined : residueClassExpression(ce, x);

  // After Wolfram's PowerMod::ninv and ChineseRemainder::nsol.
  defineMessages(ce, RESIDUE_CLASS, { ninv: "`1` is not a unit mod `2`; gcd(`1`, `2`) = `3`." });
  defineMessages(ce, "ChineseRemainder", {
    nsol: "No integer is `1` mod `2` and `3` mod `4`: gcd(`2`, `4`) = `5` does not divide their difference.",
  });
  const notUnit = (a: bigint, m: bigint): undefined => {
    const r = mod(a, m);
    emit(ce, RESIDUE_CLASS, "ninv", [r, m, gcd(r, m)]);
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

  // The old spelling reads as the class as it is canonicalised, so every rule of the native
  // arithmetic that looks for a class sees one.
  ce.declare(INTEGER_MOD, {
    description: SUMMARIES.IntegerMod,
    signature: "(any, any) -> value",
    canonical: (ops: readonly Expr[], { engine }: { engine: Engine }) => engine.function(RESIDUE_CLASS, ops),
    evaluate: (ops: readonly Expr[]) => ce.function(RESIDUE_CLASS, ops),
  });

  // ResidueClass(ResidueClass(a, m), n) for n | m -- what `a \pmod{m} \pmod{n}` parses to --
  // is the same class in the smaller ring. A rational with no inverse says why it declines.
  wrapOperator(
    ce,
    [RESIDUE_CLASS],
    () => true,
    (native) => (ops, options) => {
      const inner = residueClassOf(ops[0]);
      const n = bigIntegerAt(ops[1]);
      if (inner !== undefined && n !== undefined && n >= 1n && inner.modulus % n === 0n) {
        return write({ residue: mod(inner.residue, n), modulus: n });
      }
      const answer = native?.(ops, options);
      // Native hands the call back when it declines.
      if (answer !== undefined && !isResidueClass(answer)) return answer;
      const r = bigRationalAt(ops[0]);
      return r !== undefined && n !== undefined && n >= 1n && Z.residue(r[0], r[1], n) === undefined
        ? notUnit(r[1], n)
        : answer;
    },
    2,
  );

  // ℤ/m is compute-engine's QuotientRing(Integers, m); the patch makes Count exact past 2^53.
  // IntegerModRing(m), the old spelling, evaluates to it.
  applyPatch(ce, quotientRingCollection);
  ce.declare(INTEGER_MOD_RING, {
    description: SUMMARIES.IntegerModRing,
    signature: "(integer) -> set",
    evaluate: (ops: readonly Expr[]) => ce.function(QUOTIENT_RING, [ce.symbol("Integers"), ops[0]!]),
  });

  // The native arithmetic declines an inverse of a non-unit, silently; these rows only say why.
  // Mixed moduli decline without a word, as they do natively.
  defineOverload(ce, "Divide", {
    package: "residues",
    on: [RESIDUE_CLASS],
    arity: 2,
    evaluate: (ops) => {
      const y = residueClassOf(ops[1]);
      if (y === undefined || bigRationalAt(ops[0]) === undefined) return undefined;
      return gcd(y.residue, y.modulus) === 1n ? undefined : notUnit(y.residue, y.modulus);
    },
  });
  defineOverload(ce, "Power", {
    package: "residues",
    on: [RESIDUE_CLASS],
    arity: 2,
    when: (ops) => isResidueClass(ops[0]),
    evaluate: (ops) => {
      const x = residueClassOf(ops[0]);
      const e = bigIntegerAt(ops[1]);
      if (x === undefined || e === undefined || e >= 0n) return undefined;
      return gcd(x.residue, x.modulus) === 1n ? undefined : notUnit(x.residue, x.modulus);
    },
  });

  // ChineseRemainder(ResidueClass(r₁, m₁), …): the class mod lcm(mᵢ) reducing to each — the
  // native (residues, moduli) form is untouched.
  defineOverload(ce, "ChineseRemainder", {
    package: "residues",
    signature: "(value+) -> value",
    on: [RESIDUE_CLASS],
    native: (op) => op.operator === "List",
    when: (ops) => ops.every(isResidueClass),
    evaluate: (ops) => {
      const xs = ops.map(residueClassOf);
      if (!xs.every((x) => x !== undefined)) return undefined;
      return write(Z.chineseRemainder(xs)) ?? inconsistent(xs.map((x) => [x.residue, x.modulus]));
    },
  });
  // The native (residues, moduli) form declines an inconsistent system silently.
  const integers = (op: Expr | undefined): bigint[] | undefined => {
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
    (ops) => integers(ops[0]) !== undefined && integers(ops[1]) !== undefined && bigIntegerAt(ops[2]) !== undefined,
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
