// Collect oracle values for the ten backlog heads landed in this pass — ExpIntegralE,
// LambertW (branches other than 0/-1), InverseErfc, InverseGammaRegularized,
// InverseBetaRegularized, BellY, NorlundB, PrimeZetaP, HypergeometricPFQ and
// KleinInvariantJ — from a Wolfram kernel, and write them to
// tests/backlog-heads.golden.json. Same shape as collect-hypergeometric-goldens.ts: the
// test suite checks our numeric evaluation against these pinned values, so `vp test`
// needs no oracle installed; this script does.
//
// Requires wolframscript on PATH. Run from the package:
//   node scripts/collect-backlog-goldens.ts

import { writeFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAnalytic } from "../src/index.ts";
import { runKernel } from "@enumeratio/oracle/bounded";

const ce = new ComputeEngine();
declareAnalytic(ce);

type Pair = [number, number];

export interface GoldenCase {
  head: string;
  args: unknown[];
  label: string;
  tol: number;
  wolfram?: Pair;
}

interface Pending {
  golden: GoldenCase;
  wl: string;
}
const pending: Pending[] = [];
const push = (p: Pending): void => void pending.push(p);

// --- ExpIntegralE(n, z) --------------------------------------------------------------
for (const [n, z] of [
  [1, 1.5],
  [2, 1.5],
  [0.5, 2.5],
  [3, 2],
  [1.5, 3.2],
] as const) {
  push({
    golden: { head: "ExpIntegralE", args: [n, z], label: `E_${n}(${z})`, tol: 1e-9 },
    wl: `ExpIntegralE[${n}, ${z}]`,
  });
}

// --- LambertW(z, k) for k other than 0/-1 ---------------------------------------------
for (const [z, k] of [
  [-0.14, -3],
  [5, 2],
  [-1, 1],
  [10, 5],
] as const) {
  push({
    golden: { head: "LambertW", args: [z, k], label: `W_${k}(${z})`, tol: 1e-9 },
    wl: `ProductLog[${k}, ${z}]`,
  });
}
// LambertW at a complex point, branch 3.
push({
  golden: {
    head: "LambertW",
    args: [["Complex", 1, 2], 3],
    label: "W_3(1+2i)",
    tol: 1e-9,
  },
  wl: "ProductLog[3, 1 + 2*I]",
});

// --- InverseErfc(s) -------------------------------------------------------------------
for (const s of [0.5, 0.01, 1.7, 0.001]) {
  push({
    golden: { head: "InverseErfc", args: [s], label: `erfcInv(${s})`, tol: 1e-9 },
    wl: `InverseErfc[${s}]`,
  });
}

// --- InverseGammaRegularized(a, s) -----------------------------------------------------
for (const [a, s] of [
  [2, 0.5],
  [2.5, 0.3],
  [5, 0.1],
  [0.5, 0.9],
] as const) {
  push({
    golden: {
      head: "InverseGammaRegularized",
      args: [a, s],
      label: `Qinv(${a},${s})`,
      tol: 1e-9,
    },
    wl: `InverseGammaRegularized[${a}, ${s}]`,
  });
}

// --- InverseBetaRegularized(s, a, b) ---------------------------------------------------
for (const [s, a, b] of [
  [0.5, 2, 3],
  [0.3, 2.5, 1.5],
  [0.7, 4, 2],
] as const) {
  push({
    golden: {
      head: "InverseBetaRegularized",
      args: [s, a, b],
      label: `Iinv(${s},${a},${b})`,
      tol: 1e-9,
    },
    wl: `InverseBetaRegularized[${s}, ${a}, ${b}]`,
  });
}

// --- BellY(n, k, xs) --------------------------------------------------------------------
for (const [n, k, xs] of [
  [5, 3, [1, 2, 3]],
  [6, 2, [2, 3, 5, 7, 11]],
  [7, 4, [1, 1, 2, 5]],
] as const) {
  push({
    golden: {
      head: "BellY",
      args: [n, k, ["List", ...xs]],
      label: `BellY(${n},${k},${JSON.stringify(xs)})`,
      tol: 1e-9,
    },
    wl: `BellY[${n}, ${k}, {${xs.join(", ")}}]`,
  });
}

