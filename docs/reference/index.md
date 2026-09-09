# Language Reference

Wolfram-style reference pages for every **head** (operator, function, or collection constructor) the notebook's
expression language recognizes — one page per node: what it means, its usage forms, an argument/result/attribute
"Details" list, worked examples, and cross-links to related heads.

This is a *language* reference (the AST/MathJSON vocabulary a notebook line compiles through), distinct from the
[Data Reference](/develop/data/) (the pg-catalog's own collections/functions/stats/maps tables) — the same
mathematical family often has a foot in both: e.g. `Permutations` here is the same family as the catalog's
`permutations`, reachable by either spelling in a notebook (see each collection page's "Catalog alias" note).

## How a page is organized

Every node page follows the same shape:

- **Usage** — the forms you can write, each with a one-line gloss.
- **Details** — arity, argument/result types, attributes (e.g. Listable), complexity, and edge cases — derived
  directly from the implementation, not aspirational.
- **Examples** — worked input → result, computed by hand against the cited source function so a reader can check
  the same thing themselves.
- **See also** — sibling nodes; `code span` (no link) means the sibling doesn't have its own page yet.

## How these pages are built

The collection pages are **generated, not hand-written**. The source of truth is a dataset —
`docs/.vitepress/reference/nodes.ts`, one record per head — plus `generate.mts`, which computes every example
number (count, the first few elements, a rank) directly from the live pack kernels
(`@enumeratio/compute-engine`'s `allEntries`). So a page can never disagree with the implementation on a count
or an element; only the prose (definition, order convention, complexity) is authored, and it lives in the
dataset as structured fields. Regenerate with `node --import tsx docs/.vitepress/reference/generate.mts`; the
`--check` mode fails if any committed page is stale (a CI lint and a "does my branch need regenerating?" probe
in one). The sidebar is derived from the same dataset (`reference/sidebar.ts`). A handful of primitive/list-op/
counting-sequence pages are still hand-authored and will migrate into the dataset as their batches land.

## Where these heads come from

- `packages/expressions/src/names.ts` — the arithmetic/comparison/lattice operators, curated named identities,
  and the three generic primitives (`Element`/`At`/`Count`) bound directly by MathJSON head name.
- `packages/expressions/src/bind.ts` — the argument-type-dispatched generic primitives (`next`/`prev`/`rank`/
  `locate`/`unrank`/`random_element`) and the list operations (`join`/`sort`/`unique`, plus `scramble`/
  `random_sample`) that canonicalize to compute-engine's own heads.
- [`@enumeratio/compute-engine`](/develop/packages/components/) (`packages/compute-engine/src/`) — the ~94
  collection constructors, the counting sequences, the digit/bitwise scalar functions, and the view/combinator
  heads (`Reversed`, `Product`, …) that compose over any collection.

::: info Not documented here (yet)
A couple of forms sketched for a future notebook release — an action/`To` node (`p \to \text{expr}`, a run/ticker
control) and a `for`-comprehension (`[expr \text{ for } i = [\dots]]`) — aren't in the merged expression language
today, so there's nothing to verify a page against. They'll get pages once they land. Likewise, `Abs`/`|x|` over a
*scalar* has no curated binding yet (see the note on `cardinality` for the *collection*
form, `|C|`, which does work today via a separate head, `Count`).
:::

## Arithmetic, comparison & lattice operators

Bound by head name in `names.ts`'s `OPERATORS` table to a `base_operation` id — ordinary algebra, unsurprising
in behavior, so these don't get individual pages yet (tracked in the batching plan below).

`Add` · `Subtract` · `Multiply` · `Divide` · `Negate` · `Power` · `Less` · `LessEqual` · `Greater` ·
`GreaterEqual` · `Equal` · `NotEqual` · `Union` (lattice join) · `Intersection` (lattice meet) · `Complement`

## Named identities

`Factorial` · `Binomial` · `GCD` · `LCM`

## Generic collection primitives

The mechanisms every collection gets for free — dispatched either by head name alone (`Element`/`At`/`Count`) or
by the argument's own type (`next`/`prev`/`rank`/`locate`/`unrank`/`random_element` — see
`packages/expressions/src/bind.ts`'s `NEXT_PREV_RANK` / `HANDLE_ELEM`).

`unrank` · `rank` · `random_element` ·
`cardinality` (`Count`, `|C|`, `\#C`) · `next` · `prev` · `locate` · `Element`
(`x \in C`, membership) · `At` (`L[i]`, plain list indexing)

## List operations

Bound to compute-engine's own list heads rather than reimplemented.

`join` (→ `Join`) · `sort` (→ `Sort`) · `unique`
(→ `Unique`) · `scramble` (→ `Scramble`, Fisher–Yates) · `random_sample` (→ `RandomSample`, n random elements)

## Builtin symbols

Bare symbols that denote a catalog set rather than a scope variable (`names.ts`'s `BUILTIN_SYMBOLS`).

`natural_numbers` (`\mathbb{N}`) · `integer_numbers` (`\mathbb{Z}`) · `rational_numbers` (`\mathbb{Q}`)

## Counting sequences

First-class Listable scalar operators the compute-engine library adds (Wolfram has most of these; CE itself has
none of them).

`BellB` · `CatalanNumber` · `Fubini` ·
`PartitionsP` · `PartitionsQ` · `Factorial2` (double factorial) · `PolygonalNumber`

## Digit & bitwise functions

Wolfram-style digit manipulation and bitwise ops CE's own standard library lacks.

`IntegerDigits` · `FromDigits` · `RealDigits` · `IntegerLength` · `IntegerReverse` · `DigitSum` · `DigitCount` ·
`BitAnd` · `BitOr` · `BitXor`

## Views & combinators

Lazy, $O(1)$-random-access reindexers/composers over any collection with an `at` — these stay random-access where
CE's own `Reverse`/`RotateLeft`/`CartesianProduct`/`Take` would materialize and hit a size cap.

`Reversed` · `Rotated` · `Window` · `Concat` · `Product` · `Zip` · `Power` (k-fold Cartesian power)

## Collections

94 collection constructors, grouped by mathematical family (mirroring `packages/compute-engine/src/packs/
index.ts`'s own grouping comments). Each is a MathJSON head taking 1–2 integer parameters and producing a
collection with a closed-form count and an $O(1)$–$O(n)$ unrank/rank pair.

Migrated families show a one-line summary per head and link to a page; the rest are listed by name until their
batch lands (see the batching plan). The block below is **generated from the dataset** (`nodes.ts`) — it grows
as families migrate.

<!-- CATALOG:START (generated from nodes.ts — do not edit between markers) -->

### Permutations & permutation classes

- [**Permutations**](/reference/Permutations) — The collection of permutations of $\{1, \dots, n\}$, in one-line notation.
- [**KPermutations**](/reference/KPermutations) — The ordered arrangements of $k$ distinct symbols drawn from $\{1, \dots, n\}$ — injections $[k] \hookrightarrow [n]$.
- [**SignedPermutations**](/reference/SignedPermutations) — The hyperoctahedral group $B_n$ — permutations of $[n]$ with an independent $\pm$ sign on each entry.
- [**ColoredPermutations**](/reference/ColoredPermutations) — The wreath product $\mathbb{Z}_k \wr S_n$ — a permutation of $[n]$ with an independent color in $\{0, \dots, k-1\}$ on each position.
- [**CyclicPermutations**](/reference/CyclicPermutations) — The permutations of $[n]$ that are a single $n$-cycle, in one-line notation.
- [**Involutions**](/reference/Involutions) — The self-inverse permutations of $[n]$ — those equal to their own inverse ($\sigma = \sigma^{-1}$).
- [**Derangements**](/reference/Derangements) — The permutations of $[n]$ with no fixed point — $\sigma(i) \neq i$ for every $i$.
- [**AlternatingPermutations**](/reference/AlternatingPermutations) — The up-down permutations of $[n]$: $a_1 < a_2 > a_3 < a_4 > \cdots$.
- [**PermutationsAvoiding321**](/reference/PermutationsAvoiding321) — The permutations of $[n]$ with no decreasing subsequence of length 3 (pattern $321$).
- [**PermutationsAvoiding132**](/reference/PermutationsAvoiding132) — The permutations of $[n]$ avoiding the pattern $132$ (no $i<j<k$ with $\sigma_i < \sigma_k < \sigma_j$).
- [**PermutationsAvoiding123**](/reference/PermutationsAvoiding123) — The permutations of $[n]$ with no increasing subsequence of length 3 (pattern $123$).
- [**PermutationsAvoiding213**](/reference/PermutationsAvoiding213) — The permutations of $[n]$ avoiding the pattern $213$ (no $i<j<k$ with $\sigma_j < \sigma_i < \sigma_k$).
- [**PermutationsAvoiding231**](/reference/PermutationsAvoiding231) — The permutations of $[n]$ avoiding the pattern $231$ — equivalently the stack-sortable permutations.
- [**PermutationsAvoiding312**](/reference/PermutationsAvoiding312) — The permutations of $[n]$ avoiding the pattern $312$ (no $i<j<k$ with $\sigma_j < \sigma_k < \sigma_i$).
- [**StirlingPermutations**](/reference/StirlingPermutations) — The permutations of the multiset $\{1,1,2,2,\dots,n,n\}$ in which everything between the two copies of $i$ exceeds $i$.

<!-- CATALOG:END -->

### Not yet migrated

**Compositions** (14) — `IntegerCompositions` · `CompositionsIntoKParts` · `WeakCompositions` ·
`CarlitzCompositions` · `CompositionsBoundedParts` · `CompositionsIntoDistinctParts` · `CompositionsIntoOddParts` ·
`CompositionsIntoParts123` · `CompositionsIntoParts1234` · `CompositionsIntoParts12345` ·
`CompositionsIntoParts1And2` · `CompositionsIntoPartsAtLeast2` · `KColoredCompositions` ·
`PalindromicCompositions`

**Partitions & set partitions** (17) — `IntegerPartitions` ·
`PartitionsIntoKParts` · `DistinctPartitions` · `PartitionsMaxPart` · `PartitionsInBox` · `SetPartitions` ·
`SetPartitionsIntoKBlocks` · `SetCompositions` · `PerfectMatchings` · `NonCrossingPartitions` ·
`NonNestingPartitions` · `PartitionsIntoAtMostKParts` · `PartitionsIntoOddParts` · `SelfConjugatePartitions` ·
`SetPartitionsIntoAtMostKBlocks` · `SetPartitionsNoSingletons` · `PartitionsIntoParts1And2`

**Subsets, multisets, tuples & functions** (10) — `Subsets` · `KSubsets` · `Multisets` ·
`Tuples` · `Surjections` · `Endofunctions` · `EvenSubsets` · `OddSubsets` · `SubsetsOfSizeAtMost` ·
`SubsetsWithoutConsecutive`

**Lattice paths & Catalan objects** (12) — `LatticePaths` · `DyckPaths` ·
`MotzkinPaths` · `SchroderPaths` · `BicoloredMotzkinPaths` · `DelannoyPaths` · `GrandDyckPaths` ·
`GrandMotzkinPaths` · `LittleSchroderPaths` · `NonCrossingMatchings` · `StandardYoungTableaux2xN` ·
`Triangulations`

**Trees & tree-shaped functions** (10) — `BinaryTrees` · `KAryTrees` · `OrderedTrees` · `LabeledTrees` ·
`RootedForests` · `FullBinaryTrees` · `IncreasingTrees` · `ParkingFunctions` · `PlaneForests` ·
`UnaryBinaryTrees`

**Words** (16) — binary strings, restricted growth strings, necklaces/Lyndon words, groupings, Gray-code
subsets: `BinaryStrings` · `BalancedBinaryStrings` · `BinaryStringsAvoiding00` · `BinaryStringsAvoiding010` ·
`BinaryStringsAvoiding0101` · `BinaryStringsAvoiding101` · `BinaryStringsAvoiding111` ·
`PalindromicBinaryStrings` · `RestrictedGrowthStrings` · `Necklaces` · `LyndonWords` · `Groupings` ·
`FibonacciWords` · `SmirnovWords` · `GrayCodeSubsets` · `RevolvingDoorKSubsets`

## Not (yet) mapped

Recognized by the parser but with no curated binding — reported as an "unknown operator" error naming the head,
same as any other unmapped one, rather than guessed at (`names.ts`'s `UNMAPPED_HEADS_NO_CURATED_ID` /
`BUILTIN_SYMBOLS`'s `unsupported` entries).

`Sqrt` · `Root` · `Floor` · `Ceil` · `Abs` · `Mod` · `Min` · `Max` (scalar functions) — `Pi` · `ExponentialE` ·
`ImaginaryUnit` (constants)

## Batching plan for the rest

This first tranche covers the primitives, list operations, and four representative collections/counting
sequences the notebook surfaces most. The remaining 90 collection heads are mechanically similar within a
family — each batch below is one family, doable by a lesser model against the same template once it exists:

1. ~~**Permutations family** (14 remaining) — `KPermutations` through `StirlingPermutations`.~~ **✓ done** —
   migrated into the generated dataset (`nodes.ts`), examples computed from the kernels.
2. **Compositions family** (14) — plain + Carlitz/colored/pattern-restricted compositions.
3. **Partitions & set partitions family** (16) — integer, set, non-crossing/nesting variants.
4. **Subsets/multisets/tuples/functions family** (9).
5. **Lattice paths & Catalan objects family** (11) — Motzkin, Schröder, Delannoy, triangulations, …
6. **Trees & tree-shaped functions family** (10).
7. **Words family** (16) — binary strings, necklaces, Lyndon words, groupings.
8. **Remaining counting sequences + digit/bitwise functions** (13) — `PartitionsQ`, `Factorial2`,
   `PolygonalNumber`, the seven digit functions, three bitwise ops.
9. **Views & combinators** (7) — `Reversed`, `Rotated`, `Window`, `Concat`, `Product`, `Zip`, `Power`.
10. **Remaining generic primitives, list ops & builtin symbols** (10) — `next`, `prev`, `locate`, `Element`,
    `At`, `scramble`, `random_sample`, `natural_numbers`, `integer_numbers`, `rational_numbers`.
11. **Arithmetic/comparison/lattice operators + named identities** (19) — likely thinner pages (these mirror
    ordinary algebra), possibly one page per small cluster rather than per head.
