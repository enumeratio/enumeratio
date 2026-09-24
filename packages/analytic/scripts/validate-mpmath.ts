// Cross-validate the analytic heads (HurwitzZeta, LerchPhi, PolyLog, PolyGamma)
// against mpmath — a second, independent oracle alongside the wolframscript one.
// mpmath's `zeta(s, a)` uses the same principal
// (Hurwitz) convention as our HurwitzZeta, and — unlike Wolfram's numeric
// N[HurwitzZeta[-n, a]] — it is correct at negative-integer s, so it also pins the
// ζ(−n, a) Bernoulli-polynomial branch. (mpmath has no generalized-Zeta convention,
// so the two-argument `Zeta` is validated only against Wolfram.) `polylog` and
// `polygamma` take the same argument order as the heads.
//
// numpy itself has no zeta; scipy.special.zeta(x, q) is the same Hurwitz function
// but only for real x > 1. mpmath is pure-Python and covers complex s, a and the
// full continuation, so it is the better ecosystem oracle.
//
// Requires python3 with mpmath. Not part of `vp test`; run:
//   vp node packages/analytic/scripts/validate-mpmath.ts

import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAnalytic } from "../src/index.ts";
import { runKernel } from "@enumeratio/oracle/bounded";

const ce = new ComputeEngine();
declareAnalytic(ce);

type Val = number | { rat: [number, number] } | { c: [number, number] };

const toCE = (v: Val): unknown =>
  typeof v === "number" ? v : "rat" in v ? ["Rational", ...v.rat] : ["Complex", ...v.c];

const toPy = (v: Val): string =>
  typeof v === "number"
    ? `mpf('${v}')`
    : "rat" in v
      ? `(mpf(${v.rat[0]})/mpf(${v.rat[1]}))`
      : `mpc('${v.c[0]}','${v.c[1]}')`;

const label = (v: Val): string =>
  typeof v === "number"
    ? String(v)
    : "rat" in v
      ? `${v.rat[0]}/${v.rat[1]}`
      : `${v.c[0]}${v.c[1] < 0 ? "" : "+"}${v.c[1]}i`;

// s includes negative integers (the Bernoulli branch mpmath gets right); a > 0 and
// non-integer negatives (mpmath uses the same complex principal branch we do).
const sGrid: Val[] = [
  2,
  3,
  5,
  -1,
  -2,
  -3,
  0.5,
  1.5,
  2.5,
  -0.5,
  { c: [2, 1] },
  { c: [0.5, 3] },
  { c: [-0.5, 1] },
];
const aGrid: Val[] = [
  1,
  2,
  3,
  0.5,
  0.25,
  1.3,
  { rat: [7, 3] },
  { c: [1, 1] },
  { c: [2, -0.5] },
  -0.5,
  -1.5,
];

interface Case {
  label: string;
  py: string;
  re: number;
  im: number;
}

const cases: Case[] = [];
for (const s of sGrid) {
  for (const a of aGrid) {
    if (s === 1) continue; // pole
    const r = ce.box(["HurwitzZeta", toCE(s), toCE(a)] as never).N();
    cases.push({
      label: `ζ(${label(s)}, ${label(a)})`,
      py: `zeta(${toPy(s)}, ${toPy(a)})`,
      re: r.re,
      im: r.im,
    });
  }
}

// LerchPhi Φ(z, s, a) over |z| < 1 (the series region), incl. complex z.
// -1 and -0.9 exercise the Euler-transform path on and near the |z| = 1 rim.
const zGrid: Val[] = [
  0.5,
  -0.5,
  -0.9,
  -1,
  0.25,
  0.9,
  { rat: [1, 3] },
  { c: [0.4, 0.3] },
  { c: [-0.3, 0.5] },
];
for (const z of zGrid) {
  for (const s of [2, 3, 0.5, -1, { c: [2, 1] }] as Val[]) {
    for (const a of [1, 2, 0.5, { rat: [5, 2] }] as Val[]) {
      const r = ce.box(["LerchPhi", toCE(z), toCE(s), toCE(a)] as never).N();
      cases.push({
        label: `Φ(${label(z)}, ${label(s)}, ${label(a)})`,
        py: `lerchphi(${toPy(z)}, ${toPy(s)}, ${toPy(a)})`,
        re: r.re,
        im: r.im,
      });
    }
  }
}

