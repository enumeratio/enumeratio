// Collect mpmath values for ζ(s, a) at a positive integer a — complex s, which
// compute-engine's native Zeta declines and ours fills from ζ(s, 1), and real s left of
// Re(s) = 0, where the kernel reflects rather than direct-summing — and write them to
// tests/zeta.golden.json. The test suite checks the kernel, N() and the compiled real path
// against those pinned values, so `vp test` doesn't need mpmath; this script does, and
// exits nonzero on a disagreement.
//
// Requires python3 + mpmath on PATH. Run from the package:
//   node scripts/collect-zeta-goldens.ts

import { writeFileSync } from "node:fs";
import { runKernel } from "@enumeratio/oracle/bounded";
import { hurwitzZeta } from "../src/hurwitz-zeta.ts";

type Pair = [number, number];

export interface ZetaGolden {
  s: Pair;
  a: number;
  label: string;
  /** Relative tolerance the test holds us to against mpmath. */
  tol: number;
  mpmath: Pair;
}

// On the critical line (the first zero, near it, and higher up) and off it, both sides of
// the strip and past the Re(s) < 0 reflection line; then real s ≪ 0, and a few a > 1.
// Every row holds to 1e-13; the worst sits near 1e-14 (high on the critical line).
const TOL = 1e-13;
const grid: [Pair, number][] = [
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
];

const py = `
from mpmath import mp, mpc, zeta
mp.dps = 30
cases = [
${grid.map(([[re, im], a], k) => `    (${k}, zeta(mpc('${re}', '${im}'), ${a})),`).join("\n")}
]
for k, v in cases:
    print(f"{k}|{v.real}|{v.imag}")
`;
const out = await runKernel("python3", ["-c", py], { timeoutMs: 120_000 });
const mp = new Map<number, Pair>();
for (const line of out.split("\n")) {
  const m = line.match(/^(\d+)\|(.*)\|(.*)$/);
  if (m) mp.set(Number(m[1]), [Number(m[2]), Number(m[3])]);
}

const relErr = (ours: Pair, ref: Pair): number =>
  Math.max(Math.abs(ours[0] - ref[0]), Math.abs(ours[1] - ref[1])) /
  Math.max(1, Math.hypot(ref[0], ref[1]));

const goldens: ZetaGolden[] = [];
const disagree: string[] = [];
for (const [k, [s, a]] of grid.entries()) {
  const ref = mp.get(k);
  if (!ref || !ref.every(Number.isFinite)) throw new Error(`mpmath gave no value for case ${k}`);
  const sLabel = s[1] === 0 ? `${s[0]}` : `${s[0]}${s[1] < 0 ? "" : "+"}${s[1]}i`;
  const label = a === 1 ? `ζ(${sLabel})` : `ζ(${sLabel}, ${a})`;
  const r = hurwitzZeta({ re: s[0], im: s[1] }, { re: a, im: 0 });
  const ours: Pair = [r.re, r.im];
  const err = relErr(ours, ref);
  if (!(err <= TOL))
    disagree.push(
      `${label}: ours=(${ours.join(", ")}) mpmath=(${ref.join(", ")}) relerr=${err.toExponential(2)}`,
    );
  goldens.push({ s, a, label, tol: TOL, mpmath: ref });
}

writeFileSync(
  new URL("../tests/zeta.golden.json", import.meta.url),
  JSON.stringify(goldens, null, 2) + "\n",
);

console.log(`cases ${goldens.length}  |  disagree ${disagree.length}`);
if (disagree.length) {
  for (const d of disagree) console.log("  " + d);
  process.exitCode = 1;
}
