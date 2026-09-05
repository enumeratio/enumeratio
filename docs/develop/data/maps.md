---
sidebar: false
aside: false
---

# Maps reference

<script setup>
import { ref, computed } from 'vue'
import { data } from './maps.data.ts'

const search = ref('')
const sortKey = ref('collection')
const sortDir = ref(1)

function sortBy(key) {
  if (sortKey.value === key) sortDir.value *= -1
  else { sortKey.value = key; sortDir.value = 1 }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const rows = q
    ? data.rows.filter((r) =>
        r.collection.includes(q) || r.mapId.includes(q) || r.codomain.toLowerCase().includes(q) ||
        (r.title ?? '').toLowerCase().includes(q))
    : data.rows
  const key = sortKey.value
  return [...rows].sort((a, b) => {
    const av = a[key], bv = b[key]
    if (av === bv) return 0
    if (av === null || av === false) return 1 * sortDir.value
    if (bv === null || bv === false) return -1 * sortDir.value
    return (av < bv ? -1 : 1) * sortDir.value
  })
})
</script>

A spec sheet per registered `base_map` (bijection/morphism) — source, codomain, whether it's a bijection or
order-isomorphism, its inverse when named, and a FindStat cross-reference when curated. Generated at build time by
[`maps.data.ts`](https://github.com/enumeratio/enumeratio/blob/main/docs/develop/data/maps.data.ts) reading the
registry directly, the same pattern as [the collections index](/develop/data/collections). For the essay tour of a
handful of notable ones, see [Bijections](/learn/explorations/bijections); for every registered map id grouped by
collection, see [the API reference](/develop/api#representations-stats-maps-—-the-catalog-facets).

::: tip At a glance
**{{ data.count }}** registered maps, **{{ data.bijectionCount }}** of them bijections.
:::

<div class="maps-toolbar">
  <input v-model="search" type="search" placeholder="Filter by collection, map id, codomain, or title…" class="maps-search" />
  <span class="maps-count">{{ filtered.length }} shown</span>
</div>

<table class="maps-table">
<thead>
<tr>
<th @click="sortBy('collection')" class="sortable">collection <span v-if="sortKey === 'collection'">{{ sortDir > 0 ? '▲' : '▼' }}</span></th>
<th @click="sortBy('mapId')" class="sortable">map <span v-if="sortKey === 'mapId'">{{ sortDir > 0 ? '▲' : '▼' }}</span></th>
<th>codomain</th>
<th @click="sortBy('isBijection')" class="sortable">bijection <span v-if="sortKey === 'isBijection'">{{ sortDir > 0 ? '▲' : '▼' }}</span></th>
<th @click="sortBy('isOrderIso')" class="sortable">order-iso <span v-if="sortKey === 'isOrderIso'">{{ sortDir > 0 ? '▲' : '▼' }}</span></th>
<th>inverse</th>
<th>findstat</th>
</tr>
</thead>
<tbody>
<tr v-for="r in filtered" :key="`${r.collection}.${r.mapId}`">
<td><a :href="`/explore/collection/${r.collection}`"><code>{{ r.collection }}</code></a></td>
<td><code>{{ r.mapId }}</code><br/><span v-if="r.title" class="maps-title">{{ r.title }}</span></td>
<td><code>{{ r.codomain }}</code></td>
<td>{{ r.isBijection ? '✓' : '—' }}</td>
<td>{{ r.isOrderIso ? '✓' : '—' }}</td>
<td><code v-if="r.inverse">{{ r.inverse }}</code><span v-else class="maps-none">—</span></td>
<td>
<a v-if="r.findstat" :href="`https://www.findstat.org/${r.findstat}`" target="_blank" rel="noopener"><code>{{ r.findstat }}</code></a>
<span v-else class="maps-none">—</span>
</td>
</tr>
</tbody>
</table>

<style>
.maps-toolbar { display: flex; align-items: center; gap: 0.75rem; margin: 1rem 0; }
.maps-search { flex: 1; max-width: 24rem; padding: 0.35rem 0.6rem; border: 1px solid var(--vp-c-divider);
               border-radius: 6px; background: var(--vp-c-bg); color: var(--vp-c-text-1); font-size: 0.9em; }
.maps-count { font-size: 0.8em; color: var(--vp-c-text-2); }
.maps-table { width: 100%; font-size: 0.88em; border-collapse: collapse; }
.maps-table th, .maps-table td { text-align: left; padding: 0.3rem 0.6rem; border-bottom: 1px solid var(--vp-c-divider); vertical-align: top; }
.maps-table th.sortable { cursor: pointer; user-select: none; white-space: nowrap; }
.maps-table th.sortable:hover { color: var(--vp-c-brand-1); }
.maps-none { color: var(--vp-c-text-3); }
.maps-title { font-size: 0.85em; color: var(--vp-c-text-2); }
</style>
