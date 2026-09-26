// Collect oracle values for the twelve Jacobi `pq` functions, JacobiAmplitude and
// JacobiZN from BOTH mpmath (ellipfun) and a Wolfram kernel. Same shape as
// collect-elliptic-goldens.ts: the test suite checks our numeric evaluation against
// these pinned values, so `vp test` needs neither oracle installed; this script does.
// Requires python3 + mpmath and wolframscript on PATH. Run from the package:
//   node scripts/collect-jacobi-elliptic-goldens.ts

import { writeFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAnalytic } from "../src/index.ts";
import { runKernel } from "@enumeratio/oracle/bounded";

const ce = new ComputeEngine();
declareAnalytic(ce);

type Val = number | { c: [number, number] };
type Pair = [number, number];

interface GoldenCase {
  head: string;
  args: unknown[];
  label: string;
  tol: number;
  mpmath?: Pair;
  wolfram?: Pair;
}

const toCE = (v: Val): unknown => (typeof v === "number" ? v : ["Complex", ...v.c]);
const toPy = (v: Val): string => (typeof v === "number" ? `mpf('${v}')` : `mpc('${v.c[0]}','${v.c[1]}')`);
const toWL = (v: Val): string => (typeof v === "number" ? String(v) : `(${v.c[0]} + (${v.c[1]})*I)`);
const label = (v: Val): string => (typeof v === "number" ? String(v) : `${v.c[0]}${v.c[1] < 0 ? "" : "+"}${v.c[1]}i`);

interface Pending {
  golden: GoldenCase;
  py?: string;
  wl?: string;
}
const pending: Pending[] = [];
const push = (p: Pending): void => void pending.push(p);

// --- JacobiSN/CN/DN(u,m) -------------------------------------------------------------
// A spread: generic real (u,m) with m in [0,1], m > 1 (reciprocal-modulus), m < 0
// (imaginary-modulus), and complex u crossed with each of those three m ranges — the
// exact matrix jacobi-elliptic.ts's file header claims coverage for. Complex u is
// spread across all four quadrants, large |Im u|, and close to sn's pole at u = iK'(m)
// (coordinator review of B-55: the earlier complex-u kernel — carrying the AGM/amplitude
// recursion itself in complex arithmetic — lost precision there down to ~1e-12 relative;
// jacobi-elliptic.ts now uses DLMF 22.8's real addition formulas instead, verified
// against mpmath to ~1e-14 relative everywhere in this spread, poles included).
const uM: [Val, Val][] = [
  [0.3, 0.5],
  [1.1, 0.9],
  [-0.7, 0.2],
  [0.3, 0.0],
  [0.3, 1.0],
  [0.3, 1.5], // m > 1
  [1.2, 3.0], // m > 1
  [0.3, -2.0], // m < 0
  [0.9, -0.5], // m < 0
  // Complex u, all four quadrants, m in [0,1].
  [{ c: [0.4, 0.5] }, 0.3],
  [{ c: [0.4, -0.5] }, 0.3],
  [{ c: [-0.4, 0.5] }, 0.3],
  [{ c: [-0.4, -0.5] }, 0.3],
  [{ c: [0.3, 0.4] }, 0.5],
  [{ c: [1.1, -0.7] }, 0.3],
  [{ c: [1.0, 1.0] }, 0.3], // the exact case coordinator review flagged
  // Large |Im u|, and large Re AND Im together.
  [{ c: [0.2, 8.0] }, 0.4],
  [{ c: [0.2, -8.0] }, 0.4],
  [{ c: [5.0, 4.0] }, 0.6],
  // Close to sn's pole at u = i*K'(m) = i*K(1-m) (K'(0.3) ≈ 2.07536313529...).
  [{ c: [0.05, 1.9753631352924692] }, 0.3], // ~0.1 short of the pole
  [{ c: [0.05, 2.0653631352924693] }, 0.3], // ~0.01 short
  [{ c: [0.05, 2.074363135292469] }, 0.3], // ~0.001 short
  [{ c: [0.05, 2.075263135292469] }, 0.3], // ~0.0001 short
  // Complex u, m outside [0,1] (via the reciprocal-/imaginary-modulus transforms).
  [{ c: [0.3, 0.2] }, 1.5], // complex u, m > 1
  [{ c: [0.5, -0.3] }, 3.0], // complex u, m > 1
  [{ c: [0.3, 0.2] }, -0.7], // complex u, m < 0
  [{ c: [0.5, -0.3] }, -3.0], // complex u, m < 0
];
for (const [u, m] of uM) {
  // A near-pole case's reference value is itself huge (tens in magnitude); `relErr`
  // below already floors its denominator at 1, so this is really an absolute-near-zero /
  // relative-elsewhere hybrid throughout — 1e-13 leaves a ~10x safety margin over the
  // ~9e-15 worst case measured right at the closest pole approach in this spread.
  for (const kind of ["sn", "cn", "dn"] as const) {
    push({
      golden: {
        head: `Jacobi${kind.toUpperCase()}`,
        args: [toCE(u), toCE(m)],
        label: `${kind}(${label(u)},${label(m)})`,
        tol: 1e-13,
      },
      py: `ellipfun('${kind}', u=${toPy(u)}, m=${toPy(m)})`,
      wl: `Jacobi${kind.toUpperCase()}[${toWL(u)}, ${toWL(m)}]`,
    });
  }
}

