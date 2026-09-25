// Collect mpmath values for ζ(s, a) — at a positive integer a, complex s, which
// compute-engine's native Zeta declines and ours fills from ζ(s, 1); left of Re(s) = 0,
// where the double kernel reflects or sums a Taylor series in a rather than direct-summing;
// and a few non-integer a at complex s — and write them to tests/zeta.golden.json, each as a
// pair of doubles and as 40-digit strings. The test suite checks both kernels, N() and the
// compiled real path against those pinned values, so `vp test` doesn't need mpmath; this
// script does, and exits nonzero on a disagreement.
//
// Requires python3 + mpmath on PATH. Run from the package:
//   node scripts/collect-zeta-goldens.ts

import { writeFileSync } from "node:fs";
import { runKernel } from "@enumeratio/oracle/bounded";
import { BigDecimal } from "@cortex-js/compute-engine";
import { bigCx, hurwitzZetaBig } from "../src/bigzeta.ts";
import { hurwitzZeta } from "../src/hurwitz-zeta.ts";

type Pair = [number, number];

export interface ZetaGolden {
  s: Pair;
  a: number;
  label: string;
  /** Relative tolerance the test holds us to against mpmath. */
  tol: number;
  mpmath: Pair;
  /** The same value to 40 significant digits. */
  mpmath40: [string, string];
}

// On the critical line (the first zero, near it, and higher up) and off it, both sides of
// the strip and past the Re(s) < 0 reflection line; then real s ≪ 0, a few a > 1, and
// non-integer a left of the strip, integer s among them (the kernel, not the Bernoulli form).
// Rows hold to 1e-13 unless they carry their own; the worst of those sits near 1e-14 (high on
// the critical line). Far left, each reflected ζ(s + k) in the Taylor series in a gives up a
// little to its Γ(1 − s − k), and together they come to a few parts in 1e13.
const TOL = 1e-13;
const grid: [Pair, number, number?][] = [
  [[0.5, 14], 1],
  [[0.5, 14.134725141734693], 1], // first nontrivial zero
  [[0.5, -7], 1],
  [[0.5, 30], 1],
  [[0.5, 100], 1],
  [[2, 1], 1],
  [[1, 1], 1],
  [[1, 1e-6], 1], // next to the pole
  [[0.3, 0.2], 1],
  [[1.5, 50], 1],
  [[10, 5], 1],
  [[-3, 2], 1],
  [[-0.5, -4], 1],
  [[-10, 3], 1],
  [[-25, 10], 1],
  [[-2, 40], 1],
  [[-0.5, 1e-3], 1],
  [[-3, 300], 1],
  [[-0.5, 0], 1],
  [[-3.5, 0], 1],
  [[-10.5, 0], 1],
  [[-20.5, 0], 1],
  [[-40.5, 0], 1],
  [[-151.5, 0], 1],
  [[-5.5, 0], 2],
  [[-5.5, 0], 3],
  [[-20.5, 0], 5],
  [[-3, 2], 3],
  [[-20, 0], 0.7],
  [[-21, 0], 0.5],
  [[-10.5, 0], 0.3],
  [[-2.5, 0], 0.3],
  [[-0.5, 0], 0.05],
  [[-40.5, 0], 0.4],
  [[-80.5, 0], 0.7, 1e-12],
  [[-5.5, 3], 0.5],
  [[-20.5, 3], 2.7],
  [[-10.5, 0], 7.4],
  [[-3, 0], 1.3],
  [[0.5, 14], 0.25],
  [[2, 3], 3.7],
  [[-2.5, 7], 0.75],
];

const py = `
from mpmath import mp, mpc, mpf, zeta
mp.dps = 60
cases = [
${grid.map(([[re, im], a], k) => `    (${k}, zeta(mpc('${re}', '${im}'), mpf('${a}'))),`).join("\n")}
]
for k, v in cases:
    print(f"{k}|{mp.nstr(v.real, 40, strip_zeros=False)}|{mp.nstr(v.imag, 40, strip_zeros=False)}")
`;
const out = await runKernel("python3", ["-c", py], { timeoutMs: 120_000 });
const mp = new Map<number, [string, string]>();
for (const line of out.split("\n")) {
  const m = line.match(/^(\d+)\|(.*)\|(.*)$/);
  if (m) mp.set(Number(m[1]), [m[2], m[3]]);
}

const relErr = (ours: Pair, ref: Pair): number =>
  Math.max(Math.abs(ours[0] - ref[0]), Math.abs(ours[1] - ref[1])) / Math.max(1, Math.hypot(ref[0], ref[1]));

/** Within one unit in the 39th significant digit — each side is rounded to 40. */
const agrees40 = (ours: BigDecimal, ref: string): boolean => {
  const r = new BigDecimal(ref);
  if (r.isZero()) return ours.isZero();
  return ours
    .sub(r)
    .abs()
    .lte(r.abs().mul(new BigDecimal("1e-38")));
};

const goldens: ZetaGolden[] = [];
const disagree: string[] = [];
for (const [k, [s, a, tol = TOL]] of grid.entries()) {
  const ref40 = mp.get(k);
  const ref = ref40?.map(Number) as Pair | undefined;
  if (!ref40 || !ref || !ref.every(Number.isFinite)) throw new Error(`mpmath gave no value for case ${k}`);
  const sLabel = s[1] === 0 ? `${s[0]}` : `${s[0]}${s[1] < 0 ? "" : "+"}${s[1]}i`;
  const label = a === 1 ? `ζ(${sLabel})` : `ζ(${sLabel}, ${a})`;
  const r = hurwitzZeta({ re: s[0], im: s[1] }, { re: a, im: 0 });
  const ours: Pair = [r.re, r.im];
  const err = relErr(ours, ref);
  if (!(err <= tol))
    disagree.push(`${label}: ours=(${ours.join(", ")}) mpmath=(${ref.join(", ")}) relerr=${err.toExponential(2)}`);
  const big = hurwitzZetaBig(bigCx(...s), bigCx(a), 40);
  const off40 = !big || !agrees40(big.re, ref40[0]) || !agrees40(big.im, ref40[1]);
  if (off40) disagree.push(`${label} @40: ours=(${String(big?.re)}, ${String(big?.im)}) mpmath=(${ref40.join(", ")})`);
  goldens.push({ s, a, label, tol, mpmath: ref, mpmath40: ref40 });
}

writeFileSync(new URL("../tests/zeta.golden.json", import.meta.url), JSON.stringify(goldens, null, 2) + "\n");

console.log(`cases ${goldens.length}  |  disagree ${disagree.length}`);
if (disagree.length) {
  for (const d of disagree) console.log("  " + d);
  process.exitCode = 1;
}
