<script setup lang="ts">
// The SELECT-list editor — a PrimeVue DataTable of column rows. Each row is one column spec of the statement
// (#205: a position, the element, a repr, a statistic, a map image, the glyph, or a fiber-level aggregate): drag to reorder
// (which also reorders the elements-table columns), the ⋮ popover holds per-row config (format · header ·
// min-width · link), the eye toggles it as a column, ✕ removes it, "+ add column" appends. Controlled:
// modelValue is the PropRow[]. A fixed strip above previews the selected element's index / value / address.
// Ported (thinned) from the `numbers` precursor's FamilyProperties.vue; kept extensible for later phases.
import { computed, ref } from 'vue'
import katex from 'katex'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ColumnConfigPopover from './ColumnConfigPopover.vue'
import type { PropRow, PropDef } from './propRows'
import { nextPropRowUid } from './propRows'

const props = defineProps<{
  modelValue: PropRow[]
  defs: PropDef[]
  selRow: Record<string, unknown> | null
  selRank: number | null
  elementEnabled: boolean
  isTex: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [PropRow[]] }>()

const defById = (id: string) => props.defs.find((d) => d.id === id)
const texHtml = (s: unknown) => { try { return katex.renderToString(String(s ?? ''), { throwOnError: false, displayMode: false }) } catch { return String(s ?? '') } }
/** the codomain's SPECIFIC element (#181 — a bare codomain link was dead-ended: it never named which element the
 *  map actually reached), matching RowTable's own cellHref for the same map/through columns */
const mapHref = (codomain?: string | null, value?: unknown) =>
  (codomain && value != null ? `/explore/collection/${encodeURIComponent(codomain)}/${encodeURIComponent(String(value))}` : undefined)

// ---- fixed preview strip: the selected element's index / value / address (read-only) ----
const preview = computed(() => {
  if (!props.elementEnabled || !props.selRow) return null
  return { index: props.selRank, element: props.selRow.element, address: props.selRow.__address }
})

// ---- per-row value for the selected element ----
interface Rendered { text?: string; html?: string; href?: string; findstat?: string | null }
function renderRow(row: PropRow): Rendered {
  const d = defById(row.propId)
  if (!d || !props.elementEnabled || !props.selRow) return { text: '—' }
  const v = props.selRow[d.id]
  if (v == null) return { text: '—', findstat: d.findstatId }
  if (d.kind === 'map') return { text: String(v), href: mapHref(d.codomain, v), findstat: d.findstatId }
  const text = row.format === 'grouped' && typeof v === 'number' ? v.toLocaleString() : String(v)
  return { text, findstat: d.findstatId }
}
const view = computed(() => props.modelValue.map((row) => ({ uid: row.uid, row, def: defById(row.propId), r: renderRow(row) })))
const rowClass = (data: { row: PropRow }) => (data.row.visible ? '' : 'xprop-hidden')

// ---- mutations: all emit a fresh PropRow[] ----
const update = (rows: PropRow[]) => emit('update:modelValue', rows)
const patch = (uid: number, p: Partial<PropRow>) => update(props.modelValue.map((r) => (r.uid === uid ? { ...r, ...p } : r)))
const setVisible = (uid: number, v: boolean) => patch(uid, { visible: v })
const delRow = (uid: number) => update(props.modelValue.filter((r) => r.uid !== uid))
function addRow(id: string) {
  const d = defById(id); if (!d) return
  update([...props.modelValue, { uid: nextPropRowUid(), propId: id, format: d.formats[0], visible: true }])
}
function onReorder(e: { value: Array<{ row: PropRow }> }) { update(e.value.map((v) => v.row)) }

// ---- "+ add column" menu: the sources this archetype offers, grouped by kind (§5) ----
const addMenu = ref()
const usedIds = computed(() => new Set(props.modelValue.map((r) => r.propId)))
const addItems = computed(() => {
  const groups = new Map<string, { label: string; command: () => void }[]>()
  for (const d of props.defs) {
    if (usedIds.value.has(d.id)) continue
    groups.set(d.group, [...(groups.get(d.group) ?? []), { label: d.label, command: () => addRow(d.id) }])
  }
  return [...groups].map(([label, items]) => ({ label, items }))
})

// ---- per-row config popover (format · header · min-width · link), shared with the elements-table header (#62) ----
const cfgPop = ref()
function openCfg(ev: Event, uid: number) { cfgPop.value.open(ev, uid) }
</script>

