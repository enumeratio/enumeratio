<script setup lang="ts">
// The QUERY VIEW — the row half of a collection statement as an editable sentence, and the table it yields.
//   SELECT * FROM [handle] WHERE [restriction] GROUP BY [axes | ROLLUP (…) | GROUPING SETS (…)] HAVING [lens] ORDER BY [keys]
// Every segment is one URL parameter holding its text (?from=&where=&group_by=&having=&order_by=); the client's
// planRows() turns the statement into accelerated requests and hands back the table plus the logical SQL it equals.
// The SELECT list is `?select=` — the column half (#205), edited in the Properties pane.
import { computed, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import StatementBar from './StatementBar.vue'
import RowTable from './RowTable.vue'
import NameThisPanel from './NameThisPanel.vue'
import { distributionOf } from './distribution'
import {
  provideDb, makeWorkerDb, collections as loadCollections, constructionNames as loadConstructions, planRows, planDeferred, rowQueryFromSearch, searchFromRowQuery,
  parseHandle, handleText, gradeChain, parseGroupBy, resolveFrom,
  type RowStatement, type RowTable as RowTableData,
} from '@enumeratio/client'

provideDb(() => makeWorkerDb())

const q = ref<RowStatement>(typeof location !== 'undefined' ? rowQueryFromSearch(location.search) : { from: '' })
const table = ref<RowTableData | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)
const colls = ref<string[]>([])
const count = ref(100)          // element window
const fiberLimit = ref(200)     // fiber window

let timer: ReturnType<typeof setTimeout> | undefined
function schedule() { clearTimeout(timer); timer = setTimeout(() => void run(), 400) }
async function run() {
  if (!q.value.from.trim()) { table.value = null; error.value = null; return }
  loading.value = true
  try {
    const win = { first: 0, count: count.value, fiberLimit: fiberLimit.value }
    const sel = { select: q.value.select }
    table.value = await planRows(q.value, win, sel)
    if (table.value.deferred.length) {   // §4: the heavy columns arrive by a keyed fetch for the rows in view
      const byAddr = new Map((await planDeferred(q.value, table.value.rows.map((r) => String(r.address)), win, sel)).map((r) => [String(r.address), r]))
      table.value = { ...table.value, rows: table.value.rows.map((r) => ({ ...r, ...(byAddr.get(String(r.address)) ?? {}) })) }
    }
    error.value = null
    history.replaceState({}, '', location.pathname + searchFromRowQuery(q.value))
  } catch (e) {
    error.value = (e as Error).message
  } finally { loading.value = false }
}
watch(q, schedule, { deep: true })
// the FROM datalist offers collections AND the FROM-able constructions (finsets_of(…), maps_of(…, …))
onMounted(async () => { const [c, k] = await Promise.all([loadCollections(), loadConstructions()]); colls.value = [...k.map((n) => `${n}(`), ...c]; void run() })

function more() {
  if (!table.value) return
  if (table.value.archetype === 'elements' || table.value.archetype === 'rowgroup') count.value += 100
  else fiberLimit.value += 200
  void run()
}

// ── descend: a fiber row's keys become BINDINGS in the FROM; those axes leave the GROUP BY ─────────────────────
async function descend(row: Record<string, unknown>) {
  const t = table.value
  if (!t) return
  const p = parseHandle(await resolveFrom(q.value.from))   // a construction-FROM descends through its realized collection
  const chain = await gradeChain(p.coll)
  const args: Record<string, number | [number, number]> = {}
  p.positional.forEach((v, i) => { if (chain[i]) args[chain[i]] = v as number | [number, number] })
  for (const [k, v] of Object.entries(p.named)) args[k] = v as number | [number, number]
  const bound: string[] = []
  for (const k of t.keys) if (row[k] != null && chain.includes(k)) { args[k] = Number(row[k]); bound.push(k) }
  if (!bound.length) return
  const rest = parseGroupBy(q.value.groupBy ?? '').sets[0].filter((k) => !bound.includes(k))
  q.value = { ...q.value, from: handleText(p.coll, args, chain), groupBy: rest.length ? rest.join(', ') : undefined, having: undefined }
}
function onRowClick(row: Record<string, unknown>) {
  if (table.value?.archetype === 'fibers') descend(row).catch((err: unknown) => { error.value = (err as Error).message })
}

const showName = ref(false)
// a distribution IS a counting sequence — draw it (#81); the toggle only shows when there is one
const showChart = ref(true)
const distribution = computed(() => distributionOf(table.value))
</script>

<template>
  <div class="qv">
    <header class="qv-head">
      <h1>Query</h1>
      <p class="lede">The row half of a statement — which rows exist, in what shape, in what order — as SQL you can run.
        <a href="/explore/collection/">Collection explorer</a> configures the columns.</p>
    </header>

    <StatementBar v-model="q" :table="table" :loading="loading" :error="error" :colls="colls" @more="more">
      <template #bar-pre>
        <Button v-if="distribution" size="small" text :label="showChart ? 'hide chart' : 'show chart'" icon="pi pi-chart-bar" @click="showChart = !showChart" />
      </template>
      <template #bar>
        <Button size="small" text :label="showName ? 'hide name' : 'name this'" icon="pi pi-tag" @click="showName = !showName" />
      </template>
    </StatementBar>

    <NameThisPanel v-if="showName" :query="q" />

    <RowTable :table="table" :loading="loading" :fromText="q.from" :distribution="showChart ? distribution : null" @rowClick="onRowClick">
      <template #empty><p v-if="!loading && !error" class="empty">No rows.</p></template>
    </RowTable>
  </div>
</template>

<style scoped>
.qv { max-width: 80rem; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; }
.qv-head h1 { margin: 0; font-size: 1.8rem; }
.lede { margin: 0.25rem 0 1rem; color: var(--e-color-text-muted, #666); max-width: 70ch; }
.empty { padding: 1rem; color: var(--e-color-text-muted, #666); }
</style>
