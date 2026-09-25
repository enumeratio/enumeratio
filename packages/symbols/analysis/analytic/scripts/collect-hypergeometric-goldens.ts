// Collect oracle values for the new hypergeometric heads — Hypergeometric0F1,
// Hypergeometric0F1Regularized, Hypergeometric1F1Regularized, Hypergeometric2F1Regularized,
// Hypergeometric3F2Regularized and HypergeometricU — from BOTH mpmath and a Wolfram kernel,
// and write them to tests/hypergeometric.golden.json. Same shape as
// collect-special-goldens.ts: the test suite checks our numeric evaluation against these
// pinned values, so `vp test` needs neither oracle installed; this script does.
//
// mpmath has no built-in regularized pFq, so the regularized cases use an independent
// arbitrary-precision series in Python (Σ ∏rf(ai,k) · zᵏ/k! · ∏rgamma(bj+k)) — the same
// definition our TS series computes, but a separate implementation at 30 decimal digits, so
// it is still an independent check rather than a mirror of our own arithmetic. mpmath's
// `hyp0f1`/`hyperu` cover the two plain (non-regularized) heads directly. Wolfram has all six
// heads natively (HypergeometricPFQRegularized for the 3F2 case), so those rows cross-check
// against a wholly different implementation.
//
// Requires python3 + mpmath and wolframscript on PATH. Run from the package:
//   node scripts/collect-hypergeometric-goldens.ts

import { writeFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAnalytic } from "../src/index.ts";
import { runKernel } from "@enumeratio/oracle/bounded";

const ce = new ComputeEngine();
declareAnalytic(ce);

type Val = number | { rat: [number, number] } | { c: [number, number] };
type Pair = [number, number];

