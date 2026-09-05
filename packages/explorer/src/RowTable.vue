<script setup lang="ts">
// The TABLE a statement yields — one component per archetype: a rollup becomes a TreeTable over the grouping-set
// levels, a rowgroup a DataTable with per-fiber subheaders, everything else a flat DataTable of the planner's own
// columns. Purely a renderer: it owns no query state, and a row click is reported for the owner to act on (descend a
// fiber, select an element).
import { computed, ref, watch } from 'vue'
import katex from 'katex'
import DataTable, { type DataTableSortMeta } from 'primevue/datatable'
import TreeTable from 'primevue/treetable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import { printersFor, type ColumnKind, type Literal, type Pred, type RowTable } from '@enumeratio/client'
import type { Distribution } from './distribution'
import type { PropDef, PropRow } from './propRows'

const props = defineProps<{
  table: RowTable | null
  loading?: boolean
  /** the FROM text — labels the rollup's root row */
  fromText?: string
  /** the distribution histogram to draw above the table (#81); null = none / hidden */
  distribution?: Distribution | null
  /** eager mode: the header and the column menu EDIT the statement (one-way — no reverse mirror) */
  sortable?: boolean
  filterable?: boolean
  /** the `element` cell links into the collection explorer (the `collections` meta table drills) */
  drillElements?: boolean
  /** per-column printer config, by column id — format · header · width · link (presentation, kept local) */
  printers?: Record<string, PropRow>
  /** the column defs, for a header override and a link's codomain */
  defs?: PropDef[]
}>()
const emit = defineEmits<{
  rowClick: [Record<string, unknown>]
  /** an ORDER BY the header click wrote */
  sort: [string]
  /** WHERE terms the column menu wrote */
  filter: [Pred[]]
}>()
function onRowClick(e: { data: Record<string, unknown> }) { emit('rowClick', e.data) }

const numericKinds = new Set(['axis', 'rank', 'ordinality', 'stat', 'count', 'level', 'agg', 'pivot', 'over'])   // address / omega are text, set in mono
const columns = computed(() => props.table?.columns ?? [])
function fmt(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString() : String(v)
  return String(v)
}

// ── printers: how a cell is DRAWN (§2). The source decides what the cell holds; this decides how it reads. The
// printer per column comes from the owner's local config; absent, the column's kind picks the obvious one.
const cfgOf = (id: string): PropRow | undefined => props.printers?.[id]
const defOf = (id: string) => props.defs?.find((d) => d.id === id)
const headerOf = (id: string) => cfgOf(id)?.name || id
const widthOf = (c: { id: string; kind: string }) => {
  const w = cfgOf(c.id)?.width
  return w ? `min-width: ${w}px` : c.kind === 'element' || c.kind === 'dist' ? 'min-width: 9rem' : 'min-width: 5rem'
}
// no chosen printer = the first one this environment grants the column's kind (§9). `level` is the rollup's own
// GROUPING() column, not a source — it prints plain.
const printerOf = (c: { id: string; kind: ColumnKind }) => cfgOf(c.id)?.format ?? (c.kind === 'level' ? 'plain' : printersFor(c.kind)[0])
const texHtml = (v: unknown) => { try { return katex.renderToString(String(v ?? ''), { throwOnError: false, displayMode: false }) } catch { return String(v ?? '') } }
/** a `map:` / `through:` image links to its element in the CODOMAIN's own page; `title` to the named collection */
function cellHref(c: { id: string; kind: string }, v: unknown): string | undefined {
  if (v == null || cfgOf(c.id)?.showLink === false) return undefined
  const codomain = defOf(c.id)?.codomain
  if ((c.kind === 'map' || c.kind === 'through') && codomain) return `/explore/collection/${encodeURIComponent(codomain)}/${encodeURIComponent(String(v))}`
  return undefined
}
const grouped = (v: unknown) => (v == null || v === '' ? '' : Number.isFinite(Number(v)) ? Number(v).toLocaleString() : fmt(v))
/** a `dist:` cell is the pg array text `{1,11,11,1}` — the distribution as ONE cell, drawn as a bar row (fork 8d) */
function bars(v: unknown): { n: number; h: number }[] {
  const xs = String(v ?? '').replace(/^\{|\}$/g, '').split(',').map(Number).filter((x) => Number.isFinite(x))
  const max = Math.max(1, ...xs)
  return xs.map((n) => ({ n, h: Math.max(6, Math.round((n / max) * 100)) }))
}

