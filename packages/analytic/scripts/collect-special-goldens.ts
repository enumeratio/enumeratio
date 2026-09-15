// Collect oracle values for the special-function heads beyond the zeta family —
// BarnesG, LogBarnesG, LogGamma, ClausenCl, DirichletEta, DirichletBeta,
// StieltjesGamma, DirichletCharacter, DirichletL, and the three-argument incomplete
// Gamma / GammaRegularized — from BOTH mpmath and a Wolfram kernel, and write them to
// tests/special-functions.golden.json. The test suite then checks our numeric
// evaluation against those pinned values, so `vp test` needs neither oracle
// installed; this script does. It also reports agreement as it goes and exits
// nonzero on a disagreement, so it doubles as the validate-*.ts run for these heads.
//
// Conventions pinned here:
//  - LogGamma / LogBarnesG are the analytic continuations (branch cut (−∞, 0]), not
//    the principal log of the value; mpmath's loggamma agrees, it has no log-Barnes,
//    so LogBarnesG is mpmath-checked only where log∘barnesg is unambiguous (z > 0).
//  - Wolfram has no Clausen head; Cl_n is Im/Re PolyLog[n, E^(Iθ)] (even/odd n).
//  - mpmath's stieltjes(n, a) hangs for complex and negative a; those rows are Wolfram-only.
//  - mpmath has no character indexing, so DirichletCharacter is Wolfram-only and DirichletL
//    is checked against mpmath's `dirichlet(s, chi)` fed OUR character values — which makes
//    that row a check of the L-series summation given the table, with the table itself
//    pinned against Wolfram's DirichletCharacter separately. mpmath's chi is indexed by
//    n mod k, so chi[0] is χ(k); it diverges on the principal character at Re(s) ≤ 1.
//
// Requires python3 + mpmath and wolframscript on PATH. Run from the package:
//   node scripts/collect-special-goldens.ts

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { character, declareAnalytic, eulerPhi } from "../src/index.ts";

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
const isReal = (v: Val): boolean => typeof v === "number" || "rat" in v;
const realPart = (v: Val): number =>
  typeof v === "number" ? v : "rat" in v ? v.rat[0] / v.rat[1] : v.c[0];

interface Pending {
  golden: GoldenCase;
  py?: string;
  wl?: string;
}
const pending: Pending[] = [];
const push = (p: Pending): void => void pending.push(p);

// --- BarnesG / LogBarnesG / LogGamma over one complex grid ------------------------
const zGrid: Val[] = [
  0.5,
  1.5,
  2.5,
  7,
  10.5,
  0.3,
  0.001,
  { rat: [7, 3] },
  { c: [0.5, 1.5] },
  { c: [2.5, 1.5] },
  { c: [-2.5, 1.5] },
  { c: [-0.7, -3] },
  { c: [12, 40] },
  { c: [3, -8] },
  -2.5,
  -0.5,
  -7.5,
];
for (const z of zGrid) {
  push({
    golden: { head: "BarnesG", args: [toCE(z)], label: `G(${label(z)})`, tol: 1e-11 },
    py: `barnesg(${toPy(z)})`,
    wl: `BarnesG[${toWL(z)}]`,
  });
  push({
    golden: { head: "LogBarnesG", args: [toCE(z)], label: `lnG(${label(z)})`, tol: 1e-12 },
    py: isReal(z) && realPart(z) > 0 ? `log(barnesg(${toPy(z)}))` : undefined,
    wl: `LogBarnesG[${toWL(z)}]`,
  });
  push({
    golden: { head: "LogGamma", args: [toCE(z)], label: `lnΓ(${label(z)})`, tol: 1e-13 },
    py: `loggamma(${toPy(z)})`,
    wl: `LogGamma[${toWL(z)}]`,
  });
}

