// a⁻¹ mod m, taking the sign of m -- pure numeric kernel, no compute-engine imports.
// compute-engine's native ModularInverse already handles a positive modulus; the sign-taking
// widening in library/number-theory.ts calls inverseModSigned below.

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
export function inverseModSigned(a: bigint, m: bigint): bigint | undefined {
  if (m === 0n) return undefined;
  const n = m < 0n ? -m : m;
  if (n === 1n) return 0n;
  const [g, u] = extendedGcd(mod(a, n), n);
  if (g !== 1n) return undefined;
  const inverse = mod(u, n);
  return m < 0n && inverse !== 0n ? inverse - n : inverse;
}
