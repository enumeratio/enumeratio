# Plausible: property checks derived from what a space declares

Status: **decided** (2026-09-25), being built in phases (§9).

Plausible is the property-based sampler over our value spaces. It was called quickcheck, and it
is named after Lean 4's Plausible (formerly SlimCheck), whose typeclasses it lifts. It samples
each space by **introspecting what the space declares**, and keeps no hand lists of families in
the runner. A unit test refuses a collection that doesn't meet the contract.

## 1. Why

The old runner decided how to sample a family from lists in the script
(`FULL_ENUMERATION_FAMILIES`, `SMALL_PARAM_CAP`, `MAX_MATERIALIZED`). Those were facts about
families, kept somewhere else, and they drifted. `BoxedPlanePartitions` was missing (#219). Its
count is closed-form, but its unrank enumerates the whole box, and sampling `(7,7,7)` tried to
build 3.9e16 elements.

A census taken while designing this found worse drift:

- enumerative families that weren't on the list;
- infinite and unknown-count families (every numeric set) that were skipped outright;
- scan-backed sequences whose cost depends on the value, not the rank.

The same facts matter outside tests. `At` and `RandomChoice` reach a family through the same
`unrank`, so a notebook can take the path that OOM'd CI.

## 2. Prior art

- **Lean 4 Plausible** ([repo](https://github.com/leanprover-community/plausible)) is the model.
  - `Gen` is a seeded random monad that reads a **size**.
  - `Arbitrary α` gives `arbitrary : Gen α`, and its instances scale with size. `Shrinkable α`
    gives `shrink : α → List α`.
  - **`SampleableExt α`** samples and shrinks an inspectable `proxy`, then maps it through
    `interp : proxy → α`. `selfContained` is the case `proxy = α`.
  - `Testable p` returns `success | gaveUp | failure`. A guard that fails counts as `gaveUp`,
    retried up to `numRetries`.
  - `Configuration` holds `numInst`, `maxSize`, `randomSeed`. Size ramps up across the run.
  - `Prod`, `Sum`, `List` and `Option` instances compose. `deriving Arbitrary` derives them.
  - A missing instance is an elaboration error, so a type without one is untestable by
    construction.
- **Sage** (`TestSuite`, [sage_unittest.py](https://github.com/sagemath/sage/blob/develop/src/sage/misc/sage_unittest.py)).
  - Categories contribute `_test_*` methods (`_test_an_element`, `_test_some_elements`,
    `_test_enumerated_set_contains`, `_test_rank`, `_test_random`). Membership in a category is
    what makes a test apply, and `max_runs` caps the work.
  - **The trap to avoid:** `FiniteEnumeratedSets` defaults `cardinality`, `unrank` and
    `random_element` to implementations that iterate or materialise
    (`_cardinality_from_iterator`, `_unrank_from_list`, `_random_element_from_unrank`). A
    capability's cost must be declared where it is implemented, not inferred from the method
    being there.
- **QuickCheck, Feat, Hypothesis.**
  - QuickCheck contributes `sized` and `suchThat`.
  - Feat indexes an enumeration by rank for uniform-by-size sampling. That is our `count` +
    `unrank`.
  - Hypothesis shrinks the **choice sequence**, not the value, so nothing writes a per-type
    shrinker. Its `filter_too_much` health check is our "too many discards".
- **Wolfram has no generic protocol.** It has one sampling verb per domain (`RandomVariate`,
  `RandomPoint`, `RandomGraph`, `RandomPermutation[group]`, …). `RandomInstance` covers only
  geometric scenes and biomolecular sequences. `VerificationTest` is example testing.
- **compute-engine.** `CollectionHandlers` has `count`, `iterator`, `contains`, `at`,
  `indexWhere`, but no random handler, no rank and no cost. **User-facing sampling stays CE's
  `RandomChoice`** (with `WithRandomSeed`), which goes through `count` and `at`. Plausible's
  sampler is kernel-level and needs no head.

## 3. The contract

### 3.1 Plausible's classes, mapped

| Plausible                | Ours                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `Gen α` reading a size   | `Gen<T> = (rng, size) => T`, seeded, in the leaf package `@enumeratio/plausible`                                    |
| `Arbitrary`              | Params from `Param` specs (§3.2); elements through the proxy                                                        |
| `SampleableExt`          | `proxy = address = (params, rank)`, `interp = unrank`, `Repr proxy` = the replay line                               |
| `Shrinkable`             | On the proxy: params toward `min`, then rank toward 0. Generic, never per family                                    |
| (Lean assumes it's free) | **`interp` has a cost class**, and the runner gates on it (§3.3)                                                    |
| `Testable`, `TestResult` | `Property`: `applies(capabilities)` + `check` → pass, fail, or **discard** (`gaveUp`)                               |
| `Configuration`          | `points`, `maxSize`, `retries`, `seed`, `budget`                                                                    |
| missing instance → error | Required fields (a tsc error), plus the guard test (§6)                                                             |
| `deriving Arbitrary`     | `sampleable(family)` derives the instance from capabilities, as `declareFamilies` derives CE handlers               |
| `Prod`, `Sum`            | Multi-variable properties; call forms (a sum over arg shapes); a carrier's instance (a sum over its families, §4.2) |
| Σ types                  | A parameterised family is `Σ p, Family(p)`: sample `p` at the current size, then the element; shrink `p` first      |

A family with a direct sampler (`sample`) is `selfContained`, and only its params shrink. This
is how an enumerative family becomes testable at large params without enumerating, and later
the hook for `RandomChoice` if CE takes a random handler.

### 3.2 Parameters

These extend the catalogue's grades (`axis | param`, from enumeratio):

```ts
interface Param {
  readonly name: string;
  readonly role: "axis" | "param"; // an axis grows with size; a param draws from a small range of its own
  readonly min: number;
  readonly max?: number; // representability only: past it the kernel is wrong or unrepresentable
}
```

### 3.3 Cost classes

```ts
type Cost =
  | "closed" // arithmetic in params and rank (Lehmer unrank, closed-form count)
  | "polynomial" // DP tables polynomial in the params
  | "enumerative" // time and memory ∝ the elements generated: enumerate, cache, index
  | "scan"; // ∝ the element's value: nth-match scans of an infinite sequence
```

Cost is declared per operation (`count`, `unrank`, `rank`, `valid`). **The helpers declare their
own cost.** `indexedFamily` is `enumerative`, `nthMatchCache` is `scan`, and a table-backed
sequence is `closed` with a `known` prefix. A family built on a helper takes the helper's
cost. The declaration sits where the behaviour is, so it can't drift from it.

Feasibility:

- **What an enumeration generates isn't always the count.** Filtering the permutations of n
  generates n! to find Baxter(10)'s 326 240. Necklaces and bracelets generate every one of the
  base^size words. So wherever a cost is `enumerative`, the declaration carries a `work(p)`
  bound, and the helper that enumerates supplies it: `indexedFamily` its count, the
  permutation-class filter n!, the word classes base^size. A family whose count itself
  enumerates gives a cheap upper bound that the contract test checks wherever the count is
  cheap (`SkewPartitions`: 4ⁿ).
- The runner discards a draw whose work exceeds the budget. It compares as bigint.
- `scan` bounds the rank by size, optionally through `sized(p, size)`, since only the family
  knows how fast its values grow (`SmoothNumbers(2)` is the powers of 2).
- An infeasible draw is a discard, not a failure.

### 3.4 Counts and positions

We keep the archived enumeratio's vocabulary:

| Notion               | Meaning                                                                      | Here                                                                  |
| -------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **count**            | fiber size                                                                   | **bigint** when finite; `Infinity` known-infinite; `NaN` open problem |
| **rank**             | 0-based place in a fiber (one family at fixed params); what `unrank` inverts | **bigint**; `-1n` for a non-member                                    |
| **address**          | fiber axes ⊕ rank, `(params, rank)`, printed `4.2.1`                         | Plausible's proxy: in replay lines and findings, no head              |
| **ordinality**       | 1-based position in a result set, a property of a query                      | CE's `At(view, k)` index                                              |
| **omega_ordinality** | transfinite address across an open collection (ω·4 + 2)                      | not surfaced                                                          |

- **A filtered view takes its ordinality from its own iteration.** `At(Filter(F, pred), k)`
  counts survivors, and an element's rank in `F` is untouched. Only on the bare family is
  ordinality `rank + 1`.
- **The CE boundary stays in numbers.** An exact count past 2⁵³ answers `undefined` (unknown),
  never a rounded wrong number.
- **Migration adapter.** `numberKernel({…})` wraps a number-arithmetic kernel into the bigint
  contract. Instead of rounding it throws `RangeError`, which Plausible reports as "needs
  bigint". Those kernels then move to real bigint one at a time, heaviest first.
- **Each count class samples differently.**
  - A finite family draws its rank from `[0, count)`, biased toward both ends.
  - An infinite one draws from `[0, size]`.
  - An open problem (`NaN`) is either scanned, like infinite (TwinPrimes produces as many as you
    ask for), or backed by a table. A table declares `known(p)`, draws inside it, and must
    decline (never hang) past its end.

  CE's `isFinite` follows the count class.

- **A repeating sequence declares `repeats`.** Fibonacci's 1, 1 means `rank` finds the first
  occurrence, so the round trip becomes `unrank(rank(x)) = x` with `rank(x) ≤ r`, and
  injectivity doesn't apply. The recurrence helper works this out itself from the sequence's
  first terms.

### 3.5 Shape

```ts
interface Declared {
  readonly carrier: string; // the domain its elements inhabit (§4.2)
  readonly params: readonly Param[];
  readonly cost: { count: Cost; unrank: Cost; rank: Cost; valid: Cost };
  readonly work?: (p: number[]) => bigint; // required when any cost is enumerative
  readonly sized?: (p: number[], size: number) => bigint; // scan: largest cheap rank at this size
  readonly repeats?: boolean; // a sequence whose terms repeat
  readonly known?: (p: number[]) => bigint; // a table-backed open problem's reach
  // later: sample?: { gen: (p: number[]) => Gen<Element>; distribution: "uniform" | string }
}

interface FamilyKernel {
  readonly head: string;
  readonly kind: "ints" | "blocks" | "nested" | "scalar";
  readonly declared?: Declared; // required once the ratchet is empty
  readonly count: (p: number[]) => bigint | number; // number only for Infinity / NaN
  readonly unrank: (p: number[], r: bigint) => Element;
  readonly rank: (element: unknown, p: number[]) => bigint;
  readonly valid: (element: unknown, p: number[]) => boolean;
}

function sampleable(f: FamilyKernel): Sampleable<Address, Element> | { untestable: string };
```

## 4. Properties

### 4.1 From capabilities

| Applies when        | Property                                                                         |
| ------------------- | -------------------------------------------------------------------------------- |
| always              | a sampled element is a member (Sage `_test_some_elements`)                       |
| rank                | `rank(unrank(r)) = r` (`_test_rank`); with `repeats`, `unrank(rank(x)) = x`      |
| finite count        | injectivity over a sampled window                                                |
| finite, count ≤ cap | count = distinct enumeration                                                     |
| rank and valid      | **non-members**: mutate a member; `valid(y) ⇔ rank(y) ≥ 0 ∧ unrank(rank(y)) = y` |
| scalar, infinite    | ascending                                                                        |
| `NaN` count, table  | answers inside `known`, declines past it                                         |
| cost                | honesty: measured time and heap fit the declared class (nightly finding only)    |
| CE handlers         | `Count`, `At`, `Element` agree with the kernel                                   |

### 4.2 Laws from carriers and maps (the Sage layer)

The carrier plays the part of Sage's category. A law on a map or statistic applies to **every
family over its carrier**. Laws are found by walking the structure (family → carrier → the maps
and statistics on it), with no method-name sigil, because everything here is a record and there
are no classes to scan:

```ts
{ name: "Inverse",    from: "permutation", to: "permutation", body: …, laws: ["involution"] }
{ name: "RSK",        from: "permutation", to: "standard_tableau_pair", laws: [{ inverse: "InverseRSK" }] }
```

The vocabulary is `involution`, `idempotent`, `{inverse: g}`, and an always-on **typed** law
(the result is a member of the target domain). `{equidistributed: s}` is deferred to later
FindStat work. A law is a `Testable` over the carrier, and its instance is the **Sum** of the
instances of every family on that carrier.

As built (`domains/src/laws.ts`, `domains/tests/laws.test.ts`):

- `checkLaws` is pure and CE-based. The laws test draws a family on the carrier, then an address
  from that family's derived instance, seeded per map.
- A family's carrier is its declared one, falling back to the catalogue's while the ratchet
  exists.
- A kernel element becomes a carrier value through a small per-carrier table: Permutations
  today. Carriers whose storage differs from the kernel's (SetPartitions's growth string
  against the kernel's blocks) join as they're written, and a map with declared laws on a
  carrier without an entry fails the test.
- A guarded map that declines a subject (KrewerasComplement off the non-crossing permutations)
  counts as a decline, not a failure.
- The laws take n = 0 too. They first turned up compute-engine's `Range(1, 0)`, which counts
  down to `[1, 0]` (Wolfram's is empty), so the map bodies state their step.

## 5. The runner

- **Seeds.** Each family has its own stream (`seed/head`), so a filtered replay line reproduces
  the full run.
- **Size ramp.** Size grows from 0 to `maxSize` across the points, so degenerate params come
  first.
- **Discards.** An infeasible or empty draw is redrawn up to `retries` times. Mostly-discarded
  families are reported: their declared parameter space is too wide for their cost.
- **Isolation.** Families run one at a time in a worker with `resourceLimits` and a per-family
  time cap. The worker is replaced only when a family kills it, so a wrong declaration becomes a
  finding instead of a dead run.
- **Undeclared families** (while the ratchet exists) are sampled conservatively: every param an
  axis from 0, size at most 4, and assumed to enumerate.
- **Output.** Findings print the shrunk address as the replay line.

## 6. Enforcement

1. **Types.** `declared` becomes required once the ratchet is empty, and then an undeclared
   family doesn't compile. Until then the contract test holds the line.
2. **Guard test** (fast). For every family:
   - `sampleable` is an instance;
   - the element at the smallest nonempty params is valid and round-trips;
   - `work` covers the count wherever the count is cheap;
   - `NaN` count ⇒ `known` or a scan; ∞ count ⇒ not `enumerative`.

   Exemptions carry a reason, and a stale exemption fails.

3. **Scope.** The guard walks the declared engine's definitions for collection handlers. Every
   one must be built through the contract or be exempt with a reason, so nothing escapes by not
   registering.
4. **Honesty** is checked by the nightly run, since timing is too noisy for a unit test.

## 7. The oracle side

The two checks answer different questions. Plausible tests **internal consistency**: a kernel
agrees with itself. The oracle run (`oracle-plausible`) tests **external agreement** with mpmath,
Sage, Wolfram and the rest, at the edges of documented examples.

- **Shared:** `Gen`, date and per-key seeding, and edge-biased draws, all from
  `@enumeratio/plausible`.
- **The oracle gains param specs.** A family call's params are resampled from its `Param` spec,
  so its hand list of structural heads shrinks to non-family heads.
- **Findings from either become hidden examples** in the head's YAML.

## 8. Deferred

- A CE upstream issue for `random` and `indexOf` collection handlers, drafted for sign-off once
  ours works.
- The chi-squared uniformity check, until direct samplers exist.
- `equidistributed` laws.
- Direct samplers (plane partitions, SSYT via RSK) and Boltzmann sampling.

## 9. Phases

1. Small fixes (replay seeds, `SmoothNumbers(k<2)`, `isFinite` from count). Landed #229.
2. Rename: quickcheck becomes Plausible across scripts, workflows, actions, issue titles and
   docs. Landed #233.
3. Bigint count and rank, through `numberKernel`.
4. `@enumeratio/plausible` (leaf) with `Gen` and seeding, plus the contract (optional fields),
   the helpers self-declaring, and the guard with a ratchet.
5. The capability-driven runner, with the lists deleted. Once it sampled the infinite families,
   it found degenerate-parameter hangs (`KFreeIntegers(k<2)`, `KAlmostPrimes(0)`, odd-gap
   `PrimePairs`) and the repeating sequences.
6. Carrier laws on the permutation maps: typed, involutions, inverse pairs, idempotent
   representatives.
7. Families declare, file by file, and the ratchet shrinks.
8. CE handlers honour cost (`At`/`RandomChoice` decline past the budget).
9. The oracle uses param specs.
10. Fields become required, and the ratchet goes.
