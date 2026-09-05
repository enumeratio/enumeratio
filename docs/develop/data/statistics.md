---
sidebar: false
aside: false
---

# Statistics reference — the FindStat-style catalog

<script setup>
import { data } from './statistics.data.ts'

const byCollection = new Map()
for (const s of data.stats) {
  if (!byCollection.has(s.collection)) byCollection.set(s.collection, { title: s.collectionTitle, carrier: s.carrier, stats: [] })
  byCollection.get(s.collection).stats.push(s)
}
const collections = [...byCollection.entries()].sort((a, b) => a[1].title.localeCompare(b[1].title))
</script>

A **statistic** (a "stat" in the [FindStat](https://www.findstat.org) sense) is a named per-element invariant — a
`value_fn(carrier) → codomain` registered against a collection in `base_stat`. Every collection's page below is
generated **from the registry itself** at docs-build time: [`docs/develop/data/statistics.data.ts`](https://github.com/enumeratio/enumeratio/blob/main/docs/develop/data/statistics.data.ts)
boots the pure-SQL core in [PGlite](https://pglite.dev), reads `base_stat`, and — where the stat carries a
`COMMENT ON FUNCTION` (sourced from `base_stat.title` by the `documentation.sql` pass, issue #147) — pulls its
description straight from `pg_description`. The worked examples are **live**: each stat's `value_fn` is applied to
the collection's own first couple of elements, so the numbers shown are computed on this build, not hand-typed.

::: tip At a glance
**{{ data.counts.stats }}** distinct stat ids across **{{ data.counts.collections }}** collections.
:::

No hand-written per-stat page exists — add a row to a collection's `.stats.sql` file (with a `title`) and it appears
here on the next build.

<div v-for="[id, c] in collections" :key="id" class="stat-group">

## {{ c.title }} <code class="stat-collection-id">{{ id }}</code>

Carrier: <code>{{ c.carrier }}</code>

<table class="stat-table">
<thead><tr><th>Stat</th><th>Description</th><th>Codomain</th><th>Examples</th></tr></thead>
<tbody>
<tr v-for="s in c.stats" :key="s.statId">
<td><code>{{ s.statId }}</code><br/><span class="stat-fn">{{ s.valueFn }}</span></td>
<td>{{ s.description ?? s.title ?? '—' }}</td>
<td><code>{{ s.codomain ?? '—' }}</code></td>
<td>
<span v-if="s.examples.length === 0">—</span>
<span v-for="(ex, i) in s.examples" :key="i" class="stat-example">
<code>{{ s.valueFn }}({{ ex.element }})</code> = <code>{{ ex.value }}</code><span v-if="i < s.examples.length - 1"><br/></span>
</span>
</td>
</tr>
</tbody>
</table>

</div>

<style>
.stat-collection-id { font-weight: normal; opacity: 0.6; font-size: 0.7em; margin-left: 0.5em; }
.stat-table { width: 100%; font-size: 0.9em; }
.stat-table td, .stat-table th { vertical-align: top; }
.stat-fn { opacity: 0.6; font-size: 0.85em; }
.stat-example { display: inline-block; }
</style>

## Generating this page

Every section, description, and worked example above comes from `base_stat` plus live evaluation — nothing here is
hand-listed. See [`docs/develop/data/statistics.data.ts`](https://github.com/enumeratio/enumeratio/blob/main/docs/develop/data/statistics.data.ts)
for the loader, and the [API reference](/develop/api)'s "Representations, stats & maps" section for how stats fit
into the rest of the generated surface.
