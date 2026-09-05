<script setup lang="ts">
// Tied to the SELECTED collection: if its carrier has operations in the algebra registry (a ring, group, monoid, even
// a magma), show a text input to evaluate expressions in that carrier's algebra. A pulldown offers worked examples;
// while the input still matches an example (unmodified), the result is checked green/red against its expected value.
// For ℤ/mℤ the modulus is the collection's size n, so modular_residues(5) evaluates in ℤ/5ℤ.
import { ref, computed, watch, onMounted } from 'vue'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { carriers as loadCarriers, algebraTypes, expressionExamples, evaluateExpression, type AlgebraType, type ExpressionExample } from '@enumeratio/client'

// `grades` is the collection's whole axis→value binding; `n` is its first axis, which is the only ground most
// carriers need. multicomplex is the one that reads a second (its tower order) — see groundFor below.
const props = defineProps<{ collection: string; n: number; grades?: Record<string, number> }>()

const carrierByColl = ref<Record<string, string>>({})
const algebra = ref<AlgebraType[]>([])
const examples = ref<ExpressionExample[]>([])
const expr = ref('')
const result = ref<string | null>(null)
const error = ref<string | null>(null)

const carrier = computed(() => carrierByColl.value[props.collection] ?? '')
const info = computed(() => algebra.value.find((t) => t.type === carrier.value))
// the evaluator handles the carriers in DEFAULTS: the arithmetic rings + the finset lattice ({..} literals, ∪ ∩, ᶜ). A
// carrier in the algebra registry with no evaluator here just doesn't show the box.
const evaluable = computed(() => carrier.value in DEFAULTS || examples.value.length > 0)
const show = computed(() => !!info.value && evaluable.value)
const isModular = computed(() => carrier.value === 'modular_residue')
const isFinset = computed(() => carrier.value === 'finset')
const isMulticomplex = computed(() => carrier.value === 'multicomplex')
const mcLevel = computed(() => Math.trunc(props.grades?.level ?? 2))   // the tower order; 2 (bicomplex) shows j1 j2 j3
const ringLabel = computed(() => (isModular.value ? `ℤ/${Math.trunc(props.n)}ℤ`
  : isFinset.value ? `𝒫([${Math.trunc(props.n)}])`
  : isMulticomplex.value ? `ℂ${mcLevel.value}(ℤ/${Math.trunc(props.n)})`   // the fiber_symbol spelling
  : carrier.value))
// the ground a carrier's evaluator needs: the collection's n for ℤ/mℤ and finset, both grades for multicomplex.
const groundFor = computed<number | Record<string, number> | undefined>(() =>
  isMulticomplex.value ? { modulus: Math.trunc(props.n), level: mcLevel.value }
    : isModular.value || isFinset.value ? Math.trunc(props.n)
    : undefined)
const DEFAULTS: Record<string, string> = {
  rational_number: '1/2 + 1/3', modular_residue: '3 * 4', gaussian_integer: '(1 + i) * (1 + i)',
  ordinal: '1 + w', cardinal: 'oo + 1', integer_number: '2 - 5', natural_number: '2 + 3', finset: '{1,2} ∪ {2,3}',
  multicomplex: '(1 + j1) * (1 + j1)',
}
const placeholder = computed(() => ({
  rational_number: 'e.g. 1/2 + 1/3 * (2 − 1/4)', modular_residue: 'e.g. 3 * 4 + 2', gaussian_integer: 'e.g. (1 + i) * (1 + i)',
  ordinal: 'e.g. w · 2 + 1  (w = ω)', cardinal: 'e.g. oo + 1  (oo = ℵ₀)', integer_number: 'e.g. 2 − 5 * 3',
  finset: 'e.g. {1,2} ∪ {2,3}ᶜ   (∪ ∩, ᶜ = complement over [n])',
  multicomplex: 'e.g. (1 + j1) * (1 + j1)   (j<mask> or i_<k>, postfix ~ = conjugate)',
}[carrier.value] ?? 'e.g. 2 + 3 * 4'))

