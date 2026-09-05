<script setup lang="ts">
// The general references table: one row per subject (a collection, stat, or map), one column per external
// system — a reorderable/toggleable comparison matrix (DataTable + MultiSelect) with a row-kind filter and
// URL-synced state. State (visible systems + visible kinds) round-trips through the querystring so an external
// site can deep-link into a pre-filtered view, e.g. `?systems=findstat&kinds=map` for FindStat's own maps page.
import { ref, computed, onMounted, watch } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import MultiSelect from 'primevue/multiselect'

const props = defineProps<{
  systems: string[]
  kinds: string[]
  rows: {
    subjectKind: string
    subject: string
    cells: Record<string, { identity: string; url: string | null; delta: string; relation: string } | null>
  }[]
}>()

const SYSTEM_LABELS: Record<string, string> = {
  sage: 'Sage', mathlib4: 'mathlib4', wolfram: 'Wolfram Language', sympy: 'SymPy', matlab: 'MATLAB',
  oeis: 'OEIS', findstat: 'FindStat', wikipedia: 'Wikipedia',
}
const systemLabel = (s: string) => SYSTEM_LABELS[s] ?? s

const KIND_LABELS: Record<string, string> = {
  collection: 'Collections', stat: 'Stats', map: 'Maps',
  construction: 'Constructions', carrier: 'Carriers', operation: 'Operations', structure: 'Structures',
}
const kindLabel = (k: string) => KIND_LABELS[k] ?? k

const RELATION_TITLES: Record<string, string> = {
  isomorphic: 'isomorphic — same object, order-isomorphic or a straight bijection',
  partial: 'partial — a predicate/filter on a bigger external class, not the class itself',
  aggregate: 'aggregate — a cardinality-only coincidence, not the same combinatorial object',
  conceptual: 'conceptual — a soft grounding association, not a structural claim',
}

const visibleSystems = ref<string[]>([...props.systems])
const visibleKinds = ref<string[]>([...props.kinds])
const shownSystems = computed(() => props.systems.filter((s) => visibleSystems.value.includes(s)))
const shownRows = computed(() => props.rows.filter((r) => visibleKinds.value.includes(r.subjectKind)))

let syncing = false // guard against the mount-time seed round-tripping straight back into a history write

onMounted(() => {
  const params = new URLSearchParams(location.search)
  const qSystems = params.get('systems')
  const qKinds = params.get('kinds')
  syncing = true
  if (qSystems) visibleSystems.value = qSystems.split(',').filter((s) => props.systems.includes(s))
  if (qKinds) visibleKinds.value = qKinds.split(',').filter((k) => props.kinds.includes(k))
  syncing = false
})

watch([visibleSystems, visibleKinds], ([systems, kinds]) => {
  if (syncing) return
  const params = new URLSearchParams(location.search)
  systems.length === props.systems.length ? params.delete('systems') : params.set('systems', systems.join(','))
  kinds.length === props.kinds.length ? params.delete('kinds') : params.set('kinds', kinds.join(','))
  const qs = params.toString()
  history.replaceState(null, '', qs ? `${location.pathname}?${qs}` : location.pathname)
}, { deep: true })

// subject/map/stat rows are keyed `<collection>.<id>` (base_map/base_stat convention) — link to the owning
// collection until per-stat/map reference pages exist.
function subjectHref(row: { subjectKind: string; subject: string }): string | null {
  if (row.subjectKind === 'collection') return `/explore/collection/${row.subject}`
  if (row.subjectKind === 'stat' || row.subjectKind === 'map') {
    const [collection] = row.subject.split('.')
    return `/explore/collection/${collection}`
  }
  return null
}
</script>

<template>
  <div class="assoc-toolbar">
    <MultiSelect v-model="visibleKinds" :options="kinds" :option-label="kindLabel" display="chip"
                 placeholder="Rows" size="small" />
    <MultiSelect v-model="visibleSystems" :options="systems" :option-label="systemLabel" display="chip"
                 placeholder="Columns" size="small" />
    <span class="assoc-hint">drag a column header to reorder</span>
  </div>
  <DataTable :value="shownRows" reorderable-columns size="small" scrollable scroll-height="32rem" class="assoc-table">
    <Column field="subject" header="Subject" frozen>
      <template #body="{ data }">
        <span v-if="kinds.length > 1" class="assoc-kind">{{ data.subjectKind }}</span>
        <a v-if="subjectHref(data)" :href="subjectHref(data)!"><code>{{ data.subject }}</code></a>
        <code v-else>{{ data.subject }}</code>
      </template>
    </Column>
    <Column v-for="sys in shownSystems" :key="sys" :field="sys" :header="systemLabel(sys)">
      <template #body="{ data }">
        <span v-if="!data.cells[sys]" class="assoc-none">—</span>
        <template v-else>
          <a v-if="data.cells[sys].url" :href="data.cells[sys].url" target="_blank" rel="noopener">
            <code>{{ data.cells[sys].identity }}</code></a>
          <code v-else>{{ data.cells[sys].identity }}</code>
          <span v-if="data.cells[sys].relation !== 'isomorphic'" class="assoc-relation"
                :class="`assoc-relation--${data.cells[sys].relation}`" :title="RELATION_TITLES[data.cells[sys].relation]">
            {{ data.cells[sys].relation }}</span>
          <span v-if="data.cells[sys].delta" class="assoc-delta" :title="data.cells[sys].delta">Δ</span>
        </template>
      </template>
    </Column>
  </DataTable>
</template>

<style scoped>
.assoc-toolbar { display: flex; align-items: center; gap: 0.75rem; margin: 0.75rem 0; flex-wrap: wrap; }
.assoc-hint { font-size: 0.8em; color: var(--vp-c-text-2); }
.assoc-none { color: var(--vp-c-text-3); }
.assoc-kind { display: inline-block; font-size: 0.7em; text-transform: uppercase; letter-spacing: 0.03em;
              color: var(--vp-c-text-3); margin-right: 0.4em; }
.assoc-delta { margin-left: 0.3em; color: var(--p-amber-500, #d97706); font-weight: 700; cursor: help; }
.assoc-relation { margin-left: 0.4em; font-size: 0.7em; text-transform: uppercase; letter-spacing: 0.02em;
                   padding: 0.05em 0.35em; border-radius: 3px; cursor: help; border: 1px dashed var(--vp-c-divider); }
.assoc-relation--aggregate { color: var(--p-amber-600, #d97706); border-color: var(--p-amber-500, #d97706); }
.assoc-relation--partial { color: var(--vp-c-text-2); }
.assoc-relation--conceptual { color: var(--vp-c-text-3); }
.assoc-table :deep(code) { font-size: 0.85em; }
</style>
