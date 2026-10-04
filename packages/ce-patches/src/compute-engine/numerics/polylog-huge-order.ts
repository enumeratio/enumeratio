// Liₛ(z) for |z| > 1 at a large real order s. No imports and no free variables: the compiled
// JavaScript lane embeds this function's source (library/special-functions.ts), so it must
// run on its own.
//
// Liₛ(z) = z·Φ(z, s, 1), and for z outside [1, ∞) the Lerch integral (DLMF 25.14.1)
//   Φ(z, s, 1) = 1/Γ(s) ∫₀^∞ tˢ⁻¹ e⁻ᵗ / (1 − z e⁻ᵗ) dt
// splits after N geometric terms into the first N terms of the series plus a remainder
//   |Liₛ(z) − Σ_{n≤N} zⁿ/nˢ| ≤ |z|^{N+1} / ((N+1)ˢ · δ),
// δ = distance from 1 to the segment [0, z]. So at large s the partial sum is Liₛ(z) itself
// once the next term is negligible; the truncated series diverges at larger n, but the
// remainder bound above is exact for the terms taken. native compute-engine instead
// inverts z → 1/z (DLMF 25.12.4) and forms (2π)ˢ/s!, which overflows past s = 170
// (Li₂₅₀(4) comes out −0.25, not 4) and does O(s²) bignum work for the Bernoulli polynomial.
//
// On the cut z > 1 (δ = 0) the integral has a pole at t = ln z: the value is the principal
// part plus Im Liₛ(z) = −π (ln z)ˢ⁻¹/Γ(s) (below-the-cut, mpmath's convention). That term
// is returned as the imaginary part, and the kernel declines when it is not negligible.

/** `{ re, im }` of Liₛ(z), or undefined where this kernel cannot vouch for its digits
 * (|z| ≤ 1, a small or non-real order, or no convergence within the term cap). */
export const polyLogHugeOrder = (s: number, zRe: number, zIm: number): { re: number; im: number } | undefined => {
  // The next term is below this fraction of the sum, after dividing by δ.
  const NEGLIGIBLE = 2 ** -60;
  // Li₂(−1.01) takes ~1e3 terms; past this cap the order is not "large" and native answers.
  const MAX_TERMS = 200;
  // On the cut, (ln z)ˢ⁻¹/Γ(s) must be below this: Li₃₀(1e9) has it near 1e7 and is declined.
  const CUT_TAIL = 1e-20;

  const abs = Math.hypot(zRe, zIm);
  if (!(s > 0) || !Number.isFinite(s + abs) || !(abs > 1)) return undefined;

  // ln Γ(x), Stirling past a shift to x ≥ 8 (DLMF 5.11.1): ~1e-10, enough for a magnitude test.
  const lnGamma = (x: number): number => {
    let shift = 0;
    for (; x < 8; x += 1) shift += Math.log(x);
    return (x - 0.5) * Math.log(x) - x + 0.5 * Math.log(2 * Math.PI) + 1 / (12 * x) - 1 / (360 * x ** 3) - shift;
  };

  const onCut = zIm === 0 && zRe > 1;
  let delta = 1;
  let cutIm = 0;
  if (onCut) {
    const lnTail = (s - 1) * Math.log(Math.log(abs)) - lnGamma(s);
    if (lnTail > Math.log(CUT_TAIL)) return undefined;
    cutIm = -Math.PI * Math.exp(lnTail);
  } else {
    const along = Math.min(1, Math.max(0, zRe / (abs * abs)));
    delta = Math.hypot(1 - along * zRe, along * zIm);
  }

  const lnAbs = Math.log(abs);
  const arg = Math.atan2(zIm, zRe);
  // The n = 1 term is z itself, taken exactly (exp∘ln would cost it ~1e-14 at |z| = 1e100).
  const term = (n: number): number => (n === 1 ? abs : Math.exp(n * lnAbs - s * Math.log(n)));
  let re = 0;
  let im = 0;
  for (let n = 1; n <= MAX_TERMS; n++) {
    const t = term(n);
    if (zIm === 0) {
      re += zRe < 0 && n % 2 === 1 ? -t : t; // zⁿ real: no sin(nπ) rounding in the imaginary part
    } else {
      re += t * (n === 1 ? zRe / abs : Math.cos(n * arg));
      im += t * (n === 1 ? zIm / abs : Math.sin(n * arg));
    }
    if (!Number.isFinite(re + im)) return undefined;
    if (term(n + 1) / delta <= NEGLIGIBLE * Math.hypot(re, im)) return { re, im: im + cutIm };
  }
  return undefined;
};
