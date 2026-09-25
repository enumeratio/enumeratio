// Collect oracle values for QPochhammer, QFactorial and QBinomial from BOTH mpmath
// (`qp` for QPochhammer; direct product/quotient formulas in Python for the other two —
// an implementation independent of our Pascal-recurrence one) and a Wolfram kernel
// (`QPochhammer`, `QFactorial`, `QBinomial`, all three native there), compare them
// against our own evaluation, and write everything to tests/q-series.golden.json.
// Same shape as collect-matrix-exp-goldens.ts: `vp test` only reads the pinned JSON, so
// it needs neither oracle installed; this script does.
//
// Requires python3 + mpmath and wolframscript on PATH. Run from the package:
//   node scripts/collect-q-series-goldens.ts

import { writeFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { runKernel } from "@enumeratio/oracle/bounded";
import { declareAnalytic } from "../src/index.ts";

const ce = new ComputeEngine();
declareAnalytic(ce);

interface GoldenCase {
  label: string;
  head: "QPochhammer" | "QFactorial" | "QBinomial";
  args: (number | [number, number])[]; // plain number or [num, den] rational
  tol: number;
  mpmath?: number;
  wolfram?: number;
}

const R = (num: number, den: number): [number, number] => [num, den];

const cases: Omit<GoldenCase, "mpmath" | "wolfram">[] = [
  { label: "QPochhammer(2,3,3)", head: "QPochhammer", args: [2, 3, 3], tol: 1e-9 },
  { label: "QPochhammer(1/2,1/2,3)", head: "QPochhammer", args: [R(1, 2), R(1, 2), 3], tol: 1e-9 },
  { label: "QPochhammer(3,2,4)", head: "QPochhammer", args: [3, 2, 4], tol: 1e-9 },
  { label: "QPochhammer(-1,3,2)", head: "QPochhammer", args: [-1, 3, 2], tol: 1e-9 },
  { label: "QFactorial(3,2)", head: "QFactorial", args: [3, 2], tol: 1e-9 },
  { label: "QFactorial(4,2)", head: "QFactorial", args: [4, 2], tol: 1e-9 },
  { label: "QFactorial(3,1/2)", head: "QFactorial", args: [3, R(1, 2)], tol: 1e-9 },
  { label: "QFactorial(6,3)", head: "QFactorial", args: [6, 3], tol: 1e-6 },
  { label: "QBinomial(4,2,2)", head: "QBinomial", args: [4, 2, 2], tol: 1e-9 },
  { label: "QBinomial(6,3,1)", head: "QBinomial", args: [6, 3, 1], tol: 1e-9 },
  { label: "QBinomial(5,2,3)", head: "QBinomial", args: [5, 2, 3], tol: 1e-6 },
  { label: "QBinomial(8,3,2)", head: "QBinomial", args: [8, 3, 2], tol: 1e-3 },
];

const argExpr = (a: number | [number, number]): unknown =>
  Array.isArray(a) ? ["Rational", a[0], a[1]] : a;
const pyLit = (a: number | [number, number]): string =>
  Array.isArray(a) ? `(mp.mpf(${a[0]})/mp.mpf(${a[1]}))` : String(a);
const wlLit = (a: number | [number, number]): string =>
  Array.isArray(a) ? `(${a[0]}/${a[1]})` : String(a);

// --- our own evaluation ---------------------------------------------------------------
const ours = cases.map((c) => ce.box([c.head, ...c.args.map(argExpr)] as never).N().re as number);

// --- mpmath (qp for QPochhammer; independent product/quotient code for the others) ---
const py = `
from mpmath import mp, qp
mp.dps = 30
def qfactorial(n, q):
    r = mp.mpf(1)
    for k in range(1, n+1):
        r *= (1 - q**k) / (1 - q) if q != 1 else k
    return r
def qbinomial(n, k, q):
    return qfactorial(n, q) / (qfactorial(k, q) * qfactorial(n-k, q))
results = []
${cases
  .map((c, i) => {
    // n and k are always plain (non-rational) integers in every case above.
    const asInt = (x: number | [number, number]): number => x as number;
    if (c.head === "QPochhammer") {
      const [a, q, n] = c.args;
      return `results.append((${i}, complex(qp(${pyLit(a)}, ${pyLit(q)}, ${asInt(n)}))))`;
    }
    if (c.head === "QFactorial") {
      const [n, q] = c.args;
      return `results.append((${i}, complex(qfactorial(${asInt(n)}, ${pyLit(q)}))))`;
    }
    const [n, k, q] = c.args;
    return `results.append((${i}, complex(qbinomial(${asInt(n)}, ${asInt(k)}, ${pyLit(q)}))))`;
  })
  .join("\n")}
for i, v in results:
    print(f"{i}|{v.real!r}")
`;
const mpOut = await runKernel("python3", ["-c", py], { timeoutMs: 120_000 });
const mp = new Map<number, number>();
for (const line of mpOut.split("\n")) {
  const m = line.match(/^(\d+)\|(-?[\d.eE+-]+)$/);
  if (m) mp.set(Number(m[1]), Number(m[2]));
}

// --- Wolfram (native QPochhammer, QFactorial, QBinomial) -----------------------------
const wlCode = cases
  .map((c, i) => {
    const args = c.args.map(wlLit).join(",");
    return `Print[${i},"|",ToString[N[${c.head}[${args}],20],InputForm]]`;
  })
  .join(";\n");
const wlClean = (s: string): number => Number(s.replace(/`[\d.]+/g, "").replace(/\*\^/g, "e"));
const wlOut = await runKernel("wolframscript", ["-code", wlCode], { timeoutMs: 120_000 });
const wl = new Map<number, number>();
for (const line of wlOut.split("\n")) {
  const m = line.match(/^(\d+)\|(.*)$/);
  if (m) wl.set(Number(m[1]), wlClean(m[2]));
}

// --- Compare, report, write ----------------------------------------------------------
const goldens: GoldenCase[] = [];
const disagree: string[] = [];
let compared = 0;
for (const [i, c] of cases.entries()) {
  const g: GoldenCase = { ...c };
  const m = mp.get(i);
  const w = wl.get(i);
  if (m !== undefined) g.mpmath = m;
  if (w !== undefined) g.wolfram = w;
  goldens.push(g);
  for (const [name, ref] of [
    ["mpmath", g.mpmath],
    ["wolfram", g.wolfram],
  ] as const) {
    if (ref === undefined) continue;
    compared++;
    const err = Math.abs(ours[i] - ref) / Math.max(1, Math.abs(ref));
    if (!(err <= c.tol)) disagree.push(`${c.label} vs ${name}: ours=${ours[i]} ref=${ref}`);
  }
}

writeFileSync(
  new URL("../tests/q-series.golden.json", import.meta.url),
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
