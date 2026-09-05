<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import katex from 'katex'
import { construct, findStat, type DataResult, type Stat, type MapInfo, type FindStatHit } from '@enumeratio/client'

// The ELEMENT pane: one element (addressed by rank), its serialization, every statistic, and its map images —
// with a stepper to walk the collection. Closes the loop from the table (click a row) and from the detail pane
// (click a face). Sub-part/component selection of notation elements awaits per-collection glyphs; for polytope
// collections the detail pane's face-picking already selects components (faces) of the whole.
const props = defineProps<{
  collection: string | null; n: number; rank: number | null; row: DataResult | null
  card: number | null; stats: Stat[]; maps: MapInfo[]; isTex: boolean
  mapHref: (m: MapInfo, value: unknown) => string
}>()
const glyphSvg = computed(() => (typeof props.row?.__svg === 'string' ? props.row.__svg : null))
const emit = defineEmits<{ step: [number]; goto: [number] }>()

const statVals = computed(() => props.stats.map((s) => ({ id: s.statId, findstatId: s.findstatId, value: props.row?.[s.statId] })).filter((x) => x.value != null))
const mapVals = computed(() =>
  props.maps.map((m) => ({ m, value: props.row?.['map:' + m.id] })).filter((x) => x.value != null))
function texHtml(s: unknown): string {
  try { return katex.renderToString(String(s ?? ''), { throwOnError: false, displayMode: false }) } catch { return String(s ?? '') }
}
const findstatUrl = (id: string) => `https://www.findstat.org/${id}`
const atStart = computed(() => props.rank == null || props.rank <= 0)
const atEnd = computed(() => props.rank == null || (props.card != null && props.rank >= props.card - 1)) // infinite (card null): never at end

// ── the statistic finder (#134): a handful of small elements, type an unknown stat's value on each, find_stat()
//    sweeps the catalog live (debounced) for stats whose value_fn reproduces every value you've typed so far. ──
const SAMPLE_SIZE = 6
type Sample = { el: string; val: string }
const samples = ref<Sample[]>([])
const deep = ref(false)   // depth 0 (direct stats) vs 2 (through a couple of map hops) — the SQL hard-caps at 3
const hits = ref<FindStatHit[]>([])
const finding = ref(false)
const submitted = ref(false)

async function loadSamples(): Promise<void> {
  hits.value = []
  submitted.value = false
  if (!props.collection) { samples.value = []; return }
  try {
    const renders = await construct(props.collection, { size: props.n }).serialize(0, SAMPLE_SIZE)
    samples.value = renders.map((el) => ({ el, val: '' }))
  } catch { samples.value = [] }
}
watch(() => [props.collection, props.n], loadSamples, { immediate: true })

