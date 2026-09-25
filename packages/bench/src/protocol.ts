// The measurement protocol (design/benchmarking.md §5). Every generated harness implements
// exactly this, from these numbers; bump `version` whenever one changes, since runs under
// different protocols don't compare.

import type { Protocol } from "./types.ts";

export const PROTOCOL: Protocol = {
  version: 1,
  warmup: 3,
  warmupMs: 1000,
  samples: 15,
  minSamples: 5,
  batchBelowMs: 1,
  minSampleMs: 10,
  tooFastNs: 10_000,
};

export interface Timed {
  readonly k: number;
  readonly samplesNs: readonly number[];
  readonly timedOut: boolean;
}

/**
 * Run the protocol against `call`, in this process. `clear` runs before each sample, outside
 * the timing. `now` is injectable for tests; the default is the monotonic hrtime clock.
 */
export function measure(
  call: () => unknown,
  options: {
    readonly budgetMs: number;
    readonly clear?: () => void;
    readonly now?: () => bigint;
    readonly protocol?: Protocol;
  },
): Timed {
  const p = options.protocol ?? PROTOCOL;
  const now = options.now ?? ((): bigint => process.hrtime.bigint());
  const clear = options.clear ?? (() => {});
  const start = now();
  const spent = (): number => Number(now() - start) / 1e6;
  const time = (k: number): number => {
    clear();
    const t0 = now();
    for (let i = 0; i < k; i++) call();
    return Number(now() - t0) / k;
  };

  // Calibrate: batch sub-millisecond calls until one sample takes minSampleMs.
  let k = 1;
  let single = Math.max(time(1), 1);
  if (single < p.batchBelowMs * 1e6) {
    while (single * k < p.minSampleMs * 1e6 && spent() < options.budgetMs) k *= 2;
  }
  for (let w = 0; w < p.warmup && spent() < p.warmupMs && spent() < options.budgetMs; w++) {
    single = time(k);
  }
  const samplesNs: number[] = [];
  while (samplesNs.length < p.samples) {
    if (samplesNs.length >= p.minSamples && spent() >= options.budgetMs) break;
    samplesNs.push(time(k));
    if (spent() >= options.budgetMs * 4) break; // a runaway: stop even below minSamples
  }
  return { k, samplesNs, timedOut: samplesNs.length < p.minSamples };
}
