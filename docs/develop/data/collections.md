---
sidebar: false
aside: false
---

# Collections reference

<script setup>
import { ref, computed } from 'vue'
import { data } from './collections.data.ts'

const search = ref('')
const sortKey = ref('id')
const sortDir = ref(1)

function sortBy(key) {
  if (sortKey.value === key) sortDir.value *= -1
  else { sortKey.value = key; sortDir.value = 1 }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const rows = q
    ? data.rows.filter((r) => r.id.includes(q) || r.carrier.toLowerCase().includes(q) || (r.title ?? '').toLowerCase().includes(q))
    : data.rows
  const key = sortKey.value
  return [...rows].sort((a, b) => {
    const av = key === 'grades' ? a.grades.length : a[key]
    const bv = key === 'grades' ? b.grades.length : b[key]
    if (av < bv) return -1 * sortDir.value
    if (av > bv) return 1 * sortDir.value
    return 0
  })
})
</script>

A flat, sortable/filterable index of every collection in the registry — id, title, carrier, and grade axes — read
straight from `base_catalog` at build time by
[`collections.data.ts`](https://github.com/enumeratio/enumeratio/blob/main/docs/develop/data/collections.data.ts).
This is the code-docs-style spec sheet distinct from [the Atlas](/explore/) (a narrative map) and [the
Explorer](/explore/collection/) (an interactive browser) — this page is a lookup table, not a tour.

::: tip At a glance
**{{ data.count }}** collections registered.
:::

<div class="coll-toolbar">
  <input v-model="search" type="search" placeholder="Filter by id, title, or carrier…" class="coll-search" />
  <span class="coll-count">{{ filtered.length }} shown</span>
</div>

<table class="coll-table">
<thead>
<tr>
<th @click="sortBy('id')" class="sortable">id <span v-if="sortKey === 'id'">{{ sortDir > 0 ? '▲' : '▼' }}</span></th>
<th @click="sortBy('title')" class="sortable">title <span v-if="sortKey === 'title'">{{ sortDir > 0 ? '▲' : '▼' }}</span></th>
<th @click="sortBy('carrier')" class="sortable">carrier <span v-if="sortKey === 'carrier'">{{ sortDir > 0 ? '▲' : '▼' }}</span></th>
<th @click="sortBy('grades')" class="sortable">grades <span v-if="sortKey === 'grades'">{{ sortDir > 0 ? '▲' : '▼' }}</span></th>
</tr>
</thead>
<tbody>
<tr v-for="r in filtered" :key="r.id">
<td><a :href="`/explore/collection/${r.id}`"><code>{{ r.id }}</code></a>
<span v-if="r.unbounded" class="coll-unbounded" title="unbounded — infinite carrier">∞</span>
<span v-if="r.aliasOf" class="coll-alias">alias of <code>{{ r.aliasOf }}</code></span>
</td>
<td>{{ r.title ?? '—' }}</td>
<td><code>{{ r.carrier }}</code></td>
<td>
<span v-if="r.grades.length === 0" class="coll-none">—</span>
<code v-else v-for="(g, i) in r.grades" :key="g">{{ g }}<span v-if="i < r.grades.length - 1">, </span></code>
</td>
</tr>
</tbody>
</table>

## What's here vs. what's not

This is the flat index half of the original design — one row per collection, generated the same way
`statistics.md`/`api.md` are. **Not** built: a per-collection spec sheet at `/develop/data/collection/[id]`
(cardinality closed form, stats, maps, worked examples) — that needs a self-routing mounted app the same way
`/explore/collection/*` works, not a data-loader change, so it stays out of scope here. A collection's grade axes
are shown as names only; the closed-form cardinality as a function of those axes isn't queryable data (it's a
proof, not a registry row) and belongs on that future per-collection page instead.

<style>
.coll-toolbar { display: flex; align-items: center; gap: 0.75rem; margin: 1rem 0; }
.coll-search { flex: 1; max-width: 22rem; padding: 0.35rem 0.6rem; border: 1px solid var(--vp-c-divider);
               border-radius: 6px; background: var(--vp-c-bg); color: var(--vp-c-text-1); font-size: 0.9em; }
.coll-count { font-size: 0.8em; color: var(--vp-c-text-2); }
.coll-table { width: 100%; font-size: 0.9em; border-collapse: collapse; }
.coll-table th, .coll-table td { text-align: left; padding: 0.3rem 0.6rem; border-bottom: 1px solid var(--vp-c-divider); }
.coll-table th.sortable { cursor: pointer; user-select: none; white-space: nowrap; }
.coll-table th.sortable:hover { color: var(--vp-c-brand-1); }
.coll-none { color: var(--vp-c-text-3); }
.coll-unbounded { margin-left: 0.4em; color: var(--p-amber-500, #d97706); font-weight: 700; cursor: help; }
.coll-alias { display: block; font-size: 0.75em; color: var(--vp-c-text-3); }
</style>
