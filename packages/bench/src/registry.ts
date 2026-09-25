// Which systems have a harness, how to start it, and whether it clears caches between samples.

import { fileURLToPath } from "node:url";
import type { Generator } from "./generate.ts";
import {
  CACHES_JULIA,
  CACHES_OSCAR,
  generateJulia,
  generateOscar,
  harnessJulia,
  harnessOscar,
} from "./generators/julia.ts";
import {
  CACHES_MPMATH,
  CACHES_SAGE,
  CACHES_SYMPY,
  generateMpmath,
  generateSage,
  generateSympy,
  harnessMpmath,
  harnessSage,
  harnessSympy,
} from "./generators/python.ts";
import { CACHES_RUST, generateRust, harnessRust } from "./generators/rust.ts";
import { CACHES_WOLFRAM, generateWolfram, harnessWolfram } from "./generators/wolfram.ts";
import type { HarnessCommand } from "./run.ts";
import type { BenchSystem, Report } from "./types.ts";

export const GENERATORS: Partial<Record<BenchSystem, Generator>> = {
  wolfram: generateWolfram,
  mpmath: generateMpmath,
  sympy: generateSympy,
  sage: generateSage,
  julia: generateJulia,
  oscar: generateOscar,
  rust: generateRust,
};

export const HARNESSES: Partial<Record<BenchSystem, () => HarnessCommand>> = {
  ts: () => ({
    command: process.execPath,
    args: [fileURLToPath(new URL("./harness-ts.ts", import.meta.url))],
  }),
  wolfram: harnessWolfram,
  mpmath: harnessMpmath,
  sympy: harnessSympy,
  sage: harnessSage,
  julia: harnessJulia,
  oscar: harnessOscar,
  rust: harnessRust,
};

export const CACHES: Partial<Record<BenchSystem, Report["system"]["caches"]>> = {
  ts: "uncleared",
  wolfram: CACHES_WOLFRAM,
  mpmath: CACHES_MPMATH,
  sympy: CACHES_SYMPY,
  sage: CACHES_SAGE,
  julia: CACHES_JULIA,
  oscar: CACHES_OSCAR,
  rust: CACHES_RUST,
};
