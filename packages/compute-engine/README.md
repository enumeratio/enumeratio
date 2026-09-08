# @enumeratio/compute-engine

enumeratio's combinatorial catalog as a loadable [compute-engine](https://cortexjs.io/compute-engine/)
`LibraryDefinition`. Load it into any `ComputeEngine` and its combinatorial families become first-class
collections — with the one thing compute-engine's own lazy collections lack: **O(1) random access** (`at` via
unrank) **and its inverse** (`Rank`, element → index).

```ts
import { ComputeEngine } from "@cortex-js/compute-engine";
import { installEnumeratio } from "@enumeratio/compute-engine";

const ce = installEnumeratio(new ComputeEngine());

ce.box(["At", ["SymmetricGroup", 12], 300000000]).evaluate();   // the 3.0e8-th permutation of [12], instantly
ce.box(["Rank", ["SymmetricGroup", 4], ["List", 1, 3, 2, 4]]).evaluate();   // → 3  (the inverse of At)
ce.box(["Length", ["DyckPaths", 20]]).evaluate();               // → Catalan(20), closed form, no walk
ce.box(["BellB", 8]).evaluate();                                 // counting sequences, exact
```

## Why

compute-engine already has lazy combinatorial collections with closed-form counts, but its random access is a
scan — `Permutations.at(i)` walks `i` steps (`nthFromIterator`). enumeratio supplies constant-time `at` via
unrank, so `At`, `Length`, `Element`, `Take`, `Map` (compute-engine's own operators) compose over these families
unchanged, at any index. Measured: `At(SymmetricGroup(12), 3.0e8)` is ~0.147 ms here vs a projected ~8 min for the
equivalent scan (compute-engine's `at` is provably linear in the index).

## What's in it

- **~90 combinatorial collections** — permutations and permutation classes, compositions, integer and set
  partitions, subsets, lattice paths and Catalan objects, trees, pattern-avoiding and restricted families — each
  with a closed-form `count`, an O(1) `at`, and `Rank` (its inverse). Seven have a certified SQL twin in
  enumeratio's core; the rest are authored here and certified by the bijection differential (below).
- **View / combinator accelerators** — `Reversed`, `Rotated`, `Window`, `Concat`, `Product`, `Power`, `Zip` —
  all O(1), composing over any collection (and each other); `Rank` walks through them recursively.
- **Wolfram-aligned scalar operators** compute-engine lacks — `BellB`, `CatalanNumber`, `PartitionsP`/`Q`,
  `Fubini`, `PolygonalNumber`, `IntegerDigits`/`FromDigits`/`RealDigits`, `DigitCount`, `BitAnd`/`Or`/`Xor`, … —
  Listable, and bound to (never shadowing) compute-engine's own `Factorial`/`Binomial`/`GCD`/… .

## Shape

Zero runtime dependencies. compute-engine is a `peerDependency` — this package only `ce.declare`s its heads on
top of a standard engine; the engine's whole standard library stays live and composes with these heads
(`test/interop.test.ts` pins that).

## Correctness

`pnpm --filter @enumeratio/compute-engine selfcert` runs the bijection differential over every family: unrank all
`count(p)` ranks and assert they are **distinct**, **valid** (each family's own membership check), **exactly
`count(p)` of them**, and that **`rank(unrank(p, r)) === r`**. Distinct + valid + count together prove a bijection
onto the valid set — not just self-consistency of the rank/unrank pair. A bounded slice runs in the test suite
(`test/selfcert.test.ts`) on every CI run.
