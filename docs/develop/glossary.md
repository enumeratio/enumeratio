# Glossary

The working vocabulary of the project — the terms that recur across the SQL core, the client, the CLI, and the
explorer. Definitions are deliberately short; each links on to the reference page or [design
wiki](https://github.com/enumeratio/enumeratio/wiki) where the idea is developed in full.

Most of these words name one of a few layers: the **type** a value has (carrier), the **object** it is (element),
the **group** it lives in (fiber), the **knob** that picks the group (axis / param), the **thing you address**
(handle / collection), and the **machinery** that answers questions about it (tower). Reading them in that order is
the fastest way in.

## The core model

**Collection.** A named family of combinatorial objects — `permutations`, `subsets`, `dyck_paths`. Not a class with
methods but **rows in a catalog**: a collection is *declared as data* (a carrier type, a grade chain, examples) and
its whole public surface — enumeration, ranking, membership, counting, notation — is *generated* from that
declaration by the realizer. See [Math as data](/develop/) and the [Collections](/develop/data/collections) index.

**Carrier.** The SQL composite type that holds one object's raw value — `permutation = (entries int[])`,
`binary_word = (bits int[])`, `dyck_path = (steps int[])`. Several collections can share a carrier; equinumerous
siblings usually don't (a subset and a bitstring count the same but are different *constructions*).

**Element.** One inhabitant of a collection, carried as `(fiber, rank, value)` — the object's value *plus its
address*. An element knows which fiber it is in and where it sits inside it, so it can name itself independently of
any query.

**Fiber.** The set of objects at one fixed setting of the grade axes — `permutations` at `size = 4`, all 24 of
them. Typed per collection as `<coll>_fiber`. A collection is a disjoint union of its fibers; enumeration is
"pick a fiber, then rank within it."

**Axis (grade).** A parameter position that selects a *fiber* — `size` for `permutations`, `n` and `k` for
`k_subsets`. An axis is **recoverable from a single element** (there is a statistic that reads it back), so it can
be ranged and grouped; ranging one produces a triangle (the Mahonian/Stirling shape). Contrast **param**, below.
The ordered axes of a collection are its **grade chain** (`base_grade`, in position order).

**Handle.** The addressable `FROM` reference — `permutations(size=4)`, `k_subsets(n=0..5)`, or bare `permutations`.
Bound axes pick fibers; an axis left unbound makes an **open handle**. The client parses FROM-text into a `Handle`
via `toHandle`.

**Open handle.** A handle with an unbound axis. Because a `NULL` upper bound makes the usual `generate_series`
unfold yield nothing, an open handle instead **streams** a window: it starts at the lowest fiber and walks forward
with the odometer until it has enough elements — never materializing "all" fibers, which for an open axis don't
exist.

**Tower.** The per-collection SQL functions the realizer emits — `fibers`, `fiber_elements`, `fiber_count`,
`elements`, `unrank`, `cardinality`, `contains`, `next` / `prev`, and the address/rank accessors. "Owns a tower"
means a collection has its own generated machinery (versus being a bare alias — see **pointer point**).

**Realize.** `base_realize(<coll>)` — the one generator that reads a collection's declared carrier + grade chain
and `EXECUTE format`s its whole tower into existence. Adding a collection is mostly *declaring data*; the realizer
writes the functions.

**Odometer.** The single generic `next(fiber)` / `prev(fiber)` walk over any collection's grade chain (data-driven
from `base_grade`, not written per collection). It is what lets an open handle stream, and what defines the global
order across fibers.

**Rank / address / ordinality.** Three notions of "position." **Rank** is an element's 0-based place *within its
fiber* (what `unrank` inverts). **Address** is the compound coordinate — the fiber's axis values ⊕ the rank
(`4.2.1`). **Ordinality** is the 1-based position in a *result set* — a property of a query, not of an element, so
the client computes it per statement.

## Families, parameters, and points

The deeper story here — why a parameter is not always an axis, and how a named slice relates to its family — lives
in the wiki: [Family parameters &
numerals](https://github.com/enumeratio/enumeratio/wiki/Family-Parameters-and-Numerals) and [Parameterized
collections](https://github.com/enumeratio/enumeratio/wiki/Parameterized-Collections).

**Family.** A collection with a parameter left open — `words(size, base)`, `prime_pairs(gap)`,
`polygonal_numbers(k)`. Binding the open parameter picks a specific member.

**Param (family parameter).** A grade-chain position flagged `role = 'param'`: it selects *which collection*, not a
fiber within one. Its litmus is the opposite of an axis's — **you cannot recover it from a single element** (nothing
about the number 5 says it is the lesser of the twin pair `(5, 7)`). So a param has no statistic, can't be ranged or
grouped, and *must* be bound; ranging it would be a disjoint union of unrelated collections, not a triangle.
`words.base`, `prime_pairs.gap`, and `hypernumerary.b` / `.k` are params; `permutations.size` and `k_subsets.k` are
axes.

