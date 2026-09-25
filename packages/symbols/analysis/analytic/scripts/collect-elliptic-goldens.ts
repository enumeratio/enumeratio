// Collect oracle values for IncompleteEllipticF/IncompleteEllipticE and for the
// complex-modulus EllipticE fix, from BOTH mpmath (ellipf/ellipe) and a Wolfram kernel.
// Same shape as collect-carlson-goldens.ts: the test suite checks our numeric evaluation
// against these pinned values, so `vp test` needs neither oracle installed; this script
// does. Requires python3 + mpmath and wolframscript on PATH. Run from the package:
//   node scripts/collect-elliptic-goldens.ts

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

// --- IncompleteEllipticF(φ, m) / IncompleteEllipticE(φ, m) --------------------------
// A spread: generic real (φ, m), φ outside [-π/2, π/2] (quasi-periodicity, DLMF 19.2.10),
// complex φ, and complex m — the two cases the native two-argument EllipticF/EllipticE
// are being trusted to already cover (see design comment in elliptic.ts).
const phiM: [Val, Val][] = [
  [0.5, 0.3],
  [1.2, 0.7],
  [-0.8, 0.4],
  [2.5, 0.3], // φ outside [-π/2, π/2]
  [-3.0, 0.6], // φ outside, negative
  [{ c: [0.3, 0.4] }, 0.5], // complex φ
  [{ c: [1.0, -0.5] }, 0.2], // complex φ
  [0.6, { c: [0.57, 0.23] }], // complex m
  [1.1, { c: [0.1, 0.9] }], // complex m
  // φ outside [-π/2, π/2] AND complex m together — the case native EllipticE gets wrong
  // (Fungrim identity c28288; see the quasi-periodicity reduction in elliptic.ts).
  [0.57 + Math.PI, { c: [0.57, 0.23] }],
  [{ c: [0.57 + Math.PI, 0.23] }, { c: [0.57, 0.23] }],
  [-3.0, { c: [0.57, 0.23] }],
  [4.5, { c: [0.1, 0.9] }],
];
for (const [phi, m] of phiM) {
  push({
    golden: {
      head: "IncompleteEllipticF",
      args: [toCE(phi), toCE(m)],
      label: `F(${label(phi)}|${label(m)})`,
      tol: 1e-11,
    },
    py: `ellipf(${toPy(phi)}, ${toPy(m)})`,
    wl: `EllipticF[${toWL(phi)}, ${toWL(m)}]`,
  });
  push({
    golden: {
      head: "IncompleteEllipticE",
      args: [toCE(phi), toCE(m)],
      label: `E(${label(phi)}|${label(m)})`,
      tol: 1e-11,
    },
    py: `ellipe(${toPy(phi)}, ${toPy(m)})`,
    wl: `EllipticE[${toWL(phi)}, ${toWL(m)}]`,
  });
}

// --- IncompleteEllipticPi(n, φ, m) --------------------------------------------------
// Same (n, φ, m) argument order and m = k² convention as mpmath's `ellippi` / Wolfram's
// `EllipticPi[n, φ, m]`. A spread: generic real, φ outside [-π/2, π/2] and past π (the
// quasi-periodicity reduction), n > 1, complex n/φ/m individually and combined — including
// the case native EllipticPi itself NaNs at (complex φ, well inside its own stated validity
// region) — and finally the region Fungrim identity 5f84d9 (quasi-periodicity) exposed the
// old carlsonRJ branch bug at: n = m = φ₀ complex, φ = φ₀ + kπ for k ≠ 0, which drives
// incompleteEllipticPi's own RJ call to a single-argument-Re<0, non-real p (see
// elliptic.ts's ellipticPiComplete / carlson.ts's carlsonRJDeclines).
const piNPhiM: [Val, Val, Val][] = [
  [0.5, 0.4, 0.3],
  [0.5, -0.4, 0.3],
  [0.5, 1.9, 0.3], // phi > pi/2
  [2.0, 0.4, 0.3], // n > 1
  [0.5, 3.5, 0.3], // phi > pi
  [0.2, 2.0, 0.5], // real, wide phi
  [0.5, 0.4, { c: [0.7, 0.2] }], // complex m
  [{ c: [0.5, 0.2] }, 0.4, 0.3], // complex n
  [0.5, { c: [0.4, 0.3] }, { c: [0.6, 0.1] }], // all complex
  [0.2, { c: [1.2, 0.5] }, 0.3], // complex phi (native NaN case)
  [0.2, { c: [2.0, 0.5] }, 0.3], // complex phi, wide re
  // Fungrim 5f84d9's quasi-periodicity region: n = m = φ₀ = 1.17+0.45i, φ shifted by kπ —
  // the exact configuration that used to send carlsonRJ's per-step sum an order of
  // magnitude off (see carlson.test.ts's RJ(0,0.7,1,p) regression).
  [{ c: [1.17, 0.45] }, { c: [1.17 + 3 * Math.PI, 0.45] }, { c: [1.17, 0.45] }],
  [{ c: [1.17, 0.45] }, { c: [1.17 - 2 * Math.PI, 0.45] }, { c: [1.17, 0.45] }],
];
for (const [n, phi, m] of piNPhiM) {
  push({
    golden: {
      head: "IncompleteEllipticPi",
      args: [toCE(n), toCE(phi), toCE(m)],
      label: `Pi(${label(n)};${label(phi)}|${label(m)})`,
      tol: 1e-9,
    },
    py: `ellippi(${toPy(n)}, ${toPy(phi)}, ${toPy(m)})`,
    wl: `EllipticPi[${toWL(n)}, ${toWL(phi)}, ${toWL(m)}]`,
  });
}

// --- EllipticE(m), complex m — the precision fix -----------------------------------
const complexM: Val[] = [
  { c: [0.57, 0.23] },
  { c: [0.1, 0.9] },
  { c: [2.0, 1.0] },
  { c: [-0.3, 0.4] },
  { c: [0.99, -0.5] },
];
for (const m of complexM) {
  push({
    golden: {
      head: "EllipticE",
      args: [toCE(m)],
      label: `E(${label(m)})`,
      tol: 1e-11,
    },
    py: `ellipe(${toPy(m)})`,
    wl: `EllipticE[${toWL(m)}]`,
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
from mpmath import mp, mpf, mpc, ellipf, ellipe, ellippi
mp.dps = 30
cases = [
${pyCases.join("\n")}
]
for k, v in cases:
    v = mpc(v)
    print(f"{k}|{v.real}|{v.imag}")
`;
const mp = parseLines(await runKernel("python3", ["-c", py], { timeoutMs: 300_000 }), Number);

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
    if (!(err <= g.tol))
      disagree.push(
        `${g.label} vs ${name}: ours=(${ours.join(", ")}) ref=(${ref.join(", ")}) relerr=${err.toExponential(2)} tol=${g.tol}`,
      );
  }
  goldens.push(g);
}

writeFileSync(new URL("../tests/elliptic.golden.json", import.meta.url), JSON.stringify(goldens, null, 2) + "\n");

console.log(
  `cases ${goldens.length}  |  oracle comparisons ${compared}  |  agree ${compared - disagree.length}  disagree ${disagree.length}`,
);
if (disagree.length) {
  console.log("\n--- DISAGREEMENTS ---");
  for (const d of disagree) console.log(d);
  process.exitCode = 1;
}
