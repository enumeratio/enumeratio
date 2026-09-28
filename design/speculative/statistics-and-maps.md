# Design: statistics and maps live on their collection, not the global namespace

Status: **survey + proposal, for Dean's sign-off.** Nothing here is built. Companion to
[namespaces.md](../namespaces.md) (the resolver and context ladder this borrows) and
[domains.md](../domains.md) (carriers as nominal types, held constructors, why restrictions
are sets not subtypes) — both landed designs this document extends rather than repeats.

The forcing complaint: `Components` is not a real head (it is a `stub: carrier` catalog
record, `statOn: Endofunction` — never declared, so it never actually collided with
anything), but the naming instinct it exposed is real. A stat named for what it measures,
promoted straight to the global namespace, runs out of good names before it runs out of
statistics. This asks: what's the actual mechanism, how much does typing carriers cost, and
what do we do about `skipDeclared`.

## 1. Survey

### 1.1 What's declared today, and what's only catalogued

| population                   |                    catalogued (stub records) | actually defined                                  | where                                                             |
| ---------------------------- | -------------------------------------------: | ------------------------------------------------- | ----------------------------------------------------------------- |
| statistic names              | **242** (`statOn:` on 242 reference entries) | **84**, on 4 carriers                             | `packages/symbols/combinatorics/statistics/src/all.ts`            |
| restriction/map-ish families |                                          n/a | **19** restrictions, **25** of 85 catalogued maps | `packages/symbols/combinatorics/domains/src/{restriction,map}.ts` |
| carriers                     |                                           86 | **86**, all minted as nominal CE types            | `packages/symbols/combinatorics/domains/src/domain-data.ts`       |

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

**Maps** (`packages/symbols/combinatorics/domains/src/map.ts`) are already closer to the
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

All 86 carriers are minted this way (`declareDomains`, `packages/symbols/combinatorics/domains/src/declare.ts`).
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

