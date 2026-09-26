// The carrier types this package's statistics are declared over, mirrored here.
//
// @enumeratio/domains owns these — it is where they are minted and where the constructors
// come from — but it DEPENDS on this package, so importing it back would be a build cycle
// (`vp run -r build` refuses it). The four names below are the contract between the two,
// and `packages/symbols/combinatorics/domains/tests/entries.test.ts` exercises the real declaration.

import type { ComputeEngine } from "@cortex-js/compute-engine";

/**
 * The carriers whose statistics are declared over the minted type. SetPartition is held back
 * on purpose: @enumeratio/domains treats a set_partition as a RESTRICTED GROWTH STRING (see
 * CyclePartition in map.ts), while every set-partition definition here -- and
 * `At(SetPartitions(n), k)` -- works in BLOCKS. Typing those heads over the carrier would
 * hand an RGS to a body expecting blocks: a wrong answer rather than a type error. They keep
 * an explicit `list<list<integer>>` signature until the two representations are reconciled.
 */
export const CARRIER_TYPES: Readonly<Record<string, string>> = {
  Permutation: "permutation",
  IntegerPartition: "integer_partition",
  DyckPath: "dyck_path",
};

/** Every carrier the constructors are minted for, including the one held back above. */
const ALL_CARRIERS: Readonly<Record<string, string>> = {
  ...CARRIER_TYPES,
  SetPartition: "set_partition",
};

/** The shape each carrier's constructor accepts — a set partition is a list of blocks. */
const SHAPES: Readonly<Record<string, string>> = {
  permutation: "list<integer>",
  integer_partition: "list<integer>",
  dyck_path: "list<integer>",
  // Blocks, matching the definitions and `At(SetPartitions(n), k)` -- NOT domain-data's RGS.
  // Only this mirror uses it; the real carrier is not typed over until that is reconciled.
  set_partition: "list<list<integer>>",
};

/** Mint the carrier types and their held constructors, the way `declareDomains` does. */
export function declareCarriers(ce: ComputeEngine): void {
  for (const type of Object.values(ALL_CARRIERS)) ce.declareType(type, SHAPES[type]!, { mint: true });
  for (const [name, type] of Object.entries(ALL_CARRIERS))
    ce.declare(name, { signature: `(${SHAPES[type]!}) -> ${type}` });
}
