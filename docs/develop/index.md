# Math as data, data as math

Most combinatorics libraries are code. A permutation module knows how to count permutations, rank them, unrank
them, compute their statistics; a set-partition module does the same, from scratch, sharing nothing; and the
*facts that connect them* — that the Catalan number counts Dyck paths and binary trees and non-crossing
partitions alike, that a Robinson–Schensted bijection carries one family's ranking onto another's — live only in
the documentation, if anywhere. The knowledge is real. It just isn't in the program.

enumeratio takes the opposite stance. A collection is not a class with methods; it is **rows in a catalog**. The
count of a family, the closed form its grade counts sum to, the bijection to a sibling family — these aren't
functions scattered across modules, they are *entries*, and they reference each other the way facts do. The whole
public surface — constructors, enumeration, ranking, membership, notation, rendering — is **generated** from those
entries by a single realizer. This page is the argument for why that pays off, told in four moves.

If you're here to build rather than read the argument: **[Packages](/develop/packages/)** is the four packages
themselves and how they stack; **[Data Reference](/develop/data/)** is the generated Collections/Statistics/Maps/
Relations tables plus the still-stubbed Functions page; **[API Reference](/develop/api)** is the generated SQL
surface; **[Sources](/develop/sources)** is the crosswalk against external systems (OEIS, FindStat, Sage, …);
**[Contributing](/develop/contributing/)** is everything about adding to the library — repo shape, the model, the
rules; **[Playground](/develop/playground/)** is the curated index of live toys.

## 1. The math *is* data

Start with what a collection actually is. Three things:

- **catalog rows** — a row in `base_collection` (an id, a carrier type, an `unbounded` flag), plus its **grade
  chain** in `base_grade`: the ordered, named size axes (`n`, then `k` as a subgrade of `n`), each with a `lo`/`hi`
  expression. Then the satellite registries — `base_stat` (per-element statistics), `base_map` (morphisms to other
  collections), `base_repr` (alternate renderings), `base_example` (living assertions), `base_tag` / `base_trait` /
  `base_category` (what a collection is and has).
- **a carrier** — the base type that actually stores an element. `int[]` for a permutation, `text` for a
  set-partition's restricted-growth string, a composite type for something structured. One collection, one carrier.
- **a floor engine** — the small, hand-authored core: for each fiber (a slice of the collection at fixed axis
  values), `fiber_elements(fiber, limit)` enumerates the elements *in order*. That's the only required piece.
  Two optional companions — `fiber_count` (a closed-form cardinality) and `contains_in_fiber` (membership) — are
  accelerations, not obligations.

The floor is the irreducible math: the part that genuinely cannot be derived, the ordered enumeration itself.
Everything above it is mechanical. `base_realize(coll)` reads the row, introspects the collection's own
`<coll>_fiber` composite type, and *writes the DDL* for the entire generic surface — the `<coll>(n, k, …)`
constructor, `fibers()` / `elements()`, `cardinality()`, `unrank()`, the `contains` predicate and its `<@` / `@>`
operators, the `::text` notation cast, `render()`. Adding a collection is **rows plus a floor engine**, realized —
never a new slab of per-collection glue.