// PolyLog Liₛ(z) over the same disk, at the non-integer and complex orders our
// extension covers (integer orders are compute-engine's own native evaluator).
// mpmath's argument order is polylog(s, z), matching the head.
for (const s of [2, 3, 0.5, 1.5, 2.5, -1, { c: [2, 1] }, { c: [0.5, -1] }] as Val[]) {
  for (const z of [0.5, -0.5, 0.25, 0.9, { rat: [1, 3] }, { c: [0.4, 0.3] }] as Val[]) {
    const r = ce.box(["PolyLog", toCE(s), toCE(z)] as never).N();
    cases.push({
      label: `Li(${label(s)}, ${label(z)})`,
      py: `polylog(${toPy(s)}, ${toPy(z)})`,
      re: r.re,
      im: r.im,
    });
  }
}

// Polygamma ψ⁽ᵐ⁾(z), integer order m ≥ 1 — real z (native) and complex z (ours).
// mpmath's polygamma(m, z) uses the same convention.
for (const m of [1, 2, 3, 5] as Val[]) {
  for (const z of [
    1,
    2,
    0.5,
    1.3,
    { rat: [7, 3] },
    { c: [1, 1] },
    { c: [0.5, 0.3] },
    { c: [2, -0.5] },
  ] as Val[]) {
    const r = ce.box(["PolyGamma", toCE(m), toCE(z)] as never).N();
    cases.push({
      label: `ψ^(${label(m)})(${label(z)})`,
      py: `polygamma(${toPy(m)}, ${toPy(z)})`,
      re: r.re,
      im: r.im,
    });
  }
}

const py = `
from mpmath import mp, mpf, mpc, zeta, lerchphi, polylog, polygamma
mp.dps = 30
cases = [
${cases.map((c) => `    ${c.py},`).join("\n")}
]
for k, v in enumerate(cases):
    v = mpc(v)
    print(f"{k}|{v.real}|{v.imag}")
`;

const out = await runKernel("python3", ["-c", py], { timeoutMs: 120_000 });

const got = new Map<number, [number, number]>();
for (const line of out.split("\n")) {
  const m = line.match(/^(\d+)\|(.*)\|(.*)$/);
  if (m) got.set(Number(m[1]), [Number(m[2]), Number(m[3])]);
}

let agree = 0;
let worst = 0;
const disagree: string[] = [];
for (const [k, c] of cases.entries()) {
  const w = got.get(k);
  if (!w || !Number.isFinite(w[0]) || !Number.isFinite(w[1])) {
    disagree.push(`${c.label}: mpmath=${w ? w.join(",") : "?"} (non-finite/unparsed)`);
    continue;
  }
  const scale = Math.max(1, Math.hypot(w[0], w[1]));
  const err = Math.max(Math.abs(c.re - w[0]), Math.abs(c.im - w[1])) / scale;
  worst = Math.max(worst, err);
  if (err <= 1e-10) agree++;
  else
    disagree.push(
      `${c.label}: CE=(${c.re}, ${c.im})  mpmath=(${w[0]}, ${w[1]})  relerr=${err.toExponential(2)}`,
    );
}

console.log(`\nCOMPARED ${cases.length}  |  agree ${agree}  disagree ${disagree.length}`);
console.log(`worst relative error among matched: ${worst.toExponential(3)}`);
if (disagree.length) {
  console.log("\n--- DISAGREEMENTS (> 1e-10) ---");
  for (const d of disagree) console.log("  " + d);
}

if (disagree.length > 0) process.exitCode = 1;