// --- A few quotient heads directly (ratios of sn/cn/dn, but checked end-to-end) -----
// `letters` are the two Glaisher pq letters (numerator, denominator); `n` = 1 stands
// for the reciprocal reference function.
const quotientCases: [string, ["s" | "c" | "d" | "n", "s" | "c" | "d" | "n"], Val, Val][] = [
  ["JacobiCD", ["c", "d"], 0.3, 0.5],
  ["JacobiNS", ["n", "s"], 0.3, 0.5],
  ["JacobiSC", ["s", "c"], 0.6, 0.4],
  ["JacobiDC", ["d", "c"], 0.6, 0.4],
  ["JacobiCS", ["c", "s"], 1.1, 0.9],
  ["JacobiDS", ["d", "s"], 1.1, 0.9],
  ["JacobiNC", ["n", "c"], 0.3, 1.5],
  ["JacobiND", ["n", "d"], 0.3, -2.0],
  ["JacobiSD", ["s", "d"], 0.3, -2.0],
  // Complex u, exercising the same DLMF 22.8 addition-formula combination as sn/cn/dn.
  ["JacobiCD", ["c", "d"], { c: [0.4, 0.5] }, 0.3],
  ["JacobiNS", ["n", "s"], { c: [0.4, -0.5] }, 0.3],
];
const pyFun = (letter: "s" | "c" | "d" | "n", u: Val, m: Val): string =>
  letter === "n" ? "1" : `ellipfun('${letter}n', u=${toPy(u)}, m=${toPy(m)})`;
for (const [head, [p, q], u, m] of quotientCases) {
  push({
    golden: { head, args: [toCE(u), toCE(m)], label: `${head}(${label(u)},${label(m)})`, tol: 1e-13 },
    py: `(${pyFun(p, u, m)}) / (${pyFun(q, u, m)})`,
    wl: `${head}[${toWL(u)}, ${toWL(m)}]`,
  });
}

// --- JacobiAmplitude(u,m) / JacobiZN(u,m), m in [0,1] only --------------------------
// Complex u for JacobiAmplitude (JacobiZN stays real-u only — see jacobi-elliptic.ts):
// am(u,m) = -i*Log(cn(u,m) + i*sn(u,m)), using the same now-accurate complex sn/cn, is
// checked directly against Wolfram's own JacobiAmplitude here (mpmath has no equivalent).
const amplitudeUM: [Val, Val][] = [
  [0.3, 0.5],
  [1.1, 0.9],
  [-0.7, 0.2],
  [2.5, 0.3],
  [{ c: [1.0, 1.0] }, 0.3],
  [{ c: [0.1, 5.0] }, 0.4], // large Im
];
for (const [u, m] of amplitudeUM) {
  // mpmath has no direct amplitude function; checked against a Wolfram kernel, which HAS
  // JacobiAmplitude directly.
  push({
    golden: { head: "JacobiAmplitude", args: [toCE(u), toCE(m)], label: `am(${label(u)},${label(m)})`, tol: 1e-12 },
    wl: `JacobiAmplitude[${toWL(u)}, ${toWL(m)}]`,
  });
}
const znUM: [Val, Val][] = [
  [0.3, 0.5],
  [1.1, 0.9],
  [-0.7, 0.2],
  [2.5, 0.3],
];
for (const [u, m] of znUM) {
  push({
    golden: { head: "JacobiZN", args: [toCE(u), toCE(m)], label: `zn(${label(u)},${label(m)})`, tol: 1e-12 },
    wl: `JacobiZN[${toWL(u)}, ${toWL(m)}]`,
  });
}

