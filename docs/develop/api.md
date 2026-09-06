# API reference — the generated SQL surface

<script setup>
import { data } from './api.data.ts'
const surface = Object.fromEntries(data.surface.map(s => [s.name, s]))
const sig = n => surface[n]?.signature ?? n
</script>

enumeratio has no hand-written per-collection API. A **collection** is a row in `base_collection` (plus its grade
axes, orders, examples) over a carrier type and a handful of engine functions; the generator
[`base_realize`](https://github.com/enumeratio/enumeratio/blob/main/develop/packages/data/sqlsrc/realizer.sql) turns each row
into one **uniform** handle / element / notation / membership layer. So the surface below is the *same shape* for every
one of the **{{ data.counts.collections }}** collections — learn it once, use it everywhere.

Everything here is plain SQL over a bare PostgreSQL / [PGlite](https://pglite.dev) — no `CREATE EXTENSION`. The
signatures on this page are **introspected from the built database at docs-build time** (shown over `{{ data.representative }}`
as the worked example), so they track the live schema rather than drifting from it.

::: tip At a glance
**{{ data.counts.collections }}** collections · **{{ data.counts.functions }}** distinct functions ·
**{{ data.counts.stats }}** stats · **{{ data.counts.maps }}** maps · **{{ data.counts.representations }}** representations ·
**{{ data.counts.examples }}** catalog examples.
:::

## Constructors — the handle

Each collection name is a **function** returning a subscriptable *handle*. Grades bind at construction and are
**positional** in grade order, exposed as generic parameters `g1`, `g2`, … (a collection's grade *names* — its
mathematical parameters — surface in the handle's text form, below). Every grade defaults to `NULL`, which means
"the whole, ungraded collection".

<table class="ctor-table">
<thead><tr><th>Collection</th><th>Constructor forms</th><th>Grade axes (→ <code>g1</code>, <code>g2</code>, …)</th></tr></thead>
<tbody>
<tr v-for="c in data.ctorExamples" :key="c.collection">
<td><code>{{ c.collection }}</code></td>
<td><span v-for="f in c.forms" :key="f"><code>{{ f }}</code><br/></span></td>
<td>{{ c.grades.length ? c.grades.join(', ') : '— (no grades)' }}</td>
</tr>
</tbody>
</table>

- **Positional grades** — `permutations(5)` is `S₅`; `compositions_into_k_parts(6, 3)` binds both axes. Named-argument
  form works too (`permutations(g1 => 5)`).
- **Range form** — a single-grade collection also takes `(lo, hi)`: `permutations(3, 5)` is the handle spanning sizes 3–5.
- **`handle::text`** — a handle casts to a readable label using the grade *names*: `permutations(5)::text` → `permutations(size=5)`.
- **`{{ sig('cardinality') }} → {{ surface.cardinality?.ret }}`** — the count, **∞-aware**: `cardinality(natural_numbers())` is
  `Infinity`. Also defined per fiber.

## Elements & located addressing

An **element** is a composite `(fiber, rank, value)`: the `value` is the carrier, the `fiber` is the grade cell it
lives in, and `rank` is its slot within the collection. You address elements by rank off a handle, or by ordinal within
one fiber.

| Function | Signature | Returns | Role |
|---|---|---|---|
| `unrank` | <code>{{ sig('unrank') }}</code> | `{{ surface.unrank?.ret }}` | the element at global rank `r` off a handle |
| `element_at` | <code>{{ sig('element_at') }}</code> | `{{ surface.element_at?.ret }}` | the element at ordinal `ord` within one fiber |
| `fiber_unrank` | <code>{{ sig('fiber_unrank') }}</code> | `{{ surface.fiber_unrank?.ret }}` | just the **carrier value** at that ordinal |
| `elements` | <code>{{ sig('elements') }}</code> | `{{ surface.elements?.ret }}` | stream a handle's (or a fiber's) elements (capped) |
| `ordinality` | <code>{{ sig('ordinality') }}</code> | `{{ surface.ordinality?.ret }}` | an element's global rank as a plain number |
| `omega_ordinality` | <code>{{ sig('omega_ordinality') }}</code> | `{{ surface.omega_ordinality?.ret }}` | its transfinite address (Cantor normal form) |
| `render` | <code>{{ sig('render') }}</code> | `{{ surface.render?.ret }}` | the element's canonical rendered notation |

## Iteration & ranges

The successor/predecessor pair walks the total order; `*_in_fiber` stays inside one grade cell; `range`/`unfold`
produce contiguous windows.

| Function | Signature | Returns |
|---|---|---|
| `next` / `prev` | <code>{{ sig('next') }}</code> | `{{ surface.next?.ret }}` |
| `next_in_fiber` / `prev_in_fiber` | <code>{{ sig('next_in_fiber') }}</code> | `{{ surface.next_in_fiber?.ret }}` |
| `range` | <code>{{ sig('range') }}</code> | `{{ surface.range?.ret }}` |
| `unfold` | <code>{{ sig('unfold') }}</code> | `{{ surface.unfold?.ret }}` |
| `random_element` | <code>{{ sig('random_element') }}</code> | `{{ surface.random_element?.ret }}` |
| `random_elements` | <code>{{ sig('random_elements') }}</code> | `{{ surface.random_elements?.ret }}` |
| `an_element` | <code>{{ sig('an_element') }}</code> | `{{ surface.an_element?.ret }}` |
| `some_elements` | <code>{{ sig('some_elements') }}</code> | `{{ surface.some_elements?.ret }}` |

`an_element` / `some_elements` are **deterministic** (Sage's accessors: a stable, cheap representative, and the
first _n_) — `random_element` / `random_elements` **draw** (uniform, iid with replacement; `random_elements(h, n)`
is the plural). The random draws refuse rather than fake uniformity: an infinite or unknown-count handle yields
`NULL` / zero rows, never a biased sample.

## Fibers & grading

Grading partitions a collection into **fibers** — one per grade tuple. A fiber is itself a typed value you can count,
address, and enumerate.

| Function | Signature | Returns | Role |
|---|---|---|---|
| `fibers` | <code>{{ sig('fibers') }}</code> | `{{ surface.fibers?.ret }}` | the fibers of a handle |
| `fiber_count` | <code>{{ sig('fiber_count') }}</code> | `{{ surface.fiber_count?.ret }}` | closed-form cardinality of one fiber |
| `fiber_address` | <code>{{ sig('fiber_address') }}</code> | `{{ surface.fiber_address?.ret }}` | the fiber's ordinal position (sorts fibers) |
| `address` | <code>{{ sig('address') }}</code> | `{{ surface.address?.ret }}` | the fiber's grade tuple as an index vector |
| `fiber_symbol` | <code>{{ sig('fiber_symbol') }}</code> | `{{ surface.fiber_symbol?.ret }}` | the fiber's display subscript |

Distinct grade-axis names across the catalog: <span v-for="(g, i) in data.gradeNames" :key="g"><code>{{ g }}</code>{{ i < data.gradeNames.length - 1 ? ', ' : '' }}</span>.

## Membership — as data

Fiber membership is a first-class operator. Both directions dispatch to the generated `contains(handle, value)`; a
collection's `is_*` predicate folds in as its `membership_predicate`, and the grade axes are checked for free.

<ul>
<li v-for="o in data.operators" :key="o.name">
<span v-if="o.name === '<@'"><code>value &lt;@ handle</code> — is <code>value</code> a member of the collection?</span>
<span v-else><code>handle @&gt; value</code> — the same test, other way round</span>
({{ o.count }} carrier/collection pairs)</li>
</ul>

```sql
SELECT ARRAY[2,0,1]::permutation <@ permutations(3);   -- true
SELECT permutations(3) @> ARRAY[2,0,1]::permutation;   -- true
```

Backing functions: <code>{{ sig('contains') }} → {{ surface.contains?.ret }}</code> and its flip
<code>{{ sig('member_of') }}</code>.

## Carrier values & figures

Drop the located wrapper and work with raw carrier values, or ask the database to draw one.

| Function | Signature | Returns | Role |
|---|---|---|---|
| `unnest` | <code>{{ sig('unnest') }}</code> | `{{ surface.unnest?.ret }}` | a handle's carrier values (alias of `carriers`) |
| `carriers` | <code>{{ sig('carriers') }}</code> | `{{ surface.carriers?.ret }}` | same, explicit name |
| `glyph_svg` | <code>{{ sig('glyph_svg') }}</code> | `{{ surface.glyph_svg?.ret }}` | an element's SVG, straight from SQL |

## Representations, stats & maps — the catalog facets

Beyond the uniform surface, three catalog tables attach **named, per-collection** functions. They're data: query the
table to discover what a collection offers, then call the function it names.

**Representations** (`base_repr`) — alternate renderings. `{{ sig('render') }}` gives the canonical one;
`{{ sig('notation') }}` and `{{ sig('set_notation') }}` cover element and set-builder notation. Media in the catalog:
<span v-for="(m, i) in data.media" :key="m"><code>{{ m }}</code>{{ i < data.media.length - 1 ? ', ' : '' }}</span>.

**Stats** (`base_stat`) — a per-element invariant. Each row names a `value_fn(carrier) → codomain`; e.g. `permutations`'
`ascents` stat is `perm_ascents(permutation)`. The catalog holds **{{ data.counts.stats }}** distinct stats:

<details>
<summary>{{ data.counts.stats }} stat ids</summary>
<p>{{ data.stats.map(s => s).join(', ') }}</p>
</details>

**Maps** (`base_map`) — a structure-preserving function to another collection; each row names a `mapping_fn` and its
`codomain`, and flags `is_bijection` / `inverse`. Order-isomorphic maps are how one family *borrows* another's ranking.
The catalog holds **{{ data.counts.maps }}** distinct maps:

<details>
<summary>{{ data.counts.maps }} map ids</summary>
<p>{{ data.maps.map(m => m).join(', ') }}</p>
</details>

## Public types

The surface is typed. A handful of domain types recur:

<ul>
<li v-for="t in data.types" :key="t.name"><code>{{ t.name }}</code> — {{ t.note }}</li>
</ul>

## Generating this page

The counts, signatures, operator list, grade names, and stat/map/representation inventories above are all
**introspected live** from the built core (`docs/develop/api.data.ts` boots PGlite, applies `sqlsrc`, and queries
`pg_proc` + the `base_*` catalog). The *prose* is hand-authored, because the generated functions carry no
`COMMENT ON` yet — there's nothing to source descriptions from. Populate `COMMENT ON FUNCTION` in the realizer and the
per-entry descriptions here could be generated from `pg_description` too, closing the loop on a fully self-describing
reference.
