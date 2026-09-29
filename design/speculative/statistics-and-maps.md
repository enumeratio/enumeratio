# Design: statistics and maps live on their collection, not the global namespace

Status: **signed off; phases 1 and 2 built** (below, "What is built"). Dean's names:
`CombinatorialStat` and `CombinatorialMap` for what the text calls `Statistic` and
`Morphism` (a morphism preserves structure, and most combinatorial maps preserve none). Very
general statistics (`Count`, `Rank`) stay heads of their own and are reachable through
`CombinatorialStat` too; a statistic compute-engine or Wolfram already names may keep a
global head. Companion to
[namespaces.md](../namespaces.md) (the resolver and context ladder this borrows) and
[domains.md](../domains.md) (carriers as nominal types, held constructors, why restrictions
are sets not subtypes) — both landed designs this document extends rather than repeats.

The forcing complaint: `Components` is not a real head (it is a `stub: carrier` catalog
record, `statOn: Endofunction` — never declared, so it never actually collided with
anything), but the naming instinct it exposed is real. A stat named for what it measures,
promoted straight to the global namespace, runs out of good names before it runs out of
statistics.

**Dean's direction is explicit: no head per statistic or map.** A statistic is referenced
_through_ its collection or its FindStat id, not minted as its own global symbol. §3.1 is
that design, concretely. §3.2 gives "keep promoting bare heads" a fair hearing as the
alternative it deserves — the survey's own numbers (§1.4, §1.6) support it in places — but
it is not this document's recommendation, and a narrow exception criterion is what's left of
it.

## 1. Survey

### 1.1 What's declared today, and what's only catalogued

| population                   |                    catalogued (stub records) | actually defined                                  | where                                                                           |
| ---------------------------- | -------------------------------------------: | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| statistic names              | **242** (`statOn:` on 242 reference entries) | **84**, on 4 carriers                             | `packages/symbols/combinatorics/statistics/src/all.ts`                          |
| restriction/map-ish families |                                          n/a | **19** restrictions, **25** of 85 catalogued maps | `packages/symbols/combinatorics/combinatorics/domains/src/{restriction,map}.ts` |
| carriers                     |                                           86 | **86**, all minted as nominal CE types            | `packages/symbols/combinatorics/combinatorics/domains/src/domain-data.ts`       |

(242 and 85 match the census in `design/namespaces.md` §1 exactly — that count hasn't moved.
`grep -rl statOn: packages/reference/entries/*.yaml \| wc -l` → 242;
`grep -rl mapOn: **/*.yaml \| wc -l` → 85.)

The 84 statistics break down by carrier
(`packages/symbols/combinatorics/statistics/src/all.ts`, `ALL_STATISTICS`):

```
Permutation:      38
IntegerPartition: 19
DyckPath:         16
SetPartition:     11
```

Only **3 heads are defined on more than one carrier** today (`MajorIndex`, `Peaks`,
`Valleys` — `bySignature`/`signatureOf` in `src/types.ts` key every definition by
`(head, carrier)` precisely because of this). The 189-vs-53 split `namespaces.md` describes
for the full 242-name catalog is real but mostly still ahead of us: at 84/242 implemented,
we haven't yet met most of the multi-carrier overload problem, which is good news — the
mechanism can be designed before the hard cases pile up.

Each statistic is a `Definition`: `{ head, on, expr, summary, note?, alsoOnList? }` — `expr`
is a MathJSON tree over the wildcard `_x`, and it **is** the implementation
(`declareStatistics` boxes it, subs, evaluates; no second TypeScript kernel to drift from).
This is already the "metadata plus an implementation as an actual math expression" Dean
asked for, at the statistic level — it just isn't filed under the collection.

**Maps** (`packages/symbols/combinatorics/combinatorics/domains/src/map.ts`) are already closer to the
target shape: a `CombinatorialMap` names `from`/`to` **carrier types**, a body over `_raw`,
an optional `guard`, and a `composedOf` chain that type-checks step by step. 25 of the 85
catalogued map names have one.

### 1.2 Carriers are already nominal CE types — this part is done

`design/domains.md` (status: "built, minus the lattice") verified and shipped this before
Dean's brief landed. Recapping only what today's proposal leans on:

```ts
ce.declareType("Permutation", "list<integer>", { mint: true }); // nominal, opaque both ways
ce.declare("AsPermutation", { signature: "(list<integer>) -> Permutation" }); // held, no evaluate

const p = ce.box(["AsPermutation", ["List", 2, 1, 3]]);
p.evaluate().type; // Permutation — survives evaluation because there's no handler to collapse it
```

All 86 carriers are minted this way (`declareDomains`, `packages/symbols/combinatorics/combinatorics/domains/src/declare.ts`).
A held constructor with a signature and no `evaluate` handler doesn't collapse, so
`FixedPoints(AsPermutation([2,1,3]))` type-checks and `FixedPoints([2,1,3])` is rejected —
real dispatch, not a naming convention. The one gap `domains.md` §1.1 already logs: **minted
types don't subtype** (`Derangement ⊂ Permutation` has nowhere to live short of an upstream
change), which is why `domains.md` §4 makes restrictions **sets with a runtime guard**
instead — `KrewerasComplement`'s non-crossing check is the shipped example. That decision
carries over unchanged to typed maps on restricted collections (§3.4 below).

**Statistics don't consistently use this yet.** `declareStatistics`'s `domainTypes` option
types the subject as the carrier (or `carrier | list<integer>` when `alsoOnList` is set) —
and `packages/census/src/engine.ts` and `web/.vitepress/theme/engine-libraries.ts` both pass
`domainTypes()`, so the CLI and docs-site engines type most statistics over their carrier
already. But `declare.ts`'s own doc comment and `domains.md`'s status line both say
statistics "stay on bare lists" — that's stale relative to what `engine.ts` actually calls;
worth a one-line fix wherever it's read next, not a design question.

