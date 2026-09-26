// Collect oracle values for EllipticTheta/EllipticThetaPrime (a = 1..4) from BOTH
// mpmath (jtheta) and a Wolfram kernel. Same shape as collect-elliptic-goldens.ts.
// Requires python3 + mpmath and wolframscript on PATH. Run from the package:
//   node scripts/collect-theta-goldens.ts

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

// A spread of (u,q): real q, negative real q, complex q close to and far from 0,
// real u, complex u, u = 0.
const uQ: [Val, Val][] = [
  [0.3, 0.2],
  [0.0, 0.5],
  [1.0, -0.3], // negative real nome
  [{ c: [0.3, 0.1] }, 0.2], // complex u
  [{ c: [0.5, 0.5] }, { c: [0.1, 0.2] }], // complex u AND complex q
  [2.0, 0.6], // u past pi/2
  [0.4, 0.85], // q close to 1 (still comfortably inside MAX_ITERS)
];

for (const [u, q] of uQ) {
  for (const a of [1, 2, 3, 4] as const) {
    push({
      golden: {
        head: "EllipticTheta",
        args: [a, toCE(u), toCE(q)],
        label: `theta${a}(${label(u)},${label(q)})`,
        tol: 1e-9,
      },
      py: `jtheta(${a}, ${toPy(u)}, ${toPy(q)})`,
      wl: `EllipticTheta[${a}, ${toWL(u)}, ${toWL(q)}]`,
    });
    push({
      golden: {
        head: "EllipticThetaPrime",
        args: [a, toCE(u), toCE(q)],
        label: `theta${a}'(${label(u)},${label(q)})`,
        tol: 1e-9,
      },
      py: `jtheta(${a}, ${toPy(u)}, ${toPy(q)}, derivative=1)`,
      wl: `EllipticThetaPrime[${a}, ${toWL(u)}, ${toWL(q)}]`,
    });
  }
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
from mpmath import mp, mpf, mpc, jtheta
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
    if (!(err <= g.tol)) {
      disagree.push(
        `${g.label} vs ${name}: ours=(${ours.join(", ")}) ref=(${ref.join(", ")}) relerr=${err.toExponential(2)} tol=${g.tol}`,
      );
    }
  }
  goldens.push(g);
}

writeFileSync(new URL("../tests/theta.golden.json", import.meta.url), JSON.stringify(goldens, null, 2) + "\n");

console.log(
  `cases ${goldens.length}  |  oracle comparisons ${compared}  |  agree ${compared - disagree.length}  disagree ${disagree.length}`,
);
if (disagree.length) {
  console.log("\n--- DISAGREEMENTS ---");
  for (const d of disagree) console.log(d);
  process.exitCode = 1;
}