A collection family (`packages/symbols/combinatorics/collections/src/families/*.ts`, 25
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
shared reference. Worth closing in the same pass as the record-layout move (§3.2).

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

### 1.5 What compute-engine's type system actually offers (recap + what's new here)

`domains.md` §1 covers `mint`/`alias`, dispatch, and the missing subtype lattice in full —
not re-verified here since nothing has changed. What's new for **this** document is whether
a collection _itself_ (not just its carrier) can be a type — e.g. is `Permutations(4)` a
distinct type from `Permutations(5)`? No: `declareType` takes a name and a structural body:
there is no parametrized/generic type in compute-engine's grammar (no `Permutation<4>`), so
the only way to get a type per `n` would be minting one type per size on demand — which
re-opens exactly the "242 names is too many to mint eagerly" problem one level down, for an
unbounded population. **Base-domain types (today's 86 carriers) are the only scope compute-
engine's type grammar actually supports**; "full types" (one per collection) isn't a
trade-off to weigh, it's not offered. §3.4 recommends accordingly.

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
**Neither number is a reason to avoid typing** — the constraint in §1.5 (no parametric
types) is what actually bounds the design, not cost.

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
mechanical follow-on once a statistic is matched (§3.6 phase 4), since the id linkage that
would key it already exists for 58 of 84.

## 2. Decomposition (borrowing `namespaces.md`'s frame)

Applied to what §1 measured:

- **The already-implemented 84 (+25 maps)** have real kernels and real users (CLI, docs
  site, tests). They've earned global names. The question for them is dispatch and
  collision (§3.5), not addressing.
- **The catalogued-but-unimplemented remainder** (158 stat names, 60 map names) is exactly
  `namespaces.md`'s "genuinely open tail" — individually low-notation, growing, mechanically
  derived from the catalog. It wants the resolver (`namespaces.md` §3-§5, already built as
  `@enumeratio/catalog`), not 158 more eager `ce.declare` calls.
- **The 3 (soon more) multi-carrier heads** are the domain-keyed-signature case
  `namespaces.md` flags as needing "the upstream question pile." §3.5 argues this is
  **wrong** for the case actually in front of us: nothing upstream is required to dispatch
  one head across several _nominally-typed_ carriers, only to declare it that way instead of
  "first carrier wins."

## 3. Design

### 3.1 Mechanism options

| option                                                           | shape                                                                                         | for                                                                                                                                                                                                                                                        | against                                                                                                                                                                 |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Resource call**                                             | `ƒ("Inversions", "Permutation", p)` or `Statistic(Permutations, "inversions")`                | Never touches the global namespace; directly reuses `@enumeratio/catalog`'s built `ResourceRegistry`/`prepare()`                                                                                                                                           | Two-hop indirection for the common case; loses the "the expression IS the definition, read it plainly" ergonomic the statistics package was built for                   |
| **B. FindStat id as address**                                    | `St000018(p)`                                                                                 | Stable identity independent of our naming; exactly the provenance Dean asked to preserve                                                                                                                                                                   | Only 58/84 (and an unknown fraction of the 158 unimplemented) have one; opaque to read; still need a fallback scheme for the rest, so it can't be the _only_ mechanism  |
| **C. Carrier-scoped context, promoted on demand**                | `Permutation~Inversions`, lazily resolved, promotable to bare `Inversions`                    | Reuses the landed namespaces.md §4 ladder (namespaced → blessed → promoted) and the built registry; scales to all 242/85 without pre-declaring; separator already has a candidate (`~`, semantically apt, currently only blocked by LaTeX)                 | Separator character genuinely unresolved (namespaces.md §3.3, still open); the "declared alongside the collection" filing is a real migration, not just a naming change |
| **D. Bare typed head, multi-carrier dispatch in one `evaluate`** | `Inversions(AsPermutation(…))`, same head handles `Inversions` on any carrier that defines it | What §1.1/§1.4 shows we mostly already have; zero notation change for the 84 already-implemented; the CE union-signature machinery (`(A) & (B) -> …`) already used for domain constructors (`declareConstructor`) is provably sufficient — no upstream ask | Doesn't scale to 242 on its own — still need A/C for the unimplemented tail                                                                                             |

None of these is exclusive; the recommendation is a layering.

### 3.2 Recommended mechanism

**D for anything with a kernel, C for the catalogued tail, id-metadata (not id-as-address)
for FindStat provenance everywhere.**

- A statistic that's actually implemented gets a bare, promoted head
  (`Inversions`, `MajorIndex`, …), typed over its carrier(s) via the union-signature pattern
  `declareConstructor` already uses. When more than one carrier defines the name, **one**
  `evaluate` dispatches on `ops[0].type` to the right `Definition` — replacing today's
  "`claimed` set, first carrier silently wins, the rest reachable only through
  `applyDefinition` in tests" behaviour (`declare.ts`). This needs no upstream change; §1.5's
  measurement says the added dispatch is ~5 µs.
- Everything in the catalogued-but-unimplemented tail (158 stats, 60 maps) is addressed
  through the **already-built** `@enumeratio/catalog` resolver/context machinery
  (`namespaces.md` §3-§5), namespaced under its collection until it has a kernel and earns
  promotion. This is not new design — it's applying a decided mechanism to a population
  (`ALL_STATISTICS`'s uncovered remainder) that wasn't its original target.
- **FindStat id stays metadata, not an address.** It's the cross-reference and the source of
  known values/Sage logic to lift (§3.6 phase 4), recorded on the record the way it already
  is (`catalog: [{system: findstat, identity: …}]`). Making `St000018(...)` independently
  callable is left as an open question (§4) rather than decided here — it's easy to add
  later (a thin alias into the resolver) and costs nothing to defer.

### 3.3 Record layout — where a statistic's definition and examples live

Move the `Definition` record (and its examples) to live beside the collection/carrier it's
on, matching `plausible.md` §4.2's existing walk (family → carrier → maps/statistics):

```
packages/symbols/combinatorics/collections/src/families/permutation-classes.ts
  └─ Declared { carrier: "Permutation", … }        (existing)
  └─ statistics: readonly Definition[]              (new — was in the standalone statistics package)
      { head: "Inversions", on: "Permutation", expr: …, catalog: [{system:"findstat", identity:"St000018"}] }
```

Several collections sharing a carrier (`Permutations`, `Derangements`, `CyclicPermutations`
all `carrier: "Permutation"`) inherit the same statistic set by carrier, exactly as
`namespaces.md` §2.2 already argues (189 of 242 names are pure carrier inheritance — no
per-collection duplication wanted). A statistic's **examples become real examples** on that
record, following `design/examples-as-data.md`'s `role`/`#example/<id>` convention rather
than a separate `.examples.yaml` sidecar — the FindStat known-value tables (§3.6 phase 4)
are a natural source once id-matched.

The standalone `@enumeratio/statistics` package becomes the **home of the carrier-scoped
dispatch wiring** (the multi-definition `evaluate` per head, §3.2) rather than the owner of
every definition — definitions move to where their collection lives; the package that
declares heads on the engine stays, collecting `Definition[]` from each collection package
the way it collects `ALL_STATISTICS` today.

### 3.4 Typed maps

Largely already the target shape (§1.1, `domains.md`): `CombinatorialMap.from`/`to` name
carrier types, `declareMaps` gives each a real `(from) -> to` signature, `composedOf` chains
type-check step by step. Two things to state explicitly for the collection-scoped case
Dean's brief adds ("maps are function types between INDEXED collections"):

- **Carrier-scoped maps** (96 of 113 catalogued map rows, `plausible.md` §4.2's
  `base_map.scope: 'carrier'`) need nothing new — `from`/`to` already are carrier types.
- **Collection-scoped maps** (17 rows — a map defined only on a _restricted_ collection,
  `KrewerasComplement` on non-crossing permutations being the shipped example) stay
  **guarded, not re-typed**, per `domains.md` §4's already-decided "restrictions are sets,
  not subtypes." A collection-scoped map's `guard` checks membership at call time and
  **declines** (stays symbolic) outside it, exactly as built. This is not a gap to close now
  — it's the correct shape until the subtype-lattice upstream ask (`domains.md` §1.1) lands,
  at which point a collection-scoped map's `from` could tighten to the real subtype without
  changing its guard logic.

### 3.5 Replacing `skipDeclared`: collision is an error, named

Drop `skipDeclared` from `declareStatistics` and `declareRestrictions`. Replace with:

```ts
export function declareStatistics(ce: ComputeEngine, definitions: readonly Definition[]): Map<string, Definition> {
  const byHead = groupByHead(definitions); // head -> Definition[] (one per carrier)
  for (const [head, defs] of byHead) {
    const existing = ce.lookupDefinition(head);
    if (existing !== undefined && !isOurs(existing, head)) {
      throw new StatisticCollisionError(head, defs, describeExisting(existing));
    }
    ce.declare(head, { signature: unionSignature(defs), evaluate: dispatchByCarrierType(defs) });
  }
  // …
}
```

`StatisticCollisionError` names the head, every carrier that wanted it, and what already
owns it (signature and, where resolvable, the declaring package) — the exact shape
`.scratch/collisions.ts` printed for all 30 of today's collisions. No silent skip, ever.

**What today's 30 collisions resolve to, concretely** (this is the migration §3.6 phase 1
does immediately, before anything else in this document):

- The 12 permutation statistics and 18 restrictions that duplicate an
  `@enumeratio/collections` kernel **stop being declared as competing heads.** Their
  expression becomes a `reference`-origin binding on the SAME entry the kernel already owns
  (`design/namespaces.md` §6.2's `bindings` list — `native` row is the fast kernel, pointer
  checked; `reference` row is this expression, used for the differential test and TreeForm
  unfolding). Zero renames, zero user-visible change, and the differential test
  (`applyDefinition` against the kernel) is what `namespaces.md` §6.3 already says a second
  implementation needs to justify existing at all.
- `Sign`'s collision is with compute-engine's own native `Sign` on a wider domain
  (`complex | signed_infinity`) — same resolution: our permutation-sign expression becomes a
  reference row on CE's own `Sign`, not a second declaration.
- `SelfConjugatePartitions` (the one restriction that's actually new) declares normally.

So the "which current collisions need renames" question has a real answer: **none of them
do.** Every collision found is the specification-vs-kernel duplication `namespaces.md` §6
already has a slot for; the fix is filing, not renaming.

### 3.6 Migration, in phases

1. **Close today's 30 collisions** (§3.5) — demote the 12+18 duplicate definitions to
   reference bindings on the kernel's existing head; declare `SelfConjugatePartitions`
   normally; land the collision-error replacement for `skipDeclared`. No naming change, no
   new machinery beyond what `namespaces.md` §6 already specified.
2. **Move the 84 implemented `Definition`s down to their collection files** (§3.3); wire the
   3 existing multi-carrier heads (and any more the moves surface) through one
   dispatch-by-type `evaluate` (§3.2/D) instead of "first carrier wins."
3. **Point the catalog resolver at the unimplemented tail** (158 stats, 60 maps) — reuse
   `@enumeratio/catalog`'s registry/`prepare()` as-is; no new resolver design needed, only
   populating it from `statOn`/`mapOn` stub records that don't yet have a kernel.
4. **Lift FindStat provenance past the id**: for the 58 matched statistics, add the known
   FindStat values as examples (`design/examples-as-data.md`) and, where FindStat's Sage
   source translates cleanly, a `mapped`-origin binding pointing at it (`namespaces.md` §6.2
   table). Mechanical per statistic; gated on someone reading the mapped Sage line, not on
   any design decision here.
5. **Deferred on upstream**: once compute-engine's subtype lattice (`domains.md` §1.1) is
   real, collection-scoped maps (§3.4) can drop their runtime guard for a real `from` subtype
   — not required for anything else in this document to ship.

### 4. Open questions for Dean

1. **Separator character** (`namespaces.md` §3.3) is still unresolved and phase 3 needs one
   to actually spell a namespaced tail name. Ship phase 3 with the `_`-based fallback now and
   migrate later, or block on deciding it first?
2. **Is "same name, dispatch by type" always the right merge** for a multi-carrier head?
   `find-findstat.ts`'s own header notes the catalog's sweep once caught a "peaks" that was
   actually FindStat's _inner_ peaks — same name, different statistic. As FindStat-driven
   merges grow past today's 3, should each proposed merge get a differential check before
   it's allowed to share a head, or is agreement on the value-matching sweep (§1.7) itself
   sufficient evidence?
3. **Should a FindStat id ever be independently callable** (`St000018(p)`), or should it stay
   pure provenance metadata indefinitely? Easy to add later either way; asking because it
   changes whether phase 4 needs a resolver entry per id or just a record field.
4. **Priority of the subtype-lattice upstream ask.** It's already logged (`domains.md`
   §1.1) and nothing in this document's phases 1-4 depends on it — confirming it stays
   low-priority background work rather than something to push on for the maps piece.
5. **Combinatorial species as the organizing generic** (Dean's brief, §4 of the original
   ask): compute-engine has no generic/parametric type machinery to hang a species
   functor on (§1.5), so anything here would live at the `FamilyKernel`/`Declared` layer in
   our own code, not in CE's type system. Worth a dedicated exploratory spike, or shelve
   until a concrete need (beyond what `Declared` already expresses) shows up?
