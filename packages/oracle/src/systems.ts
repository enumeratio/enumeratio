// The external systems we check ourselves against, and how far each one is wired.
//
// The point of naming the unwired ones is that the mapping table is the slow part, not the
// runner: a system with no mappings yet still belongs in the type, so a scan reports
// "unmapped" for it rather than pretending the question was never asked.

export type System =
  | "wolfram"
  | "sympy"
  | "mpmath"
  | "sage"
  | "oscar"
  | "julia"
  | "mathlib4"
  | "rust";

export interface SystemSpec {
  readonly name: System;
  readonly label: string;
  /** Whether a runner exists and the kernel is expected on PATH. */
  readonly wired: boolean;
  /** What this system is good FOR — they are not interchangeable oracles. */
  readonly strength: string;
}

export const SYSTEMS: readonly SystemSpec[] = [
  {
    name: "wolfram",
    label: "Wolfram Language",
    wired: true,
    strength: "broadest coverage; the naming baseline most of our heads follow",
  },
  {
    name: "sympy",
    label: "SymPy",
    wired: true,
    strength: "exact symbolic results, so it catches a closed form we got numerically right",
  },
  {
    name: "mpmath",
    label: "mpmath",
    wired: true,
    strength:
      "arbitrary-precision numerics, and correct on branches Wolfram's N[] is not — ζ(−n, a) among them",
  },
  {
    name: "sage",
    label: "SageMath",
    wired: true,
    strength:
      "exact number theory and combinatorics; bundles SymPy and mpmath but has much more besides",
  },
  {
    name: "oscar",
    label: "Oscar (Julia)",
    wired: true,
    strength:
      "Julia's Sage: GAP, Singular, polymake and FLINT under one roof — the oracle for the group and diagram algebras",
  },
  {
    name: "julia",
    label: "Julia (Nemo + Combinatorics.jl)",
    wired: true,
    strength:
      "FLINT number theory and the classic combinatorial counts, light enough to install in CI",
  },
  {
    name: "mathlib4",
    label: "Lean 4 / Mathlib",
    wired: true,
    strength:
      "definitions rather than values: the place to check that a convention is the standard one",
  },
  {
    name: "rust",
    label: "Rust (num, primal, statrs, adic)",
    wired: true,
    strength:
      "the numeric and number-theory crates a Rust user would reach for, and the adic crate for p-adic numbers",
  },
];

export const wiredSystems = (): System[] =>
  SYSTEMS.filter((system) => system.wired).map((system) => system.name);
