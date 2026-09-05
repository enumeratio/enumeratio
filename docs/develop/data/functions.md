---
sidebar: false
aside: false
---

# Functions reference

<script setup>
import { ref, computed, reactive } from 'vue'
import { data } from './functions.data.ts'

const search = ref('')
const sortKey = ref('id')
const sortDir = ref(1)
const expanded = reactive(new Set())

function sortBy(key) {
  if (sortKey.value === key) sortDir.value *= -1
  else { sortKey.value = key; sortDir.value = 1 }
}
function toggle(id) {
  expanded.has(id) ? expanded.delete(id) : expanded.add(id)
}

function hasEngine(r, engine) { return r.impls.some((i) => i.engine === engine) }

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const rows = q
    ? data.rows.filter((r) =>
        r.id.includes(q) || (r.title ?? '').toLowerCase().includes(q) || r.description.toLowerCase().includes(q) ||
        r.impls.some((i) => i.implRef.toLowerCase().includes(q)))
    : data.rows
  const key = sortKey.value
  return [...rows].sort((a, b) => {
    const av = a[key] ?? '', bv = b[key] ?? ''
    if (av < bv) return -1 * sortDir.value
    if (av > bv) return 1 * sortDir.value
    return 0
  })
})
</script>

A curated ledger of named math identities — `catalan_number`, `factorial`, `stirling1`, `gcd`, … — each backed by
one or more implementations (`base_function_impl`): a live SQL function, a
[`@enumeratio/math`](https://github.com/enumeratio/enumeratio/tree/main/packages/math) TS twin, or both, at one or
more representations (exact `numeric`, native `bigint`, …). Generated at build time by
[`functions.data.ts`](https://github.com/enumeratio/enumeratio/blob/main/docs/develop/data/functions.data.ts)
reading `base_function`/`base_function_impl` directly, the same pattern as [the collections index](/develop/data/collections) and
[the maps reference](/develop/data/maps). SQL/TS bodies below are pulled live (`pg_get_functiondef` for SQL, a
TypeScript-AST walk of `packages/math/src/*.ts` for TS), not hand-copied — they can't go stale.

::: tip At a glance
**{{ data.count }}** curated identities. This is an initial batch, not exhaustive — see
[issue #282](https://github.com/enumeratio/enumeratio/issues/282) for what's deliberately excluded (generic-
dispatch rank/unrank plumbing, mostly) and what's still to curate.
:::

An identity can carry a **function property** — named for the property itself, not Wolfram Language's keyword,
though the [WL attribute](https://reference.wolfram.com/language/ref/Flat.html) each borrows from is kept as a
cross-reference:

- **associativity** (WL `Flat`) — `f(f(a,b),f(c,d)) = f(a,b,c,d)` for any bracketing.
- **commutativity** (WL `Orderless`) — argument order doesn't matter.
- **idempotency** — the semilattice law `x∘x = x` (gcd/lcm are the meet/join of the divisibility lattice).
- **threadability** (WL `Listable`) — threads elementwise over lists in argument position. Vocabulary; nothing
  curated yet (no SQL impl provides an array-threading overload).
- **one_identity** (WL `OneIdentity`) — the single-argument application of a variadic head collapses to its
  argument, `f(x) ≡ x` (e.g. `Add[x] → x`). This is a **rewrite/pattern-matching rule, not idempotency** — `Plus`
  has it yet `1+1 ≠ 1`, and idempotent `Abs` lacks it; the two are orthogonal. Kept as its own property because
  the IR wants exactly this normalization. Vocabulary; nothing curated yet.

associativity and commutativity each *correspond to* — this is this project's own framing, not a proof the schema
enforces — a polytope already in [the Explorer](/explore/collection/): every bracketing of an n-ary endo-operation's
operands is a distinct [Associahedron](/explore/collection/associahedron) vertex, and associativity means they all
collapse to one value; every ordering is a distinct [Permutahedron](/explore/collection/permutahedron) vertex, and
commutativity means they all collapse. Every attribute assignment below that has a live SQL implementation is backed
by a `base_example` proof (an actual computed equality, not just an asserted claim) — see each identity's expanded
detail.

<div class="fn-toolbar">
  <input v-model="search" type="search" placeholder="Filter by id, title, description, or implementation…" class="fn-search" />
  <span class="fn-count">{{ filtered.length }} shown</span>
</div>

<table class="fn-table">
<thead>
<tr>
<th @click="sortBy('id')" class="sortable">identity <span v-if="sortKey === 'id'">{{ sortDir > 0 ? '▲' : '▼' }}</span></th>
<th>SQL</th>
<th>TS</th>
<th>attributes</th>
<th>refs</th>
</tr>
</thead>
<tbody>
<template v-for="r in filtered" :key="r.id">
<tr class="fn-row" @click="toggle(r.id)">
<td><code>{{ r.id }}</code><br/><span class="fn-title">{{ r.title }}</span></td>
<td><span v-if="hasEngine(r, 'pg')" class="fn-yes" title="has a live SQL implementation">✓</span><span v-else class="fn-none">—</span></td>
<td><span v-if="hasEngine(r, 'ts')" class="fn-yes" title="has a @enumeratio/math TS implementation">✓</span><span v-else class="fn-none">—</span></td>
<td>
<span v-if="r.attributes.length === 0" class="fn-none">—</span>
<span v-for="a in r.attributes" :key="a.id" class="fn-badge">{{ a.title }}</span>
</td>
<td>{{ r.references.length || '—' }}</td>
</tr>
<tr v-if="expanded.has(r.id)" class="fn-detail-row">
<td colspan="5">
<div class="fn-detail">
<p>{{ r.description }}</p>

<div v-if="r.attributes.length" class="fn-attrs">
<div v-for="a in r.attributes" :key="a.id" class="fn-attr">
<strong>{{ a.title }}</strong>
<a v-if="a.polytope" :href="`/explore/collection/${a.polytope}`">corresponds to the {{ a.polytope }} ↗</a>
</div>
</div>

<div class="fn-bodies">
<div v-for="impl in r.impls" :key="`${impl.engine}:${impl.implRef}`" class="fn-body">
<template v-if="impl.engine === 'pg'">
<div class="fn-body-label"><code>{{ impl.signature }}</code> → <code>{{ impl.ret }}</code>
<span class="fn-badge">{{ impl.representation }}</span><span v-if="impl.variadic" class="fn-badge">variadic</span></div>
<p v-if="impl.note" class="fn-impl-note">{{ impl.note }}</p>
<pre v-if="impl.body"><code>{{ impl.body }}</code></pre>
</template>
<template v-else>
<div class="fn-body-label"><code>{{ impl.implRef }}</code>
<span class="fn-badge">{{ impl.engine }}</span><span class="fn-badge">{{ impl.representation }}</span>
<a v-if="impl.file" :href="`https://github.com/enumeratio/enumeratio/blob/main/packages/math/src/${impl.file}`">{{ impl.file }}</a></div>
<p v-if="impl.note" class="fn-impl-note">{{ impl.note }}</p>
<pre v-if="impl.comment"><code>{{ impl.comment }}</code></pre>
<pre v-if="impl.body"><code>{{ impl.body }}</code></pre>
</template>
</div>
</div>

<table v-if="r.references.length" class="fn-refs">
<thead><tr><th>system</th><th>identity</th><th>delta</th><th>relation</th></tr></thead>
<tbody>
<tr v-for="ref in r.references" :key="ref.system">
<td>{{ ref.system }}</td>
<td><a v-if="ref.url" :href="ref.url" target="_blank" rel="noopener"><code>{{ ref.identity }}</code></a><code v-else>{{ ref.identity }}</code></td>
<td>{{ ref.delta || '—' }}</td>
<td>{{ ref.relation }}</td>
</tr>
</tbody>
</table>
</div>
</td>
</tr>
</template>
</tbody>
</table>

## What's not here

This is a first batch (see [issue #282](https://github.com/enumeratio/enumeratio/issues/282)), not the full
surface. Deliberately excluded: every "generic dispatch" rank/unrank export in `packages/math` (the read
direction of a bijection whose SQL side is dispatched through `unrank(<collection>(...), r)`, not a separately
named identity) and a couple of ambiguous-shape cases where the only SQL counterpart is an enumerator rather than
a matching scalar function. [The API reference](/develop/api) documents the uniform generated surface every
collection shares regardless of curation here, and [the bijections page](/learn/explorations/bijections) tours
the registered `base_map` identities specifically.

<style>
.fn-toolbar { display: flex; align-items: center; gap: 0.75rem; margin: 1rem 0; }
.fn-search { flex: 1; max-width: 26rem; padding: 0.35rem 0.6rem; border: 1px solid var(--vp-c-divider);
             border-radius: 6px; background: var(--vp-c-bg); color: var(--vp-c-text-1); font-size: 0.9em; }
.fn-count { font-size: 0.8em; color: var(--vp-c-text-2); }
.fn-table { width: 100%; font-size: 0.9em; border-collapse: collapse; }
.fn-table th, .fn-table td { text-align: left; padding: 0.3rem 0.6rem; border-bottom: 1px solid var(--vp-c-divider); vertical-align: top; }
.fn-table th.sortable { cursor: pointer; user-select: none; }
.fn-table th.sortable:hover { color: var(--vp-c-brand-1); }
.fn-row { cursor: pointer; }
.fn-row:hover { background: var(--vp-c-bg-soft); }
.fn-title { font-size: 0.8em; color: var(--vp-c-text-2); }
.fn-none { color: var(--vp-c-text-3); }
.fn-yes { color: var(--p-amber-600, #d97706); font-weight: 700; }
.fn-badge { display: inline-block; font-size: 0.72em; text-transform: uppercase; letter-spacing: 0.02em;
            padding: 0.05em 0.4em; margin: 0 0.25em 0.2em 0; border-radius: 3px; border: 1px dashed var(--vp-c-divider);
            color: var(--vp-c-text-2); }
.fn-detail-row td { background: var(--vp-c-bg-soft); padding: 1rem 1.5rem; }
.fn-detail p { margin-top: 0; }
.fn-attrs { margin: 0.5rem 0 1rem; display: flex; flex-direction: column; gap: 0.3rem; }
.fn-attr a { margin-left: 0.5em; font-size: 0.85em; }
.fn-bodies { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 800px) { .fn-bodies { grid-template-columns: 1fr; } }
.fn-body-label { font-size: 0.85em; margin-bottom: 0.3rem; }
.fn-impl-note { font-size: 0.82em; color: var(--vp-c-text-2); margin: 0.2rem 0 0.4rem; }
.fn-body pre { margin: 0 0 0.5rem; max-height: 20rem; overflow: auto; font-size: 0.82em; }
.fn-refs { width: 100%; font-size: 0.85em; margin-top: 0.75rem; border-collapse: collapse; }
.fn-refs th, .fn-refs td { text-align: left; padding: 0.2rem 0.5rem; border-bottom: 1px solid var(--vp-c-divider); }
</style>