And it is genuinely *just data* in a database. Pure SQL, zero C, no `CREATE EXTENSION`: the core loads into a bare
PostgreSQL or into [PGlite](https://pglite.dev) compiled to WebAssembly, which is why the same catalog that runs in
your test suite runs *in the browser* — the docs components and the explorer query a live PGlite instance, not a
pre-baked JSON export. The catalog is the database, all the way down.

## 2. One identity, many roles

Here is the move that a library-of-modules structurally cannot make.

A combinatorial number is written **once**, as a `math_*` identity — `math_factorial`, `math_binomial`,
`math_catalan`, `math_stirling2`, `math_bell`. Then every role that *is* that number references the identity
instead of recomputing it:

- as a **cardinality** — one Catalan identity is the count of Dyck paths, binary trees, ordered trees,
  231-avoiding permutations, *and* non-crossing partitions. Five collections, one number, referenced five times, not
  re-implemented five times.
- as an **aggregate's closed form** — the grade counts of `set_partitions(5)`, sliced by number of blocks, are a
  row of Stirling-2 numbers; they sum to Bell(5). The distribution *is* a known identity, and the catalog says so by
  pointing at it.
- as an **order-isomorphic map** — the deep one. When two collections share a carrier and a natural bijection,
  one *borrows* the other's ranking rather than authoring its own. `binary_trees` ranks through the Dyck-path
  bijection; it never writes an unrank formula, because the bijection plus Dyck paths' formula already determine it.
  The borrow is manifest in the SQL — you can see which family is lending its engine.

The payoff is not just less code. It's that **the connections become first-class objects you can query**. A
statistic's distribution over a fiber is a `GROUP BY stat` away, and for permutations-by-inversions it's the
Mahonian numbers — the q-factorial `[n]_q!` — read straight off the group counts. Perms by descents give the
Eulerian numbers; Dyck paths by area give the q-Catalan. The generating polynomial isn't a special feature someone
had to build; it falls out of the same catalog, because the statistic and the grading and the count are all *the
same data wearing different hats*. That's the thesis: **one identity, surfaced as counts, aggregates, and rankings,
threaded through structure-preserving maps** — rather than each family re-deriving in isolation what it shares with
its neighbors.

## 3. The page is a SQL view — a star schema

Now zoom out to the surface a user actually touches: a collection page in the explorer. The temptation is to build
it as a pile of bespoke widgets — a table here, a count in the header, a distribution chart, a detail pane. Resist
it. **A collection page is a single composed SQL `SELECT`**, and every pane is one facet of it:

```sql
SELECT   <projections>          -- the columns ARE the SELECT list: element, stats, map images
FROM     <collection>(<params>) -- the handle; type params, restrictions, maps live here
WHERE    <predicate>            -- the filter box
GROUP BY <axis…>                -- grading → the triangle / distribution views
HAVING   <aggregate predicate>  -- fix or range a grade parameter
ORDER BY <keys…>                -- the sort
LIMIT    <window>               -- the virtual-scroll window
```

There is no separate "column configuration" that the query then honors — the columns you see *are* the projection
list. Add a column, add a projection; drop `rank`, drop it from the `SELECT`. Filtering is `WHERE`. Sorting is
`ORDER BY`. Even the header itself is a query: a collection's title and traits are literally one row of a
`collections` meta-collection, so the page is two coordinated views over the catalog — the chrome is a query too.

Split that statement by role and a deeper claim falls out. The `SELECT` list is the *column* half — which properties
to show — and it is exactly what the explorer's column configurator edits. Everything else — `FROM`, `WHERE`,
`GROUP BY`, `HAVING`, `ORDER BY` — is the *row* half: which rows exist, in what shape, in what order. And **a named
row half is a collection.** `derangements` is `FROM permutations WHERE is_derangement`; a distribution triangle is
`permutations GROUP BY size, descents`; an order-isomorphic sibling swaps the element column through a map — and each
already lives in a registry row (`base_restrict`, `base_triangle`, `base_map`). So configuring a table's rows and
*naming* the configuration is the very act of defining a collection; the two surfaces are one. And it is real: the
[query view](/explore/query/) is the row half you edit as running SQL, while the collection explorer is the column
editor over a row half that already has a name.

Grading is the elegant case. The grade axes are an ordered, nested chain (`k` only makes sense *under* `n`), so the
set of meaningful groupings is exactly a **`ROLLUP`**: `GROUP BY ROLLUP (n, k)` = `GROUPING SETS ((n,k), (n), ())`
— which is precisely the row set of a TreeTable, every nesting level plus an overall footer. No grading is the
empty grouping set `(())`; the empty set `()` is the footer where the collection-wide cardinality lives (honestly
`∞` or "unknown" when we can't compute it). This chain of successively coarser partitions is a *filtration* in the
measure-theoretic sense — precise vocabulary the model earns, not borrows loosely.

Naming it this way reveals a shape that was there all along: the four layers people kept designing one at a time —
grades, stats, maps, grouping — are the four parts of a **star schema**.

| OLAP term | In enumeratio | Backing table |
|---|---|---|
| **Fact table** | a collection — one row per element | `base_collection` |
| **Dimension** | a grade axis you slice / bind / group by | `base_grade` |
| **Measure** | a stat — a per-element number you aggregate or distribute | `base_stat` |
| **Relationship** | a map — a morphism / join to another collection | `base_map` |

A carrier-scoped map is a *conformed dimension* shared across every collection over that carrier; a
collection-scoped bijection is an invertible *join between two fact tables*. The distinctions already living in the
tables line up exactly with the OLAP ones — the shape is borrowed, not invented, which is the tell that it's right.

## 4. Correctness that certifies itself

A generated surface raises an obvious worry: how do you trust the fast path? A closed-form `cardinality` that
returns `n!` without enumerating, an `unrank` that jumps to the r-th element by formula — these are exactly where a
subtle wrong coefficient hides.

The answer is built into the model. Every collection already carries a **slow, definitional floor**: enumerate the
fiber, in order. So the floor is a free oracle. Run the accelerated path and the definitional path over the same
fiber and assert they agree:

| Check | Accelerated (fast) | Naive (definitional) |
|---|---|---|
| **count** | `fiber_count(f)` — a closed form (n!, Catalan, Bell, …) | `count(elements(f))` — actually enumerate |
| **unrank** | `element_at(f, ord)` — direct random access by formula | the `ord`-th of `elements(f) ORDER BY e` |

No hand-authored expected values, no external reference — the collection certifies *itself*, and it does so for
every collection that carries an acceleration, for free. The count check needs a finite fiber; the unrank check
runs on infinite ones too, comparing the first N terms, which is what pins the closed-form term formulas of the
unbounded number sequences (Catalan, factorial, Fibonacci). The harness — `packages/data/selfcert.mts` — boots a
bare PGlite, applies the whole core, and sweeps every collection across a range of fiber sizes; a first run cleared
~1,090 checks over the 106 collections with an acceleration, zero mismatches, the handful of skips being honest
"too large / infinite to enumerate cheaply" cases. It's deliberately slow (materialising and sorting is the whole
point), so it's opt-in rather than part of the default gate.

This is the same discipline the whole project runs on, at three scales:

- **examples as a living spec** — `base_example` rows are SQL paired with an expected result, loaded and verified
  on every build. They are simultaneously the regression suite and the documentation, and `COMMENT ON` makes the
  database self-describing. The spec can't drift from the code because the spec *is* run.
- **the per-collection differential** — `selfcert.mts`, above: accelerated equals definitional.
- **the view-level differential** — `selfcert-view.mts` lifts the same equation to a whole page. Given a `WHERE`
  / `ORDER BY` / `GROUP BY` over a bounded collection, the naive materialisation (enumerate, then apply the clauses
  in plain SQL) *is* the definitional answer, and the accelerated view must equal it. As each clause gains an
  acceleration — indexed filters, rank-bounded windows, closed-form group counts — it gets a ready-made oracle.

Everything in the catalog turns out to be a special case of one equation. `base_example`'s assertions, the
triangle's `Σ grade-counts == cardinality`, the order-isomorphism identity `rank_c(f(x)) = rank_d(x)` that lets one
family borrow another's ranking — all of them are *the accelerated answer equals the definitional one*. That
equation is the same one from move 2 (one identity, many roles) and move 3 (the naive view is the fast view's
oracle), seen from correctness's side.

## The through-line

Four moves, one idea. The math is **data** (move 1), so a fact can be *referenced* rather than re-implemented, and
one identity fans out across many roles (move 2). Because it's data in a database, the entire consuming surface
collapses to a **composed query** with a recognizable OLAP shape (move 3). And because the query has a slow,
definitional form sitting right next to its fast one, the whole thing **certifies itself** (move 4). Put a
combinatorial structure into the catalog as rows and a floor engine, realize it, and you don't just get a counter
and a ranker — you get its place in the web of identities, its page as a queryable view, and a proof that the fast
answers match the honest ones. That is what it means for math to be data, and data to be math.

---

*Deeper design detail lives in the wiki:*
[*Architecture*](https://github.com/enumeratio/enumeratio/wiki/Architecture) ·
[*Query Model*](https://github.com/enumeratio/enumeratio/wiki/Query-Model) ·
[*Dimensions & Measures*](https://github.com/enumeratio/enumeratio/wiki/Dimensions-and-Measures) ·
[*Self-Certification*](https://github.com/enumeratio/enumeratio/wiki/Self-Certification).
