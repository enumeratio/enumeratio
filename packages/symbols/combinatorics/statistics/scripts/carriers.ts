// The carrier types this package's statistics are declared over, mirrored here.
//
// @enumeratio/combinatorics owns these — it is where they are minted and where the constructors
// come from — but it DEPENDS on this package, so importing it back would be a build cycle
// (`vp run -r build` refuses it). The four names below are the contract between the two,
// and `packages/symbols/combinatorics/statistics/tests/domains-entries.test.ts` exercises the real declaration.

import type { ComputeEngine } from "@cortex-js/compute-engine";

/** The carriers whose statistics are declared over the minted type. */
export const CARRIER_TYPES: Readonly<Record<string, string>> = {
  Permutation: "permutation",
  IntegerPartition: "integer_partition",
  DyckPath: "dyck_path",
  SetPartition: "set_partition",
};

/** Every carrier the constructors are minted for. */
const ALL_CARRIERS: Readonly<Record<string, string>> = CARRIER_TYPES;

/** The shape each carrier's constructor accepts — a set partition is a list of blocks. */
export const SHAPES: Readonly<Record<string, string>> = {
  permutation: "list<integer>",
  integer_partition: "list<integer>",
  dyck_path: "list<integer>",
  set_partition: "list<list<integer>>",
};

/** Mint the carrier types and their held constructors, the way combinatorics' own carrier declare does. */
export function declareCarriers(ce: ComputeEngine): void {
  for (const type of Object.values(ALL_CARRIERS)) ce.declareType(type, SHAPES[type]!, { mint: true });
  for (const [name, type] of Object.entries(ALL_CARRIERS))
    ce.declare(name, { signature: `(${SHAPES[type]!}) -> ${type}` });
}