// --- Run the oracles --------------------------------------------------------------
const parseLines = (out: string, clean: (s: string) => number): Map<number, Pair> => {
  const got = new Map<number, Pair>();
  for (const line of out.split("\n")) {
    const m = line.match(/^(\d+)\|(.*)\|(.*)$/);
    if (m) got.set(Number(m[1]), [clean(m[2]), clean(m[3])]);
  }
  return got;
};

const pyCases = pending.map((p, k) => (p.py ? `    (${k}, ${p.py}),` : "")).filter(Boolean);
const py = `
from mpmath import mp, mpf, mpc, ellipfun
mp.dps = 30
cases = [
${pyCases.join("\n")}
]
for k, v in cases:
    v = mpc(v)
    print(f"{k}|{v.real}|{v.imag}")
`;
const mp =
  pyCases.length > 0 ? parseLines(await runKernel("python3", ["-c", py], { timeoutMs: 300_000 }), Number) : new Map();

const wlCode = pending
  .map((p, k) =>
    p.wl ? `With[{v=N[${p.wl}, 25]},Print[${k},"|",ToString[Re[v],InputForm],"|",ToString[Im[v],InputForm]]]` : "",
  )
  .filter(Boolean)
  .join(";\n");
const wlClean = (s: string): number => Number(s.replace(/`[\d.]+/g, "").replace(/\*\^/g, "e"));
const wl = parseLines(await runKernel("wolframscript", ["-code", wlCode], { timeoutMs: 300_000 }), wlClean);

// --- Compare, report, write --------------------------------------------------------
const relErr = (ours: Pair, ref: Pair): number =>
  Math.max(Math.abs(ours[0] - ref[0]), Math.abs(ours[1] - ref[1])) / Math.max(1, Math.hypot(ref[0], ref[1]));

const goldens: GoldenCase[] = [];
const disagree: string[] = [];
let compared = 0;
for (const [k, p] of pending.entries()) {
  const g = p.golden;
  const m = mp.get(k);
  const w = wl.get(k);
  if (m && m.every(Number.isFinite)) g.mpmath = m;
  if (w && w.every(Number.isFinite)) g.wolfram = w;
  const r = ce.box([g.head, ...g.args] as never).N();
  const ours: Pair = [r.re, r.im];
  for (const [name, ref] of [
    ["mpmath", g.mpmath],
    ["wolfram", g.wolfram],
  ] as const) {
    if (!ref) continue;
    compared++;
    const err = relErr(ours, ref);
    if (!(err <= g.tol)) {
      disagree.push(
        `${g.label} vs ${name}: ours=(${ours.join(", ")}) ref=(${ref.join(", ")}) relerr=${err.toExponential(2)} tol=${g.tol}`,
      );
    }
  }
  goldens.push(g);
}

writeFileSync(
  new URL("../tests/jacobi-elliptic.golden.json", import.meta.url),
  JSON.stringify(goldens, null, 2) + "\n",
);

console.log(
  `cases ${goldens.length}  |  oracle comparisons ${compared}  |  agree ${compared - disagree.length}  disagree ${disagree.length}`,
);
if (disagree.length) {
  console.log("\n--- DISAGREEMENTS ---");
  for (const d of disagree) console.log(d);
  process.exitCode = 1;
}
