// Collect oracle values for RiemannSiegelTheta, RiemannSiegelZ and RiemannZetaZero from
// BOTH mpmath (`siegeltheta`, `siegelz`, `zetazero`) and a Wolfram kernel
// (`RiemannSiegelTheta`, `RiemannSiegelZ`, `ZetaZero`), compare them against our own
// evaluation, and write everything to tests/riemann-siegel.golden.json. Same shape as
// collect-matrix-exp-goldens.ts: `vp test` only reads the pinned JSON, so it needs
// neither oracle installed; this script does.
//
// Requires python3 + mpmath and wolframscript on PATH. Run from the package:
//   node scripts/collect-riemann-siegel-goldens.ts

import { writeFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { runKernel } from "@enumeratio/oracle/bounded";
import { declareAnalytic } from "../src/index.ts";

const ce = new ComputeEngine();
declareAnalytic(ce);

interface ThetaZCase {
  label: string;
  head: "RiemannSiegelTheta" | "RiemannSiegelZ";
  t: number;
  tol: number;
  mpmath?: number;
  wolfram?: number;
}
interface ZeroCase {
  label: string;
  k: number;
  tol: number;
  mpmath?: number; // imaginary part t_k
  wolfram?: number;
}

const thetaZCases: Omit<ThetaZCase, "mpmath" | "wolfram">[] = [
  { label: "RiemannSiegelTheta(1.5)", head: "RiemannSiegelTheta", t: 1.5, tol: 1e-10 },
  { label: "RiemannSiegelTheta(10)", head: "RiemannSiegelTheta", t: 10, tol: 1e-10 },
  { label: "RiemannSiegelTheta(0)", head: "RiemannSiegelTheta", t: 0, tol: 1e-12 },
  { label: "RiemannSiegelTheta(50)", head: "RiemannSiegelTheta", t: 50, tol: 1e-9 },
  { label: "RiemannSiegelZ(1.5)", head: "RiemannSiegelZ", t: 1.5, tol: 1e-9 },
  { label: "RiemannSiegelZ(20.5)", head: "RiemannSiegelZ", t: 20.5, tol: 1e-9 },
  { label: "RiemannSiegelZ(0)", head: "RiemannSiegelZ", t: 0, tol: 1e-9 },
  { label: "RiemannSiegelZ(100)", head: "RiemannSiegelZ", t: 100, tol: 1e-8 },
];

const zeroCases: Omit<ZeroCase, "mpmath" | "wolfram">[] = [
  { label: "RiemannZetaZero(1)", k: 1, tol: 1e-9 },
  { label: "RiemannZetaZero(2)", k: 2, tol: 1e-9 },
  { label: "RiemannZetaZero(10)", k: 10, tol: 1e-9 },
  { label: "RiemannZetaZero(50)", k: 50, tol: 1e-8 },
];

// --- our own evaluation -----------------------------------------------------------
const oursThetaZ = thetaZCases.map((c) => ce.box([c.head, c.t]).N().re as number);
const oursZero = zeroCases.map((c) => ce.box(["RiemannZetaZero", c.k]).N().im as number);

// --- mpmath -------------------------------------------------------------------------
const py = `
from mpmath import mp, siegeltheta, siegelz, zetazero
mp.dps = 30
${thetaZCases
  .map((c, i) =>
    c.head === "RiemannSiegelTheta"
      ? `print(f"tz${i}|{float(siegeltheta(${c.t}))!r}")`
      : `print(f"tz${i}|{float(siegelz(${c.t}))!r}")`,
  )
  .join("\n")}
${zeroCases.map((c, i) => `print(f"z${i}|{float(zetazero(${c.k}).imag)!r}")`).join("\n")}
`;
const mpOut = await runKernel("python3", ["-c", py], { timeoutMs: 120_000 });
const mpThetaZ = new Map<number, number>();
const mpZero = new Map<number, number>();
for (const line of mpOut.split("\n")) {
  let m = line.match(/^tz(\d+)\|(-?[\d.eE+-]+)$/);
  if (m) mpThetaZ.set(Number(m[1]), Number(m[2]));
  m = line.match(/^z(\d+)\|(-?[\d.eE+-]+)$/);
  if (m) mpZero.set(Number(m[1]), Number(m[2]));
}

// --- Wolfram --------------------------------------------------------------------------
const wlClean = (s: string): number => Number(s.replace(/`[\d.]+/g, "").replace(/\*\^/g, "e"));
const wlCode = [
  ...thetaZCases.map((c, i) => `Print["tz",${i},"|",ToString[N[${c.head}[${c.t}],20],InputForm]]`),
  ...zeroCases.map((c, i) => `Print["z",${i},"|",ToString[N[Im[ZetaZero[${c.k}]],20],InputForm]]`),
].join(";\n");
const wlOut = await runKernel("wolframscript", ["-code", wlCode], { timeoutMs: 180_000 });
const wlThetaZ = new Map<number, number>();
const wlZero = new Map<number, number>();
for (const line of wlOut.split("\n")) {
  let m = line.match(/^tz(\d+)\|(.*)$/);
  if (m) wlThetaZ.set(Number(m[1]), wlClean(m[2]));
  m = line.match(/^z(\d+)\|(.*)$/);
  if (m) wlZero.set(Number(m[1]), wlClean(m[2]));
}

// --- Compare, report, write ----------------------------------------------------------
const thetaZGoldens: ThetaZCase[] = [];
const zeroGoldens: ZeroCase[] = [];
const disagree: string[] = [];
let compared = 0;

for (const [i, c] of thetaZCases.entries()) {
  const g: ThetaZCase = { ...c };
  const m = mpThetaZ.get(i);
  const w = wlThetaZ.get(i);
  if (m !== undefined) g.mpmath = m;
  if (w !== undefined) g.wolfram = w;
  thetaZGoldens.push(g);
  for (const [name, ref] of [
    ["mpmath", g.mpmath],
    ["wolfram", g.wolfram],
  ] as const) {
    if (ref === undefined) continue;
    compared++;
    const err = Math.abs(oursThetaZ[i] - ref) / Math.max(1, Math.abs(ref));
    if (!(err <= c.tol)) disagree.push(`${c.label} vs ${name}: ours=${oursThetaZ[i]} ref=${ref}`);
  }
}
for (const [i, c] of zeroCases.entries()) {
  const g: ZeroCase = { ...c };
  const m = mpZero.get(i);
  const w = wlZero.get(i);
  if (m !== undefined) g.mpmath = m;
  if (w !== undefined) g.wolfram = w;
  zeroGoldens.push(g);
  for (const [name, ref] of [
    ["mpmath", g.mpmath],
    ["wolfram", g.wolfram],
  ] as const) {
    if (ref === undefined) continue;
    compared++;
    const err = Math.abs(oursZero[i] - ref) / Math.max(1, Math.abs(ref));
    if (!(err <= c.tol)) disagree.push(`${c.label} vs ${name}: ours=${oursZero[i]} ref=${ref}`);
  }
}

writeFileSync(
  new URL("../tests/riemann-siegel.golden.json", import.meta.url),
  JSON.stringify({ thetaZ: thetaZGoldens, zeros: zeroGoldens }, null, 2) + "\n",
);

console.log(
  `cases ${thetaZGoldens.length + zeroGoldens.length}  |  oracle comparisons ${compared}  |  agree ${compared - disagree.length}  disagree ${disagree.length}`,
);
if (disagree.length) {
  console.log("\n--- DISAGREEMENTS ---");
  for (const d of disagree) console.log(d);
  process.exitCode = 1;
}
