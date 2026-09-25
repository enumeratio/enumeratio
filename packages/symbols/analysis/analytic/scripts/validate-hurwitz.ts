// Cross-validate HurwitzZeta(s, a) against a Wolfram kernel. Evaluate our head
// over a grid of s, a with compute-engine, evaluate Wolfram's `HurwitzZeta[s, a]`
// for the same grid in one `wolframscript` call, and assert agreement to ~1e-10.
//
// Requires Wolfram Engine + wolframscript on PATH. Not part of `vp test`; run:
//   vp node packages/symbols/analysis/analytic/scripts/validate-hurwitz.ts
//
// Wolfram's `N[…, 25]` prints with a precision backtick (1.644…`25.) and uses
// `*^` for exponents; both are sanitized before parsing.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAnalytic } from "../src/index.ts";
import { runKernel } from "@enumeratio/oracle/bounded";

const ce = new ComputeEngine();
declareAnalytic(ce);

type Val = number | { rat: [number, number] } | { c: [number, number] };

const toCE = (v: Val): unknown =>
  typeof v === "number" ? v : "rat" in v ? ["Rational", ...v.rat] : ["Complex", ...v.c];

const toWL = (v: Val): string =>
  typeof v === "number" ? String(v) : "rat" in v ? `${v.rat[0]}/${v.rat[1]}` : `(${v.c[0]} + (${v.c[1]})*I)`;

const label = (v: Val): string =>
  typeof v === "number"
    ? String(v)
    : "rat" in v
      ? `${v.rat[0]}/${v.rat[1]}`
      : `${v.c[0]}${v.c[1] < 0 ? "" : "+"}${v.c[1]}i`;

// s: real integers (incl. nonpositive → Bernoulli branch), real non-integers, complex.
const sGrid: Val[] = [
  2,
  3,
  4,
  5,
  8,
  0,
  -1,
  -2,
  -3,
  0.5,
  1.5,
  2.5,
  3.5,
  -0.5,
  -1.5,
  0.25,
  { c: [2, 1] },
  { c: [0.5, 3] },
  { c: [1.5, -2] },
  { c: [-0.5, 1] },
];
// a > 0 (classical region), plus non-integer negatives (analytic continuation).
const aGrid: Val[] = [
  1,
  2,
  3,
  10,
  0.5,
  0.25,
  0.75,
  1.3,
  3.7,
  { rat: [7, 3] },
  { c: [1, 1] },
  { c: [2, -0.5] },
  -0.5,
  -1.5,
  -2.5,
];

interface Case {
  label: string;
  wl: string;
  re: number;
  im: number;
}

// Validate both heads against their respective Wolfram functions. FunctionExpand
// first: Wolfram's numeric N[HurwitzZeta[-n, a]]/N[Zeta[-n, a]] is wrong for some
// rational a (e.g. -3, 7/3 — off by 1/120), but its symbolic reduction is right and
// matches us. N[FunctionExpand[…]] is the correct reference everywhere.
const heads = ["HurwitzZeta", "Zeta"] as const;

const cases: Case[] = [];
for (const head of heads) {
  for (const s of sGrid) {
    for (const a of aGrid) {
      if (s === 1) continue; // pole
      const r = ce.box([head, toCE(s), toCE(a)] as never).N();
      cases.push({
        label: `${head === "Zeta" ? "Z" : "ζ"}(${label(s)}, ${label(a)})`,
        wl: `N[FunctionExpand[${head}[${toWL(s)}, ${toWL(a)}]], 25]`,
        re: r.re,
        im: r.im,
      });
    }
  }
}

const code = cases
  .map((c, k) => `With[{v=${c.wl}},Print[${k},"|",ToString[Re[v],InputForm],"|",ToString[Im[v],InputForm]]]`)
  .join(";\n");

const out = await runKernel("wolframscript", ["-code", code], { timeoutMs: 300_000 });

const clean = (s: string): number => Number(s.replace(/`[\d.]+/g, "").replace(/\*\^/g, "e"));

const got = new Map<number, [number, number]>();
for (const line of out.split("\n")) {
  const m = line.match(/^(\d+)\|(.*)\|(.*)$/);
  if (m) got.set(Number(m[1]), [clean(m[2]), clean(m[3])]);
}

let agree = 0;
let worst = 0;
const disagree: string[] = [];
const missing: string[] = [];
for (const [k, c] of cases.entries()) {
  const w = got.get(k);
  if (!w || !Number.isFinite(w[0]) || !Number.isFinite(w[1])) {
    missing.push(`${c.label}: WL=${w ? w.join(",") : "?"}`);
    continue;
  }
  const [wr, wi] = w;
  const scale = Math.max(1, Math.hypot(wr, wi));
  const err = Math.max(Math.abs(c.re - wr), Math.abs(c.im - wi)) / scale;
  worst = Math.max(worst, err);
  if (err <= 1e-10) agree++;
  else disagree.push(`${c.label}: CE=(${c.re}, ${c.im})  WL=(${wr}, ${wi})  relerr=${err.toExponential(2)}`);
}

console.log(`\nCOMPARED ${cases.length}  |  agree ${agree}  disagree ${disagree.length}  missing ${missing.length}`);
console.log(`worst relative error among matched: ${worst.toExponential(3)}`);
if (disagree.length) {
  console.log("\n--- DISAGREEMENTS (> 1e-10) ---");
  for (const d of disagree) console.log("  " + d);
}
if (missing.length) {
  console.log("\n--- WL non-finite / unparsed ---");
  for (const m of missing) console.log("  " + m);
}

if (disagree.length > 0) process.exitCode = 1;