// rollup → TreeTable nodes: a row's key path is its non-null keys; its parent is the row with one fewer.
type Node = { key: string; data: Record<string, unknown>; children?: Node[]; leaf?: boolean }
const tree = computed<Node[]>(() => {
  const t = props.table
  if (!t || t.archetype !== 'rollup') return []
  const byPath = new Map<string, Node>()
  const roots: Node[] = []
  for (const r of t.rows) {
    const path = t.keys.map((k) => r[k]).filter((v) => v != null).map(String)
    const label = path.length ? `${t.keys[path.length - 1]} = ${path[path.length - 1]}` : `${props.fromText} · all`
    byPath.set(JSON.stringify(path), { key: path.join('.') || '()', data: { ...r, label }, children: [] })
  }
  for (const [p, node] of byPath) {
    const path = JSON.parse(p) as string[]
    const parent = path.length ? byPath.get(JSON.stringify(path.slice(0, -1))) : undefined
    if (parent) parent.children!.push(node); else roots.push(node)
  }
  for (const n of byPath.values()) if (!n.children!.length) { n.leaf = true; delete n.children }
  return roots
})
/** the rollup's own columns — `level` is the tree's shape, drawn as the hierarchy rather than a cell */
const treeColumns = computed(() => columns.value.filter((c) => c.kind !== 'level'))
const expanded = ref<Record<string, boolean>>({})
watch(tree, (t) => { expanded.value = Object.fromEntries(t.map((n) => [n.key, true])) })

// ── one-way editors: the table's controls WRITE clauses, they never mirror them back ──────────────────────────
// The DataTable runs `lazy`, so PrimeVue emits the interaction and reorders/filters nothing itself — the statement is
// the only state, and the rows come back from the planner in the order the statement asks for.
const sortableKinds = new Set(['axis', 'rank', 'address', 'ordinality', 'element', 'stat', 'map'])
const canSort = (kind: string) => !!props.sortable && sortableKinds.has(kind)
function onSort(e: { multiSortMeta?: DataTableSortMeta[]; sortField?: unknown; sortOrder?: number | null }) {
  const meta = e.multiSortMeta ?? (e.sortField ? [{ field: String(e.sortField), order: e.sortOrder ?? 1 }] : [])
  emit('sort', meta.map((m) => `${ident(String(m.field))}${(m.order ?? 1) < 0 ? ' DESC' : ''}`).join(', '))
}
const ident = (s: string) => (/^[a-z_][a-z0-9_]*$/.test(s) ? s : `"${s.replace(/"/g, '""')}"`)

// the filter menu is a term BUILDER: applying one writes chips into WHERE and clears itself, so it never accumulates
// a second filter state beside the chips.
type Constraint = { value: unknown; matchMode: string }
type FilterMeta = { operator: 'and' | 'or'; constraints: Constraint[] }
const filterCols = computed(() => columns.value.filter((c) => props.filterable && c.kind !== 'map'))
// a stat can be TEXT (`carrier` on the collections meta-collection), so the kind is only the fallback — the loaded
// rows are the evidence, and they pick the match modes, the input widget, and how the literal is spelled
const colTypes = computed<Record<string, 'numeric' | 'text'>>(() => {
  const t: Record<string, 'numeric' | 'text'> = {}
  for (const c of columns.value) {
    let ty: 'numeric' | 'text' = numericKinds.has(c.kind) ? 'numeric' : 'text'
    for (const r of props.table?.rows ?? []) { const v = r[c.id]; if (v != null) { ty = typeof v === 'number' ? 'numeric' : 'text'; break } }
    t[c.id] = ty
  }
  return t
})
const isNumeric = (id: string) => colTypes.value[id] === 'numeric'
const numericModes = [
  { label: 'equals', value: 'equals' }, { label: 'not equals', value: 'notEquals' },
  { label: 'less than', value: 'lt' }, { label: 'less or equal', value: 'lte' },
  { label: 'greater than', value: 'gt' }, { label: 'greater or equal', value: 'gte' },
  { label: 'between', value: 'between' },
]
const textModes = [
  { label: 'contains', value: 'contains' }, { label: 'not contains', value: 'notContains' },
  { label: 'starts with', value: 'startsWith' }, { label: 'ends with', value: 'endsWith' },
  { label: 'equals', value: 'equals' }, { label: 'not equals', value: 'notEquals' },
]
const modesFor = (id: string) => (isNumeric(id) ? numericModes : textModes)
const blankFilters = (): Record<string, FilterMeta> => Object.fromEntries(
  filterCols.value.map((c) => [c.id, { operator: 'and', constraints: [{ value: null, matchMode: isNumeric(c.id) ? 'equals' : 'contains' }] }]))
