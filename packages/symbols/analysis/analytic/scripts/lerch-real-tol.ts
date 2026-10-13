// Measures LERCH_REAL_TOL (src/shader.ts): the noise floor, the |Im|/|Re| the f32 shader
// produces on genuinely real Φ, against the signal floor, the true |Im|/|Re| where Φ is complex.
//   vp node packages/symbols/analysis/analytic/scripts/lerch-real-tol.ts
// Needs python3 with mpmath for the signal side.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { lerchPhiF32, makeJitter } from "./lerch-f32.ts";

type Pt = [number, number, number];

const Z_GRID = [-0.9, -0.5, 0, 0.5, 0.9];
const range = (lo: number, hi: number, step: number) => {
  const out: number[] = [];
  for (let i = 0; lo + i * step <= hi + 1e-9; i++) out.push(+(lo + i * step).toFixed(6));
  return out;
};
const A_NEG = range(-7.9, -0.1, 0.8);
const A_POS = [0.1, 0.5, 1, 2.5, 8];

// Real-valued: a > 0 with any s; a < 0 with integer s.
const realPoints = (): Pt[] => {
  const pts: Pt[] = [];
  for (const z of Z_GRID) {
    for (const a of A_POS) for (const s of range(-6, 8, 0.25)) pts.push([z, s, a]);
    for (const a of A_NEG) for (const s of range(-12, 16, 1)) pts.push([z, s, a]);
  }
  return pts;
};
// Complex: a < 0 with non-integer s (not within 0.01 of an integer).
const complexPoints = (): Pt[] => {
  const pts: Pt[] = [];
  for (const z of Z_GRID)
    for (const a of A_NEG)
      for (const s of range(-6.45, 8, 0.2)) if (Math.abs(s - Math.round(s)) > 0.01) pts.push([z, s, a]);
  return pts;
};

const ratio = (w: [number, number]) => (w[0] === 0 ? Infinity : Math.abs(w[1]) / Math.abs(w[0]));
const quantile = (xs: number[], q: number) => xs.toSorted((x, y) => x - y)[Math.floor(q * (xs.length - 1))]!;

function main() {
  const real = realPoints();
  const cplx = complexPoints();
  const truth: number[] = JSON.parse(
    execFileSync("python3", [fileURLToPath(new URL("./lerch-true.py", import.meta.url))], {
      input: JSON.stringify(cplx),
      maxBuffer: 1 << 28,
    }).toString(),
  );
  console.log(`real-valued points: ${real.length}; complex points: ${cplx.length}`);
  const noiseAt = (ulps: number) =>
    real.map(([z, s, a]) => ratio(lerchPhiF32([z, 0], [s, 0], [a, 0], makeJitter(ulps))));
  for (const ulps of [0, 2, 8]) {
    const noise = noiseAt(ulps);
    const finite = noise.filter(Number.isFinite);
    const worst = noise.indexOf(Math.max(...noise));
    console.log(
      `noise (±${ulps} ulp): max ${Math.max(...noise).toExponential(2)} at ${JSON.stringify(real[worst])}; ` +
        `p99 ${quantile(finite, 0.99).toExponential(2)}; p99.9 ${quantile(finite, 0.999).toExponential(2)}`,
    );
  }
  const minTrue = Math.min(...truth);
  console.log(`signal (true): min ${minTrue.toExponential(2)} at ${JSON.stringify(cplx[truth.indexOf(minTrue)])}`);
  for (const q of [0.001, 0.01, 0.05]) console.log(`  signal q${q}: ${quantile(truth, q).toExponential(2)}`);
  const noise2 = noiseAt(2);
  for (const tol of [1e-4, 3e-4, 1e-3, 1e-2]) {
    console.log(
      `tol ${tol}: real points declined ${noise2.filter((n) => n > tol).length}/${real.length}; ` +
        `complex points drawn ${truth.filter((t) => t <= tol).length}/${cplx.length}`,
    );
  }
}

main();