// --- NorlundB(n, a) -----------------------------------------------------------------
for (const [n, a] of [
  [6, 4],
  [5, 3],
  [7, 2],
] as const) {
  push({
    golden: { head: "NorlundB", args: [n, a], label: `NorlundB(${n},${a})`, tol: 1e-9 },
    wl: `NorlundB[${n}, ${a}]`,
  });
}

// --- PrimeZetaP(s) --------------------------------------------------------------------
for (const s of [2, 3, 4, 2.5]) {
  push({
    golden: { head: "PrimeZetaP", args: [s], label: `P(${s})`, tol: 1e-9 },
    wl: `PrimeZetaP[${s}]`,
  });
}

// --- HypergeometricPFQ(upper, lower, z) ------------------------------------------------
for (const [upper, lower, z] of [
  [[1, 1], [2], 0.5],
  [[1, 2, 3], [4, 5], 0.5],
  [[2, 3], [5], 0.3],
] as const) {
  push({
    golden: {
      head: "HypergeometricPFQ",
      args: [["List", ...upper], ["List", ...lower], z],
      label: `pFq(${JSON.stringify(upper)};${JSON.stringify(lower)};${z})`,
      tol: 1e-9,
    },
    wl: `HypergeometricPFQ[{${upper.join(", ")}}, {${lower.join(", ")}}, ${z}]`,
  });
}

// --- KleinInvariantJ(tau) ----------------------------------------------------------
for (const [re, im] of [
  [0, 1],
  [0, 2],
  [1, 2],
] as const) {
  push({
    golden: {
      head: "KleinInvariantJ",
      args: [["Complex", re, im]],
      label: `J(${re}+${im}i)`,
      tol: 1e-8,
    },
    wl: `N[KleinInvariantJ[${re} + (${im})*I], 20]`,
  });
}

// --- Run the kernel, compare, write -----------------------------------------------
function parseLines(text: string, convert: (s: string) => number): Map<number, Pair> {
  const map = new Map<number, Pair>();
  for (const line of text.split("\n")) {
    const parts = line.trim().split("|");
    if (parts.length !== 3) continue;
    const [k, re, im] = parts;
    map.set(Number(k), [convert(re), convert(im)]);
  }
  return map;
}

const wlCode = pending
  .map(
    (p, k) =>
      `With[{v=N[${p.wl}, 25]},Print[${k},"|",ToString[Re[v],InputForm],"|",ToString[Im[v],InputForm]]]`,
  )
  .join(";\n");
const wlClean = (s: string): number => Number(s.replace(/`[\d.]+/g, "").replace(/\*\^/g, "e"));
const wl = parseLines(
  await runKernel("wolframscript", ["-code", wlCode], { timeoutMs: 300_000 }),
  wlClean,
);

const relErr = (ours: Pair, ref: Pair): number =>
  Math.max(Math.abs(ours[0] - ref[0]), Math.abs(ours[1] - ref[1])) /
  Math.max(1, Math.hypot(ref[0], ref[1]));

const goldens: GoldenCase[] = [];
const disagree: string[] = [];
let compared = 0;
for (const [k, p] of pending.entries()) {
  const g = p.golden;
  const w = wl.get(k);
  if (w && w.every(Number.isFinite)) g.wolfram = w;
  const r = ce.box([g.head, ...g.args] as never).N();
  const ours: Pair = [r.re, r.im];
  if (g.wolfram) {
    compared++;
    const err = relErr(ours, g.wolfram);
    if (!(err <= g.tol))
      disagree.push(
        `${g.label} vs wolfram: ours=(${ours.join(", ")}) ref=(${g.wolfram.join(", ")}) relerr=${err.toExponential(2)} tol=${g.tol}`,
      );
  }
  goldens.push(g);
}

writeFileSync(
  new URL("../tests/backlog-heads.golden.json", import.meta.url),
  `${JSON.stringify(goldens, null, 2)}\n`,
);

process.stdout.write(`${goldens.length} cases, ${compared} compared against wolfram\n`);
if (disagree.length > 0) {
  process.stdout.write(`${disagree.length} disagreements:\n${disagree.join("\n")}\n`);
  process.exitCode = 1;
}