const filters = ref<Record<string, FilterMeta>>({})
watch([filterCols, colTypes], () => { filters.value = blankFilters() }, { immediate: true })

type CmpOp = '=' | '<>' | '<' | '<=' | '>' | '>='
const CMP: Record<string, CmpOp> = { equals: '=', notEquals: '<>', lt: '<', lte: '<=', gt: '>', gte: '>=' }
function toPred(col: string, c: Constraint): Pred | null {
  const v = c.value
  if (v == null || v === '') return null
  if (c.matchMode === 'between') { const a = Array.isArray(v) ? v : []; return a[0] == null || a[1] == null ? null : { op: 'between', col, value: [Number(a[0]), Number(a[1])] } }
  if (CMP[c.matchMode]) return { op: CMP[c.matchMode], col, value: (isNumeric(col) ? Number(v) : String(v)) as Literal }
  const pat = String(v).replace(/[\\%_]/g, (ch) => '\\' + ch)
  switch (c.matchMode) {
    case 'contains': return { op: 'ilike', col, value: `%${pat}%` }
    case 'notContains': return { op: 'not ilike', col, value: `%${pat}%` }
    case 'startsWith': return { op: 'ilike', col, value: `${pat}%` }
    case 'endsWith': return { op: 'ilike', col, value: `%${pat}` }
    default: return null
  }
}
function onFilter(e: { filters: unknown }) {
  const out: Pred[] = []
  for (const [col, meta] of Object.entries((e.filters ?? {}) as Record<string, FilterMeta>))
    for (const c of meta?.constraints ?? []) { const p = toPred(col, c); if (p) out.push(p) }
  filters.value = blankFilters()   // the menu is an input, not a state — reset it once its terms are written
  if (out.length) emit('filter', out)
}

// rowgroup subheaders: the fiber subtotal for a group key
const subtotalOf = computed(() => {
  const m = new Map<string, Record<string, unknown>>()
  for (const r of props.table?.subtotals ?? []) m.set(props.table!.keys.map((k) => String(r[k])).join('.'), r)
  return m
})
</script>