export interface GoldenCase {
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

/** `Σ ∏rf(ai,k) · zᵏ/k! · ∏rgamma(bj+k)` as a Python expression string, evaluated at mp.dps. */
const pyRegularized = (upper: Val[], lower: Val[], z: Val): string =>
  `pfq_reg([${upper.map(toPy).join(",")}], [${lower.map(toPy).join(",")}], ${toPy(z)})`;

// --- Hypergeometric0F1(b, z) and its regularized form -------------------------------
const bz0f1: [Val, Val][] = [
  [2, 0.5],
  [1.5, -0.7],
  [{ rat: [7, 3] }, 2.5],
  [{ c: [1, 1] }, 0.5],
  [2, { c: [0.5, 0.5] }],
  [-0.5, 0.3], // negative non-integer b, no pole
  [{ c: [-2.5, 1.5] }, { c: [1.2, -0.8] }],
];
for (const [b, z] of bz0f1) {
  push({
    golden: {
      head: "Hypergeometric0F1",
      args: [toCE(b), toCE(z)],
      label: `0F1(${label(b)};${label(z)})`,
      tol: 1e-9,
    },
    py: `hyp0f1(${toPy(b)}, ${toPy(z)})`,
    wl: `Hypergeometric0F1[${toWL(b)}, ${toWL(z)}]`,
  });
}

// b at and near poles (0, -1, -2) — regularized must stay finite there.
const bz0f1reg: [Val, Val][] = [
  ...bz0f1,
  [0, 0.5],
  [-1, 0.5],
  [-2, 0.7],
  [0, { c: [0.3, 0.4] }],
  [-1, { c: [-0.5, 0.2] }],
];
for (const [b, z] of bz0f1reg) {
  push({
    golden: {
      head: "Hypergeometric0F1Regularized",
      args: [toCE(b), toCE(z)],
      label: `0F1Reg(${label(b)};${label(z)})`,
      tol: 1e-9,
    },
    py: pyRegularized([], [b], z),
    wl: `Hypergeometric0F1Regularized[${toWL(b)}, ${toWL(z)}]`,
  });
}

// --- Hypergeometric1F1Regularized(a, b, z) ------------------------------------------
const abz1f1: [Val, Val, Val][] = [
  [1, 2, 0.5],
  [0.5, 1.5, -1],
  [{ c: [1, 0.5] }, 2, 0.5],
  [1, 0, 0.5], // pole b = 0
  [1, -1, 0.7], // pole b = -1
  [2, -2, 0.4], // pole b = -2, numerator doesn't cancel (a ≠ related)
  [1, 2, { c: [0.5, 0.5] }],
  [1, -1, { c: [0.3, -0.4] }],
];
for (const [a, b, z] of abz1f1) {
  push({
    golden: {
      head: "Hypergeometric1F1Regularized",
      args: [toCE(a), toCE(b), toCE(z)],
      label: `1F1Reg(${label(a)},${label(b)};${label(z)})`,
      tol: 1e-8,
    },
    py: pyRegularized([a], [b], z),
    wl: `Hypergeometric1F1Regularized[${toWL(a)}, ${toWL(b)}, ${toWL(z)}]`,
  });
}

// --- Hypergeometric2F1Regularized(a, b, c, z) — |z| < 1 only ------------------------
const abcz2f1: [Val, Val, Val, Val][] = [
  [1, 1, 2, 0.5],
  [0.5, 1.5, 2.5, -0.6],
  [1, 1, 0, 0.5], // pole c = 0
  [1, 1, -1, 0.3], // pole c = -1
  [1, 2, -2, 0.4], // pole c = -2, a genuine pole (numerator doesn't cancel)
  [1, 1, 2, { c: [0.3, 0.3] }],
  [1, 1, -1, { c: [0.2, -0.1] }],
];
for (const [a, b, c, z] of abcz2f1) {
  push({
    golden: {
      head: "Hypergeometric2F1Regularized",
      args: [toCE(a), toCE(b), toCE(c), toCE(z)],
      label: `2F1Reg(${label(a)},${label(b)},${label(c)};${label(z)})`,
      tol: 1e-8,
    },
    py: pyRegularized([a, b], [c], z),
    wl: `Hypergeometric2F1Regularized[${toWL(a)}, ${toWL(b)}, ${toWL(c)}, ${toWL(z)}]`,
  });
}

// --- Hypergeometric3F2Regularized(a1, a2, a3, b1, b2, z) — |z| < 1 only -------------
const params3f2: [Val, Val, Val, Val, Val, Val][] = [
  [1, 1, 1, 2, 3, 0.5],
  [0.5, 1, 1.5, 2, 2.5, -0.4],
  [1, 1, 1, 0, 2, 0.3], // pole b1 = 0
  [1, 1, 1, -1, 2, 0.3], // pole b1 = -1
  [1, 1, 1, 2, -1, 0.3], // pole b2 = -1
  [1, 1, 1, 2, 3, { c: [0.3, 0.2] }],
];
for (const [a1, a2, a3, b1, b2, z] of params3f2) {
  push({
    golden: {
      head: "Hypergeometric3F2Regularized",
      args: [toCE(a1), toCE(a2), toCE(a3), toCE(b1), toCE(b2), toCE(z)],
      label: `3F2Reg(${label(a1)},${label(a2)},${label(a3)},${label(b1)},${label(b2)};${label(z)})`,
      tol: 1e-7,
    },
    py: pyRegularized([a1, a2, a3], [b1, b2], z),
    wl: `HypergeometricPFQRegularized[{${toWL(a1)}, ${toWL(a2)}, ${toWL(a3)}}, {${toWL(b1)}, ${toWL(b2)}}, ${toWL(z)}]`,
  });
}

// --- HypergeometricU(a, b, z) — non-integer b (see hypergeometric-ustar.ts) ---------
const abzU: [Val, Val, Val][] = [
  [1, 2.5, 3],
  [0.5, 1.5, 2],
  [1, 2.5, { c: [0.5, 0.5] }],
  [{ c: [1, 0.5] }, 2.5, 1.5],
  [2, -1.5, 0.8],
];
for (const [a, b, z] of abzU) {
  push({
    golden: {
      head: "HypergeometricU",
      args: [toCE(a), toCE(b), toCE(z)],
      label: `U(${label(a)},${label(b)};${label(z)})`,
      tol: 1e-9,
    },
    py: `hyperu(${toPy(a)}, ${toPy(b)}, ${toPy(z)})`,
    wl: `HypergeometricU[${toWL(a)}, ${toWL(b)}, ${toWL(z)}]`,
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
from mpmath import mp, mpf, mpc, hyp0f1, hyperu, rf, rgamma
mp.dps = 30

def pfq_reg(upper, lower, z, terms=600):
    # A lower parameter at a non-positive integer makes rgamma(b+k) exactly 0 up through
    # k = -b -- a real feature, not the tail converging -- so convergence is only checked
    # past the last such pole (mirrors packages/symbols/analysis/analytic/src/hypergeometric.ts).
    pole_bound = -1
    for b in lower:
        b = mpc(b)
        if b.imag == 0 and b.real == int(b.real) and b.real <= 0:
            pole_bound = max(pole_bound, int(-b.real))
    core = mpc(1)
    total = mpc(0)
    for k in range(terms):
        invg = mpc(1)
        for b in lower:
            invg *= rgamma(b + k)
        term = core * invg
        total += term
        if core == 0:
            break
        if k > pole_bound and abs(term) < mpf('1e-40') * (1 + abs(total)):
            break
        num = mpc(z)
        for a in upper:
            num *= (a + k)
        core = core * num / (k + 1)
    return total

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
  new URL("../tests/hypergeometric.golden.json", import.meta.url),
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