### 1.3 Collections: `Declared` capability, carrier by string

A collection family (`packages/symbols/combinatorics/combinatorics/collections/src/families/*.ts`, 25
files) carries a `Declared` record (`design/plausible.md` §3.5):

```ts
interface Declared {
  readonly carrier: string; // e.g. "Permutation" — a NAME, not a ce.type() reference
  readonly params: readonly Param[];
  readonly cost: { count: Cost; unrank: Cost; rank: Cost; valid: Cost };
  // …
}
```

`plausible.md` §4.2 already walks family → carrier → the maps and statistics declared on
that carrier to derive laws (`domains/src/laws.ts`) — the exact "statistics live with their
collection, several collections share one" shape Dean is asking for, already built **for
law-checking**. What's missing is that link running the other way: nothing today declares a
statistic _from_ the collection's own file, and nothing stops two different definitions of
`(head, carrier)` from existing in different packages unnoticed (§1.4).

The carrier field is a bare string, checked only by convention against the CE type of the
same spelling — collections and domains are two packages that agree by naming, not by a
shared reference. Worth closing in the same pass as the record-layout move (§3.3).

### 1.4 The `skipDeclared` collision census

Ran `declareStatistics`/`declareRestrictions` **without** `skipDeclared`, on an engine built
from `@enumeratio/census`'s `PACKAGE_DECLARATIONS` up to (not including) each step, so the
attempt sees exactly what real usage would collide with. Script kept at
`.scratch/collisions.ts` (not committed).