<template>
  <div class="xprops">
    <!-- fixed preview of the selected element (read-only; column model lives in the rows below) -->
    <div class="xprop-sel" v-if="preview">
      <span class="xprop-sel-k">#{{ preview.index }}</span>
      <span v-if="isTex" class="xprop-sel-el" v-html="texHtml(preview.element)" />
      <span v-else class="xprop-sel-el">{{ preview.element }}</span>
      <span v-if="preview.address != null" class="xprop-sel-addr">@ {{ preview.address }}</span>
    </div>
    <p v-else class="xprop-sel xprop-empty">No element selected — pick a row to preview its properties.</p>

    <DataTable :value="view" dataKey="uid" @row-reorder="onReorder" :rowClass="rowClass" size="small" class="xprop-dt">
      <Column rowReorder headerStyle="width:2.2rem" bodyClass="xprop-c-grip" />
      <Column headerStyle="width:2.6rem" bodyClass="xprop-c-cfg">
        <template #body="{ data }">
          <Button icon="pi pi-sliders-h" size="small" variant="text" severity="secondary" rounded
                  @click="openCfg($event, data.row.uid)" v-tooltip.top="'format · header · width · link'" />
        </template>
      </Column>
      <Column headerStyle="width:2.6rem" bodyClass="xprop-c-eye">
        <template #body="{ data }">
          <Button :icon="data.row.visible ? 'pi pi-eye' : 'pi pi-eye-slash'" size="small" variant="text"
                  severity="secondary" rounded @click="setVisible(data.row.uid, !data.row.visible)"
                  v-tooltip.top="data.row.visible ? 'hide column' : 'show column'" />
        </template>
      </Column>
      <Column header="Property">
        <template #body="{ data }">
          <span class="xprop-name" :class="{ 'has-desc': data.def?.desc }" v-tooltip.top="data.def?.desc || undefined">{{ data.row.name || data.def?.label }}</span>
          <i v-if="data.def?.kind === 'map'" class="xprop-cod">→ {{ data.def?.codomain }}</i>
        </template>
      </Column>
      <Column header="Value" bodyClass="xprop-c-val">
        <template #body="{ data }">
          <a v-if="data.r.href && data.row.showLink !== false" :href="data.r.href" :data-via="data.def?.label" class="xprop-val xprop-link" @click.stop>{{ data.r.text }}</a>
          <span v-else class="xprop-val">{{ data.r.text }}</span>
          <a v-if="data.r.findstat" class="xprop-fs" :href="`https://www.findstat.org/${data.r.findstat}`" target="_blank" rel="noopener" v-tooltip.top="'FindStat entry'">{{ data.r.findstat }}</a>
        </template>
      </Column>
      <Column headerStyle="width:2.6rem" bodyClass="xprop-c-del">
        <template #body="{ data }">
          <Button icon="pi pi-times" size="small" variant="text" severity="secondary" rounded
                  @click="delRow(data.row.uid)" v-tooltip.top="'remove'" />
        </template>
      </Column>
    </DataTable>

    <ColumnConfigPopover ref="cfgPop" :rows="modelValue" :defs="defs" @patch="patch" />

    <div class="xprop-add">
      <Button icon="pi pi-plus" label="add column" size="small" variant="text" severity="secondary"
              :disabled="!addItems.length" @click="addMenu.toggle($event)" aria-haspopup="true" />
      <Menu ref="addMenu" :model="addItems" popup />
    </div>
  </div>
</template>

<style scoped>
.xprops { display: flex; flex-direction: column; }
.xprop-sel { display: flex; align-items: baseline; gap: 0.6rem; padding: 0.2rem 0.1rem 0.5rem; flex-wrap: wrap; }
.xprop-sel-k { font-family: var(--font-mono, monospace); color: var(--p-text-muted-color); font-variant-numeric: tabular-nums; }
.xprop-sel-el { font-family: var(--font-mono, monospace); font-weight: 600; }
.xprop-sel-addr { font-family: var(--font-mono, monospace); color: var(--p-text-muted-color); font-size: 0.85em; }
.xprop-empty { color: var(--p-text-muted-color); }
/* compact, quiet table for the config panel */
.xprop-dt :deep(.p-datatable-tbody > tr > td) { padding: 0.15rem 0.5rem; }
.xprop-dt :deep(.p-datatable-thead > tr > th) { padding: 0.2rem 0.5rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.55; }
.xprop-dt :deep(tr.xprop-hidden) { opacity: 0.45; }
.xprop-dt :deep(.xprop-c-grip) { cursor: grab; }
.xprop-dt :deep(.p-datatable-row-reorder-icon) { opacity: 0.4; }
.xprop-name { font-size: 0.8rem; font-weight: 600; opacity: 0.78; }
.xprop-name.has-desc { cursor: help; }
.xprop-cod { margin-left: 0.4rem; font-size: 0.72rem; opacity: 0.5; font-style: italic; }
.xprop-val { font-family: var(--font-mono, monospace); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.xprop-link { color: var(--p-primary-color); text-decoration: none; }
.xprop-link:hover { text-decoration: underline; }
.xprop-fs { margin-left: 0.4rem; font-size: 0.65rem; opacity: 0.4; text-decoration: none; font-family: var(--font-mono, monospace); }
.xprop-fs:hover { opacity: 0.8; }
.xprop-add { margin-top: 0.4rem; }
</style>
