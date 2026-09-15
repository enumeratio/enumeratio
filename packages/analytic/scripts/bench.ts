// Micro-benchmark for the analytic kernels — single-eval throughput and a grid
// sweep (the shape a Manipulate / interactive surface drives). Not part of `vp
// test`; run:
//   vp node packages/analytic/scripts/bench.ts
//
// Reports µs/eval and evals/s so optimization work (JS inlining now; WASM/WebGPU
// later) has a baseline to beat. The complex-a path is transcendental-bound
// (~1 log + 1 exp + trig per term), so it sets the realistic ceiling.

import { hurwitzZeta } from "../src/hurwitz-zeta.ts";

const s = { re: 2, im: 0 };

/** Sweep an n×n grid of a over the complex plane at fixed s; return elapsed ms. */
function gridSweep(n: number): number {
  const lo = -3;
  const span = 6;
  const t0 = performance.now();
  let acc = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const r = hurwitzZeta(s, { re: lo + (span * i) / n, im: lo + (span * j) / n });
      acc += r.re; // keep the result live so it isn't optimized away
    }
  }
  const ms = performance.now() - t0;
  if (!Number.isFinite(acc)) throw new Error("non-finite");
  return ms;
}

gridSweep(24); // warm the JIT

console.log("Hurwitz ζ(s,a) grid sweep, fixed s = 2, a ∈ [-3,3]²  (complex-a path)\n");
for (const n of [64, 128, 256]) {
  const ms = gridSweep(n);
  const evals = n * n;
  console.log(
    `${n}×${n} = ${evals.toLocaleString()} evals: ${ms.toFixed(1)} ms  ` +
      `(${Math.round(evals / ms)}k evals/s, ${((ms / evals) * 1000).toFixed(2)} µs/eval)`,
  );
}

// Real-a fast path (Math.pow instead of exp/log) for contrast.
const t0 = performance.now();
let acc = 0;
const M = 200_000;
for (let i = 0; i < M; i++) acc += hurwitzZeta(s, { re: 1 + i / M, im: 0 }).re;
const ms = performance.now() - t0;
if (!Number.isFinite(acc)) throw new Error("non-finite");
console.log(
  `\nreal-a fast path: ${M.toLocaleString()} evals: ${ms.toFixed(1)} ms  ` +
    `(${Math.round(M / ms)}k evals/s, ${((ms / M) * 1000).toFixed(2)} µs/eval)`,
);
