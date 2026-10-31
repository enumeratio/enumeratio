// What is left of the interpreter-shaped RSK Epsil: the pair constructor's body. The maps' own definitions are on
// flat state in ./flat.ts, which compiles.
//
// THE RULE THAT MAKES NESTED EPSIL WORK. A first attempt at RSK produced an unevaluated tree, and
// the cause is worth stating because it governs every non-trivial expression that runs interpreted:
//
//   Iterate over a RANGE and index. Never fold or filter over a list taken out of the
//   accumulator.
//
// `Filter(At(state, 1), …)` inside a fold step does not force — the substitution happens,
// the collection stays lazy, and nothing downstream forces it, not even `Count`. The same
// selection written as `Fold` over `Range(1, Count(row))`, indexing with `At`, evaluates
// eagerly.
//
// The second rule, from the statistics package: when a list has to BE a value rather than a
// promise, build it with a fold. `Map` over a range stays lazy.

/** A MathJSON expression, structurally — declared locally so this package stays packable
 *  (a bundled package cannot import types from the src-only reference package). */
type MathJSON = string | number | boolean | readonly MathJSON[] | { readonly [key: string]: unknown };

/** Both tableaux, for the `standard_tableau_pair` constructor: the two RSK maps' own answers, so the
 *  pair rides their fast paths and their definitions stay the single description of each half. */
export const rskRows: MathJSON = [
  "Tuple",
  ["RskInsertion", ["Permutation", "_raw"]],
  ["RskRecording", ["Permutation", "_raw"]],
];
