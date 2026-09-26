# Design: Plausible — property checks derived from what a space declares

Status: **decided** (2026-09-25). The maintainer answered Q2 and approved the small fixes. Coordinator B
decided the rest while the maintainer was away, and relayed both. Being implemented in phased PRs:
§10 fixes → rename → bigint count/rank → contract + guard → capability-driven runner (lists
deleted).

## Decisions

- **§10 fixes 1, 3, 5 land first**, in their own PR.
- **Count and rank become bigint** (maintainer). Plain-number conveniences may sit alongside for casual
  use. Positions follow the archive's vocabulary (§3.6).
- **Feasibility.** When a family's count is closed or polynomial, the check is
  `count(p) ≤ budget`, compared as bigint, with no extra declaration. Only a family whose count
  itself enumerates declares a cheap upper bound, `sizeBound(p)`. There is no `feasible`
  predicate and no `max` tuple for budget. (`Param.max` stays, but only to mark where a value
  becomes unrepresentable.)
- **Carrier** is declared on `FamilyKernel`, since a join against the catalogue would drift.
- **Guard scope.** The guard walks the declared engine's definitions for collection handlers, so
  a collection can't escape by never registering.
- **Laws** use the vocabulary in §4.2. `equidistributed` is deferred to later FindStat work.
- **`Gen` lives in a new leaf package, `@enumeratio/plausible`,** imported by collections,
  reference and bench. It must stay a leaf because `vp run -r` fails on devDependency cycles.
- **Deferred:** the CE upstream proposals (random and indexOf handlers; the issue is drafted for
  the maintainer once ours works) and the chi-squared uniformity check (until direct samplers exist).
- **Rename first**, as its own mechanical PR.

Direction so far (maintainer): quickcheck samples **value spaces** by introspecting what each space
declares, with no hand-kept lists in the test script. A unit test refuses a collection that
lacks the contract. Relayed via coordinator B: rename the framework **Plausible** after Lean 4's,
lift Plausible's typeclasses, and weigh a Sage-style `_test_*` convention (§4.2).

## 0. In one screen

- A family already carries most of a Plausible instance: `count`, `unrank`, `rank`, `valid`.
  What it lacks is **cost** and **parameter space**. Add those, and the sampler, the shrinker,
  the properties and the safety limits all derive from the declaration.
- **SampleableExt's proxy/interp split fits exactly.** An element's proxy is its choice
  `(params, rank)`; `interp` is `unrank`. Shrinking and printing the replay line then come free,
  for every family, with no per-family shrinker.
- **Cost classes** (`closed`, `polynomial`, `enumerative`, `scan`) are what we add beyond Lean.
  Lean assumes `interp` is cheap; ours can materialise 3.9e16 elements. The helper that
  materialises (`indexedFamily`) declares that about itself, so a family built on it can't
  claim otherwise. That is the opposite of Sage's trap (§2.2).
- Properties come from capabilities, Sage-style. Laws that hold for every value of a
  carrier (involutions, bijections, equidistributions) hang off domains and maps, and apply to
  every family over that carrier (§4.2). Recommendation: yes to category-contributed laws, no to
  a name sigil.
- Enforcement comes in two layers. Required fields make an undeclared family a **type error**,
  as a missing instance is an elaboration error in Lean. A fast guard test adds runtime checks
  and a ratcheting exemption list with a reason per entry.

## 1. Why the lists fail

`FULL_ENUMERATION_FAMILIES`, `SMALL_PARAM_CAP` and `MAX_MATERIALIZED` in
[quickcheck.ts](../../packages/symbols/combinatorics/collections/scripts/quickcheck.ts) encode
facts about families, but they live somewhere else. #219 added `BoxedPlanePartitions` after it
OOM'd. A census of all 222 families (each in its own capped process, all params equal and
stepped up, 512 MB and 8 s per family) shows the lists were already wrong in more places:

- **84 of 222 families are never sampled.** Their count is ∞ (70) or unknown `NaN` (14), and the
  runner skips `!Number.isFinite(total)`. That covers every numeric set.
