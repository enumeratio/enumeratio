<script setup lang="ts">
// The chip face of a WHERE / HAVING segment: a conjunction of simple terms over the relation's columns, each a
// removable chip, plus a three-step picker (column → operator → value). Purely presentational over the client's Pred
// model; the owner projects chips ⇄ the raw segment text (predsToSql / parsePreds) and decides when the chip face is
// available (a raw clause that isn't a faithful conjunction stays raw).
import { computed, ref } from 'vue'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import { predToSql, type Pred, type PredOp, type Literal, type FacetField } from '@enumeratio/client'

/** the values a facet field offers, with how many collections carry each (broadest first) */
export type FacetOption = { value: string; label: string; count?: number }
export type Facet = { field: FacetField; label: string; options: FacetOption[] }

const props = defineProps<{ modelValue: Pred[]; columns: string[]; predicates?: boolean; facets?: Facet[] }>()
const emit = defineEmits<{ 'update:modelValue': [Pred[]] }>()

const col = ref<string | null>(null)
const op = ref<PredOp>('=')
const text = ref('')

const OPS: { value: PredOp; label: string }[] = [
  { value: '=', label: '=' }, { value: '<>', label: '≠' }, { value: '<', label: '<' }, { value: '<=', label: '≤' },
  { value: '>', label: '>' }, { value: '>=', label: '≥' }, { value: 'between', label: 'between a and b' },
  { value: 'in', label: 'in (a, b, …)' }, { value: 'not in', label: 'not in (…)' },
  { value: 'like', label: 'like' }, { value: 'ilike', label: 'ilike' }, { value: 'not like', label: 'not like' },
]
const colOptions = computed(() => [
  ...(props.facets ?? []).map((f) => ({ value: `__facet:${f.field}`, label: `${f.label}:` })),
  ...props.columns.map((c) => ({ value: c, label: c })),
  ...(props.predicates ? [{ value: '__fn', label: 'predicate(value)…' }] : []),
])
const isFn = computed(() => col.value === '__fn')
// a facet term picks one of the field's registered values — a membership question, not a free literal
const facet = computed(() => (props.facets ?? []).find((f) => `__facet:${f.field}` === col.value) ?? null)
const FACET_OPS = [{ value: '=', label: 'is' }, { value: '<>', label: 'is not' }]
const hint = computed(() =>
  facet.value ? facet.value.label : isFn.value ? 'is_derangement' : op.value === 'between' ? 'lo, hi' : op.value === 'in' || op.value === 'not in' ? 'a, b, …' : op.value.includes('like') ? "'pattern%'" : 'value')

const lit = (s: string): Literal => (/^-?\d+(\.\d+)?$/.test(s.trim()) ? Number(s) : s.trim().replace(/^'(.*)'$/, '$1'))
function add() {
  const v = text.value.trim()
  if (!col.value || !v) return
  let p: Pred | null = null
  if (facet.value) p = op.value === '<>' ? { op: 'facet', field: facet.value.field, value: v, negate: true } : { op: 'facet', field: facet.value.field, value: v }
  else if (isFn.value) p = { op: 'fn', col: 'value', fn: v.replace(/\(.*$/, '') }
  else if (op.value === 'between') { const [a, b] = v.split(/[,\s]+/).map(Number); if (Number.isFinite(a) && Number.isFinite(b)) p = { op: 'between', col: col.value, value: [a, b] } }
  else if (op.value === 'in' || op.value === 'not in') p = { op: op.value, col: col.value, value: v.split(',').map((x) => lit(x)) }
  else if (op.value !== 'fn' && op.value !== 'facet') p = { op: op.value, col: col.value, value: lit(v) }
  if (!p) return
  emit('update:modelValue', [...props.modelValue, p])
  text.value = ''
}
function remove(i: number) { const next = props.modelValue.slice(); next.splice(i, 1); emit('update:modelValue', next) }
</script>

<template>
  <div class="chips">
    <button v-for="(p, i) in modelValue" :key="i" type="button" class="chip" :title="`${predToSql(p)} — click to remove`" @click="remove(i)">
      <code>{{ predToSql(p) }}</code><span class="x">×</span>
    </button>
    <Select v-model="col" :options="colOptions" optionLabel="label" optionValue="value" placeholder="+ term" size="small" showClear class="pick" style="min-width: 9rem" />
    <template v-if="col">
      <Select v-if="facet" v-model="op" :options="FACET_OPS" optionLabel="label" optionValue="value" size="small" class="pick" style="min-width: 5.5rem" />
      <Select v-else-if="!isFn" v-model="op" :options="OPS" optionLabel="label" optionValue="value" size="small" class="pick" style="min-width: 7rem" />
      <Select v-if="facet" v-model="text" :options="facet.options" optionLabel="label" optionValue="value" filter :placeholder="hint" size="small" class="val" style="min-width: 11rem">
        <template #option="{ option }"><span class="fopt">{{ option.label }}<span v-if="option.count != null" class="foptct">{{ option.count }}</span></span></template>
      </Select>
      <InputText v-else v-model="text" :placeholder="hint" size="small" class="val" spellcheck="false" @keydown.enter.prevent="add" />
      <Button icon="pi pi-plus" size="small" text aria-label="add term" @click="add" />
    </template>
  </div>
</template>

<style scoped>
.chips { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.chip { font: inherit; padding: 0.1rem 0.5rem; border-radius: 999px; border: 1px solid var(--p-primary-color); background: var(--p-primary-color);
  color: var(--p-primary-contrast-color, #fff); cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem; }
.chip code { font-family: var(--e-font-mono, ui-monospace, monospace); font-size: 0.78rem; background: none; border: 0; padding: 0; color: inherit; }
.chip .x { font-weight: 700; opacity: 0.75; }
.chip:hover { filter: brightness(1.08); }
.fopt { display: flex; align-items: baseline; gap: 0.4rem; }
.foptct { font-size: 0.72rem; opacity: 0.6; font-variant-numeric: tabular-nums; }
.val { width: 11rem; font-family: var(--e-font-mono, ui-monospace, monospace); font-size: 0.82rem; }
</style>