**Family point.** A named, pinned slice of a family, recorded in `base_family_point` — `binary_words` = `words` at
`base = 2`; `twin_primes` = `prime_pairs` at `gap = 2`; `square_free_numbers` = `k_free_integers` at `k = 2`. The
same object then has two spellings — the friendly name and the expanded family call — and the router keeps them
interchangeable (see **fold**).

**Realized point.** A family point that **owns its own tower** — its own carrier, engines, and axis names
(`binary_words`, `twin_primes`). It is its own canonical, directly-buildable collection; a selfcert differential
checks that it enumerates the same objects as the family handle it is a point of.

**Pointer point (pure pointer).** A family point that is **only an alias** — `alias_of` is set, `base_realize` was
skipped, so it has *no tower of its own* (`cube_free_numbers` → `k_free_integers(k=3)`). To build or enumerate it at
all, the router must rewrite it into the family (see **fold forward**). Called a "pure pointer" in the code
comments, a "pointer point" in the design wiki — the same thing.

**Fold.** What the FROM-router (`resolveFrom`, client) does to keep a point's two spellings interchangeable, in two
directions. **Fold forward** rewrites a point into its family with the bindings applied (`cube_free_numbers` →
`k_free_integers(k=3)`); **fold backward** collapses a family bound to exactly a point's bindings back to the point
(`words(base=2)` → `binary_words`). *Only a pointer point folds forward* — it has no tower to run. A realized point
is left alone and built directly: forward-folding one is both anti-canonical and, when its bound param sits behind
an unbound axis, unbuildable (the `binary_words` → `words(base=2)` "bind size before base" case, [fixed in
#347](https://github.com/enumeratio/enumeratio/pull/347)).

**Family skeleton.** A family whose params are still unbound — a bare `prime_pairs` or `hypernumerary`. There is
nothing concrete to enumerate (a param is not a rangeable axis), so it is the explorer's **family page**, not a
fiber list; `planRows` refuses one gracefully (`isFamilySkeleton`) rather than trying to walk it.

## Statistics, maps, and references

**Statistic (stat).** A named per-element invariant registered against a collection — `inversions` and `descents`
on `permutations`, `major_index` on `dyck_paths`. Recoverable from the element alone; the axis-recovering stats are
what make an axis an axis. See [Statistics](/develop/data/statistics).

**Map.** A registered function between collections — a bijection, order-isomorphism, or embedding (permutation ↔ its
inverse; a Robinson–Schensted correspondence). Maps are how equinumerous families are *related* rather than
collapsed. See [Maps](/develop/data/maps).

**Reference (relation).** A cross-reference row tying a collection or statistic to an external system — OEIS,
FindStat, Sage, mathlib4. The [Relations](/develop/data/relations) table is the full crosswalk;
[Sources](/develop/sources) is the per-system view.

## Rendering

**Notation / repr.** A textual spelling of an element — `notation(w)` gives a `binary_word` its bitstring `1010`.
A carrier can carry several named reprs (cycle vs one-line for a permutation); the resolved default is
per-environment.

**Glyph.** An SVG rendering of an element — the little diagram in the explorer. Registered per carrier
(`carrier_renders_svg` derives from the overload's existence); coordinates are rounded for stable output.

## Verification and packaging

**Example / floor.** A checked `base_example` row — an input, an expected value, and the SQL that must produce it.
The example suite (`run.mts`, `pnpm test:core`) is the first gate; anchors (counts, OEIS values) must come from a
real source, never recalled memory.

**Selfcert / differential.** The cross-check that the *accelerated* path agrees with the *naive* one — `fiber_count`
against an actual enumeration, `element_at` against sequential ranking, at every fiber a sweep touches
(`selfcert.mts`; the row-half walk `selfcert-rows.mts`). It catches numerical disagreement the example suite would
miss — a truncation or off-by-one at large `n`. See [Self-certification](https://github.com/enumeratio/enumeratio/wiki/Self-Certification).

**Quickcheck.** A property-based sampler with a fresh random seed each run — **advisory, not a gate**. A failure
opens one rolling tracking issue rather than blocking, and findings are swept in batches; the blocking gates are the
deterministic `pnpm test` suites.

**Core / pack.** The catalog splits into `sqlsrc/` (**core** — always loaded) and opt-in `packs/<pack>/` (domain
clusters — number sets, tableaux, polytopes). A pack only ever *adds* rows; core must be self-contained (loadable
without any pack). The split is mapped by `packages/data/pack-map.ts`.

**Codemod.** How a wide mechanical change ships here — as an idempotent script (with `--check` and `--dry-run`
modes) that reads its intent from a checked-in map, rather than a one-shot pass. The same script performs the
refactor *and* re-normalizes a branch that predates it, so a stranded branch catches up with one command.
