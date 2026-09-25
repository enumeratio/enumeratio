// Collect oracle values for MatrixExp from BOTH mpmath (`mpmath.expm`) and a Wolfram
// kernel (`MatrixExp`), and write them to tests/matrix-exp.golden.json. Same shape as
// collect-carlson-goldens.ts: `vp test` only reads the pinned JSON, so it needs neither
// oracle installed; this script does.
//
// Requires python3 + mpmath and wolframscript on PATH. Run from the package:
//   node scripts/collect-matrix-exp-goldens.ts

import { writeFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { runKernel } from "@enumeratio/oracle/bounded";
import { declareAnalytic } from "../src/index.ts";

const ce = new ComputeEngine();
declareAnalytic(ce);

interface GoldenCase {
  matrix: number[][];
  label: string;
  tol: number;
  mpmath?: number[][];
  wolfram?: number[][];
}

const cases: { matrix: number[][]; label: string; tol: number }[] = [
  {
    matrix: [
      [0, 1],
      [1, 0],
    ],
    label: "symmetric 2x2",
    tol: 1e-12,
  },
  {
    matrix: [
      [0, 1],
      [0, 0],
    ],
    label: "nilpotent 2x2",
    tol: 1e-12,
  },
  {
    matrix: [
      [2, 1],
      [0, 2],
    ],
    label: "Jordan block (degenerate 2x2)",
    tol: 1e-12,
  },
  {
    matrix: [
      [1, 2],
      [3, 4],
    ],
    label: "generic 2x2",
    tol: 1e-11,
  },
  {
    matrix: [
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 3],
    ],
    label: "diagonal 3x3",
    tol: 1e-12,
  },
  {
    matrix: [
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, 0],
    ],
    label: "nilpotent 3x3",
    tol: 1e-12,
  },
  {
    matrix: [
      [1, 2, 0],
      [0, 3, 4],
      [0, 0, 5],
    ],
    label: "upper triangular 3x3 (numeric path)",
    tol: 1e-10,
  },
  {
    matrix: [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 10],
    ],
    label: "generic 3x3, no structure (numeric path)",
    tol: 1e-9,
  },
  {
    matrix: [
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
      [0, 0, 0, 0],
    ],
    label: "nilpotent 4x4 (numeric path — n > matched exact cases)",
    tol: 1e-10,
  },
];

// --- mpmath ------------------------------------------------------------------------
const pyMatrix = (m: number[][]): string => `[[${m.map((row) => row.join(",")).join("],[")}]]`;
const py = `
from mpmath import mp, matrix, expm
mp.dps = 30
cases = [
${cases.map((c, k) => `    (${k}, matrix(${pyMatrix(c.matrix)})),`).join("\n")}
]
for k, m in cases:
    r = expm(m)
    flat = ",".join(str(r[i, j]) for i in range(r.rows) for j in range(r.cols))
    print(f"{k}|{r.rows}|{r.cols}|{flat}")
`;
const parseMatrixLines = (out: string): Map<number, number[][]> => {
  const got = new Map<number, number[][]>();
  for (const line of out.split("\n")) {
    const m = line.match(/^(\d+)\|(\d+)\|(\d+)\|(.*)$/);
    if (!m) continue;
    const rows = Number(m[2]);
    const cols = Number(m[3]);
    const flat = m[4].split(",").map(Number);
    const mat: number[][] = [];
    for (let i = 0; i < rows; i++) mat.push(flat.slice(i * cols, (i + 1) * cols));
    got.set(Number(m[1]), mat);
  }
  return got;
};
const mp = parseMatrixLines(await runKernel("python3", ["-c", py], { timeoutMs: 300_000 }));

// --- Wolfram -------------------------------------------------------------------------
const wlMatrix = (m: number[][]): string => `{{${m.map((row) => row.join(",")).join("},{")}}}`;
const wlCode = cases
  .map(
    (c, k) =>
      `With[{r=N[MatrixExp[${wlMatrix(c.matrix)}],25]},Print[${k},"|",Length[r],"|",Length[r[[1]]],"|",StringRiffle[Flatten[Map[ToString[#,InputForm]&,r,{2}]],","]]]`,
  )
  .join(";\n");
const wlClean = (s: string): number => Number(s.replace(/`[\d.]+/g, "").replace(/\*\^/g, "e"));
const parseWlLines = (out: string): Map<number, number[][]> => {
  const got = new Map<number, number[][]>();
  for (const line of out.split("\n")) {
    const m = line.match(/^(\d+)\|(\d+)\|(\d+)\|(.*)$/);
    if (!m) continue;
    const rows = Number(m[2]);
    const cols = Number(m[3]);
    const flat = m[4].split(",").map(wlClean);
    const mat: number[][] = [];
    for (let i = 0; i < rows; i++) mat.push(flat.slice(i * cols, (i + 1) * cols));
    got.set(Number(m[1]), mat);
  }
  return got;
};
const wl = parseWlLines(
  await runKernel("wolframscript", ["-code", wlCode], { timeoutMs: 300_000 }),
);

// --- Compare, report, write ----------------------------------------------------------
const relErr = (ours: number[][], ref: number[][]): number => {
  let max = 0;
  let scale = 1;
  for (let i = 0; i < ours.length; i++) {
    for (let j = 0; j < ours[i].length; j++) {
      max = Math.max(max, Math.abs(ours[i][j] - ref[i][j]));
      scale = Math.max(scale, Math.abs(ref[i][j]));
    }
  }
  return max / scale;
};

const goldens: GoldenCase[] = [];
const disagree: string[] = [];
let compared = 0;
for (const [k, c] of cases.entries()) {
  const g: GoldenCase = { matrix: c.matrix, label: c.label, tol: c.tol };
  const m = mp.get(k);
  const w = wl.get(k);
  if (m) g.mpmath = m;
  if (w) g.wolfram = w;
  const r = ce
    .box(["MatrixExp", ["List", ...c.matrix.map((row) => ["List", ...row])]] as never)
    .N();
  const ours: number[][] = operandsOf(r).map((row) => operandsOf(row).map((e) => e.re));
  for (const [name, ref] of [
    ["mpmath", g.mpmath],
    ["wolfram", g.wolfram],
  ] as const) {
    if (!ref) continue;
    compared++;
    const err = relErr(ours, ref);
    if (!(err <= g.tol))
      disagree.push(`${g.label} vs ${name}: relerr=${err.toExponential(2)} tol=${g.tol}`);
  }
  goldens.push(g);
}

writeFileSync(
  new URL("../tests/matrix-exp.golden.json", import.meta.url),
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
