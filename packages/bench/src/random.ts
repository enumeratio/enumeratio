// Seeded draws for sampled cases (design/benchmarking.md §3.2). The seed is part of the case,
// so every run and every system sees the same inputs; the draws are written into the
// generated scripts as literals.

import type { MathJSON } from "@enumeratio/oracle/src";
import type { Draw, Sample } from "./types.ts";

/** mulberry32, as the quickcheck scripts use. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBits(next: () => number, bits: number): bigint {
  let n = 0n;
  for (let i = 0; i < bits; i += 16) n = (n << 16n) | BigInt(Math.floor(next() * 65536));
  n &= (1n << BigInt(bits)) - 1n;
  return n | (1n << BigInt(bits - 1));
}

/** An integer as MathJSON: a number while it is exact as a double, a numeric string past that. */
const integer = (n: bigint): MathJSON =>
  n >= BigInt(Number.MIN_SAFE_INTEGER) && n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : { num: n.toString() };

export function drawOne(next: () => number, draw: Draw): MathJSON {
  switch (draw[0]) {
    case "int":
      return draw[1] + Math.floor(next() * (draw[2] - draw[1] + 1));
    case "bits":
      return integer(randomBits(next, draw[1]));
    case "odd-bits":
      return integer(randomBits(next, draw[1]) | 1n);
    case "real":
      return draw[1] + next() * (draw[2] - draw[1]);
    case "log":
      return 10 ** (draw[1] + next() * (draw[2] - draw[1]));
  }
}

/** `count` bindings, one per input; variables are drawn in key order, so adding one is a new case. */
export function drawSample(sample: Sample): Record<string, MathJSON>[] {
  const next = mulberry32(sample.seed);
  const names = Object.keys(sample.draw).sort();
  return Array.from({ length: sample.count }, () =>
    Object.fromEntries(names.map((name) => [name, drawOne(next, sample.draw[name] as Draw)])),
  );
}

/** Replace `$name` symbols with their bound values. */
export function substitute(expr: MathJSON, binding: Readonly<Record<string, MathJSON>>): MathJSON {
  if (typeof expr === "string" && expr.startsWith("$")) {
    const value = binding[expr.slice(1)];
    if (value === undefined) throw new Error(`unbound sample variable ${expr}`);
    return value;
  }
  if (Array.isArray(expr)) return expr.map((part: MathJSON) => substitute(part, binding));
  return expr;
}