- **At least nine enumerative families are missing from the list.** `KNecklaces`,
  `KLyndonWords`, `KBracelets`, `BaxterPermutations`, `NonCrossingPermutations`,
  `SeparablePermutations`, `SimplePermutations`, `SmoothPermutations` and
  `VexillaryPermutations` pass 0.5 s for one `count` or `unrank` somewhere in n = 7–10.
  `SeparablePermutations(9)` takes 4.4 s to unrank and `SmoothPermutations(9)` takes 4.3 s to
  count. The nightly cap is 9.
- **Listed families die early too.** Under 512 MB, `SemistandardTableaux(9,9)`,
  `GelfandTsetlin(6,6)`, `AlternatingSignMatrices(8)`, `SkewStandardTableaux(8)` and
  `BoxedPlanePartitions(5,5,5)` all abort.
- **Scan cost depends on the value, not the rank.** 15 infinite or unknown sequences blow 6 s or
  512 MB before rank 10 000. `WeirdNumbers` takes 358 ms at rank 10. `SmoothNumbers(2)` is the
  powers of 2, so rank 100 means scanning to 2⁹⁹.

The same facts matter outside the harness. `RandomChoice` and `At` reach a family through
declare.ts's `at` → `unrank`. So `RandomChoice(BoxedPlanePartitions(7,7,7), 1)` in a notebook
takes the same path that OOM'd CI. I found this by reading the code and did not run it.

## 2. Prior art

### 2.1 Lean 4 Plausible (formerly SlimCheck), the model

