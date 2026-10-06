// `@enumeratio/complex-numerals/lattice`: radix expansions as a layer for
// `<notatio-lattice-plot layer="radix">`. Plain TypeScript, no engine.

export { EXAMPLES, exampleNamed, FAVORITES, NOTABLE, type RadixExample } from "./examples.ts";
export {
  expansions,
  formatSettings,
  formatValue,
  isCompleteResidueSystem,
  leastResidues,
  lengthLimit,
  parseSettings,
  parseValue,
  RADIX_LIMIT,
  type RadixSettings,
  type System,
  type Value,
} from "./radix.ts";
export { type RadixLattice, radixLattice, type RadixLatticeOptions } from "./radix-lattice.ts";
