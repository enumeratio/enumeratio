<script setup lang="ts">
// The STATEMENT — a collection's row half as an editable sentence, shared by the query view (FROM free) and the
// collection explorer (FROM pinned to a named collection). Each segment holds one clause's TEXT, exactly what the URL
// carries and what planRows() reads; WHERE and HAVING additionally offer a chip face when the clause is a faithful
// conjunction of simple terms. Below the sentence: what the table amounts to, the logical SQL, the error.
import { computed, watch } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import Button from 'primevue/button'
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
import PredChips, { type Facet } from './PredChips.vue'
import { handleText, parseHandle, parsePreds, predsToSql, type Pred, type RowQuery, type RowTable } from '@enumeratio/client'

const props = defineProps<{
  table: RowTable | null
  loading?: boolean
  error?: string | null
  /** FROM datalist options — collections and the FROM-able constructions. */
  colls?: string[]
  /** FROM pinned to a named collection: the axis chips ARE its bindings, blank = unbound. */
  pin?: { coll: string; label: string; axes: string[] }
  /** membership facets the WHERE chips can ask about (the `collections` meta-collection's tag/trait/category/carrier) */
  facets?: Facet[]
}>()
const emit = defineEmits<{ more: [] }>()
const q = defineModel<RowQuery>({ required: true })

const showSql = defineModel<boolean>('showSql', { default: false })

// each segment edits one field of the query object; '' and undefined both read as "clause absent"
function seg<K extends 'from' | 'where' | 'groupBy' | 'having' | 'orderBy'>(k: K) {
  return computed({
    get: () => q.value[k],
    set: (v: RowQuery[K]) => { q.value = { ...q.value, [k]: v } },
  })
}
const from = seg('from')

// ── the pinned FROM: `<coll>(size = 4, k = —)`, each axis an editable chip ─────────────────────────────────────
// The chips ARE the handle's bindings — writing one respells `from` through the core's own handleText, so the URL and
// the plan still see one thing (the FROM text). Blank clears the binding: that axis runs over its whole range (#175).
const bindings = computed<Record<string, number>>(() => {
  const pin = props.pin
  if (!pin) return {}
  let p
  try { p = parseHandle(q.value.from) } catch { return {} }
  if (p.coll !== pin.coll) return {}
  const out: Record<string, number> = {}
  p.positional.forEach((v, i) => { if (pin.axes[i] && typeof v === 'number') out[pin.axes[i]] = v })
  for (const [k, v] of Object.entries(p.named)) if (typeof v === 'number') out[k] = v
  return out
})
function bind(axis: string, v: number | null) {
  const pin = props.pin!
  const args: Record<string, number> = { ...bindings.value }
  if (v == null) delete args[axis]; else args[axis] = Math.trunc(v)
  q.value = { ...q.value, from: handleText(pin.coll, args, pin.axes) }
}
const where = seg('where')
const groupBy = seg('groupBy')
const having = seg('having')
const orderBy = seg('orderBy')

// ── the chip face of WHERE / HAVING ───────────────────────────────────────────────────────────────────────────
// Both faces, switchable both ways; raw → chips only when the clause is a faithful conjunction of chip terms (else the
// toggle is disabled with the reason). Chips are projected into the segment TEXT (the URL and the plan see one thing).
type Face = 'chips' | 'raw'
const FACES = [{ label: 'chips', value: 'chips' }, { label: 'SQL', value: 'raw' }]
const whereFace = defineModel<Face>('whereFace', { default: 'raw' })
const havingFace = defineModel<Face>('havingFace', { default: 'raw' })
const whereCols = computed(() => props.table?.available ?? [])
const havingCols = computed(() => [...(props.table?.keys ?? []), 'count(*)'])
const whereChips = computed<Pred[] | null>(() => parsePreds(q.value.where ?? '', whereCols.value.length ? whereCols.value : undefined))
const havingChips = computed<Pred[] | null>(() => parsePreds(q.value.having ?? '', havingCols.value.length ? havingCols.value : undefined))
const chipsDisabled = (chips: Pred[] | null) => (o: { value: Face }) => o.value === 'chips' && chips === null
function setWhereChips(ps: Pred[]) { q.value = { ...q.value, where: predsToSql(ps) || undefined } }
function setHavingChips(ps: Pred[]) { q.value = { ...q.value, having: predsToSql(ps) || undefined } }
// open in chips when the clause is chip-shaped (a linked URL with a plain conjunction reads as chips). Settled ONCE,
// on the first table — the owner may already have one by the time this mounts, so `immediate` rather than a null→set edge.
let facesSettled = false
watch(() => props.table, (t) => {
  if (!t || facesSettled) return
  facesSettled = true
  if (whereChips.value) whereFace.value = 'chips'
  if (havingChips.value) havingFace.value = 'chips'
}, { immediate: true })

