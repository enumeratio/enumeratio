// Collect mpmath values for ζ(s, a) at 40 and 80 digits — real s left of Re(s) = 0 and
// non-integer a, where the Euler–Maclaurin in src/precise.ts cancels most of its digits —
// and write them to tests/precise-zeta.golden.json. The test suite holds N() at that
// precision to them, so `vp test` doesn't need mpmath; this script does.
//
// Requires python3 + mpmath on PATH. Run from the package:
//   node scripts/collect-precise-zeta-goldens.ts

import { writeFileSync } from "node:fs";
import { runKernel } from "@enumeratio/oracle/bounded";

type Rational = [number, number];

export interface PreciseZetaGolden {
  s: Rational;
  a: Rational;
  digits: number;
  /** mpmath's value, ten digits past `digits`. */
  mpmath: string;
}

// Deep left of the strip first — the cases that lost digits — then shallow ones, and one
// right of it where nothing cancels.
const grid: [Rational, Rational][] = [
  [
    [-41, 2],
    [3, 10],
  ],
  [
    [-81, 2],
    [2, 5],
  ],
  [
    [-21, 2],
    [3, 10],
  ],
  [
    [-11, 2],
    [27, 10],
  ],
  [
    [-5, 2],
    [3, 10],
  ],
  [
    [-1, 2],
    [1, 20],
  ],
  [
    [1, 2],
    [5, 4],
  ],
];
const DIGITS = [40, 80];

const rows = DIGITS.flatMap((digits) => grid.map(([s, a]) => ({ s, a, digits })));
const py = `
from mpmath import mp, mpf, zeta, nstr
cases = [
${rows.map(({ s, a, digits }) => `    (${digits}, ${s[0]}, ${s[1]}, ${a[0]}, ${a[1]}),`).join("\n")}
]
for d, sn, sd, an, ad in cases:
    mp.dps = d + 30
    print(nstr(zeta(mpf(sn) / sd, mpf(an) / ad), d + 10))
`;
const out = (await runKernel("python3", ["-c", py], { timeoutMs: 120_000 })).trim().split("\n");
if (out.length !== rows.length)
  throw new Error(`mpmath gave ${out.length} values for ${rows.length} cases`);

const goldens: PreciseZetaGolden[] = rows.map((row, k) => ({ ...row, mpmath: out[k] }));
writeFileSync(
  new URL("../tests/precise-zeta.golden.json", import.meta.url),
  JSON.stringify(goldens, null, 2) + "\n",
);
console.log(`cases ${goldens.length}`);
