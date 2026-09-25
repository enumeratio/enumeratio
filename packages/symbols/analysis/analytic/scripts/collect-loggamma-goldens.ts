// Collect oracle values for LogGamma from mpmath.loggamma at 30 digits, covering the
// domain the double kernel (loggamma.ts) has three regimes for: small positive reals,
// the neighborhoods of 1 and 2 (where lnΓ ≈ 0, so error is judged absolute there), negative
// non-integers, complex values in all four quadrants, points near the negative axis (close
// to a pole but off it), large |Im(z)| (where the kernel falls back to the original
// shift-to-Stirling recurrence past LANCZOS_IM_LIMIT), and — the case that actually
// exercises the reflection branch correction — z sitting exactly on an odd half-integer
// real part (…, −6.5, −4.5, −2.5, −0.5, …), where ln sin(πz)'s own principal branch jumps
// by 2πi and `reflect`'s k has to cancel it exactly. Written to tests/loggamma.golden.json.
//
// Requires python3 + mpmath on PATH. Regenerate with:
//   UPDATE_LOGGAMMA_GOLDEN=1 node scripts/collect-loggamma-goldens.ts

import { writeFileSync } from "node:fs";
import { runKernel } from "@enumeratio/oracle/bounded";

if (process.env.UPDATE_LOGGAMMA_GOLDEN !== "1") {
  console.error("refusing to rewrite the golden without UPDATE_LOGGAMMA_GOLDEN=1");
  process.exit(1);
}

export interface LogGammaGolden {
  re: number;
  im: number;
  label: string;
  category:
    | "small-positive"
    | "near-integer"
    | "negative"
    | "complex"
    | "near-axis"
    | "large-im"
    | "crossing"
    | "large-re";
  mpmath: [number, number];
}

const points: [number, number, LogGammaGolden["category"]][] = [
  // small positive reals
  [0.001, 0, "small-positive"],
  [0.01, 0, "small-positive"],
  [0.1, 0, "small-positive"],
  [0.3, 0, "small-positive"],
  [0.5, 0, "small-positive"],
  [0.6, 0, "small-positive"], // the z from #113/loggamma's own doc comment
  [0.9, 0, "small-positive"],
  // near 1 and 2 (lnΓ ≈ 0 there — judged by absolute error)
  [0.99, 0, "near-integer"],
  [1.0, 0, "near-integer"],
  [1.01, 0, "near-integer"],
  [1.5, 0, "near-integer"],
  [1.99, 0, "near-integer"],
  [2.0, 0, "near-integer"],
  [2.01, 0, "near-integer"],
  // negative non-integers
  [-0.5, 0, "negative"],
  [-0.3, 0, "negative"],
  [-1.5, 0, "negative"],
  [-2.5, 0, "negative"],
  [-3.7, 0, "negative"],
  [-7.5, 0, "negative"],
  [-10.1, 0, "negative"],
  [-0.001, 0, "negative"],
  // complex, all quadrants, moderate magnitude
  [0.5, 1.5, "complex"],
  [0.5, -1.5, "complex"],
  [-0.5, 1.5, "complex"],
  [-0.5, -1.5, "complex"],
  [2.5, 1.5, "complex"],
  [2.5, -1.5, "complex"],
  [-2.5, 1.5, "complex"],
  [-2.5, -1.5, "complex"],
  [1.3, 1.0, "complex"],
  [1.3, -1.0, "complex"],
  [-1.3, 1.0, "complex"],
  [-1.3, -1.0, "complex"],
  [5.0, 3.0, "complex"],
  [5.0, -3.0, "complex"],
  [-5.0, 3.0, "complex"],
  [-5.0, -3.0, "complex"],
  [0.1, 0.1, "complex"],
  [0.1, -0.1, "complex"],
  [-0.1, 0.1, "complex"],
  [-0.1, -0.1, "complex"],
  // near the negative axis: close to a pole, just off it
  [-2.0001, 0.001, "near-axis"],
  [-2.0001, -0.001, "near-axis"],
  [-4.999, 0.002, "near-axis"],
  [-4.999, -0.002, "near-axis"],
  [-0.9999, 0.0005, "near-axis"],
  [-0.9999, -0.0005, "near-axis"],
  // large |Im(z)|: past LANCZOS_IM_LIMIT, so these exercise the shift-to-Stirling fallback
  // (and, via hurwitz-zeta's own reflection, are exactly the shape of z that once regressed
  // when Lanczos's own error was left to grow unchecked out here — see loggamma.ts's doc).
  [0.5, 20, "large-im"],
  [0.5, -20, "large-im"],
  [3, 40, "large-im"],
  [4, -300, "large-im"],
  [17.9, 40, "large-im"],
  [10, -100, "large-im"],
  [-3, 50, "large-im"],
  [-3, -50, "large-im"],
  [25, 60, "large-im"],
  [25, -60, "large-im"],
  // exact odd-half-integer crossings, off the real axis: ln sin(πz) is exactly on its own
  // branch cut here (sin(πz) lands exactly on the negative real axis), which is where
  // `reflect`'s branch correction `k` actually has something to correct.
  [-2.5, 1.5, "crossing"],
  [-4.5, 2.0, "crossing"],
  [-0.5, 3.0, "crossing"],
  [-6.5, 1.0, "crossing"],
  // large real (Stirling directly, or close to its threshold)
  [18.5, 0, "large-re"],
  [30, 0, "large-re"],
  [50, 5, "large-re"],
  // tiny positive, near the pole at 0 (stresses the sinPi/cosPi reduction near z = 0)
  [1e-6, 0, "small-positive"],
  [1e-6, 1e-6, "small-positive"],
];

const py = `
from mpmath import mp, mpc, loggamma
mp.dps = 30
pts = [${points.map(([re, im]) => `(${re}, ${im})`).join(", ")}]
for re, im in pts:
    v = loggamma(mpc(re, im))
    print(f"{float(v.real)!r}|{float(v.imag)!r}")
`;
const out = await runKernel("python3", ["-c", py], { timeoutMs: 120_000 });
const lines = out
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);
if (lines.length !== points.length) {
  throw new Error(`expected ${points.length} mpmath rows, got ${lines.length}:\n${out}`);
}

const goldens: LogGammaGolden[] = points.map(([re, im, category], i) => {
  const [reStr, imStr] = lines[i].split("|");
  return {
    re,
    im,
    label: `lnΓ(${re}${im === 0 ? "" : `${im < 0 ? "" : "+"}${im}i`})`,
    category,
    mpmath: [Number(reStr), Number(imStr)],
  };
});

writeFileSync(new URL("../tests/loggamma.golden.json", import.meta.url), `${JSON.stringify(goldens, null, 2)}\n`);
console.log(`${goldens.length} points written`);
