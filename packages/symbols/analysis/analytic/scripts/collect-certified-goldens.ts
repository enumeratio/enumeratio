// Collect mpmath values for the certified kernels (src/certified.ts) and the ball primitives
// under them (src/ball.ts), at 220 digits, and write them to tests/certified.golden.json. The
// tests check that every enclosure holds mpmath's value and narrows as the digits asked for
// rise, at up to 120 digits -- so `vp test` doesn't need mpmath; this script does.
//
// Arguments are written as an integer, a rational `p/q` or a decimal, and handed to mpmath
// exactly (`mpf(p)/q` at the working precision, a decimal as a string).
//
// Requires python3 + mpmath on PATH. Run from the package:
//   node scripts/collect-certified-goldens.ts

import { writeFileSync } from "node:fs";
import { runKernel } from "@enumeratio/oracle/bounded";

export interface CertifiedGolden {
  /** A head in certified.ts, or a primitive of ball.ts: `exp`, `ln`, `pow`. */
  readonly head: string;
  readonly args: readonly string[];
  /** mpmath's value to 220 significant digits (`digits`, where a row gives it). */
  readonly mpmath: string;
  readonly digits?: number;
}

export const DIGITS = 220;

const cases: [string, string[], number?][] = [
  // π, which Barnes G takes from BigDecimal's literal, to every digit it is used at.
  ["pi", [], 1100],
  ["exp", ["1/3"]],
  ["exp", ["-0.7"]],
  ["exp", ["-50"]],
  ["exp", ["123.456"]],
  ["exp", ["1e-30"]],
  ["ln", ["1/3"]],
  ["ln", ["2"]],
  ["ln", ["1.0000000001"]],
  ["ln", ["12345678.9"]],
  ["ln", ["1e-40"]],
  ["pow", ["1/3", "5/2"]],
  ["pow", ["7", "-1/3"]],
  // Inside the disk; a growing-then-shrinking series (s < 0); alternating (z < 0); slow
  // (|z| = 0.9); a small a.
  ["LerchPhi", ["1/2", "2", "1/3"]],
  ["LerchPhi", ["-1/2", "5/2", "1"]],
  ["LerchPhi", ["1/2", "-7/2", "1/4"]],
  ["LerchPhi", ["9/10", "1/2", "1"]],
  ["LerchPhi", ["-9/10", "3", "7/3"]],
  ["LerchPhi", ["1/3", "1/2", "1/10"]],
  ["LerchPhi", ["0.25", "1.5", "2.5"]],
  ["PolyLog", ["2", "1/3"]],
  ["PolyLog", ["5/2", "-1/2"]],
  ["PolyLog", ["1/2", "9/10"]],
  ["PolyLog", ["-3/2", "1/2"]],
  ["PolyLog", ["7", "1/10"]],
  ["PolyLog", ["3", "-0.3"]],
  // Right of the strip, inside it, left of it (where the direct terms cancel), a small a, and
  // the Riemann ζ as ζ(s, 1).
  ["HurwitzZeta", ["3", "1/3"]],
  ["HurwitzZeta", ["1/2", "1/3"]],
  ["HurwitzZeta", ["-5/2", "3/10"]],
  ["HurwitzZeta", ["5/2", "7/2"]],
  ["HurwitzZeta", ["2", "1/100"]],
  ["HurwitzZeta", ["1.5", "0.25"]],
  ["Zeta", ["3"]],
  ["Zeta", ["1/2"]],
  ["Zeta", ["-3/2"]],
  ["Zeta", ["7/2", "5/4"]],
  // Euler's γ = γ₀, low and higher orders, and a small a, where the direct terms dominate.
  ["StieltjesGamma", ["0"]],
  ["StieltjesGamma", ["1"]],
  ["StieltjesGamma", ["2", "1/3"]],
  ["StieltjesGamma", ["5", "7/2"]],
  ["StieltjesGamma", ["10"]],
  ["StieltjesGamma", ["3", "0.25"]],
  ["StieltjesGamma", ["1", "1/10"]],
  // Near 1 (no recurrence), up and down the recurrence, the negative axis, and its logarithm.
  ["BarnesG", ["1/3"]],
  ["BarnesG", ["0.75"]],
  ["BarnesG", ["5/2"]],
  ["BarnesG", ["21/2"]],
  ["BarnesG", ["-3/2"]],
  ["BarnesG", ["-7/3"]],
  ["LogBarnesG", ["1/2"]],
  ["LogBarnesG", ["37/2"]],
];

const py = `
from mpmath import mp, mpf, exp, log, power, lerchphi, polylog, zeta, stieltjes, barnesg, nstr
mp.dps = ${DIGITS + 30}
def arg(t):
    if "/" in t:
        p, q = t.split("/")
        return mpf(p) / int(q)
    return mpf(t)
heads = {
    "exp": exp,
    "ln": log,
    "pow": power,
    "LerchPhi": lerchphi,
    "PolyLog": polylog,
    "HurwitzZeta": zeta,
    "Zeta": zeta,
    "StieltjesGamma": lambda n, a=1: stieltjes(int(n), a),
    "BarnesG": barnesg,
    "LogBarnesG": lambda x: log(barnesg(x)),
    "pi": lambda: +mp.pi,
}
cases = [
${cases.map(([head, args, digits = DIGITS]) => `    (${JSON.stringify(head)}, ${JSON.stringify(args)}, ${digits}),`).join("\n")}
]
for head, args, digits in cases:
    mp.dps = digits + 30
    print(nstr(heads[head](*[arg(t) for t in args]), digits, min_fixed=-mp.inf, max_fixed=mp.inf))
`;
const out = (await runKernel("python3", ["-c", py], { timeoutMs: 300_000 })).trim().split("\n");
if (out.length !== cases.length)
  throw new Error(`mpmath gave ${out.length} values for ${cases.length} cases`);

const goldens: CertifiedGolden[] = cases.map(([head, args, digits], k) => ({
  head,
  args,
  mpmath: out[k]!,
  ...(digits === undefined ? {} : { digits }),
}));
writeFileSync(
  new URL("../tests/certified.golden.json", import.meta.url),
  JSON.stringify(goldens, null, 2) + "\n",
);
console.log(`cases ${goldens.length}`);
