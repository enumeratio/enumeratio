// Mirrors packages/bench/src/types.ts's report/plan/index shapes (design/benchmarking.md §7).
// Duplicated rather than imported: web shouldn't depend on packages/bench. Keep in sync by hand.

export type BenchSystem = "ts" | "wolfram" | "sympy" | "mpmath" | "sage" | "oscar" | "julia" | "rust";

export type Status = "ok" | "unsupported" | "precision" | "denied" | "too-fast" | "wrong" | "error" | "timeout";

export interface CaseResult {
  readonly name: string;
  readonly status: Status;
  readonly reason?: string;
  readonly k?: number;
  readonly samplesNs?: readonly number[];
  readonly median?: number;
  readonly q1?: number;
  readonly q3?: number;
  readonly min?: number;
  readonly max?: number;
  readonly outliers?: number;
  readonly value?: string;
}

export interface Conditions {
  readonly at: string;
  readonly loadavg: readonly number[];
  readonly freeMemoryGB: number;
  readonly swapUsedGB?: number;
}

export interface Machine {
  readonly fingerprint: string;
  readonly os: string;
  readonly osVersion?: string;
  readonly arch: string;
  readonly cpu: string;
  readonly cpuMHz?: number;
  readonly cores: number;
  readonly memoryGB: number;
  readonly runner: string;
  readonly node: string;
}

export interface Report {
  readonly schema: 1;
  readonly run: {
    readonly id: string;
    readonly sha: string;
    readonly date: string;
    readonly trigger: string;
    readonly url?: string;
  };
  readonly system: {
    readonly name: BenchSystem;
    readonly version: string;
    readonly packages?: Readonly<Record<string, string>>;
    readonly caches: "cleared" | "uncleared";
  };
  readonly machine: Machine;
  readonly conditions?: { readonly start: Conditions; readonly end: Conditions };
  readonly results: readonly CaseResult[];
}

export type Exclusion =
  | { readonly reason: "unmapped"; readonly missing: readonly string[] }
  | { readonly reason: "precision" }
  | { readonly reason: "denied"; readonly note: string };

export type PlanCell = { readonly sources: readonly string[] } | Exclusion;

export interface Plan {
  readonly schema: 1;
  readonly protocol: number;
  readonly cases: readonly {
    readonly name: string;
    readonly precision: "exact" | "machine" | number;
    readonly budget: number;
    readonly tags?: readonly string[];
    readonly expr?: unknown;
    readonly sample?: {
      readonly seed: number;
      readonly count: number;
      readonly draw: Readonly<Record<string, unknown>>;
    };
    readonly inputs?: readonly unknown[];
    readonly expected?: string;
    readonly systems: Readonly<Partial<Record<BenchSystem, PlanCell>>>;
  }[];
}

export interface BenchIndex {
  readonly schema: 1;
  readonly runs: readonly {
    readonly id: string;
    readonly sha: string;
    readonly date: string;
    readonly trigger: string;
    readonly url?: string;
    readonly job: string;
    readonly systems: readonly BenchSystem[];
    readonly machine: string;
  }[];
}

export type IndexRun = BenchIndex["runs"][number];
