// Grid points for the analytic special functions — HurwitzZeta, LerchPhi, PolyLog and
// PolyGamma over real, rational and complex arguments, across the branches their
// continuations take — kept as reference examples, as data, in
// src/entries/special-functions.examples.json. Each is `N(head(args))` with our value as its
// `expected`, so the reference tests pin it and every oracle lane (mpmath, SymPy, Sage,
// Wolfram, Julia, Rust) checks it from the same MathJSON. They are `hidden`: too many to
// render, but data like any other example.
//
// Regenerate after a change to the heads or the grids:
//   node packages/reference/scripts/collect-examples.ts

import { writeFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAnalytic } from "@enumeratio/analytic/src";

const ce = new ComputeEngine();
declareAnalytic(ce);

type Val = number | { rat: [number, number] } | { c: [number, number] };

const toCE = (v: Val): unknown =>
  typeof v === "number" ? v : "rat" in v ? ["Rational", ...v.rat] : ["Complex", ...v.c];

interface Example {
  expr: unknown;
  expected: unknown;
  hidden: true;
  divergence?: { wolfram: string };
}
const byHead: Record<string, Example[]> = {};

/** Wolfram's LerchPhi takes ((a+k)²)^(−s/2) where a + k < 0: a convention, said on the example. */
const LERCH_NEGATIVE_A =
  "For a + k < 0 Wolfram's LerchPhi sums ((a+k)²)^(−s/2), the generalized-zeta convention; ours, like mpmath and SymPy, takes (a+k)^(−s) on the principal branch.";
/** One grid point. `valueOnly` keeps it only where ours evaluates — past |z| = 1, LerchPhi
 * declines where it can't vouch for double precision, and a decline isn't a grid point. */
const add = (call: unknown[], valueOnly = false): void => {
  const expr = ["N", call];
  const expected = ce.box(expr as never).evaluate().json;
  if (valueOnly && Array.isArray(expected) && expected[0] === call[0]) return;
  const negativeA = call[0] === "LerchPhi" && typeof call[3] === "number" && call[3] < 0;
  (byHead[call[0] as string] ??= []).push({
    expr,
    expected,
    hidden: true,
    ...(negativeA ? { divergence: { wolfram: LERCH_NEGATIVE_A } } : {}),
  });
};

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

for (const s of sGrid) {
  for (const a of aGrid) {
    if (s === 1) continue; // pole
    add(["HurwitzZeta", toCE(s), toCE(a)]);
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
      add(["LerchPhi", toCE(z), toCE(s), toCE(a)]);
    }
  }
}

// …and past |z| = 1, where LerchPhi is continued by its integral representation: real z on
// the cut (either sign), complex z, a < 0 through the recurrence.
for (const z of [
  2,
  -2,
  3,
  1.5,
  -1.5,
  { c: [1, 2] },
  { c: [-1.5, 1] },
  { c: [0.8, 0.9] },
] as Val[]) {
  for (const s of [2, 3, 0.5, { c: [2, 1] }] as Val[]) {
    for (const a of [1, 2, 0.5, { rat: [5, 2] }, -2.5] as Val[]) {
      add(["LerchPhi", toCE(z), toCE(s), toCE(a)], true);
    }
  }
}

// PolyLog Liₛ(z) over the same disk, at the non-integer and complex orders our
// extension covers (integer orders are compute-engine's own native evaluator).
// mpmath's argument order is polylog(s, z), matching the head.
for (const s of [2, 3, 0.5, 1.5, 2.5, -1, { c: [2, 1] }, { c: [0.5, -1] }] as Val[]) {
  for (const z of [0.5, -0.5, 0.25, 0.9, { rat: [1, 3] }, { c: [0.4, 0.3] }] as Val[]) {
    add(["PolyLog", toCE(s), toCE(z)]);
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
    add(["PolyGamma", toCE(m), toCE(z)]);
  }
}

writeFileSync(
  new URL("../src/entries/special-functions.examples.json", import.meta.url),
  `${JSON.stringify(byHead, null, 2)}\n`,
);
process.stderr.write(
  `${Object.entries(byHead)
    .map(([head, rows]) => `${head} ${rows.length}`)
    .join(", ")}\n`,
);
