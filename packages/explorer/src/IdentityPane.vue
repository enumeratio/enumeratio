<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import {
  constructions as loadConstructions, collectionConstructions as loadCollCons,
  species as loadSpecies, references as loadReferences,
  type Construction, type CollectionConstruction, type Species, type Reference,
} from '@enumeratio/client'
import { routeFor } from './route'

// The IDENTITY strip: a collection's counting identity in its many roles (the "one identity, many roles" thesis, as data).
// - CONSTRUCTION: which generic functor it instantiates (finset α, words α, …), its α binding, and its sibling instances
//   (same construction, different α) — the generic-skeleton ⇄ concrete-instances link (docs backlog #22).
// - GENERATING FUNCTION: its species expression / OGF fixed point (base_species), suite-checked against the count.
// - REFERENCES: hard pointers to the same object in mathlib4 / sage / OEIS / Wolfram / FindStat (base_reference),
//   rendered as external links where a url exists (#118).
const props = defineProps<{ collection: string | null; n: number; titleOf: (id: string | null) => string }>()

const cons = ref<Record<string, Construction>>({})
const collCons = ref<Record<string, CollectionConstruction>>({})
const spec = ref<Record<string, Species>>({})
const refs = ref<Reference[]>([])

onMounted(async () => {
  // each is independent + optional — a pre-registry DB just leaves that row blank
  try { cons.value = Object.fromEntries((await loadConstructions()).map((c) => [c.id, c])) } catch { /* pre-constructions */ }
  try { collCons.value = await loadCollCons() } catch { /* pre-constructions */ }
  try { spec.value = await loadSpecies() } catch { /* pre-species */ }
  await loadRefs()
})
watch(() => props.collection, loadRefs)
async function loadRefs() {
  refs.value = props.collection ? await loadReferences(props.collection).catch(() => []) : []
}

const myCon = computed(() => (props.collection && collCons.value[props.collection]) || null)
const conDef = computed(() => (myCon.value && cons.value[myCon.value.construction]) || null)
// sibling instances: other collections built from the SAME construction (one functor, many α)
const siblings = computed(() => {
  const c = myCon.value?.construction
  if (!c) return []
  return Object.values(collCons.value).filter((x) => x.construction === c && x.collection !== props.collection)
})
const mySpec = computed(() => (props.collection && spec.value[props.collection]) || null)
const gfKind = computed(() => {
  const s = mySpec.value
  if (!s) return null
  return s.unlabelled ? 'OGF' : s.implicit ? 'EGF (implicit)' : 'EGF'
})
// references grouped by system, in a stable order, each with a human label (so the row says WHICH library)
const REF_SYSTEMS: [string, string][] = [['mathlib4', 'mathlib4'], ['sage', 'sage'], ['oeis', 'OEIS'], ['wolfram', 'Wolfram'], ['findstat', 'FindStat']]
const refGroups = computed(() => REF_SYSTEMS
  .map(([sys, label]) => ({ sys, label, rows: refs.value.filter((r) => r.system === sys) }))
  .filter((g) => g.rows.length))
// findstat rows are stat/map-scoped (`references()` widens the subject match to `<collection>.<stat_id|map_id>`),
// so the identity alone (a bare St###### / Mp##### code) doesn't say WHICH stat or map it's for — pull that back
// out of the subject for the tooltip.
const refTitle = (r: Reference, label: string) => {
  const scoped = r.subject.slice(r.subject.indexOf('.') + 1)
  return r.subject.includes('.') ? `${scoped} — ${r.delta || label}` : (r.delta || label)
}
// the EGF/OGF field is KaTeX source — render it; `expr` (E·E, 1+X·Y²) is our own species algebra, shown as code
const egfHtml = computed(() => {
  const s = mySpec.value?.egf
  if (!s) return ''
  try { return katex.renderToString(s, { throwOnError: false, displayMode: false }) } catch { return '' }
})
const has = computed(() => !!(myCon.value || mySpec.value || refs.value.length))
// a sibling instance (same construction, different α) is a DIFFERENT collection — a real path, unbound (#175's
// "whole collection" default), not the current collection's path with a dead `?c=` query param (parseRoute has no
// `c` key, so it silently fell into the secondary-axis catch-all as `axes.c = NaN`).
const link = (id: string) => routeFor({ address: { collection: id, fiberBinding: { n: null, axes: {} }, element: null }, viewQuery: {} })
</script>