const total = computed(() => {
  const t = props.table
  if (!t) return ''
  const n = t.total == null ? '∞' : t.total.toLocaleString()
  const shown = t.rows.length.toLocaleString()
  const unit = t.archetype === 'elements' || t.archetype === 'rowgroup' ? 'elements' : t.archetype === 'rollup' ? 'rows' : 'fibers'
  return t.frontier ? `${shown} ${unit} loaded · ${n}` : t.total != null && t.total !== t.rows.length ? `${shown} of ${n} ${unit}` : `${n} ${unit}`
})
</script>

<template>
  <div class="stmt">
    <span class="kw sel">SELECT *</span>
    <div v-if="pin" class="seg from pinned">
      <span class="kw">FROM</span>
      <code class="pincoll" :title="pin.coll">{{ pin.label }}</code>
      <span v-if="pin.axes.length" class="axes">
        <span v-for="a in pin.axes" :key="a" class="axis">
          <label :for="`ax-${a}`">{{ a }}</label>
          <InputNumber :inputId="`ax-${a}`" :modelValue="bindings[a] ?? null" @update:modelValue="(v) => bind(a, v as number | null)"
                       :min="0" :max="40" placeholder="—" showClear size="small" class="axin"
                       v-tooltip.bottom="`blank = unbound — every ${a}`" />
        </span>
      </span>
    </div>
    <slot v-else name="from">
      <InputGroup class="seg from">
        <InputGroupAddon class="kw">FROM</InputGroupAddon>
        <InputText v-model="from" list="qv-colls" placeholder="permutations · permutations(size=4) · k_subsets(n=2..4, k=2)" spellcheck="false" />
      </InputGroup>
      <datalist id="qv-colls"><option v-for="c in colls" :key="c" :value="c" /></datalist>
    </slot>
    <div class="seg clause">
      <InputGroup v-if="whereFace === 'raw'">
        <InputGroupAddon class="kw">WHERE</InputGroupAddon>
        <InputText v-model="where" placeholder="descents >= 2 · is_derangement(value) …" spellcheck="false" />
      </InputGroup>
      <div v-else class="chipline"><span class="kw">WHERE</span><PredChips :modelValue="whereChips ?? []" :columns="whereCols" :facets="facets" predicates @update:modelValue="setWhereChips" /></div>
      <SelectButton v-model="whereFace" :options="FACES" optionLabel="label" optionValue="value" :allowEmpty="false" size="small" class="face"
                    :optionDisabled="chipsDisabled(whereChips)"
                    v-tooltip.top="whereChips === null ? 'this WHERE is not a plain conjunction of simple terms — it stays SQL' : ''" />
    </div>
    <InputGroup class="seg">
      <InputGroupAddon class="kw">GROUP BY</InputGroupAddon>
      <InputText v-model="groupBy" placeholder="size · size, descents · ROLLUP (n, k) · GROUPING SETS ((n, k, rank), (n))" spellcheck="false" />
    </InputGroup>
    <div class="seg clause">
      <InputGroup v-if="havingFace === 'raw'">
        <InputGroupAddon class="kw">HAVING</InputGroupAddon>
        <InputText v-model="having" placeholder="count(*) > 5 · k = 2" spellcheck="false" />
      </InputGroup>
      <div v-else class="chipline"><span class="kw">HAVING</span><PredChips :modelValue="havingChips ?? []" :columns="havingCols" @update:modelValue="setHavingChips" /></div>
      <SelectButton v-model="havingFace" :options="FACES" optionLabel="label" optionValue="value" :allowEmpty="false" size="small" class="face"
                    :optionDisabled="chipsDisabled(havingChips)"
                    v-tooltip.top="havingChips === null ? 'this HAVING is not a plain conjunction of simple terms — it stays SQL' : ''" />
    </div>
    <InputGroup class="seg">
      <InputGroupAddon class="kw">ORDER BY</InputGroupAddon>
      <InputText v-model="orderBy" placeholder="inversions DESC, rank" spellcheck="false" />
    </InputGroup>
  </div>

  <div class="bar">
    <span class="total">{{ total }}</span>
    <span v-if="table" class="arch">{{ table.archetype }}</span>
    <slot name="bar-pre" />
    <Button size="small" text :label="showSql ? 'hide SQL' : 'show SQL'" icon="pi pi-code" @click="showSql = !showSql" />
    <slot name="bar" />
    <Button v-if="table?.frontier" size="small" text label="Load more" icon="pi pi-plus" :loading="loading" @click="emit('more')" />
  </div>
  <pre v-if="showSql && table" class="sql">{{ table.sql }}</pre>
  <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
