// Collect oracle values for GammaRegularized's generalized (three-argument) incomplete-gamma
// extension -- the only head here without a mapped oracle binding (see GammaRegularized.yaml)
// -- from BOTH mpmath and a Wolfram kernel, and write them to
// tests/special-functions.golden.json.
//
// Requires python3 + mpmath and wolframscript on PATH. Run from the package:
//   node scripts/collect-special-goldens.ts

import { writeFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAnalytic } from "../src/declare.ts";
import { runKernel } from "@enumeratio/oracle/bounded";

const ce = new ComputeEngine();
declareAnalytic(ce);

type Val = number | { rat: [number, number] } | { c: [number, number] };
type Pair = [number, number];

export interface GoldenCase {
  head: string;
  args: unknown[];
  label: string;
  /** Relative tolerance the test holds us to against each oracle. */
  tol: number;
  mpmath?: Pair;
  wolfram?: Pair;
}

const toCE = (v: Val): unknown =>
  typeof v === "number" ? v : "rat" in v ? ["Rational", ...v.rat] : ["Complex", ...v.c];
const toPy = (v: Val): string =>
  typeof v === "number"
    ? `mpf('${v}')`
    : "rat" in v
      ? `(mpf(${v.rat[0]})/mpf(${v.rat[1]}))`
      : `mpc('${v.c[0]}','${v.c[1]}')`;
const toWL = (v: Val): string =>
  typeof v === "number" ? String(v) : "rat" in v ? `${v.rat[0]}/${v.rat[1]}` : `(${v.c[0]} + (${v.c[1]})*I)`;
const label = (v: Val): string =>
  typeof v === "number"
    ? String(v)
    : "rat" in v
      ? `${v.rat[0]}/${v.rat[1]}`
      : `${v.c[0]}${v.c[1] < 0 ? "" : "+"}${v.c[1]}i`;

interface Pending {
  golden: GoldenCase;
  py?: string;
  wl?: string;
}
const pending: Pending[] = [];
const push = (p: Pending): void => void pending.push(p);

// --- GammaRegularized(s, z₀, z₁) ---------------------------------------------------
// The third argument is ours; the two-argument kernel underneath is compute-engine's, so
// these rows check the difference, the z₀ = 0 lower incomplete gamma included.
const gammaArgs: [Val, Val, Val][] = [
  [2.5, 0, 1.5],
  [2.5, 1.5, 3],
  [1, 0, 2],
  [0.5, 0, 0.25],
  [-1.5, 0, 1.5],
  [3, 1, 7],
  [2.5, 0, { c: [1.5, 1] }],
  [{ c: [2, 1] }, 0, 1.5],
  [{ c: [2, 1] }, { c: [0.5, -1] }, { c: [1.5, 1] }],
  [0, 1, 4],
];
for (const [s, z0, z1] of gammaArgs) {
  push({
    golden: {
      head: "GammaRegularized",
      args: [toCE(s), toCE(z0), toCE(z1)],
      label: `Q(${label(s)}, ${label(z0)}, ${label(z1)})`,
      tol: 1e-12,
    },
    // mpmath's gammainc(z, a, b) is the integral between the limits, so Q(s, z₀) − Q(s, z₁)
    // is the difference of two upper tails — spelled out rather than using gammainc(s,z₀,z₁)
    // so the row checks the same two calls the head makes.
    py: `(gammainc(${toPy(s)}, ${toPy(z0)}, inf, regularized=True) - gammainc(${toPy(s)}, ${toPy(z1)}, inf, regularized=True))`,
    wl: `GammaRegularized[${toWL(s)}, ${toWL(z0)}, ${toWL(z1)}]`,
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
from mpmath import mp, mpf, mpc, inf, gammainc
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

writeFileSync(
  new URL("../tests/special-functions.golden.json", import.meta.url),
  JSON.stringify(goldens, null, 2) + "\n",
);

console.log(
  `cases ${goldens.length}  |  oracle comparisons ${compared}  |  agree ${compared - disagree.length}  disagree ${disagree.length}`,
);
if (disagree.length) {
  console.log("\n--- DISAGREEMENTS ---");
  for (const d of disagree) console.log("  " + d);
  process.exitCode = 1;
}