<template>
  <div v-if="distribution" class="hist">
    <div v-for="f in distribution.facets" :key="f.label || '_'" class="hist-row">
      <span class="hist-label">{{ f.label || distribution.statId }}</span>
      <div class="hist-bars">
        <div v-for="v in distribution.values" :key="v" class="hist-bar" :title="`${distribution.statId} = ${v}: ${f.byValue.get(v)?.toLocaleString() ?? 0}`">
          <span class="hist-count">{{ f.byValue.get(v) ?? '' }}</span>
          <div class="hist-fill" :style="{ height: (((f.byValue.get(v) ?? 0) / distribution.max) * 100) + '%' }" />
          <span class="hist-val">{{ v }}</span>
        </div>
      </div>
      <span class="hist-total">Σ {{ f.total.toLocaleString() }}</span>
    </div>
  </div>

  <TreeTable v-if="table?.archetype === 'rollup'" :value="tree" v-model:expandedKeys="expanded" :loading="loading"
             scrollable scrollHeight="70vh" size="small" class="qt tt">
    <Column field="label" header="" expander style="min-width: 14rem">
      <template #body="{ node }"><span :class="node.leaf ? 'leaf' : 'grp'">{{ node.data.label }}</span></template>
    </Column>
    <!-- a rollup row carries the columns of ITS level; the other levels' cells are NULL (C10) -->
    <Column v-for="c in treeColumns" :key="c.id" :field="c.id" :header="headerOf(c.id)"
            :class="[c.kind, numericKinds.has(c.kind) ? 'numr' : '', c.kind === 'count' ? 'count' : '']"
            :style="widthOf(c)">
      <template #body="{ node }">
        <span v-if="printerOf(c) === 'bars' && node.data[c.id] != null" class="cellbars" :title="String(node.data[c.id])">
          <i v-for="(b, i) in bars(node.data[c.id])" :key="i" :style="{ height: b.h + '%' }" :title="String(b.n)" />
        </span>
        <span v-else-if="printerOf(c) === 'grouped'">{{ grouped(node.data[c.id]) }}</span>
        <span v-else>{{ fmt(node.data[c.id]) }}</span>
      </template>
    </Column>
  </TreeTable>

  <DataTable v-else-if="table" :value="table.rows" :loading="loading" scrollable scrollHeight="70vh" size="small" class="qt"
             :class="{ fibers: table.archetype === 'fibers' }"
             lazy
             :sortMode="sortable ? 'multiple' : undefined" :removableSort="sortable" @sort="onSort"
             :filterDisplay="filterable ? 'menu' : undefined" v-model:filters="filters" @filter="onFilter"
             :rowGroupMode="table.archetype === 'rowgroup' ? 'subheader' : undefined"
             :groupRowsBy="table.archetype === 'rowgroup' ? '__group' : undefined"
             @row-click="onRowClick">
    <Column v-for="c in columns" :key="c.id" :field="c.id" :header="headerOf(c.id)"
            :sortable="canSort(c.kind)"
            :showFilterMatchModes="true" :filterMatchModeOptions="modesFor(c.id)"
            :class="[c.kind, numericKinds.has(c.kind) ? 'numr' : '']"
            :frozen="c.kind === 'ordinality' || c.kind === 'address' || c.kind === 'element'"
            :style="widthOf(c)">
      <template v-if="filterable && c.kind !== 'map'" #filter="{ filterModel }">
        <template v-if="isNumeric(c.id) && filterModel.matchMode === 'between'">
          <InputNumber :modelValue="(filterModel.value as number[] | null)?.[0] ?? null" placeholder="min" size="small" class="colfilter"
                       @update:modelValue="(v) => (filterModel.value = [v, (filterModel.value as number[] | null)?.[1] ?? null])" />
          <InputNumber :modelValue="(filterModel.value as number[] | null)?.[1] ?? null" placeholder="max" size="small" class="colfilter"
                       @update:modelValue="(v) => (filterModel.value = [(filterModel.value as number[] | null)?.[0] ?? null, v])" />
        </template>
        <InputNumber v-else-if="isNumeric(c.id)" :modelValue="(filterModel.value as number) ?? null" size="small" class="colfilter"
                     @update:modelValue="(v) => (filterModel.value = v)" />
        <InputText v-else :modelValue="(filterModel.value as string) ?? ''" size="small" class="colfilter"
                   @update:modelValue="(v) => (filterModel.value = v || null)" />
      </template>
      <template #body="{ data }">
        <a v-if="drillElements && c.kind === 'element' && data[c.id] != null" :href="`/explore/collection/${encodeURIComponent(String(data[c.id]))}`"
           class="drill" :title="String(data[c.id])" @click.stop>{{ fmt(data[c.id]) }}</a>
        <a v-else-if="printerOf(c) === 'link' && cellHref(c, data[c.id])" :href="cellHref(c, data[c.id])" class="drill"
           :title="String(data[c.id])" @click.stop>{{ fmt(data[c.id]) }}</a>
        <span v-else-if="printerOf(c) === 'katex'" class="tex" v-html="texHtml(data[c.id])" />
        <span v-else-if="printerOf(c) === 'svg'" class="cellsvg" v-html="String(data[c.id] ?? '')" />
        <span v-else-if="printerOf(c) === 'bars' && data[c.id] != null" class="cellbars" :title="String(data[c.id])">
          <i v-for="(b, i) in bars(data[c.id])" :key="i" :style="{ height: b.h + '%' }" :title="String(b.n)" />
        </span>
        <span v-else-if="printerOf(c) === 'grouped'" :title="String(data[c.id] ?? '')">{{ grouped(data[c.id]) }}</span>
        <span v-else :title="String(data[c.id] ?? '')">{{ fmt(data[c.id]) }}</span>
      </template>
    </Column>
    <template v-if="table.archetype === 'rowgroup'" #groupheader="{ data }">
      <span class="ghdr">{{ table.keys.map((k) => `${k} = ${data[k]}`).join(', ') }}</span>
      <span class="gcount">{{ fmt(subtotalOf.get(String(data.__group))?.count) }} elements</span>
    </template>
    <template #empty><slot name="empty" /></template>
  </DataTable>