**12 of 81 distinct statistic heads collide** (84 definitions dedupe to 81 heads before
`MajorIndex`/`Peaks`/`Valleys`'s second carrier is even reached):

```
Descents, Ascents, MajorIndex, MinorIndex, Inversions, Sign, FixedPoints,
Excedances, Antiexcedances, Peaks, Valleys, CycleCount
```

All twelve are **Permutation** statistics, and all but `Sign` collide with
`@enumeratio/collections`' own fast native kernel under the identical signature shape
(`(list) -> integer`) — this is precisely the case `declareStatistics`'s own doc comment
already names ("`@enumeratio/collections` ships its own fast permutation statistics under
the same names… compute-engine throws on a second declaration"). `Sign` collides with
compute-engine's native `(complex | signed_infinity) -> complex` `Sign`. None of these are
naming accidents — they're the SAME statistic, expression-defined here and hand-optimized
there, competing for one declaration.

**18 of 19 restrictions collide**, every one against `(integer<0..>) -> indexed_collection<list<integer>>`
— i.e. against `@enumeratio/collections`' own family declaration for that exact name
(`Derangements`, `CyclicPermutations`, every composition/partition restriction). Only
**`SelfConjugatePartitions`** is genuinely new. `declareRestrictions`'s restrictions package
is, for 18 of its 19 entries, a second implementation of a collection `@enumeratio/collections`
already ships — `skipDeclared: true` is currently the only thing keeping that invisible.

This is good news structurally: every collision found is "the fast kernel and the
specification agree to compete for a name," never two unrelated things silently fighting.
§3.5 turns that into the collision-error design.

**A related, sharper finding: maps already have an audited extension mechanism that
statistics never reaches for.** `packages/symbols/combinatorics/combinatorics/domains/src/extend.ts` exists
precisely to add a permutation-specific clause to a compute-engine built-in without losing
its original behaviour (`domains.md` §5.2-§5.3, "the shadowing audit"), and `declareMaps`
uses it: checked directly (`MAPS` against an engine built up to the maps step), **3 of the 25
implemented maps — `Reverse`, `Complement`, `Inverse` — are already compute-engine heads**,
extended rather than replaced, with every original overload (list `Reverse`, set `Complement`,
matrix `Inverse`) verified intact. `declareStatistics` never calls this mechanism for `Sign`;
it does a bare `ce.declare` that fails and lets `skipDeclared` paper over it. Worth noting
precisely because `extend.ts`'s own comment lists `Sign` by name as an example of an
"evaluate-backed head" the mechanism can extend (alongside `Inverse`, `Sort`) — so the
question for `Sign` was never "is this mechanically possible," it's "is a permutation's ±1
parity the same _meaning_ as a complex number's sign, or a coincidental homonym like `Prime`
the arithmetic prime versus a derivative." `Inverse`/`Reverse`/`Complement` passed that bar
(a permutation genuinely IS a kind of list/set-like object being reversed/complemented/inverted
in the same sense). **Decided (Dean, 2026-09-28): `Sign` over a permutation is a coherent
generalisation to support**, a map onto ±1 as a number's sign is, the same way the structures
package generalises `Min` and `Floor`. It is not an overloading to avoid.

### 1.5 What compute-engine's type system actually offers (corrected, BL-9)

An earlier draft said compute-engine has no parametric or generic types. That was wrong.
Probed against 0.139:

- **Polytypes and constrained signatures.** `(T, U) -> T where T, U: number`, and protocol
  constraints (`where T is P`), which the solver enforces: a `(collection<T>, string) -> list
where T is CombinatorialCarrier` signature rejects `SymmetricGroup(3)` with
  `protocol-constraint-unsatisfied`, and accepts a list of `Permutation` values.
- **Parameterized nominal types.** `ce.declareType("tagged", "list<T>", { mint: true, typeParams:
"T" })` with a constructor `(list<T>) -> tagged<T>` infers `tagged<integer>` for
  `Tag([1, 2])` and `tagged<string>` for `Tag(["a"])`. Variance is declarable.
- **Conditional conformance.** A generic head conforms to a protocol under a clause
  (`list<T> is P where T is Q`), instantiated per receiver.
- **Parameterized kinds** it ships: `list<T>`, `collection<E>`, `indexed_collection<E>`,
  `broadcastable<T>`.

What it does not have, yet: **a type variable in a length**. Compute-engine does carry lengths
in types (`[1, 2, 3, 4]` is `vector<integer^4>`, and matches `list<integer^4>` but not
`list<integer^3>`), and a literal value is a type (`4`), usable as a type argument
(`declareType("tagged_size", "tuple<N, list<integer>>", { typeParams: "N: integer" })` gives
`tagged_size<4>`). But the length slot takes only a literal: `list<integer^N>` does not parse. A
parameter also has to appear in the body (`generic-alias-unused-parameter`), so there is no
phantom `permutation<4>` either.

That is exactly what `permutation<N>` needs, and it is how Julia does it. Julia's type
parameters can be values as well as types (any "bits" value: an `Int`, a `Symbol`, a tuple of
them). `Array{T, N}` carries its dimension count, `NTuple{N, T}` is `Tuple{Vararg{T, N}}`,
StaticArrays' `SVector{N, T}` carries its length, and `Val{N}` lifts any such value into a type
for dispatch. So the missing piece in compute-engine is small: a type variable, bounded by
`integer`, in the length position (`list<T^N> where N: integer`). With it:

- `permutation<N>` is a nominal type over `list<integer^N>`, and the constructor
  `(list<integer^N>) -> permutation<N>` infers `N` from the value;
- a family's spec says what it yields at each size: `SymmetricGroup: (N: integer) ->
indexed_collection<permutation<N>>`, with `N` bound from the argument's literal type, the way
  a Julia method binds `N` from `Val{N}`;
- a statistic or map says which sizes it takes, and a map that preserves size says so in its
  type (`(permutation<N>) -> permutation<N>`).

This is an upstream candidate (design/upstreaming.md): the grammar change, and the solver
binding `N` from a literal-typed argument.

So the real options are:

1. **Carriers parameterized by what they are made of.** A word over an alphabet
   (`word<T>`), a set partition of a ground set (`set_partition<T>`), a permutation of
   arbitrary labels. This is the species picture, F[U] for a label set U, and it is
   expressible now.
2. **Collections typed by their element carrier.** Today every family types its elements as a
   bare `list<integer>` (`SymmetricGroup(3)` is `indexed_collection<list<integer>>`), so
   nothing at the type level says those lists are permutations. If families produced carrier
   values, `SymmetricGroup(n)` would be `indexed_collection<permutation>`, and
   `CombinatorialStat(SymmetricGroup(4), name)` could be checked at boxing through a
   `collection<T> where T is …` signature. The cost is that every consumer of a family's
   elements then sees `Permutation([…])` rather than `[…]`.
3. **Dispatch through compute-engine's solver.** One protocol (`CombinatorialCarrier`, member
   `StatisticOf(Self, string)`) that every carrier conforms to. It works, but it is slow: see
   §1.6.

**Recommendation** (revised with Dean, 2026-09-28):

1. **Dispatch stays in our table**, and compute-engine's slowness goes upstream: a profile puts
   about half of a protocol member's call in re-parsing a type string, and its first attempt
   throws. Cache the parse, then measure again (§1.6).
2. **Type collections by their element carrier**, a family at a time, starting with the
   permutations (`indexed_collection<permutation>`), and give `CombinatorialStat` a constrained
   arm over `collection<T>`.
3. **Size in the type:** propose the length type variable upstream, prototype `permutation<N>`
   against a patched compute-engine, and write family specs with it once it lands.
4. **Carriers parameterized by what they are made of** (the species picture) as they come up.

### 1.6 Cost measurement

Method: `.scratch/typed-collections-bench.ts` (not committed), run via
`vp node --experimental-strip-types --experimental-transform-types`, from
`packages/census` so workspace resolution works. `sysctl kern.memorystatus_vm_pressure_level`
checked at 1 before running. Each number is a **median** across repeated passes (5 passes ×
40,320 calls for the dispatch benchmark; 15 fresh-engine reps for minting; 50 reps for the
arithmetic baseline). Node 24.21.0, this machine, single run — not a CI-grade benchmark, but
real numbers instead of a guess.

| measurement                                                                                |                                                 median |
| ------------------------------------------------------------------------------------------ | -----------------------------------------------------: |
| `Add` of 200 terms (1 symbol, so it can't constant-fold), box+evaluate                     | **0.269 ms** total (context, not a type-system number) |
| Mint 86 nominal carrier types on a fresh engine (today's actual count)                     |                         **1.42 ms**, one-time, at boot |
| Mint 300 nominal types (3.5× today's count) on a fresh engine                              |                                  **8.76 ms**, one-time |
| `Descents` over all 40,320 `Permutations(8)`, **untyped** (bare `list<integer>` signature) |                 **425.97 ms** total, **10.57 µs/call** |
| Same, **typed** (`AsPermutation`-held argument, nominal `Permutation` signature)           |                 **623.73 ms** total, **15.47 µs/call** |

**Typed dispatch costs about +5 µs/call, a 1.46× ratio, over an untyped call that's itself
~10 µs.** In absolute terms that's noise next to the Add-200 baseline (~20-25× the typed
overhead) and next to any real statistic body heavier than a comparison. Minting types is a
one-time boot cost that stays under 10 ms even at more than triple today's carrier count.
**Neither number is a reason to avoid typing.**

Dispatch through compute-engine's own solver (§1.5, option 3), measured the same way on the
census engine: 5,040 permutations of 7, `FixedPoints`, second of two passes.

| call                                                        |      total |
| ----------------------------------------------------------- | ---------: |
| `FixedPoints([…])`, the statistic's own head                |  **61 ms** |
| `CombinatorialStat(Permutation([…]), "FixedPoints")`, table |  **95 ms** |
| `StatisticOf(Permutation([…]), "FixedPoints")`, CE protocol | **774 ms** |

The protocol member costs about 8× the table, so dispatch stays ours.

### 1.7 FindStat

`packages/reference/src/findstat-data.ts` (generated) already cross-references **58 of the
84** implemented statistics to a FindStat id, by **value agreement** — enumerate every
object of a carrier up to a size FindStat's finder API accepts (153 permutations for the
permutation carrier), evaluate our definition, POST to `findstat.org`'s finder, keep whatever
FindStat statistics agree on every value with no offset
(`packages/reference/scripts/find-findstat.ts`). Two or more matches means "agree on
everything this small," left for a human to separate with more data. Each reference yaml
records the match as `catalog: [{system: findstat, identity: St000105, url, on}]`
(e.g. `Blocks.yaml`).

Network to `findstat.org` **is reachable from this sandbox** (`curl -sS -m 8 -o /dev/null -w
'%{http_code}' https://www.findstat.org/` → 200), so the live-query path in
`find-findstat.ts` isn't blocked here — worth re-checking in whatever environment actually
runs the regen, since the coordinator's brief expected it might not be.

**What's lifted today: only the id.** FindStat's own pages carry a reference Sage
implementation and known-value tables per statistic; neither is pulled in — `findstat-data.ts`
stores `{head, on, findstat: string[], values: number}` and nothing else. Dean's "known data
and Sage implementation logic can be lifted from FindStat" is not yet built; it's a
mechanical follow-on once a statistic is matched (§3.6 phase 5), since the id linkage that
would key it already exists for 58 of 84.

## 2. Decomposition (borrowing `namespaces.md`'s frame)

Applied to what §1 measured, and reframed around Dean's direction rather than around who
currently has a kernel:

- **No population gets a head per name, on principle** — not the 84 implemented statistics,
  not the 25 implemented maps, not the 158/60 unimplemented tail. Having a kernel is a
  question of whether an _implementation_ exists, not of whether a _global symbol_ should.
  §3.1 is one mechanism spanning all of it.
- **The already-implemented 84 (+25 maps)** are the ones with something real to route to —
  a fast kernel, an expression, or both. §3.1 covers how dispatch reaches the right one
  through the mechanism, not through a bare name.
- **The catalogued-but-unimplemented remainder** (158 stat names, 60 map names) resolves
  through the exact same mechanism, just with no kernel behind it yet — there's no separate
  "tail" design because the mechanism never eagerly declares a symbol per name to begin with.
- **The 3 (soon more) multi-carrier heads** are the domain-keyed-signature case
  `namespaces.md` flags as needing "the upstream question pile." §3.1 shows this is **not**
  an upstream question for the mechanism proposed here: dispatch happens inside our own
  `evaluate`, keyed on the nominally-typed subject's carrier, which compute-engine has
  supported since `domains.md` shipped.

## 3. Design

### 3.1 Primary design: statistics and maps are metadata on their collection

No new global head per statistic or map. A statistic is data — `{ head, on, expr, catalog }`,
already the shape in §1.1 — filed on its collection/carrier record (§3.3), and reached
through a small, fixed set of **verbs**, not through a symbol minted per name.

**The call shapes, weighed:**

| shape                                              | reads as                                                            | for                                                                                                                                                                                                                              | against                                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Statistic(Permutations, "Inversions")` then `(π)` | "the Inversions statistic, on Permutations, applied to π" — curried | Reads as a VALUE you can pass on: `Map(Statistic(Permutations, "Inversions"), Permutations(4))` computes it across a whole collection in one line — the common combinatorics workflow (a statistic's distribution over a family) | Two calls for the single-element case; the collection argument is redundant whenever the carrier alone disambiguates (189 of 242 names, `namespaces.md` §2.2) |
| `Statistic(π, "Inversions")`                       | "the Inversions statistic of π" — direct                            | One call; the collection name is redundant anyway, since π's own nominal carrier type (§1.2) already says what it is — no generics needed, just a runtime type read (below)                                                      | Doesn't give the curried "statistic as a value" form for free unless `Statistic(Permutations, name)` is _also_ accepted as a 2-arg partial application        |
| `Statistic("St000018")` then `(π)`                 | "whatever FindStat calls St000018" — id as key, same registry       | Costs nothing extra: a FindStat id is just an alternate key into the identical (carrier, name) → `Definition` table (§1.7); no separate mechanism                                                                                | Only 58/84 (and an unknown fraction of the tail) have an id, so it's a lookup key, never the _only_ way in                                                    |

**Recommendation on the shape**: support both `Statistic(collection, name)` (curried, 2-arg,
returns the callable — reach for it when the collection actually disambiguates, or when the
statistic is wanted as a value) and `Statistic(subject, name)` (direct, dispatches on
`subject`'s own nominal carrier type). Both are one head with an overloaded signature — the
same union-arm pattern `declareConstructor` already proves out (`domains.md` §1.2), with
`indexed_collection<T>` in one arm and each carrier `T` in the other. A FindStat id is
accepted anywhere a name string is, since it's the same table under a different key. Maps get
the parallel treatment under a distinct head (`Map` is already CE's list-mapping head, so it
can't be reused) — name TBD (§4 Q2) — same shape otherwise: `Morphism("RskRecording", π)` or
`Morphism(π, "RskRecording")`, `from`/`to` unchanged from `CombinatorialMap` (§3.4).

**Dispatch by a runtime type read.** Compute-engine has generics (§1.5), but dispatching
through its protocol solver costs about 8× a table lookup (§1.6), so dispatch reads the
value's type and looks the operation up in our own table:

```ts
ce.declare("Statistic", {
  signature: "(Permutation | IntegerPartition | DyckPath | SetPartition | …, string) -> any",
  evaluate: (ops) => {
    const [subject, name] = ops;
    const def = lookup(subject.type, nameOrFindStatId(name)); // table lookup, our code
    if (!def) throw new UnknownStatisticError(subject.type, name); // §3.5
    return applyDefinition(ce, def, contentsOf(subject));
  },
});
```

This is the identical held-carrier-argument dispatch already measured in §1.6 — `ops[0].type`
read, `ce.type` comparison against the union arms compute-engine already builds cheaply (86
carriers mint in 1.42 ms; a union of them in one signature is the same cost, paid once at
boot). The only addition over what §1.6 measured is a `Map` lookup by name string inside the
matched carrier's small table (≤38 entries for Permutation) — negligible next to the ~5 µs/call
already attributed to the typed-argument path. **No new cost measurement needed**: the
mechanism is the same shape already benchmarked, just addressed through one shared head
instead of many.

**Retiring an existing global head — `Inversions` worked through.** `Inversions` is _already_
one bare head today, not two: `@enumeratio/collections`' fast kernel declares it first in
`PACKAGE_DECLARATIONS` order, and the statistics package's expression definition silently
loses via `skipDeclared` (§1.4) — so `Inversions(p)` in the CLI and docs site today is always
the fast kernel. Retiring it means retiring _that_ declaration, not a hypothetical second one:

1. **Register, don't yet retire.** Add the `Statistic` head. For every (carrier, name) pair,
   register the fast kernel as the table's preferred implementation (what `Statistic`
   actually calls) and the expression as its differential/reference row (`namespaces.md`
   §6.2's `bindings`) — the same resolution §3.5/§3.6 phase 2 already gives the collision.
   `Inversions` the bare head keeps working, unchanged, for now.
2. **Deprecate.** Mark the bare head's reference entry `deprecated`, pointing at
   `Statistic(π, "Inversions")`. Update reference examples, docs-site prose, and any
   generated component that reaches for the bare spelling (check `packages/frontend/src/generate.ts`'s
   symbol scope before this step — unverified here whether these 84 heads currently get an
   auto-generated Vue/React wrapper the way structural/graphics heads do; if they do, that
   wrapper's generation source moves too). A currency test (in the shape of the repo's
   existing provenance/currency tests) fails if a _new_ reference example or doc page adds the
   bare spelling during the deprecation window, so the surface to migrate only shrinks.
3. **Retire.** Once the currency test shows zero remaining bare-spelling usages, stop
   declaring the bare head. `Inversions(p)` then errors — unknown symbol — for anyone who
   still has it memorized or saved in an old notebook or bookmark link; that is the real,
   acknowledged cost of this direction, not a hypothetical one. (`namespaces.md` §4's ladder,
   run in reverse, offers a cheaper mercy — an optional permanent low-notation alias into the
   resolver instead of a hard error — folded into the separator question, §4 Q2, since an
   alias needs the same spelling decision a promoted namespaced name does.)

This same three-step path applies to every one of the 84 statistic heads and 25 map heads
live today (`@enumeratio/collections`' fast kernels included) — `Inversions` is the worked
example, not a special case.

### 3.2 Considered alternative: keep promoting bare heads

The alternative this document's first draft recommended, kept here because the survey's own
numbers cut both ways and Dean should see the case made honestly, not strawmanned.

**For it:**

- **Ergonomics.** `Inversions(p)` reads better than `Statistic(p, "Inversions")` for the
  overwhelmingly common single-statistic, single-element case, and it's what the existing 84
  reference pages, examples and tests already say.
- **Zero migration cost for what's already implemented** — §3.1's retirement path (register →
  deprecate → retire) is real work with a real breakage window; keeping bare heads skips all
  three steps for the 84/25 that already have a kernel.
- **Wolfram parity, where it's real.** Some of these names aren't ours alone — Combinatorica
  (the legacy Wolfram combinatorics package) has documented `Inversions[p]` and `Descents[p]`
  functions computing the identical statistics. Where an external system already uses the
  exact word for the exact meaning, a bare head is arguably not namespace pollution but
  convergence.

**Against it — and why it loses:**

- **It doesn't scale**, which is the entire forcing complaint: 242 stat names and 85 map
  names is already too many to mint eagerly, and the catalog grows. A criterion that keeps
  _some_ bare heads still needs the mechanism above for everything it doesn't cover, so this
  alternative is additive complexity (two mechanisms) rather than a genuine substitute.
- **`Sign` was offered as the counter-example; Dean ruled the other way** (§1.4): a
  permutation's sign is a coherent generalisation of a number's, so it is supported. The
  argument as first made: permutation `Sign` colliding with compute-engine's
  native `(complex | signed_infinity) -> complex` `Sign` (§1.4) is not a coincidence a rename
  fixes — it's the shape the project already forbids elsewhere: don't widen a compute-engine
  notation head to an unrelated meaning (`Prime` stays the arithmetic prime, never a
  derivative; "the nth prime" is `NthPrime`/`At(Primes, n)`, not a second `Prime`). §1.4's
  finding sharpens this rather than settles it by fiat: the audited extension mechanism
  (`extend.ts`) that already widens `Inverse`/`Reverse`/`Complement` for permutations _names
  `Sign` as an example of the kind of head it can extend_ — so the reason not to widen it here
  isn't "the mechanism can't," it's a judgment that a permutation's discrete ±1 parity isn't
  the same _meaning_ as a complex number's continuous sign, unlike `Inverse` (a permutation
  genuinely has a group-theoretic inverse) or `Reverse` (a permutation genuinely is a
  sequence). That judgment is exactly what "keep some bare heads" needs a real answer to
  before it can be applied consistently, and it's evidence _against_ keeping bare heads by
  default rather than a special case to carve around.
- **The project's own Wolfram crosswalk doesn't register the Combinatorica parity.**
  `packages/reference/src/crosswalk-data.ts` and `crosswalk/curated-data.ts` have zero entries
  for `Inversions`, `Descents`, `MajorIndex`, or `Ascents` — so today's tooling doesn't even
  treat Combinatorica as the relevant "Wolfram" for parity purposes. Whether Combinatorica (a
  bundled but legacy context, superseded for most purposes in current Mathematica) should
  count is exactly the judgment call in the criterion below, and it's Dean's to make, not
  this document's.

**If Dean wants exceptions, the criterion:** promote a bare head _only_ where an external
canonical system — compute-engine's own kernel, or Wolfram's current (non-legacy) language —
already has a head of the identical spelling with the identical meaning, so promoting it is
convergence with an existing standard rather than a name we're choosing to spend.
Spot-checked against the current crosswalk data (above), **none of today's 84 statistics
currently meet this bar** — the crosswalk records no Wolfram-core equivalent for any of the
12 colliding names or the others checked. If Combinatorica counts as "Wolfram" for this
purpose, `Inversions` and `Descents` would be the first (and so far only) candidates; that
inclusion decision is Q2 in §4.

### 3.3 Record layout — where a statistic's definition and examples live

Move the `Definition` record (and its examples) to live beside the collection/carrier it's
on, matching `plausible.md` §4.2's existing walk (family → carrier → maps/statistics):

```
packages/symbols/combinatorics/combinatorics/collections/src/families/permutation-classes.ts
  └─ Declared { carrier: "Permutation", … }        (existing)
  └─ statistics: readonly Definition[]              (new — was in the standalone statistics package)
      { head: "Inversions", on: "Permutation", expr: …, catalog: [{system:"findstat", identity:"St000018"}] }
```

Several collections sharing a carrier (`Permutations`, `Derangements`, `CyclicPermutations`
all `carrier: "Permutation"`) inherit the same statistic set by carrier, exactly as
`namespaces.md` §2.2 already argues (189 of 242 names are pure carrier inheritance — no
per-collection duplication wanted). A statistic's **examples become real examples** on that
record, following `design/examples-as-data.md`'s `role`/`#example/<id>` convention rather
than a separate `.examples.yaml` sidecar — the FindStat known-value tables (§3.6 phase 5)
are a natural source once id-matched.

The standalone `@enumeratio/statistics` package becomes the **home of the `Statistic`
dispatch table** (§3.1) rather than the owner of every definition and the declarer of every
bare head — definitions move to where their collection lives; the package that builds the
lookup table stays, collecting `Definition[]` from each collection package the way it
collects `ALL_STATISTICS` today, minus the per-name `ce.declare` calls.

### 3.4 Typed maps

`CombinatorialMap.from`/`to` already name carrier types (§1.1, `domains.md`), and
`composedOf` chains type-check step by step — that part of the shape carries over to the
`Morphism` mechanism (§3.1) unchanged, just addressed through it instead of a bare name per
map.

- **Carrier-scoped maps** (96 of 113 catalogued map rows, `plausible.md` §4.2's
  `base_map.scope: 'carrier'`) need nothing new beyond the mechanism — `from`/`to` already
  are carrier types, and dispatch is the same nominal-type read §3.1 describes.
- **Collection-scoped maps** (17 rows — a map defined only on a _restricted_ collection,
  `KrewerasComplement` on non-crossing permutations being the shipped example) stay
  **guarded, not re-typed**, per `domains.md` §4's already-decided "restrictions are sets,
  not subtypes." The `Morphism` mechanism's evaluate still runs the `guard` and declines
  (stays symbolic) outside it, exactly as built today — this is the correct shape until the
  subtype-lattice upstream ask (`domains.md` §1.1) lands, not a gap to close now.
- **The 3 maps already extended onto compute-engine built-ins** (`Reverse`, `Complement`,
  `Inverse` — §1.4's `extendBuiltin` finding) are the one real fork in the road for maps
  specifically: under the primary design, does the permutation-specific arm stay spliced onto
  CE's own `Reverse`/`Complement`/`Inverse` (today's behaviour — a bare `Reverse(π)` keeps
  working because it _is_ CE's own head, widened), or does it retire into
  `Morphism(π, "Reverse")` like every other map, leaving CE's built-ins untouched? Retiring is
  more consistent with "no head per map," but it changes behaviour that works today and isn't
  forced by anything else in this document — flagged as §4 Q4.

### 3.5 Replacing `skipDeclared`: collision is an error, named

This is independent of §3.1's decision and needed either way: `declareRestrictions` still
declares real, promoted **collections** (`Derangements`, `CyclicPermutations`, …), which is
`namespaces.md`'s already-decided territory (a collection earns a bare name once it has a
kernel), not the "no head per statistic" question. Drop `skipDeclared` from both
`declareStatistics` and `declareRestrictions`. Under the primary design the shapes differ
slightly by population:

```ts
// Restrictions/collections: still real ce.declare calls (namespaces.md's resolver territory),
// so the error is at declare time.
export function declareRestrictions(ce: ComputeEngine, restrictions: readonly Restriction[]): void {
  for (const restriction of restrictions) {
    const existing = ce.lookupDefinition(restriction.name);
    if (existing !== undefined && !isOurs(existing, restriction.name)) {
      throw new CollectionCollisionError(restriction.name, describeExisting(existing));
    }
    ce.declare(restriction.name, { signature: "(integer) -> indexed_collection<…>", evaluate: … });
  }
}

// Statistics: no per-name ce.declare at all (§3.1), so the collision the error guards against
// moves from "compute-engine throws" to "two records claim the same table key."
function registerStatistic(table: Map<string, Definition[]>, def: Definition): void {
  const key = `${def.on}@${def.head}`; // or FindStat id, if that's the registered key
  const existing = table.get(key);
  if (existing !== undefined && !sameStatistic(existing, def)) {
    throw new StatisticCollisionError(key, existing, def);
  }
  table.set(key, [...(existing ?? []), def]);
}
```

Either error names the key, every claimant, and what already owns it (signature and, where
resolvable, the declaring package) — the exact shape `.scratch/collisions.ts` printed for all
30 of today's collisions. No silent skip, ever.

**Which of today's 30 collisions remain, under the primary design:**

- **The 12 permutation-statistic collisions disappear by construction.** Once statistics stop
  attempting `ce.declare` under names like `Inversions` (§3.1), there's nothing left to
  collide with `@enumeratio/collections`' fast kernel at declare time. What remains is a
  _table_-level merge: the fast kernel becomes the `Statistic` table's preferred
  implementation for `(Permutation, "Inversions")`, the expression becomes its differential
  reference row (`namespaces.md` §6.2's `bindings`) — one Definition entry, two implementations,
  no competing declarations. `Sign` resolves the same way at the table level regardless of
  where §3.2's exception question lands, since under the primary design `Sign` never reaches
  `ce.declare` either.
- **The 18 restriction collisions do NOT disappear** — they're a same-collection-twice
  problem (`declareRestrictions`' generic spec vs. `@enumeratio/collections`' hand-tuned
  family for names like `Derangements`), orthogonal to whether statistics get bare heads,
  since restrictions stay promoted collections either way. These resolve exactly as the
  first draft proposed: the generic restriction expression becomes a `reference` binding on
  the collection's existing entry, not a second declared collection. `SelfConjugatePartitions`
  (the one restriction that's genuinely new) declares normally.

So "which current collisions need renames" still has the same answer as the first draft:
**none of them do** — but for a stronger reason now. Twelve stop being collisions at all
because the colliding declaration is retired, not merged; eighteen were always a
collections-package filing problem, independent of this document's central question.

### 3.6 Migration, in phases

1. **Land the collision-error replacement for `skipDeclared`** (§3.5) for restrictions
   immediately — it's needed regardless of §3.1/§3.2, and closes the 18 real collection
   collisions today: fold the 18 duplicate restriction specs into `reference` bindings on
   `@enumeratio/collections`' existing entries; declare `SelfConjugatePartitions` normally.
2. **Build the `Statistic`/`Morphism` mechanism** (§3.1): the dispatch head(s), the table
   registration with its own collision check, and the retirement path (register → deprecate →
   retire) for the currently-live bare heads — the 84 statistics (both packages' kernels) and
   the 25 maps. This is the phase that needs Dean's sign-off on §3.1 vs §3.2 before it starts,
   since it's the one with a real breakage window.
3. **Move the `Definition` records down to their collection files** (§3.3) as part of the
   same phase — there's no reason to file them under the collection and then separately wire
   dispatch; building the table IS filing them.
4. **Point the same mechanism at the unimplemented tail** (158 stats, 60 maps) — this is
   free once the table-based dispatch exists: an entry with no kernel just has no
   implementation row yet, resolved from `statOn`/`mapOn` stub records the way the table
   already would be populated for the implemented ones.
5. **Lift FindStat provenance past the id**: for the 58 matched statistics, add the known
   FindStat values as examples (`design/examples-as-data.md`) and, where FindStat's Sage
   source translates cleanly, a `mapped`-origin binding pointing at it (`namespaces.md` §6.2
   table). Mechanical per statistic, independent of everything above.
6. **Deferred on upstream**: once compute-engine's subtype lattice (`domains.md` §1.1) is
   real, collection-scoped maps (§3.4) can drop their runtime guard for a real `from` subtype
   — not required for anything else in this document to ship.

### What is built

- **The tables** are `@enumeratio/structures`' (`registerCarrier`, `registerOperation`,
  `registerCollectionCarrier`), the leaf collections, statistics and domains can all reach.
  `CombinatorialStat(x, name)` and `CombinatorialMap(x, name)` find `x`'s carrier by
  matching its type, as protocol dispatch does, then the operation by name or FindStat id.
  Over a collection (`SymmetricGroup(4)`, `Derangements(4)`, a plural) they map over its
  elements lazily, so `Tally(CombinatorialStat(SymmetricGroup(4), "Inversions"))` is the
  Mahonian numbers. The result is a collection, not a function: compute-engine's `Map` takes
  only a literal `Function` as its mapping. `CombinatorialStat(C, "Count")` is `Count(C)`.
- **Dispatch cost.** A value's carrier is found by its constructor first, then by type with
  each carrier's parsed type cached. Parsing every carrier's type on every call made
  `CombinatorialStat` about 19× slower than the statistic's own head over the permutations of
  8 (BL-7). Measured on the census engine over the 5,040 permutations of 7:
  `CombinatorialStat(Permutation(p), "FixedPoints")` takes 1.24× the time of
  `FixedPoints(Permutation(p))`. Hot per-element callers (collection tables, `Filter` scans,
  Plausible) still call the statistic's head directly.
- **Kernel beside definition.** collections files its permutation kernels as each
  statistic's preferred implementation; statistics files the defining expression beside them.
  The same part twice is an `OperationCollisionError`.
- **`skipDeclared` is gone.** A statistic's bare head is declared where the name is free. A taken
  name is allowed only when the table holds another package's kernel for that very statistic,
  or when compute-engine owns the name (`Sign`, whose head then takes the carrier as one more argument, Dean's ruling in §1.4). Anything
  else is a `StatisticCollisionError` naming every signature. Restrictions say which package
  implements them (`implementedBy: "collections"`, on 18 of 19); any other taken name is a
  `RestrictionCollisionError`.
- **FindStat ids** come from `@enumeratio/statistics`' `findstat-data.ts` (moved from
  reference, which still generates it). Three ids are each shared by several of our names,
  which agree by value: St000485 (`LargestCycleLength`, `LongestCycleLength`), St000159
  (`DistinctParts`, `ConjugateDistinctParts`, `Corners`), St000011 (`Returns`,
  `NumberOfTouchPoints`). An id resolves to the first; folding the duplicate names is
  still to do.

- **Equivalent carriers.** A converter pair with an `{ inverse }` law makes two carriers
  equivalent (`registerEquivalence`), and a statistic or map one carrier lacks is transported
  from the nearest carrier that has it, through the chain of bijections. So each is defined
  once, on whichever carrier states it most naturally, and which carrier is the storage matters
  much less. A conversion is not a head of its own: it is an overload of the target's
  constructor, chosen by the argument's type (`SetPartition(RestrictedGrowthString([0, 1, 0, 2]))`),
  also reached as `CombinatorialMap(x, SetPartitions)` (by the target collection) or by FindStat
  id. The pairs: set partitions (blocks) and restricted growth strings; set compositions
  (blocks) and surjections; binary trees (nested), their in-order parent arrays and Dyck paths
  (FindStat's Mp00012); and a composition of n with its cut word, a binary word of length
  n - 1 (`CutWord`, and back by `Composition(word)`). Every map is defined in Epsil, the nested ones by recursion: a
  function handed itself as an argument, so a body stays one closed expression
  (`domains/src/recursion.ts`). There is no hand-written kernel as input: a hand kernel is a
  black box an optimizer can't compile, fuse or simplify through, so a compiled form, when one is
  needed, is the optimizer's output from the Epsil. `domains/tests/map-definitions.test.ts`
  checks the recursive definitions against an independent TypeScript reading.
- **Orders.** A carrier has no order; a collection is a carrier with a total order, and sibling
  collections exist for distinct useful orders. Where a conversion happens to match two
  collections' orders it says so (`orderIsomorphism`), and `domains/tests/equivalence.test.ts`
  checks it: set partitions and growth strings, compositions and cut words, binary trees and
  parent arrays. Mp00012 is a bijection but not order-preserving between BinaryTrees and DyckPaths.

Still to do: deprecate and retire the bare heads (phase 2's second half), move each
definition down to its collection (phase 3), `Rank` through `CombinatorialStat`, and the
unimplemented tail (phase 4).

### 4. Open questions for Dean

1. **§3.1 vs §3.2 itself** — confirming the primary design (no head per statistic or map,
   reached through `Statistic`/`Morphism`) over the considered alternative, and if any
   exceptions survive the criterion in §3.2.
2. **Separator/naming for the resolver's own spellings** (`namespaces.md` §3.3) is still
   unresolved, and phase 2 needs _some_ answer to spell a deprecation-period alias or a
   namespaced tail name. Ship with the `_`-based fallback now and migrate later, or block on
   deciding it first?
3. **Does Combinatorica count as "Wolfram" for the exception criterion** (§3.2)? It's the
   one place today's spot-check found real prior art (`Inversions`, `Descents`), and the
   criterion's answer to "which external systems count" decides whether either gets an
   exception.
4. **`Reverse`/`Complement`/`Inverse`: retire the extension, or keep it?** (§3.4) The one
   place the primary design would change behaviour that works today for reasons not forced by
   anything else here.
5. **Is `Sign`'s parity actually a case for `extendBuiltin`**, the way `Inverse` was, or is it
   correctly excluded as a coincidental-homonym case like `Prime`? (§1.4, §3.2) `extend.ts`
   names `Sign` as a mechanically valid target; this document takes no position on whether it
   _should_ be extended, only that the question is real and unresolved.
6. **Is "same name, dispatch by type" always the right merge** for a multi-carrier statistic
   (or a future multi-carrier entry in the `Statistic` table)? `find-findstat.ts`'s own header
   notes the catalog's sweep once caught a "peaks" that was actually FindStat's _inner_ peaks
   — same name, different statistic. Should a proposed merge get a differential check before
   sharing a table entry, or is agreement on the value-matching sweep (§1.7) itself sufficient?
7. **Should a FindStat id ever be independently callable** (`Statistic("St000018")` without
   also knowing our own name for it), or should it stay a lookup key discovered only through
   a record someone already found? Affects how much of phase 5 is "populate a field" versus
   "build a second index."
8. **Priority of the subtype-lattice upstream ask.** Already logged (`domains.md` §1.1) and
   nothing in phases 1-5 depends on it — confirming it stays low-priority background work.
9. **Combinatorial species as the organizing generic** (Dean's brief): compute-engine's
   parameterized nominal types (§1.5) can express F[U], a structure over a label set, for the
   carriers that are "of" something. Worth a spike on one species (words or set partitions)
   before committing the layout?
