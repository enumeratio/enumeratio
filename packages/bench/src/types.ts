// The shapes design/benchmarking.md §3 and §7 describe: a catalogue case, the plan the
// generators work from, and the report every runner writes.

import type { MathJSON } from "@enumeratio/oracle/src";

/** `exact` for integer/rational answers, `machine` for doubles, or a digit count. */
export type Precision = "exact" | "machine" | number;

/** One way to draw a sampled input. Draws happen at generation time, never in the timed region. */
export type Draw =
  | readonly ["int", number, number] // uniform integer in [lo, hi]
  | readonly ["bits", number] // uniform integer with exactly this many bits
  | readonly ["odd-bits", number] // the same, forced odd
  | readonly ["real", number, number] // uniform double in [lo, hi)
  | readonly ["log", number, number]; // 10^u, u uniform in [lo, hi)

/**
 * Seeded inputs. The draws become one input, a `List` of the expression at each draw, so a
 * timed call computes every value: enough work to time, and no value a system could have
 * stored or cached from the call before.
 */
export interface Sample {
  readonly seed: number;
  readonly count: number;
  readonly draw: Readonly<Record<string, Draw>>;
}

/** How hard a case is. A suite runs some tiers: see `SUITES` in suites.ts. */
export type Tier = "small" | "medium" | "large";

export interface BenchSpec {
  readonly tier?: Tier;
  readonly tags?: readonly string[];
  /** Where the problem is already timed publicly: a suite, paper or library. */
  readonly source?: string;
  readonly precision: Precision;
  /** Soft cap for the whole measurement, in seconds. */
  readonly budget?: number;
  readonly sample?: Sample;
  /** Systems to leave out, each with its reason. */
  readonly deny?: Readonly<Record<string, string>>;
}

/** A catalogue case: an example (`role: bench`) plus its bench fields. */
export interface BenchCase {
  readonly head: string;
  readonly id: string;
  readonly role: "bench";
  /** MathJSON, with `$name` symbols standing for sampled inputs. */
  readonly expr: MathJSON;
  /** Pinned answer. Omitted for sampled cases, whose answers are computed per input. */
  readonly expected?: MathJSON;
  readonly caption?: string;
  readonly bench: BenchSpec;
}

/** A case with its sampled inputs substituted: one or more concrete expressions. */
export interface ConcreteCase {
  /** `<Head>/<id>`. */
  readonly name: string;
  readonly case: BenchCase;
  readonly inputs: readonly MathJSON[];
}

/** Every system a benchmark can run in: the oracle's systems plus our own side. */
export type BenchSystem = "ts" | "wolfram" | "sympy" | "mpmath" | "sage" | "oscar" | "julia" | "rust";

export type Exclusion =
  | { readonly reason: "unmapped"; readonly missing: readonly string[] }
  | { readonly reason: "precision" }
  | { readonly reason: "denied"; readonly note: string };

export type PlanCell = { readonly sources: readonly string[] } | Exclusion;

export interface Plan {
  readonly schema: 1;
  readonly protocol: number;
  /** The suite the cases were chosen by. */
  readonly suite?: string;
  readonly cases: readonly {
    readonly name: string;
    /**
     * Hash of what the case computes (expression, inputs, precision): runs compare a case
     * only while this matches, whatever the catalogue does to it in between.
     */
    readonly formula: string;
    readonly tier: Tier;
    readonly precision: Precision;
    /** Soft cap for the whole measurement, in seconds. */
    readonly budget: number;
    readonly tags?: readonly string[];
    /** The case as the catalogue writes it, `$name` symbols standing for sampled inputs. */
    readonly expr: MathJSON;
    /** Where sampled inputs came from: rerunning the draw with this seed gives `inputs` again. */
    readonly sample?: Sample;
    /** The concrete MathJSON every system ran, one per input. */
    readonly inputs: readonly MathJSON[];
    /** The pinned answer as text, for the correctness gate; absent for sampled cases. */
    readonly expected?: string;
    readonly systems: Readonly<Partial<Record<BenchSystem, PlanCell>>>;
  }[];
}

export type Status = "ok" | "unsupported" | "precision" | "denied" | "too-fast" | "wrong" | "error" | "timeout";

export interface Summary {
  readonly median: number;
  readonly q1: number;
  readonly q3: number;
  readonly min: number;
  readonly max: number;
  /** Samples beyond Tukey's 1.5×IQR fences: flagged, never dropped. */
  readonly outliers: number;
}

export interface CaseResult extends Partial<Summary> {
  readonly name: string;
  /** The plan's `formula` for the case this timed. */
  readonly formula?: string;
  readonly status: Status;
  readonly reason?: string;
  /** Calls per sample. */
  readonly k?: number;
  /** Nanoseconds per call, one entry per sample. */
  readonly samplesNs?: readonly number[];
  /** The (reduced) answer, as the system printed it, once, outside the timed region. */
  readonly value?: string;
}

export interface Machine {
  readonly fingerprint: string;
  readonly os: string;
  /** The kernel's own version string (`os.version()`). */
  readonly osVersion: string;
  readonly arch: string;
  readonly cpu: string;
  /** Nominal clock of the first core, MHz, as the OS reports it (0 where it doesn't). */
  readonly cpuMHz: number;
  readonly cores: number;
  readonly memoryGB: number;
  /** `local`, or the hosted runner's image and version. */
  readonly runner: string;
  readonly node: string;
}

/** How loaded the machine was: taken when the run starts and when it ends. */
export interface Conditions {
  readonly at: string;
  /** 1, 5 and 15 minute load averages. */
  readonly loadavg: readonly number[];
  readonly freeMemoryGB: number;
  /** Swap in use, where the OS reports it. */
  readonly swapUsedGB?: number;
}

export interface Report {
  readonly schema: 1;
  readonly run: {
    readonly id: string;
    readonly sha: string;
    readonly date: string;
    readonly trigger: string;
    readonly url?: string;
    readonly suite?: string;
  };
  readonly system: {
    readonly name: BenchSystem;
    readonly version: string;
    readonly packages?: Readonly<Record<string, string>>;
    readonly caches: "cleared" | "uncleared";
  };
  readonly machine: Machine;
  readonly conditions?: { readonly start: Conditions; readonly end: Conditions };
  readonly protocol: Protocol;
  readonly results: readonly CaseResult[];
}

export interface Protocol {
  readonly version: number;
  readonly warmup: number;
  readonly warmupMs: number;
  readonly samples: number;
  readonly minSamples: number;
  /** A single call under this is batched `k` times until a sample reaches `minSampleMs`. */
  readonly batchBelowMs: number;
  readonly minSampleMs: number;
  /** A single call under this is left out of cross-system comparison. */
  readonly tooFastNs: number;
}

/**
 * `index.json` at the root of the `bench-data` branch (design/benchmarking.md §7): every run,
 * newest last. Each run's files are `runs/<id>/plan.json` and `runs/<id>/<system>.json`.
 */
export interface BenchIndex {
  readonly schema: 1;
  readonly runs: readonly {
    readonly id: string;
    readonly sha: string;
    readonly date: string;
    readonly trigger: string;
    readonly url?: string;
    /** The GitHub job that produced it: systems in one job share a machine and a time window. */
    readonly job: string;
    readonly suite?: string;
    readonly systems: readonly BenchSystem[];
    readonly machine: string;
  }[];
}