</template>

<style scoped>
.hist { border: 1px solid var(--e-color-border, #ddd); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 0.75rem; overflow-x: auto; background: var(--e-color-bg-soft, #f6f4f0); }
.hist-row { display: flex; align-items: flex-end; gap: 0.75rem; padding-block: 0.4rem; }
.hist-row + .hist-row { border-top: 1px solid var(--e-color-border, #ddd); }
.hist-label { flex: 0 0 auto; min-width: 6rem; font: 0.78rem var(--e-font-mono, ui-monospace, monospace); color: var(--e-color-text-muted, #666); align-self: center; }
.hist-bars { display: flex; align-items: flex-end; gap: 3px; height: 6rem; }
.hist-bar { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; width: 1.6rem; height: 100%; }
.hist-count { font-size: 0.62rem; color: var(--e-color-text-subtle, #888); font-variant-numeric: tabular-nums; min-height: 0.9em; }
.hist-fill { width: 100%; min-height: 2px; background: var(--p-primary-color); border-radius: 3px 3px 0 0; }
.hist-val { font-size: 0.68rem; color: var(--e-color-text-muted, #666); font-variant-numeric: tabular-nums; margin-top: 0.2rem; }
.hist-total { flex: 0 0 auto; font-size: 0.78rem; font-variant-numeric: tabular-nums; color: var(--e-color-text-muted, #666); align-self: center; }
.qt :deep(.p-datatable-tbody > tr > td), .tt :deep(td) { height: 34px !important; padding-block: 0 !important; }
.qt :deep(.numr), .tt :deep(.numr) { text-align: right; font-variant-numeric: tabular-nums; }
.qt :deep(th.numr .p-datatable-column-header-content) { justify-content: flex-end; }
.qt :deep(.ordinality), .qt :deep(.rank) { opacity: 0.6; }
.qt :deep(.element), .qt :deep(.address), .qt :deep(.omega) { font-family: var(--e-font-mono, ui-monospace, monospace); }
.qt :deep(.address) { text-align: right; font-variant-numeric: tabular-nums; opacity: 0.8; }
.qt.fibers :deep(.p-datatable-tbody > tr) { cursor: pointer; }
.qt :deep(.p-datatable-row-group-header > td) { background: var(--p-content-hover-background); }
.ghdr { font-weight: 600; color: var(--p-primary-color); margin-right: 0.75rem; }
.gcount { color: var(--e-color-text-muted, #666); font-variant-numeric: tabular-nums; }
.tt :deep(.count) { font-weight: 600; }
.grp { font-weight: 600; color: var(--p-primary-color); }
.leaf { font-family: var(--e-font-mono, ui-monospace, monospace); }
.drill { color: var(--p-primary-color); text-decoration: none; font-weight: 600; }
.tex { font-size: 0.95em; }
.cellsvg :deep(svg) { height: 26px; width: auto; vertical-align: middle; }
.cellbars { display: inline-flex; align-items: flex-end; gap: 2px; height: 22px; }
.cellbars i { display: block; width: 6px; min-height: 2px; background: var(--p-primary-color); border-radius: 2px 2px 0 0; }
.drill:hover { text-decoration: underline; }
.colfilter { width: 100%; }
</style>
