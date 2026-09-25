// Collect oracle values for the Carlson symmetric elliptic integrals — CarlsonRF,
// CarlsonRC, CarlsonRD, CarlsonRJ, CarlsonRG — from BOTH mpmath (which has these
// natively: elliprf, elliprc, elliprd, elliprj, elliprg) and a Wolfram kernel, and write
// them to tests/carlson.golden.json. Same shape as collect-special-goldens.ts: the test
// suite checks our numeric evaluation against these pinned values, so `vp test` needs
// neither oracle installed; this script does.
//
// Requires python3 + mpmath and wolframscript on PATH. Run from the package:
//   node scripts/collect-carlson-goldens.ts

import { writeFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAnalytic } from "../src/index.ts";
import { runKernel } from "@enumeratio/oracle/bounded";

const ce = new ComputeEngine();
declareAnalytic(ce);

type Val = number | { rat: [number, number] } | { c: [number, number] };
type Pair = [number, number];

interface GoldenCase {
  head: string;
  args: unknown[];
  label: string;
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
  typeof v === "number"
    ? String(v)
    : "rat" in v
      ? `${v.rat[0]}/${v.rat[1]}`
      : `(${v.c[0]} + (${v.c[1]})*I)`;
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

// --- CarlsonRF(x,y,z) / CarlsonRC(x,y) / CarlsonRG(x,y,z) ---------------------------
// A spread covering: generic positive reals, one argument zero (the "complete" cases,
// where RF degenerates to 1/AGM), equal arguments (the elementary RF(t,t,t)=1/√t check),
// and genuinely complex arguments off the branch cut.
const rfTriples: [Val, Val, Val][] = [
  [1, 2, 3],
  [1, 1, 1],
  [2, 2, 2],
  [0, 1, 2],
  [0, 2, 3],
  [0.5, 1, 1.5],
  [1, 4, 4],
  [{ c: [1, 1] }, 2, 3],
  [{ c: [3, -2] }, { c: [1, 1] }, 5],
  [{ c: [0.5, 0.5] }, { c: [0.5, -0.5] }, 2],
  [{ rat: [1, 3] }, 2, { rat: [5, 2] }],
];
for (const [x, y, z] of rfTriples) {
  push({
    golden: {
      head: "CarlsonRF",
      args: [toCE(x), toCE(y), toCE(z)],
      label: `RF(${label(x)},${label(y)},${label(z)})`,
      tol: 1e-12,
    },
    py: `elliprf(${toPy(x)}, ${toPy(y)}, ${toPy(z)})`,
    wl: `CarlsonRF[${toWL(x)}, ${toWL(y)}, ${toWL(z)}]`,
  });
  push({
    golden: {
      head: "CarlsonRD",
      args: [toCE(x), toCE(y), toCE(z)],
      label: `RD(${label(x)},${label(y)},${label(z)})`,
      tol: 1e-11,
    },
    py: `elliprd(${toPy(x)}, ${toPy(y)}, ${toPy(z)})`,
    wl: `CarlsonRD[${toWL(x)}, ${toWL(y)}, ${toWL(z)}]`,
  });
  push({
    golden: {
      head: "CarlsonRG",
      args: [toCE(x), toCE(y), toCE(z)],
      label: `RG(${label(x)},${label(y)},${label(z)})`,
      tol: 1e-11,
    },
    py: `elliprg(${toPy(x)}, ${toPy(y)}, ${toPy(z)})`,
    wl: `CarlsonRG[${toWL(x)}, ${toWL(y)}, ${toWL(z)}]`,
  });
}
push({
  golden: { head: "CarlsonRG", args: [0, 0, 0], label: "RG(0,0,0)", tol: 1e-13 },
  py: `elliprg(mpf(0), mpf(0), mpf(0))`,
  wl: `CarlsonRG[0, 0, 0]`,
});

const rcPairs: [Val, Val][] = [
  [1, 4],
  [1, 1],
  [3, 2],
  [{ c: [1, 2] }, 3],
  [{ c: [0, 1] }, { c: [0, -1] }],
  // Real y < 0: the Cauchy-principal-value branch (DLMF 19.2.19).
  [1, -1],
  [4, -3],
  [2, -0.5],
];
for (const [x, y] of rcPairs) {
  push({
    golden: {
      head: "CarlsonRC",
      args: [toCE(x), toCE(y)],
      label: `RC(${label(x)},${label(y)})`,
      tol: 1e-12,
    },
    py: `elliprc(${toPy(x)}, ${toPy(y)})`,
    wl: `CarlsonRC[${toWL(x)}, ${toWL(y)}]`,
  });
}

// --- CarlsonRJ(x,y,z,p) -------------------------------------------------------------
const rjQuads: [Val, Val, Val, Val][] = [
  [1, 2, 3, 4],
  [1, 1, 1, 1],
  [2, 2, 2, 2],
  [0, 1, 2, 3],
  [1, 2, 3, 3], // p = z: RJ(x,y,z,z) = RD(x,y,z)
  [{ c: [1, 1] }, 2, 3, 4],
  [1, 2, 3, { c: [1, 1] }],
  [{ c: [0.5, -1] }, { c: [2, 0.5] }, 3, { c: [1, -0.5] }],
  // p alone with Re < 0 (Im ≠ 0, off the branch cut), x,y,z real ≥ 0: the region the
  // 19.26.7 α/β sum got wrong and the d_m/e_m fix above targets directly. Includes the
  // exact case Fungrim 5f84d9 (IncompleteEllipticPi's quasi-periodicity) found it at.
  [0, 0.7, 1, { c: [-0.17, -0.45] }],
  [0.5, 0.7, 1, { c: [-0.17, -0.45] }],
  [1, 2, 3, { c: [-0.5, -1.5] }],
  [0.1, 2.4, 5, { c: [-2, -0.1] }],
  // p alone with Re < 0, x, y, z ALSO genuinely complex (not just real ≥ 0) — same fix,
  // wider domain.
  [{ c: [0.3, 0.4] }, { c: [1.1, -0.2] }, { c: [2, 0.5] }, { c: [-0.6, -0.9] }],
  // p equals one of x, y, z exactly, with two OTHER arguments at Re < 0: RJ(x,y,z,z) =
  // RD(x,y,z) exempts this from the two-or-more-negative decline heuristic (carlsonRJDeclines).
  [{ c: [-0.3, 0.2] }, { c: [-0.5, 0.1] }, 1, 1],
];
for (const [x, y, z, p] of rjQuads) {
  push({
    golden: {
      head: "CarlsonRJ",
      args: [toCE(x), toCE(y), toCE(z), toCE(p)],
      label: `RJ(${label(x)},${label(y)},${label(z)},${label(p)})`,
      tol: 1e-10,
    },
    py: `elliprj(${toPy(x)}, ${toPy(y)}, ${toPy(z)}, ${toPy(p)})`,
    wl: `CarlsonRJ[${toWL(x)}, ${toWL(y)}, ${toWL(z)}, ${toWL(p)}]`,
  });
}

// --- CarlsonRJ(x,y,z,p), real p < 0: the Cauchy principal value (Carlson 1995 eq. (33);
// DLMF 19.20.14). Wolfram's own `CarlsonRJ` already returns this real value for real p < 0
// — mpmath's `elliprj` instead returns the complex analytic continuation, whose real part
// agrees with the principal value (Sokhotski–Plemelj) but carries a nonzero imaginary part
// this golden format can't express as a second oracle column here, so these rows compare
// against Wolfram only.
const rjNegP: [Val, Val, Val, Val][] = [
  [1, 2, 3, -1],
  [0, 2, 3, -1], // one argument 0 (the "at most one may be 0" case)
  [1, 2, 3, -2.5],
  [0.5, 1.5, 4, -0.3],
  [2, 2, 2, -1], // equal x,y,z
];
for (const [x, y, z, p] of rjNegP) {
  push({
    golden: {
      head: "CarlsonRJ",
      args: [toCE(x), toCE(y), toCE(z), toCE(p)],
      label: `RJ(${label(x)},${label(y)},${label(z)},${label(p)}) [CPV]`,
      tol: 1e-10,
    },
    wl: `CarlsonRJ[${toWL(x)}, ${toWL(y)}, ${toWL(z)}, ${toWL(p)}]`,
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
from mpmath import mp, mpf, mpc, elliprf, elliprd, elliprj, elliprc, elliprg
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
    p.wl
      ? `With[{v=N[${p.wl}, 25]},Print[${k},"|",ToString[Re[v],InputForm],"|",ToString[Im[v],InputForm]]]`
      : "",
  )
  .filter(Boolean)
  .join(";\n");
const wlClean = (s: string): number => Number(s.replace(/`[\d.]+/g, "").replace(/\*\^/g, "e"));
const wl = parseLines(
  await runKernel("wolframscript", ["-code", wlCode], { timeoutMs: 300_000 }),
  wlClean,
);

// --- Compare, report, write --------------------------------------------------------
const relErr = (ours: Pair, ref: Pair): number =>
  Math.max(Math.abs(ours[0] - ref[0]), Math.abs(ours[1] - ref[1])) /
  Math.max(1, Math.hypot(ref[0], ref[1]));

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
  new URL("../tests/carlson.golden.json", import.meta.url),
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
