import { bigIntegerAt, mayBeInteger, widenSignature, wrapOperator } from "@enumeratio/boxed";
import type { Patch } from "../patch.ts";

// cortex-js/compute-engine#339, PR #347. Only the ModularInverse sign fix lives here. The
// FactorInteger, Divisors and MultiplicativeOrder wrappers run on residues' factoriser,
// which other residues heads share, so they stay in number-theory and residues. Once #347
// lands, check whether they are still needed.

/** [g, u] with u*a + (something)*m = g = gcd(a, m). Extended Euclidean, no factoring. */
function extendedGcd(a: bigint, m: bigint): [bigint, bigint] {
  let [oldR, r] = [a, m];
  let [oldU, u] = [1n, 0n];
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldU, u] = [u, oldU - q * u];
  }
  return oldR < 0n ? [-oldR, -oldU] : [oldR, oldU];
}

const mod = (a: bigint, m: bigint): bigint => ((a % m) + m) % m;

/** a⁻¹ mod m for m ≠ 0, taking the sign of m the way Wolfram's ModularInverse does. */
function inverseModSigned(a: bigint, m: bigint): bigint | undefined {
  if (m === 0n) return undefined;
  const n = m < 0n ? -m : m;
  if (n === 1n) return 0n;
  const [g, u] = extendedGcd(mod(a, n), n);
  if (g !== 1n) return undefined;
  const inverse = mod(u, n);
  return m < 0n && inverse !== 0n ? inverse - n : inverse;
}

export const numberTheoryLargeIntegers: Patch = {
  id: "number-theory-large-integers",
  issue: "https://github.com/cortex-js/compute-engine/issues/339",
  pr: "https://github.com/cortex-js/compute-engine/pull/347",
  lands: "ModularInverse's handling of a negative modulus (the sign-taking convention only)",

  fixed: (ce) => bigIntegerAt(ce.box(["ModularInverse", 3, -7]).evaluate()) === -2n,

  apply: (ce) => {
    widenSignature(ce, "ModularInverse", "(value, value) -> value", mayBeInteger);
    wrapOperator(
      ce,
      ["ModularInverse", 1, 1],
      (ops) => {
        const m = bigIntegerAt(ops[1]);
        return m !== undefined && m < 0n && bigIntegerAt(ops[0]) !== undefined;
      },
      () => (ops) => {
        const a = bigIntegerAt(ops[0])!;
        const m = bigIntegerAt(ops[1])!;
        const inverse = inverseModSigned(a, m);
        return inverse === undefined ? undefined : ce.number(inverse);
      },
      2,
    );
  },
};