From [leanprover-community/plausible](https://github.com/leanprover-community/plausible):

- `Gen α := RandT (ReaderT (ULift Nat) (Except GenError)) α`: a random monad that reads a
  **size**. It provides `getSize`, `resize`, and `chooseNat`, which draws from `0 … size`.
- `class Arbitrary α` gives `arbitrary : Gen α`. The instances scale with size: `Nat` draws from
  `0 … size`, `Int` from `±size`, and `List` has size-bounded length. `Prod` and `Sum` instances
  compose their parts.
- `class Shrinkable α` gives `shrink : α → List α`. The default `NoShrink` returns `[]`.
- `class SampleableExt α` has fields `proxy`, `[Repr proxy]`, `[Shrinkable proxy]`,
  `[Arbitrary proxy]` and `interp : proxy → α`. You sample and shrink a representation you can
  inspect, then interpret it. `selfContained` is the case `proxy = α, interp = id`. Instances for
  `Prod`, `Sum`, `List`, `Array` and `Option` map `interp` componentwise.
- `class Testable p` gives `run : Configuration → Bool → Gen (TestResult p)`.
  `TestResult` is `success | gaveUp n | failure`. A guard `p → q` whose `p` is false counts as
  `gaveUp`, and `numRetries` bounds the redraws.
- `Configuration` holds `numInst`, `maxSize`, `numRetries`, `randomSeed : Option Nat` and the
  `trace*` flags. Size grows linearly across the run, so small cases come first.
- **Missing instance means untestable by construction.** `sorryIfNoTestable` (default `false`)
  controls whether an unsynthesisable `Testable` is admitted silently. By default it is an
  error. `deriving Arbitrary` derives instances for inductive types.

### 2.2 Sage: categories contribute the tests

- `TestSuite(P).run()` ([sage_unittest.py](https://github.com/sagemath/sage/blob/develop/src/sage/misc/sage_unittest.py))
  discovers tests by scanning `dir(P)` for `_test_*`. Categories mix those methods in, so
  membership in a category is what makes a test apply. `max_runs=4096` caps the work.
- `Sets` contributes `_test_an_element` and `_test_some_elements` (every sampled element is
  `in P`). `EnumeratedSets` contributes `_test_enumerated_set_contains` (iterates, stops after
  `max_runs`) and `_test_enumerated_set_iter_list` (skipped when "too big").
  `FiniteEnumeratedSets` contributes `_test_rank` and `_test_random`, a chi-squared check that
  Sage skips for its own generic sampler.
- **This is the trap.** `FiniteEnumeratedSets` defaults `cardinality` to
  `_cardinality_from_iterator` (counts by iterating). `_unrank_from_list` materialises the
  tuple. `_random_element_from_unrank` composes the two. A parent inherits a capability that
  silently enumerates everything, which is our `indexedFamily` exactly. The lesson is to
  declare cost where the capability is implemented, not to infer it from whether a method
  exists.
- `Partitions_n` has two samplers: `random_element_uniform` and `random_element_plancherel`.
  That is precedent for a sampler that declares its distribution.

### 2.3 QuickCheck, Feat, SmallCheck, Hypothesis

- QuickCheck provides `Arbitrary` (`arbitrary`, `shrink`), `sized` / `resize` / `getSize`,
  `suchThat`, and `Args{maxSuccess, maxSize, maxShrinks}`.
- **Feat** (Duregård et al., Haskell'12) enumerates by index. `index → value` gives exhaustive
  small cases (SmallCheck-style) and uniform-by-size sampling from one primitive. That is our
  `count` + `unrank`. SmallCheck is exhaustive up to a depth, which is our "enumerate when
  count ≤ cap".
- **Hypothesis** has `register_type_strategy`: a type registers its own strategy, which is the
  closest match to "the space declares its sampler". Its Conjecture engine **shrinks the choice
  sequence rather than the value**, so no strategy writes a shrinker. Our `(params, rank)` proxy
  is that choice sequence. `HealthCheck.filter_too_much` flags too many rejected draws, which is
  our "too many `gaveUp`" signal.
- Boltzmann samplers (Duchon–Flajolet–Louchard–Schaeffer 2004) give size-controlled,
  approximately uniform sampling from a specification. They are the fallback in theory when no
  cheap unrank exists. Not proposed now.

### 2.4 Wolfram and compute-engine

- **Wolfram has no generic protocol.** `VerificationTest` and `TestReport` are example tests,
  the equivalent of our reference examples. Sampling uses one verb per domain:
  `RandomVariate[dist]`, `RandomPoint[region]`, `RandomGraph[dist]`, `RandomTree[n]`,
  `RandomPermutation[group]`, `RandomEntity`, `RandomWord`, `RandomPrime`.
  `RandomInstance` sounds generic, but its usage string (15.0) scopes it to geometric scenes and
  biomolecular sequences. `RandomInstance[Primes]`, `RandomInstance[Element[x, Integers]]` and
  `RandomPoint[Integers]` all stay unevaluated when probed. The only property-based testing
  package I found is third-party
  ([cabralski/quickcheck.wl](https://github.com/cabralski/quickcheck.wl), MIT, 2 stars), so it
  is not a precedent. Nothing here to mirror.
- **compute-engine (0.134).** `CollectionHandlers` has `count`, `iterator`, `contains`, `at`,
  `indexWhere`, `isFinite`, `isLazy`, `isEnumerable` and `elttype`. It has no random handler, no
  rank (`indexWhere` is a linear search) and no cost. `RandomChoice(domain, k)` (with
  replacement), `RandomSample` and `RandomShuffle` go through count and `at`, `WithRandomSeed`
  makes them deterministic, and an infinite collection gets `out-of-range`. **User-facing
  sampling therefore stays `RandomChoice`** (CE first). The kernel-level field below is internal
  and needs no head.

## 3. The contract: Plausible's classes, mapped to ours

### 3.1 Mapping

| Plausible                  | Ours                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `Gen α`, reads a size      | `Gen<T> = (rng, size) => T`, a seeded mulberry32 stream                                                                                    |
| `Arbitrary`                | For params: derived from `Param` specs (§3.2). For elements: derived through the proxy                                                     |
| `Shrinkable`               | On the proxy only: params toward `min`, then rank toward 0. Generic, never per family                                                      |
| `SampleableExt`            | `proxy = (params, rank)`, `interp = unrank`, `Repr proxy` = the replay line. `selfContained` for a family with a direct sampler only       |
| `interp` is free           | **`interp` has a cost class**, and the runner gates on it (§3.3)                                                                           |
| `Testable p`, `TestResult` | `Property`: `applies(caps)` plus `check(sample)` → pass, fail or **discard** (`gaveUp`)                                                    |
| `Configuration`            | `points` (numInst), `maxSize`, `retries`, `seed`, `budget` (work units), `trace`                                                           |
| missing instance → error   | Required fields make it a tsc error, and the guard test covers the runtime side (§6)                                                       |
| `deriving Arbitrary`       | `sampleable(family)` derives the instance from capabilities, as `declareFamilies` derives CE handlers                                      |
| `Prod`, `Sum`              | Multi-variable properties, call forms (a sum over arg shapes), and a carrier's instance (a sum over its families, §4.2)                    |
| (none)                     | **Σ over params**: a parameterised family is `Σ p : Params, Family(p)`. Sample `p` at the current size, then the element; shrink `p` first |

### 3.2 Parameter spaces

The catalogue already has the seed of this. Each collection has `grades: [{name, role:
"axis" | "param"}]`, carried over from enumeratio, where an axis is a size grading and a param a
shape parameter. Extend it:

```ts
interface Param {
  readonly name: string;
  readonly role: "axis" | "param"; // an axis grows with Plausible's size; a param draws from min … min+3
  readonly min: number; // SmoothNumbers: k ≥ 2 (k = 1 is {1}, and its unrank(1) never returns)
  readonly max?: number; // hard bound: beyond it the kernel is wrong or unrepresentable (18! is the last exact factorial)
}
```

`max` means representability, not budget. The budget belongs to the runner.

### 3.3 Cost classes (ours, not Lean's)

```ts
type Cost =
  | "closed" // arithmetic in params and rank only (Lehmer unrank, closed-form count)
  | "polynomial" // DP tables polynomial in the params (partition unrank via p(n,k))
  | "enumerative" // time and memory ∝ count(p): enumerate, cache, index (indexedFamily)
  | "scan"; // ∝ the element's value: nth-match scans of infinite sequences
```

Declared per operation: `{ count, unrank, rank, valid }`. The runner turns cost into
feasibility:

- `closed` or `polynomial`: any params within `max`, any rank.
- `enumerative`: the runner needs the family size before it pays. With a cheap count, feasible
  means `count(p) ≤ budget`. **When count is itself enumerative** (`PlanePartitions`,
  `SkewPartitions`, `SkewStandardTableaux`), the family must supply `feasible(p)`. The type
  enforces this (sketch below). An infeasible draw is a discard, not a failure.
- `scan`: the rank is bounded by size, and optionally `sized(p, size) → maxRank`, because only
  the family knows how fast its values grow (`SmoothNumbers(2)`). A worker time cap is the
  backstop.

**The helpers declare their own cost.** `indexedFamily` returns `{ …, cost: "enumerative" }`.
`nthMatchCache` returns `"scan"`. A table-backed sequence returns `"closed"` plus `known`. A
family assembled from helpers takes the helper's cost, so the declaration sits where the
behaviour is. It cannot drift the way a list can.

### 3.4 Counts: finite, ∞, unknown

`count(p)` stays a number: finite, `Infinity`, or `NaN` for a declared open problem (the
existing convention). The contract adds:

- **finite**: rank is drawn from `[0, count)`, biased toward 0 and `count−1` (the degenerate
  ends, which is where bugs turn up).
- **∞**: rank is drawn from `[0, size]`, or `sized` for `scan`. Now sampled at all.
- **NaN**: requires `known(p)`, the length of the prefix the kernel can produce (the
  `NarcissisticNumbers`-style tables). Rank is drawn inside the prefix. Past it, the kernel
  must decline (NaN), never hang.

This also makes the CE handlers honest. declare.ts answers `isFinite: () => true` for `Primes`
too. The handler should take `isFinite` from the count class.

### 3.6 Positions: rank, address, ordinality

The archived enumeratio (docs/develop/glossary.md) keeps four notions of position apart. We
follow it and surface only what's needed now:

| Notion               | Meaning                                                                          | Now                                                                                         |
| -------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **rank**             | 0-based place within a fiber (one family at fixed params); what `unrank` inverts | **bigint** in the kernel. `rank` returns `-1n` for a non-member                             |
| **count**            | fiber size                                                                       | **bigint** when finite. `Infinity` and `NaN` keep their meanings (the only numbers allowed) |
| **address**          | fiber axes ⊕ rank: `(params, rank)`, printed `4.2.1`                             | **Plausible's proxy.** It appears in replay lines and findings. No head for now             |
| **ordinality**       | 1-based position in a result set: a property of a query, not of an element       | Already CE's: `At(view, k)` indexes by ordinality. See below                                |
| **omega_ordinality** | transfinite address across an open collection, in Cantor normal form (ω·4 + 2)   | Not surfaced. It would matter for walking an open family across its params                  |

- **A filtered view gets its ordinality without touching rank.** `At(Filter(F, pred), k)` counts
  survivors of the filter's own iteration, so `k` is the view's ordinality. An element keeps its
  intrinsic rank in `F`'s fiber: `rank(e) = r` holds whether or not `e` survived. For the bare
  family only, ordinality is `rank + 1`, which is exactly what declare.ts's `at` does. No new
  machinery.
- **The boundary with CE is plain numbers.** CE's `count` handler returns `number | undefined`,
  and `at(index: number)`. declare.ts converts: an exact count answers as a number, a count past
  2⁵³ answers `undefined` (unknown to CE, never a rounded wrong number), and `At` indices come in
  as numbers and turn into bigint ranks.
- **Migration adapter.** Today's kernels do number arithmetic. `numberKernel({…})` wraps one into
  the bigint contract. It converts at the boundary, and when a count isn't a safe integer it
  throws `RangeError("… exceeds 2^53 …")` instead of converting a rounded value. Plausible
  reports those families as "needs bigint" rather than failing them. They then move to real
  bigint arithmetic one at a time, heaviest first (`SetPartitions`, `Permutations`).

### 3.5 Sketch

```ts
// decided: feasibility is count(p) ≤ budget; only an enumerating count declares sizeBound
type Costs =
  | { count: "closed" | "polynomial"; unrank: Cost; rank: Cost; valid: Cost }
  | { count: "enumerative"; unrank: Cost; rank: Cost; valid: Cost; sizeBound: (p: number[]) => bigint };

interface FamilyKernel {
  readonly head: string;
  readonly kind: "ints" | "blocks" | "nested" | "scalar";
  readonly params: readonly Param[]; // replaces paramCount (length = arity)
  readonly cost: Costs;
  readonly count: (p: number[]) => number;
  readonly unrank: (p: number[], r: number) => Element;
  readonly rank: (element: unknown, p: number[]) => number;
  readonly valid: (element: unknown, p: number[]) => boolean;
  readonly known?: (p: number[]) => number; // required when count is NaN (guard test)
  readonly sized?: (p: number[], size: number) => number; // scan: max rank at this size
  readonly sample?: { gen: (p: number[]) => Gen<Element>; distribution: "uniform" | string }; // direct sampler, optional
  readonly carrier?: string; // joins domains/maps (§4.2); today only the catalogue has it
}

// "deriving": the instance or the reason there isn't one
function sampleable(f: FamilyKernel): Sampleable<[number[], number], Element> | { untestable: string };
```

A **direct sampler** (`sample`) is how an enumerative family becomes testable at large params
without enumerating: Plausible's `selfContained`, with the shrinker limited to params. None is
proposed now. It is the hook for later work (plane partitions, SSYT via RSK), and the same hook
could back `RandomChoice` if CE ever takes a random handler (§11).

## 4. Properties: where they come from

### 4.1 From capabilities (the Sage `Sets`/`EnumeratedSets` layer)

| Applies when                     | Property                                                                                                      | Sage analogue                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| always                           | a sampled element is a member: `valid(interp(x))`                                                             | `_test_some_elements`                   |
| rank declared                    | `rank(unrank(r)) = r`                                                                                         | `_test_rank`                            |
| finite count                     | injectivity over a sampled window; `unrank` in range is never undefined                                       | —                                       |
| finite, feasible, count ≤ cap    | count = distinct enumeration                                                                                  | `_test_enumerated_set_iter_cardinality` |
| rank and valid declared          | **non-members**: mutate a member (bump an entry, drop a part); `valid(y) ⇔ rank(y) ≥ 0 ∧ unrank(rank(y)) = y` | —                                       |
| `kind: "scalar"`, ∞ count        | ascending: `unrank(r) < unrank(r+1)`                                                                          | —                                       |
| NaN count                        | inside `known` it answers; past `known` it declines without hanging                                           | —                                       |
| `sample` declared uniform, small | chi-squared (nightly only)                                                                                    | `_test_random`                          |
| cost declared                    | **honesty**: measured time and heap scale with the declared class (nightly finding, never a unit test)        | —                                       |
| CE handlers                      | `Count`, `At`, `Element` through the engine agree with the kernel                                             | —                                       |

The non-member row covers a real gap. Today `valid` is only ever asked about its own elements,
so false positives are invisible.

### 4.2 Laws on domains and maps: the Sage `_test_*` question

Structure first. We have no classes, so there is no `dir()` to scan. Everything is a record:
`Domain` (carrier), `CombinatorialMap {from, to, body}`, statistics on a carrier, families.
The catalogue joins them (282 collections over 87 carriers, 242 stats, 85 maps, each with a
carrier). The carrier plays the role of Sage's category. A law declared on a carrier or on a
map applies to **every family over that carrier**, just as a category's `_test_*` applies to
every parent in it.

**Recommendation: yes to category-contributed laws, discovered by walking the structure; no to a
name sigil.** A `laws` field on the record plays the part of the `_test_` prefix:

```ts
// domains/src/map.ts: checked on elements of every family whose carrier is `from`
{ name: "Inverse",    from: "permutation", to: "permutation", body: …, laws: ["involution"] }
{ name: "Complement", from: "permutation", to: "permutation", body: …, laws: ["involution"] }
{ name: "RSK",        from: "permutation", to: "standard_tableau_pair", laws: [{ inverse: "InverseRSK" }] }
// a statistic: equidistribution over each finite family on the carrier (MacMahon)
{ name: "Inversions", on: "permutation", laws: [{ equidistributed: "MajorIndex" }] }
```

The law vocabulary stays small and named: `involution` (f∘f = id), `idempotent`,
`{inverse: g}` (g∘f = id), `{equidistributed: s}` (same value multiset over a whole finite
family, which needs `enumerate`), and implicitly **typed** (the result is a member of `to`'s
domain; always on). CE's operator flags (`involution`, `idempotent`, `commutative`,
`associative`) fit the same vocabulary. None of our heads sets them yet, but any that did would
get its laws for free.

**How it meets the instances.** A law is a `Testable` of the form ∀ x : carrier, law(x). Its
instance is the **Sum** of every family instance over the carrier: pick a family (weighted),
then sample from it. Plausible's `Sum` does the same. So laws need nothing new from families
beyond `carrier`. `equidistributed` needs a finite, feasible family, and simply doesn't apply
elsewhere, the way Sage skips a test a parent can't support.

Cost: the carrier join. `FamilyKernel` has no `carrier`, and the catalogue does. Either add the
field, or join by head from the catalogue at harness time (open question 3).

## 5. The runner

- **Seeds.** Every family gets its own stream, `hash(seed/head)`, as oracle-quickcheck already
  does. **Today's replay line does not replay.** The whole run shares one stream, so filtering
  to `<family>` changes which draws that family sees.
- **Size schedule.** Plausible's linear ramp from 0 to `maxSize` across `points`. Degenerate
  params come first. The nightly run raises `maxSize` and `points`, as it raises the caps today.
- **Discards.** An infeasible or empty draw is `gaveUp` and is redrawn up to `retries` times.
  When most of a family's draws are discarded, that is itself reported: the declared parameter
  space is too wide for its cost (Hypothesis' `filter_too_much`).
- **Isolation.** Each family runs in a worker with `resourceLimits` and a time cap, the same
  isolated-and-capped approach `runCases` gives oracle-quickcheck. A lying declaration then
  produces a finding ("BoxedPlanePartitions: 512 MB at (7,7,7)") instead of a dead run. Heap caps
  follow `NODE_OPTIONS`, 1.5 GB for the whole run.
- **Output.** Each finding prints the shrunk proxy as the replay line (`<head> <seed>`, plus
  params and rank). "Undeclared" families are listed separately while the ratchet exists.

## 6. Enforcement

1. **Types.** `params` and `cost` are required on `FamilyKernel`, and `feasible` is forced by the
   `Costs` union. An undeclared family doesn't compile, just as a missing Lean instance fails
   elaboration. Plausible's default refuses to `sorry` the goal, and so do we.
2. **Guard test** (`plausible-contract.test.ts`, fast, under a second). For every entry:
   - `sampleable(entry)` is an instance, not `{untestable}`;
   - an element at the smallest nonempty params (Sage's `an_element`) is valid and round-trips;
   - NaN count ⇒ `known` exists; ∞ count ⇒ not `enumerative`;
   - `max` holds;
   - the CE handler's `isFinite` matches the count class.

   Exemptions go in one `EXEMPT: Record<head, reason>` in the test, each with a reason. **A stale
   exemption fails too**: an exempt family that now satisfies the contract has to be removed.

3. **Scope** beyond `FamilyKernel`: every head declared with `collection` handlers (residues'
   `PrimitiveRootList` and `IntegerModRing`, call-forms' dispatchers) is either built through the
   contract or exempt with a reason. The best way to enumerate those is open question 4.
4. **Honesty** is checked by the nightly Plausible run, not the unit test, because timing is
   noisy.

## 7. Relation to the oracle quickcheck

- Different questions. Plausible checks **internal consistency**: a kernel agrees with itself
  (rank against unrank, valid, count). The oracle check tests **external agreement**, ours
  against mpmath, Sage and Wolfram, at edge values of documented examples.
- **What they share:** `Gen`, seeding (date seed, per-key streams) and edge-biased draws. There
  are three mulberry32 copies (collections, oracle-quickcheck's generator, `bench/random.ts`);
  benchmarking.md already plans to move it into `@enumeratio/utils`, and Plausible's `Gen` should
  live beside it.
- **What the oracle gains:** a family call's params are resampled from its `Param` spec (within
  `feasible`) instead of `numberNear`. Its own hand list, `STRUCTURAL`, then shrinks to non-family
  heads (`Diagram`, algebras), which can grow param specs later.
- **What they share downstream:** a counterexample from either becomes a hidden example in the
  head's YAML, the same promotion path examples-as-data set up.

## 8. The rename: every place

| Where                                                  | Now                                                                             | Proposed                                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `collections/scripts/quickcheck.ts`                    | runner                                                                          | `scripts/plausible.ts`                                                                                           |
| `collections/scripts/properties.ts`                    | properties + shrinker + PRNG                                                    | properties stay; `Gen`/seed move out (§7)                                                                        |
| `collections/tests/quickcheck.test.ts`                 | harness self-test                                                               | `plausible.test.ts`; plus new `plausible-contract.test.ts`                                                       |
| `.github/workflows/quickcheck.yml`                     | `name: Quickcheck`, job, concurrency group, log file                            | `plausible.yml`, `Plausible`, `plausible-…`, `plausible.log`                                                     |
| same, env                                              | `QUICKCHECK_POINTS`, `QUICKCHECK_PARAM_CAP`                                     | `PLAUSIBLE_POINTS`, `PLAUSIBLE_MAX_SIZE`                                                                         |
| rolling issue                                          | `quickcheck sampling regression`                                                | `plausible sampling regression`: **retitle the open issue in the same PR**, since the workflow finds it by title |
| `packages/reference/scripts/oracle-quickcheck.ts`      | oracle sampler                                                                  | `oracle-plausible.ts`                                                                                            |
| `.github/actions/oracle-quickcheck/action.yml`         | action name, `quickcheck.md` report                                             | `oracle-plausible`, `plausible.md`                                                                               |
| its rolling issues                                     | `oracle quickcheck findings: <ecosystem>`                                       | `oracle plausible findings: <ecosystem>` (retitle open ones)                                                     |
| `.github/workflows/nightly.yml`                        | `uses: ./.github/actions/oracle-quickcheck` (×3), comments                      | follow                                                                                                           |
| `.github/workflows/perf.yml`, `tools/perf/README.md`   | comments citing quickcheck.yml                                                  | follow                                                                                                           |
| `AGENTS.md` (CI section)                               | quickcheck.yml, both issue titles, oracle quickcheck                            | follow                                                                                                           |
| `design/benchmarking.md`, `design/examples-as-data.md` | prose                                                                           | follow                                                                                                           |
| code comments                                          | `families/index.ts`, `numeric-digits-primes.ts`, a few tests, `bench/random.ts` | follow                                                                                                           |
| nightly-fixup routine (06:15 UTC)                      | reads the issue titles                                                          | update its prompt (outside the repo)                                                                             |
| memory notes                                           | ci-and-deploy-setup, capability-driven-quickcheck                               | follow                                                                                                           |

## 9. Migration

Collections is shared with lane coordinator A (A-40 is live in `collections/src/graphs-2.ts`),
so each step claims its files in the lanes ledger first.

1. **Rename** (mechanical, no behaviour change): everything in §8.
2. **Contract, derivation, runner, lists deleted.**
   - Add `Param`, `Costs` and `sampleable()` as **optional** fields for now.
   - The helpers self-declare (`indexedFamily`, `nthMatchCache`, tables), which covers every
     family in today's list on day one.
   - Rewrite the runner to introspect: per-family seeds, size ramp, isolation.
   - An undeclared family runs under conservative defaults (size ≤ 4, worker cap) and is
     reported as "undeclared".
   - Delete `FULL_ENUMERATION_FAMILIES`, `SMALL_PARAM_CAP` and `MAX_MATERIALIZED`.
   - Add the guard test with a ratchet seeded from whatever is still undeclared.
3. **Declare, file by file** (`families/*.ts`, a few per PR, sonnet lanes). Each PR shrinks the
   ratchet. Fix `SmoothNumbers(1)` via `min: 2` here.
4. **CE handlers honour the contract**: `isFinite` from the count class, and `At`/`RandomChoice`
   decline past `feasible` with a message instead of an OOM.
5. **Laws** (§4.2): the carrier join, plus `laws` on maps and stats. Separate sign-off if §4.2 is
   contentious.
6. **Oracle side**: param specs replace `numberNear` for family heads, and `STRUCTURAL` shrinks.
7. **Make the fields required** and delete the ratchet.

## 10. Found along the way

1. The replay line doesn't replay (§5).
2. 84 of 222 families (38%) are never sampled (§1).
3. `SmoothNumbers(1)` has count ∞, but the set is `{1}`, and `unrank([1], 1)` never returns
   (confirmed with a 5 s timeout).
4. At least nine enumerative families are missing from the list, and the nightly cap reaches
   them (§1).
5. `isFinite: () => true` for every family, infinite ones included (declare.ts).
6. `At` and `RandomChoice` on a large enumerative family in a notebook take the OOM path (§1).
7. `valid` is only tested positively (§4.1).

Fixes for 1, 3 and 5 are small enough to land ahead of the redesign if you want them now.

## 11. Open questions

1. **Feasibility for enumerative-count families**: a `feasible(p)` predicate (proposed), a
   declared `max` tuple, or a cheap upper-bound function `sizeBound(p)`?
2. **Rank precision.** Ranks and counts are JS numbers. Past 2⁵³, uniform rank sampling and exact
   round trips are impossible: `SetPartitions(30)` has Bell(30) ≈ 8.5e23 elements. Is `max`
   enough for now, or should `rank`/`unrank` move to bigint?
3. **Carrier**: add `carrier` to `FamilyKernel`, or join from the catalogue at harness time?
4. **Guard scope**: can we list every definition with `collection` handlers from a declared
   engine (scope walk), or do non-family collections register themselves?
5. **Sage-style laws** (§4.2): yes in principle? Is the law vocabulary right, and does
   `equidistributed` (FindStat territory) belong in this effort or later?
6. **Where `Gen` lives**: `@enumeratio/utils` with the PRNG move, or a small
   `@enumeratio/plausible` package that collections, reference and bench all import?
7. **CE upstream**: propose a `random` collection handler (so `RandomChoice` can use a direct
   sampler) and an `indexOf`/rank handler? Issue first, with your sign-off on the draft, per the
   upstreaming rule.
8. **Uniformity (chi-squared)**: worth a nightly slot, or wait until there are direct samplers?
9. **Rename timing**: rename first (§9.1), or together with the rewrite?
