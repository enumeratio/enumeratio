// Collect mpmath values for the one-argument Riemann Zeta(s) at complex s — the case
// compute-engine's native Zeta declines and ours fills from ζ(s, 1) — and write them to
// tests/zeta.golden.json. The test suite checks our N() against those pinned values, so
// `vp test` doesn't need mpmath; this script does, and exits nonzero on a disagreement.
//
// Requires python3 + mpmath on PATH. Run from the package:
//   node scripts/collect-zeta-goldens.ts

import { writeFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAnalytic } from "../src/index.ts";
import { runKernel } from "@enumeratio/oracle/bounded";

const ce = new ComputeEngine();
declareAnalytic(ce);

type Pair = [number, number];

export interface ZetaGolden {
  s: Pair;
  label: string;
  /** Relative tolerance the test holds us to against mpmath. */
  tol: number;
  mpmath: Pair;
}

// On the critical line (the first zero, near it, and higher up) and off it, both sides of
// the strip and past the Re(s) < 0 reflection line.
// Every row holds to 1e-13; the worst sits near 1e-14 (high on the critical line).
const TOL = 1e-13;
const grid: Pair[] = [
  [0.5, 14],
  [0.5, 14.134725141734693], // first nontrivial zero
  [0.5, -7],
  [0.5, 30],
  [0.5, 100],
  [2, 1],
  [1, 1],
  [1, 1e-6], // next to the pole
  [0.3, 0.2],
  [1.5, 50],
  [10, 5],
  [-3, 2],
  [-0.5, -4],
  [-10, 3],
  [-25, 10],
  [-2, 40],
  [-0.5, 1e-3],
];

const py = `
from mpmath import mp, mpc, zeta
mp.dps = 30
cases = [
${grid.map(([re, im], k) => `    (${k}, zeta(mpc('${re}', '${im}'))),`).join("\n")}
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
for (const [k, s] of grid.entries()) {
  const ref = mp.get(k);
  if (!ref || !ref.every(Number.isFinite)) throw new Error(`mpmath gave no value for case ${k}`);
  const label = `ζ(${s[0]}${s[1] < 0 ? "" : "+"}${s[1]}i)`;
  const r = ce.box(["Zeta", ["Complex", ...s]]).N();
  const ours: Pair = [r.re, r.im];
  const err = relErr(ours, ref);
  if (!(err <= TOL))
    disagree.push(
      `${label}: ours=(${ours.join(", ")}) mpmath=(${ref.join(", ")}) relerr=${err.toExponential(2)}`,
    );
  goldens.push({ s, label, tol: TOL, mpmath: ref });
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