<template>
  <div v-if="has" class="ident">
    <!-- construction: the generic functor + this collection's α, with sibling instances -->
    <div v-if="myCon" class="row">
      <span class="lbl">construction</span>
      <code class="skel">{{ conDef?.skeleton ?? myCon.construction }}</code>
      <span class="at">α = <code>{{ myCon.alpha }}</code></span>
      <span v-if="myCon.generic" class="badge generic" title="a type-parameter is an unfilled hole — a skeleton concrete collections fill">generic</span>
      <template v-if="siblings.length">
        <span class="also">also:</span>
        <a v-for="s in siblings" :key="s.collection" class="sib" :href="link(s.collection)"
           :title="`${conDef?.skeleton ?? myCon.construction} at α = ${s.alpha}`">{{ titleOf(s.collection) }}</a>
      </template>
    </div>

    <!-- generating function: the species / OGF identity, suite-checked against the count -->
    <div v-if="mySpec" class="row">
      <span class="lbl">generating fn</span>
      <code class="gf">{{ mySpec.expr }}</code>
      <span class="badge kind">{{ gfKind }}</span>
      <span v-if="egfHtml" class="egf" v-html="egfHtml"></span>
    </div>

    <!-- references: the same object elsewhere — labelled by system (mathlib4 / sage / OEIS / Wolfram / FindStat), linked to its docs where a url exists -->
    <div v-if="refs.length" class="row">
      <span class="lbl">also known as</span>
      <span v-for="g in refGroups" :key="g.sys" class="refgrp">
        <span class="sys">{{ g.label }}</span>
        <template v-for="r in g.rows" :key="r.subject + r.identity">
          <a v-if="r.url" class="ref" :class="g.sys" :href="r.url" target="_blank" rel="noopener" :title="refTitle(r, g.label)">{{ r.identity }}</a>
          <span v-else class="ref" :class="g.sys" :title="refTitle(r, g.label)">{{ r.identity }}</span>
        </template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.ident { display: flex; flex-direction: column; gap: 0.3rem; margin: -0.4rem 0 1rem; padding: 0.5rem 0.75rem;
  background: var(--p-content-hover-background); border-radius: 8px; }
.row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; font-size: 0.86rem; }
.lbl { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--p-text-muted-color);
  min-width: 6.5rem; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--p-text-color); }
.skel, .gf { padding: 0.05rem 0.4rem; border-radius: 4px; background: color-mix(in srgb, var(--p-primary-color) 12%, transparent); }
.at { color: var(--p-text-muted-color); }
.at code { color: var(--p-text-color); }
.badge { font-size: 0.68rem; padding: 0.05rem 0.4rem; border-radius: 999px; }
.badge.generic { background: color-mix(in srgb, var(--e-color-accent) 22%, transparent); border: 1px solid color-mix(in srgb, var(--e-color-accent) 50%, transparent); }
.badge.kind { background: color-mix(in srgb, var(--p-primary-color) 16%, transparent); color: var(--p-text-muted-color); }
.also { color: var(--p-text-muted-color); font-size: 0.78rem; margin-left: 0.25rem; }
.sib { color: var(--p-primary-color); text-decoration: none; }
.sib:hover { text-decoration: underline; }
.egf { color: var(--p-text-color); font-size: 0.95rem; }
.egf :deep(.katex) { font-size: 1em; }
.refgrp { display: inline-flex; align-items: center; gap: 0.3rem; }
.sys { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--p-text-muted-color);
  padding: 0.05rem 0.3rem; border-radius: 3px; background: var(--p-content-border-color); }
.ref { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.82rem; padding: 0.05rem 0.4rem;
  border-radius: 4px; border: 1px solid var(--p-content-border-color); color: var(--p-text-color); text-decoration: none; }
a.ref { color: var(--p-primary-color); }
a.ref:hover { text-decoration: underline; }
.ref.oeis, .ref.findstat { font-variant-numeric: tabular-nums; }
</style>