</template>

<style scoped>
.stmt { display: flex; flex-wrap: wrap; align-items: stretch; gap: 0.5rem; margin-bottom: 0.75rem; }
.stmt .sel { align-self: center; padding: 0 0.25rem; }
.kw { font-family: var(--e-font-mono, ui-monospace, monospace); font-weight: 600; font-size: 0.8rem; letter-spacing: 0.02em; color: var(--e-color-brand-text, #92400e); }
.seg { flex: 1 1 14rem; }
.seg.from { flex-basis: 20rem; }
.seg.from.pinned { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; padding: 0.2rem 0.6rem; border: 1px solid var(--p-inputtext-border-color, var(--e-color-border, #ddd)); border-radius: var(--p-inputtext-border-radius, 6px); }
.pincoll { font-family: var(--e-font-mono, ui-monospace, monospace); font-weight: 600; font-size: 0.86rem; background: none; padding: 0; }
.axes { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.axis { display: flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; color: var(--e-color-text-muted, #666); }
.axin { width: 5.5rem; }
.axin :deep(input) { font-family: var(--e-font-mono, ui-monospace, monospace); font-size: 0.82rem; }
.seg.clause { display: flex; align-items: stretch; gap: 0.35rem; }
.seg.clause > :first-child { flex: 1 1 auto; min-width: 0; }
.chipline { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; padding: 0.2rem 0.6rem; border: 1px solid var(--p-inputtext-border-color, var(--e-color-border, #ddd)); border-radius: var(--p-inputtext-border-radius, 6px); }
.face :deep(.p-togglebutton) { padding: 0.25rem 0.5rem; font-size: 0.72rem; }
.seg :deep(input) { font-family: var(--e-font-mono, ui-monospace, monospace); font-size: 0.86rem; }
.bar { display: flex; align-items: center; gap: 0.75rem; min-height: 2.2rem; }
.total { font-variant-numeric: tabular-nums; color: var(--e-color-text-muted, #666); }
.arch { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--e-color-text-subtle, #888); border: 1px solid var(--e-color-border, #ddd); border-radius: 999px; padding: 0.1rem 0.55rem; }
.sql { font: 0.8rem/1.45 var(--e-font-mono, ui-monospace, monospace); background: var(--e-color-bg-soft, #f6f4f0); border: 1px solid var(--e-color-border, #ddd); border-radius: 8px; padding: 0.75rem 1rem; overflow-x: auto; margin: 0 0 0.75rem; white-space: pre; }
</style>
