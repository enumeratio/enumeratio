// Collect oracle values for the two elementary/special heads that carry a real numeric
// kernel of our own — Gudermannian (Math.atan(Math.sinh(x))) and Hyperfactorial
// (exp(z·lnΓ(z+1) − lnG(z+1)), off the integers) — from BOTH mpmath and a Wolfram kernel,
// and write them to tests/elementary.golden.json. `vp test` only reads the pinned JSON, so
// it needs neither oracle installed; this script does.
//
// The other seven backlog heads (CubeRoot, IntegerPart, FractionalPart, RealAbs, RealSign,
// UnitStep) reduce to a native compute-engine head (Root, Abs, Sign) or exact
// truncation/comparison arithmetic — no independent numeric kernel of their own to
// cross-check, so they are not golden-tested here (same as Csgn, XGCD, FallingFactorial…).
//
// Requires python3 + mpmath and wolframscript on PATH. Run from the package:
//   node scripts/collect-elementary-goldens.ts

import { writeFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { runKernel } from "@enumeratio/oracle/bounded";
import { declareAnalytic } from "../src/index.ts";

const ce = new ComputeEngine();
declareAnalytic(ce);

interface GoldenCase {
  head: "Gudermannian" | "Hyperfactorial";
  arg: number;
  label: string;
  tol: number;
  mpmath?: number;
  wolfram?: number;
}

const cases: { head: GoldenCase["head"]; arg: number; label: string; tol: number }[] = [
  { head: "Gudermannian", arg: 0.5, label: "gd(0.5)", tol: 1e-12 },
  { head: "Gudermannian", arg: 1.5, label: "gd(1.5)", tol: 1e-12 },
  { head: "Gudermannian", arg: 3, label: "gd(3)", tol: 1e-12 },
  { head: "Gudermannian", arg: -2.25, label: "gd(-2.25)", tol: 1e-12 },
  { head: "Hyperfactorial", arg: 0.5, label: "H(0.5)", tol: 1e-11 },
  { head: "Hyperfactorial", arg: 1.5, label: "H(1.5)", tol: 1e-11 },
  { head: "Hyperfactorial", arg: 2.5, label: "H(2.5)", tol: 1e-11 },
  { head: "Hyperfactorial", arg: 6.25, label: "H(6.25)", tol: 1e-10 },
];

// --- mpmath --------------------------------------------------------------------------
const py = `
from mpmath import mp, mpf, atan, sinh, gamma, barnesg
mp.dps = 30
cases = [
${cases.map((c, k) => `    (${k}, "${c.head}", mpf("${c.arg}")),`).join("\n")}
]
for k, head, x in cases:
    if head == "Gudermannian":
        r = atan(sinh(x))
    else:
        r = gamma(x + 1) ** x / barnesg(x + 1)
    print(f"{k}|{r}")
`;
const parseLines = (out: string): Map<number, number> => {
  const got = new Map<number, number>();
  for (const line of out.split("\n")) {
    const m = line.match(/^(\d+)\|(.*)$/);
    if (!m) continue;
    got.set(Number(m[1]), Number(m[2]));
  }
  return got;
};
const mp = parseLines(await runKernel("python3", ["-c", py], { timeoutMs: 120_000 }));

// --- Wolfram ---------------------------------------------------------------------------
const wlCode = cases
  .map((c, k) => `Print[${k},"|",ToString[N[${c.head}[${c.arg}],20],InputForm]]`)
  .join(";\n");
const wlClean = (s: string): number => Number(s.replace(/`[\d.]+/g, "").replace(/\*\^/g, "e"));
const parseWlLines = (out: string): Map<number, number> => {
  const got = new Map<number, number>();
  for (const line of out.split("\n")) {
    const m = line.match(/^(\d+)\|(.*)$/);
    if (!m) continue;
    got.set(Number(m[1]), wlClean(m[2]));
  }
  return got;
};
const wl = parseWlLines(
  await runKernel("wolframscript", ["-code", wlCode], { timeoutMs: 120_000 }),
);

// --- Compare, report, write ------------------------------------------------------------
const goldens: GoldenCase[] = [];
const disagree: string[] = [];
let compared = 0;
for (const [k, c] of cases.entries()) {
  const g: GoldenCase = { head: c.head, arg: c.arg, label: c.label, tol: c.tol };
  const m = mp.get(k);
  const w = wl.get(k);
  if (m !== undefined) g.mpmath = m;
  if (w !== undefined) g.wolfram = w;
  const ours = ce.box([c.head, c.arg] as never).N().re;
  for (const [name, ref] of [
    ["mpmath", g.mpmath],
    ["wolfram", g.wolfram],
  ] as const) {
    if (ref === undefined) continue;
    compared++;
    const err = Math.abs(ours - ref) / Math.max(1, Math.abs(ref));
    if (!(err <= g.tol))
      disagree.push(`${g.label} vs ${name}: relerr=${err.toExponential(2)} tol=${g.tol}`);
  }
  goldens.push(g);
}

writeFileSync(
  new URL("../tests/elementary.golden.json", import.meta.url),
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