// --- ClausenCl(n, θ): mpmath clsin/clcos; Wolfram via PolyLog on the unit circle ----
const thetaGrid: Val[] = [0.1, 1, 2.5, 4, -1.2, 7.5, 0.001, 3.14159, { rat: [1, 3] }];
for (const n of [1, 2, 3, 4, 5, 8, 11]) {
  for (const t of thetaGrid) {
    const even = n % 2 === 0;
    push({
      golden: {
        head: "ClausenCl",
        args: [n, toCE(t)],
        label: `Cl_${n}(${label(t)})`,
        tol: 1e-13,
      },
      py: `${even ? "clsin" : "clcos"}(${n}, ${toPy(t)})`,
      wl: `${even ? "Im" : "Re"}[PolyLog[${n}, Exp[I*(${toWL(t)})]]]`,
    });
  }
}

// --- DirichletEta / DirichletBeta over complex s ------------------------------------
const sGrid: Val[] = [
  2,
  3,
  0.5,
  1.5,
  -0.5,
  -1,
  -3,
  0,
  // Next to the removable point s = 1 — as exact rationals, so Wolfram evaluates them
  // at 25 digits rather than cancelling the pole in machine precision.
  { rat: [10000001, 10000000] },
  { rat: [9999, 10000] },
  { rat: [1, 3] },
  { c: [0.5, 14.1] },
  { c: [2, 1] },
  { c: [1.5, -3] },
  { c: [-0.5, 2] },
  { c: [0, 1] },
];
for (const s of sGrid) {
  push({
    golden: { head: "DirichletEta", args: [toCE(s)], label: `η(${label(s)})`, tol: 1e-11 },
    py: `altzeta(${toPy(s)})`,
    wl: `DirichletEta[${toWL(s)}]`,
  });
  push({
    golden: { head: "DirichletBeta", args: [toCE(s)], label: `β(${label(s)})`, tol: 1e-11 },
    py: `dirichlet(${toPy(s)}, [0, 1, 0, -1])`,
    wl: `DirichletBeta[${toWL(s)}]`,
  });
}

// --- StieltjesGamma(n, a): precision decays with n (see stieltjes.ts) ---------------
const stieltjesTol = (n: number): number => (n <= 15 ? 1e-11 : n <= 20 ? 1e-10 : 1e-7);
const aGrid: Val[] = [1, 0.5, 2, 0.25, 3.7, { rat: [7, 3] }, { c: [1, 1] }, { c: [3.7, -2] }, -0.5];
for (const n of [0, 1, 2, 3, 5, 10, 15, 20, 25, 30]) {
  for (const a of aGrid) {
    const oneArg = a === 1;
    push({
      golden: {
        head: "StieltjesGamma",
        args: oneArg ? [n] : [n, toCE(a)],
        label: oneArg ? `γ_${n}` : `γ_${n}(${label(a)})`,
        tol: stieltjesTol(n),
      },
      py: isReal(a) && realPart(a) > 0 ? `stieltjes(${n}, ${toPy(a)})` : undefined,
      wl: `StieltjesGamma[${n}, ${toWL(a)}]`,
    });
  }
}

// --- DirichletCharacter(k, j, n) and DirichletL(k, j, s) ----------------------------
// The character indexing is Wolfram's and is not given by a documented formula, so the whole
// table is pinned for a spread of moduli: prime, prime power, 2^e and composite.
for (const k of [1, 3, 4, 5, 7, 8, 9, 12, 15, 16, 21, 40]) {
  for (let j = 1; j <= eulerPhi(k); j++) {
    for (let n = 1; n <= k; n++) {
      push({
        golden: {
          head: "DirichletCharacter",
          args: [k, j, n],
          label: `χ_${j} mod ${k} (${n})`,
          tol: 1e-14,
        },
        wl: `DirichletCharacter[${k}, ${j}, ${n}]`,
      });
    }
  }
  const js = [...new Set([1, 2, 3, eulerPhi(k)])].filter((j) => j <= eulerPhi(k));
  for (const j of js) {
    for (const s of [
      2,
      3,
      0.5,
      1.0001,
      0.9,
      -1,
      -2,
      0,
      { c: [0.5, 3] },
      { c: [2, -1] },
      { c: [1, 0.1] },
      { c: [-0.5, 1] },
    ] as Val[]) {
      const chi: string[] = [];
      for (let n = 0; n < k; n++) {
        const c = character(k, j, n === 0 ? k : n);
        chi.push(`mpc('${c.re}','${c.im}')`);
      }
      const principalPole = j === 1 && isReal(s) && realPart(s) <= 1.01;
      push({
        golden: {
          head: "DirichletL",
          args: [k, j, toCE(s)],
          label: `L(${label(s)}, χ_${j} mod ${k})`,
          tol: 1e-10,
        },
        py: principalPole ? undefined : `dirichlet(${toPy(s)}, [${chi.join(", ")}])`,
        wl: `DirichletL[${k}, ${j}, ${toWL(s)}]`,
      });
    }
  }
}