// while the input still equals a known example, check the result against its expected value
const matched = computed(() => examples.value.find((e) => e.expr.trim() === expr.value.trim()))
// Ground-dependent examples are authored pinned (see expression_examples.sql header): modular to m = 5, multicomplex
// to ℂ2(ℤ/5). Their expected values only hold there, so only assert a green/red verdict when the page's grades match
// — at any other binding the calculator still evaluates live (correctly for that fiber), it just doesn't check.
const EXAMPLE_MODULUS = 5
const EXAMPLE_LEVEL = 2
const verdict = computed<null | 'ok' | 'bad'>(() => {
  if (!matched.value || error.value || result.value == null) return null
  if ((isModular.value || isMulticomplex.value) && Math.trunc(props.n) !== EXAMPLE_MODULUS) return null
  if (isMulticomplex.value && mcLevel.value !== EXAMPLE_LEVEL) return null
  return result.value === matched.value.expected ? 'ok' : 'bad'
})

async function loadExamples() { examples.value = carrier.value ? await expressionExamples(carrier.value) : [] }
async function run() {
  if (!show.value || !expr.value.trim()) { result.value = null; error.value = null; return }
  const r = await evaluateExpression(carrier.value, expr.value, groundFor.value)
  result.value = r.result; error.value = r.error ?? null
}
onMounted(async () => {
  const [c, a] = await Promise.all([loadCarriers(), algebraTypes()])
  carrierByColl.value = c; algebra.value = a; await loadExamples(); reset(); run()
})
// seed with a registered example (guaranteed valid ops for this carrier); else the arithmetic default; else empty
function reset() { expr.value = examples.value[0]?.expr ?? DEFAULTS[carrier.value] ?? '' }
watch(carrier, async () => { await loadExamples(); reset() })
watch([expr, () => props.n, () => props.grades, carrier], run, { deep: true })
</script>

<template>
  <div v-if="show" class="algebra">
    <div class="algebra-hd">
      <span class="algebra-title">{{ ringLabel }}</span>
      <span class="algebra-struct">{{ info?.structures.join(' · ') }}</span>
      <Select v-if="examples.length" :modelValue="matched?.expr ?? null" @update:modelValue="(v) => v && (expr = v)"
              :options="examples" optionLabel="title" optionValue="expr" placeholder="examples ▾" showClear
              class="algebra-samples" />
      <span class="algebra-ops">ops&nbsp;{{ info?.ops.map((o) => o.symbol).join(' ') }}</span>
    </div>
    <div class="algebra-eval">
      <InputText v-model="expr" :placeholder="placeholder" class="algebra-input" spellcheck="false" autocapitalize="off" autocomplete="off" />
      <span class="algebra-eq">=</span>
      <span v-if="error" class="algebra-err" :title="error">{{ error }}</span>
      <span v-else class="algebra-res">{{ result ?? '—' }}</span>
      <span v-if="verdict === 'ok'" class="algebra-ok" :title="`matches the expected ${matched?.expected}`">✓</span>
      <span v-else-if="verdict === 'bad'" class="algebra-bad" :title="`expected ${matched?.expected}`">✗</span>
    </div>
  </div>
</template>

<style scoped>
.algebra { border: 1px solid var(--p-content-border-color, #dcdcdc); border-radius: 8px; padding: .6rem .8rem; margin: .5rem 0; background: var(--p-content-background, transparent); }
.algebra-hd { display: flex; align-items: baseline; gap: .7rem; margin-bottom: .5rem; flex-wrap: wrap; }
.algebra-title { font-weight: 600; font-family: ui-monospace, monospace; }
.algebra-struct { opacity: .75; }
.algebra-samples { margin-left: .3rem; min-width: 12rem; }
.algebra-ops { opacity: .55; font-family: ui-monospace, monospace; margin-left: auto; }
.algebra-eval { display: flex; align-items: center; gap: .7rem; }
.algebra-input { flex: 1; font-family: ui-monospace, monospace; }
.algebra-eq { opacity: .45; }
.algebra-res { font-family: ui-monospace, monospace; font-weight: 600; font-size: 1.15rem; }
.algebra-ok { color: var(--p-green-500, #27ae60); font-weight: 700; }
.algebra-bad { color: var(--p-red-500, #c0392b); font-weight: 700; }
.algebra-err { color: var(--p-red-500, #c0392b); font-size: .9rem; }
</style>
