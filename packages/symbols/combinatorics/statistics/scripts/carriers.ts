// The carrier types this package's statistics are declared over, mirrored here.
//
// @enumeratio/domains owns these — it is where they are minted and where the constructors
// come from — but it DEPENDS on this package, so importing it back would be a build cycle
// (`vp run -r build` refuses it). The four names below are the contract between the two,
// and `packages/symbols/combinatorics/domains/tests/entries.test.ts` exercises the real declaration.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";

/**
 * The carriers whose statistics are declared over the minted type. SetPartitions is held
 * back on purpose: @enumeratio/domains treats a set_partition as a RESTRICTED GROWTH STRING
 * (see CyclePartition in map.ts), while every set-partition definition here -- and
 * `At(SetPartitions(n), k)` -- works in BLOCKS. Typing those heads over the carrier would
 * hand an RGS to a body expecting blocks: a wrong answer rather than a type error. They keep
 * an explicit `list<list<integer>>` signature until the two representations are reconciled.
 */
export const CARRIER_TYPES: Readonly<Record<string, string>> = {
  Permutations: "permutation",
  IntegerPartitions: "integer_partition",
  DyckPaths: "dyck_path",
};

/** Every carrier the constructors are minted for, including the one held back above. */
const ALL_CARRIERS: Readonly<Record<string, string>> = {
  ...CARRIER_TYPES,
  SetPartitions: "set_partition",
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

/** Mint the carrier TYPES only, without declaring their constructors. Split out so a caller
 *  can mint these before some OTHER library's declare runs (a signature naming the type by
 *  name), then declare collections' NAMES, then this file's constructors -- so a name the
 *  two share (Permutations, SetPartitions, ...) overloads onto whatever collections already
 *  declared rather than colliding with it. Mirrors `declareDomainTypes`/
 *  `declareDomainConstructors` in @enumeratio/domains -- this file can't import that package
 *  (build cycle), so the split is kept in sync here by hand. */
export function declareCarrierTypes(ce: ComputeEngine): void {
  for (const type of Object.values(ALL_CARRIERS)) ce.declareType(type, SHAPES[type]!, { mint: true });
}

/** One carrier's constructor, held with no `evaluate` -- unless the name is already declared
 *  (collections' own family, here, always), in which case the two become overloads of it.
 *  Same merge domains/src/declare.ts's `declareConstructor` uses, and for the same reason:
 *  overload resolution tries arms in DECLARATION order, so the new, precise
 *  `(shape) -> type` arm has to come first, and the existing signature is spliced in
 *  unwrapped because it may itself already be a `where`-quantified overload set. */
function declareCarrierConstructor(ce: ComputeEngine, name: string, type: string): void {
  const clause = `(${SHAPES[type]!}) -> ${type}`;
  const definition = ce.lookupDefinition(name);
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;

  if (operator === undefined) {
    ce.declare(name, { signature: clause });
    return;
  }

  const existingEvaluate = operator.evaluate;
  const existingSignature = operator.signature;
  (operator as { signature: unknown }).signature = ce.type(`(${clause}) & ${String(existingSignature)}`);
  operator.evaluate = (ops: readonly BoxedExpression[], options) => existingEvaluate?.(ops, options);
}

/** Declare every carrier's constructor. Call after `declareCarrierTypes` AND after
 *  collections has declared its own names, so this layers onto them. */
export function declareCarrierConstructors(ce: ComputeEngine): void {
  for (const [name, type] of Object.entries(ALL_CARRIERS)) declareCarrierConstructor(ce, name, type);
}

/** Mint the carrier types and their held constructors, the way `declareDomains` does. Kept
 *  for a caller that doesn't need the split -- but see `declareCarrierTypes` above, most
 *  callers combining this with `declareCollections` DO need it. */
export function declareCarriers(ce: ComputeEngine): void {
  declareCarrierTypes(ce);
  declareCarrierConstructors(ce);
}