// --- Gamma(s, z₀, z₁) / GammaRegularized(s, z₀, z₁) ---------------------------------
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
  for (const head of ["Gamma", "GammaRegularized"] as const) {
    const wlHead = head === "Gamma" ? "Gamma" : "GammaRegularized";
    const pyCall =
      head === "Gamma"
        ? `(gammainc(${toPy(s)}, ${toPy(z0)}, inf) - gammainc(${toPy(s)}, ${toPy(z1)}, inf))`
        : `(gammainc(${toPy(s)}, ${toPy(z0)}, inf, regularized=True) - gammainc(${toPy(s)}, ${toPy(z1)}, inf, regularized=True))`;
    push({
      golden: {
        head,
        args: [toCE(s), toCE(z0), toCE(z1)],
        label: `${head === "Gamma" ? "Γ" : "Q"}(${label(s)}, ${label(z0)}, ${label(z1)})`,
        tol: 1e-12,
      },
      // mpmath's gammainc(z, a, b) is the integral between the limits, so Γ(s, z₀) − Γ(s, z₁)
      // is the difference of two upper tails — spelled out rather than using gammainc(s,z₀,z₁)
      // so the row checks the same two calls the head makes.
      py: pyCall,
      wl: `${wlHead}[${toWL(s)}, ${toWL(z0)}, ${toWL(z1)}]`,
    });
  }
}

// --- HarmonicNumber(z) / HarmonicNumber(z, r): mpmath.harmonic (1-arg only) plus the
// ζ(r) − ζ(r, z+1) identity mpmath's Hurwitz zeta also lets us check the 2-arg form with.
// Wolfram has no separate 2-arg oracle call here either — DirichletEta/Beta above already
// exercise HurwitzZeta itself, so this just pins HarmonicNumber's own reduction.
const harmonicZGrid: Val[] = [
  2.5,
  0.5,
  -0.5,
  -2.5,
  10.5,
  { rat: [7, 3] },
  { c: [3, 2] },
  { c: [-1.5, 4] },
  { c: [0.2, -3] },
];
for (const z of harmonicZGrid) {
  push({
    golden: { head: "HarmonicNumber", args: [toCE(z)], label: `H(${label(z)})`, tol: 1e-11 },
    py: isReal(z) ? `harmonic(${toPy(z)})` : undefined,
    wl: `HarmonicNumber[${toWL(z)}]`,
  });
}
const harmonicRGrid: [Val, Val][] = [
  [2.5, 2],
  [0.5, 3],
  [{ c: [3, 2] }, 2],
  [5, { rat: [1, 2] }],
  [{ c: [-1.5, 4] }, { rat: [3, 2] }],
];
for (const [z, r] of harmonicRGrid) {
  push({
    golden: {
      head: "HarmonicNumber",
      args: [toCE(z), toCE(r)],
      label: `H(${label(z)}, ${label(r)})`,
      tol: 1e-10,
    },
    py: `(zeta(${toPy(r)}) - zeta(${toPy(r)}, ${toPy(z)} + 1))`,
    wl: `HarmonicNumber[${toWL(z)}, ${toWL(r)}]`,
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
from mpmath import mp, mpf, mpc, inf, log, barnesg, loggamma, clsin, clcos, altzeta, dirichlet, stieltjes, gammainc, harmonic, zeta
mp.dps = 30
cases = [
${pyCases.join("\n")}
]
for k, v in cases:
    v = mpc(v)
    print(f"{k}|{v.real}|{v.imag}")
`;
const mp = parseLines(
  execFileSync("python3", ["-c", py], { encoding: "utf8", timeout: 300_000 }),
  Number,
);

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
  execFileSync("wolframscript", ["-code", wlCode], { encoding: "utf8", timeout: 300_000 }),
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