let timer: ReturnType<typeof setTimeout> | undefined
let findGen = 0
async function runFind(): Promise<void> {
  const gen = ++findGen
  if (!props.collection) return
  const values: Record<string, number> = {}
  for (const s of samples.value) {
    const n = Number(s.val)
    if (s.val.trim() !== '' && Number.isFinite(n)) values[s.el] = n
  }
  const nowSubmitted = Object.keys(values).length > 0
  if (!nowSubmitted) { if (gen === findGen) { submitted.value = false; hits.value = [] }; return }
  finding.value = true
  try {
    const result = await findStat(props.collection, values, { depth: deep.value ? 2 : 0 })
    if (gen !== findGen) return // a newer query (or collection/sample change) superseded this one
    submitted.value = true
    hits.value = result
  } catch { if (gen === findGen) { submitted.value = true; hits.value = [] } } finally { if (gen === findGen) finding.value = false }
}
watch([samples, deep], () => {
  clearTimeout(timer)
  timer = setTimeout(runFind, 350)
}, { deep: true })
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="elpane">
    <div v-if="rank == null || !row" class="empty">
      <p>No element selected.</p>
      <p class="hint">Click a row in the table, or a face in the detail view, to inspect one element.</p>
    </div>
    <template v-else>
      <div class="stepper">
        <Button size="small" icon="pi pi-chevron-left" text :disabled="atStart" title="previous" @click="emit('step', -1)" />
        <span class="rk">#</span>
        <InputNumber :modelValue="rank" :min="0" :max="card != null ? card - 1 : undefined" @update:modelValue="(v) => emit('goto', Math.trunc((v as number) ?? 0))" :inputStyle="{ width: '3.5rem', textAlign: 'center' }" />
        <Button size="small" icon="pi pi-chevron-right" text :disabled="atEnd" title="next" @click="emit('step', 1)" />
        <span class="of">of {{ card != null ? card.toLocaleString() : '∞' }}</span>
      </div>

      <div class="hero">
        <svg-figure v-if="glyphSvg" :svg="glyphSvg" class="ghero" />
        <span v-if="isTex" class="tex" v-html="texHtml(row.element)"></span>
        <code v-else class="el">{{ row.element }}</code>
      </div>

      <div v-if="statVals.length" class="block">
        <div class="blabel">statistics</div>
        <div class="grid">
          <div v-for="s in statVals" :key="s.id" class="cell">
            <a v-if="s.findstatId" :href="findstatUrl(s.findstatId)" target="_blank" class="k">{{ s.id }}</a>
            <span v-else class="k">{{ s.id }}</span>
            <b class="v">{{ s.value }}</b>
          </div>
        </div>
      </div>

      <div v-if="mapVals.length" class="block">
        <div class="blabel">maps</div>
        <div class="grid">
          <div v-for="mv in mapVals" :key="mv.m.id" class="cell">
            <span class="k">{{ mv.m.id }} <i>→ {{ mv.m.codomain }}</i></span>
            <a :href="mapHref(mv.m, mv.value)" class="v maplink">{{ mv.value }}</a>
          </div>
        </div>
      </div>

      <div v-if="samples.length" class="block finder">
        <div class="blabel">find this statistic <span class="hint">— type its value on a few small elements</span></div>
        <div class="grid samples">
          <div v-for="s in samples" :key="s.el" class="sample">
            <code class="k">{{ s.el }}</code>
            <InputText v-model="s.val" size="small" placeholder="value" class="sampleval" />
          </div>
        </div>
        <div class="finderctl">
          <Checkbox v-model="deep" binary inputId="finder-deep" />
          <label for="finder-deep">search through maps too (slower)</label>
        </div>
        <div v-if="finding" class="hint"><i class="pi pi-spin pi-spinner" /> searching…</div>
        <ul v-else-if="hits.length" class="hits">
          <li v-for="h in hits" :key="`${h.statCollection}.${h.statId}.${h.mapPath.join(',')}`">
            <span class="hstat">{{ h.statCollection }}.{{ h.statId }}</span>
            <span v-if="h.mapPath.length" class="hpath">via {{ h.mapPath.join(' → ') }}</span>
            <span class="hq">q<sub>a</sub>={{ h.qa.toFixed(2) }} q<sub>d</sub>={{ h.qd.toFixed(2) }}</span>
          </li>
        </ul>
        <p v-else-if="submitted" class="hint">no matching statistic found.</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.elpane { min-height: 8rem; }
.empty { padding: 2rem 1rem; color: var(--p-text-muted-color); }
.hint { font-size: 0.85rem; }
.stepper { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
.rk { font-weight: 600; color: var(--p-text-muted-color); }
.of { font-size: 0.82rem; color: var(--p-text-muted-color); }
.of code { font-family: ui-monospace, monospace; color: var(--p-text-color); }
.hero { padding: 1.2rem 1rem; margin-bottom: 1.2rem; border: 1px solid var(--p-content-border-color); border-radius: 8px; background: var(--p-content-hover-background); text-align: center; }
.hero .ghero { display: block; margin: 0 auto 0.9rem; max-width: 320px; }
.hero .el { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 1.4rem; }
.hero .tex :deep(.katex) { font-size: 1.7em; }
.block { margin-bottom: 1rem; }
.blabel { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--p-text-muted-color); margin-bottom: 0.4rem; }
.grid { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.cell { display: flex; align-items: baseline; gap: 0.4rem; padding: 0.3rem 0.6rem; border: 1px solid var(--p-content-border-color); border-radius: 6px; font-variant-numeric: tabular-nums; }
.k { font-size: 0.82rem; color: var(--p-text-muted-color); text-decoration: none; }
.k i { font-style: normal; opacity: 0.6; font-size: 0.9em; }
a.k:hover { text-decoration: underline; }
.v { font-weight: 600; }
.maplink { color: var(--p-primary-color); text-decoration: none; font-family: ui-monospace, monospace; }
.maplink:hover { text-decoration: underline; }
.finder .hint { font-weight: 400; text-transform: none; letter-spacing: normal; font-size: 0.82rem; }
.samples { margin-bottom: 0.6rem; }
.sample { display: flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.5rem; border: 1px solid var(--p-content-border-color); border-radius: 6px; }
.sample .k { font-size: 0.78rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.sampleval { width: 4rem; }
.finderctl { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.6rem; font-size: 0.82rem; color: var(--p-text-muted-color); }
.hits { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.hits li { display: flex; align-items: baseline; gap: 0.5rem; padding: 0.3rem 0.6rem; border: 1px solid var(--p-content-border-color); border-radius: 6px; font-size: 0.85rem; flex-wrap: wrap; }
.hstat { font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.hpath { color: var(--p-text-muted-color); font-size: 0.82rem; }
.hq { margin-left: auto; color: var(--p-text-muted-color); font-variant-numeric: tabular-nums; font-size: 0.8rem; }
</style>
