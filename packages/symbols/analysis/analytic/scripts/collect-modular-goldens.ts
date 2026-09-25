// Collect oracle values for the modular heads — ModularJ, ModularLambda, EisensteinG —
// from BOTH mpmath (kleinj, jtheta) and a Wolfram kernel, and write them to
// tests/modular.golden.json. Same shape as collect-carlson-goldens.ts: the test suite
// checks our numeric evaluation against these pinned values, so `vp test` needs neither
// oracle installed; this script does.
//
// Conventions pinned here:
//  - mpmath's `kleinj(tau)` returns j(τ)/1728 (its own normalization) — so the mpmath
//    reference for ModularJ multiplies by 1728. Wolfram's `KleinInvariantJ` is the same
//    j/1728, so the Wolfram reference does the same scaling; `ModularLambda` needs no
//    scaling on either oracle.
//  - EisensteinG has no oracle head under that name in either system, so it is checked
//    only against the closed form G_k = 2ζ(k)E_k fed mpmath's own eisenstein series
//    (mpmath has no direct EisensteinE either, so this uses mpmath's `eisensteinE`? —
//    mpmath in fact has no such head; instead this checks EisensteinG against 2ζ(k)
//    times our OWN ModularJ-validated EisensteinE-backed reduction, i.e. against
//    mpmath's q-series for E_k computed here directly) — see the eisensteinEmp() below.
//
// Requires python3 + mpmath and wolframscript on PATH. Run from the package:
//   node scripts/collect-modular-goldens.ts

import { writeFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAnalytic } from "../src/index.ts";
import { runKernel } from "@enumeratio/oracle/bounded";

const ce = new ComputeEngine();
declareAnalytic(ce);

type Pair = [number, number];

interface GoldenCase {
  head: string;
  args: unknown[];
  label: string;
  tol: number;
  mpmath?: Pair;
  wolfram?: Pair;
}

interface Pending {
  golden: GoldenCase;
  py?: string;
  wl?: string;
}
const pending: Pending[] = [];
const push = (p: Pending): void => void pending.push(p);

const toCE = (re: number, im: number): unknown => (im === 0 ? re : ["Complex", re, im]);
const toWL = (re: number, im: number): string => (im === 0 ? String(re) : `(${re}+(${im})*I)`);
const label = (re: number, im: number): string => `${re}${im < 0 ? "" : "+"}${im}i`;

// A spread of τ in the upper half-plane: the two special points with known exact
// values, one deep inside the standard fundamental domain, and several OUTSIDE it
// (near the real axis, translated, and inverted) — these are exactly the points the
// SL2(Z) reduction in modular.ts exists for, so they exercise it rather than only the
// native kernel's own direct-evaluation path.
const taus: Pair[] = [
  [0, 1], // i: j = 1728, λ = 1/2
  [-0.5, Math.sqrt(3) / 2], // ρ = e^{2πi/3}: j = 0
  [0.3, 1.1], // generic, inside the fundamental domain
  [0.3, 0.05], // near the real axis — needs reduction for precision
  [1.3, 0.05], // same point translated by 1
  [2.7, 1.4], // Re(τ) far outside [−½, ½]
  [-1.4, 0.6], // negative Re(τ), |τ| < 1 — needs an S step
];

for (const [re, im] of taus) {
  push({
    golden: {
      head: "ModularJ",
      args: [toCE(re, im)],
      label: `ModularJ(${label(re, im)})`,
      tol: 1e-9,
    },
    py: `1728*kleinj(mpc('${re}','${im}'))`,
    wl: `1728*KleinInvariantJ[${toWL(re, im)}]`,
  });
  push({
    golden: {
      head: "ModularLambda",
      args: [toCE(re, im)],
      label: `ModularLambda(${label(re, im)})`,
      tol: 1e-9,
    },
    py: `modlambda(mpc('${re}','${im}'))`,
    wl: `ModularLambda[${toWL(re, im)}]`,
  });
}

// EisensteinG(k, τ): k = 4, 6, 8, checked via G_k = 2ζ(k)·E_k(τ), E_k(τ) computed by
// mpmath's own q-series (mpmath has no eisensteinE head, so the reference below sums
// the series directly — this is the SAME series `EisensteinE` runs natively, so it
// checks our reduction/back-transform machinery, not an independent formula).
for (const k of [4, 6, 8] as const) {
  for (const [re, im] of taus) {
    push({
      golden: {
        head: "EisensteinG",
        args: [k, toCE(re, im)],
        label: `EisensteinG(${k}, ${label(re, im)})`,
        tol: 1e-8,
      },
      py: `2*zeta(${k})*eisensteinE(${k}, mpc('${re}','${im}'))`,
      wl: `2*Zeta[${k}]*(1 - (2*${k}/BernoulliB[${k}])*Sum[DivisorSigma[${k - 1}, n]*Exp[2*Pi*I*n*(${toWL(re, im)})], {n, 1, 400}])`,
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
from mpmath import mp, mpf, mpc, kleinj, jtheta, qfrom, zeta, nsum, inf

mp.dps = 30

def modlambda(tau):
    q = qfrom(tau=tau)
    return jtheta(2, 0, q)**4 / jtheta(3, 0, q)**4

def eisensteinE(k, tau):
    # E_k(tau) = 1 - (2k/B_k) * sum_{n>=1} sigma_{k-1}(n) q^n, q = e^{2 pi i tau}
    from mpmath import bernoulli, exp, pi, mpc as _mpc
    q = exp(2j * pi * tau)
    def sigma(n, p):
        s = mpf(0)
        d = 1
        while d * d <= n:
            if n % d == 0:
                s += mpf(d) ** p
                if d != n // d:
                    s += mpf(n // d) ** p
            d += 1
        return s
    total = mpc(0)
    qn = mpc(1)
    for n in range(1, 200):
        qn *= q
        total += sigma(n, k - 1) * qn
        if abs(qn) < mpf(10) ** (-40):
            break
    return 1 - (2 * k / bernoulli(k)) * total

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
  new URL("../tests/modular.golden.json", import.meta.url),
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
