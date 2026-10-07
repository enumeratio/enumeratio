// `@enumeratio/complex-numerals/lattice`: radix expansions as a layer for `Show`'s `LatticeTiles`.
// Plain TypeScript, no engine.

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
export {
  EXAMPLE_CHOICES,
  exampleOf,
  exampleSettings,
  randomSettings,
  type RadixLayer,
  type RadixLayerSettings,
  radixExpansions,
} from "./radix-layer.ts";
