<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import Button from 'primevue/button'
import { polytope, Handle, type PolytopeData, type DataResult } from '@enumeratio/client'
import ProjectiveView from './ProjectiveView.vue'

// The DETAIL pane: a view representative of the WHOLE collection. Every rendering is a CAST of the element data into
// a space. Polytope collections cast into SCENE space (the polytope, via base_polytope) — single, or the shared
// projective space. Collections with a page-space glyph cast into PAGE space — shown as a gallery of the first
// elements. Others have no visual cast yet → disabled.
const props = defineProps<{ collection: string | null; n: number; isPolytope: boolean; polyTitle: string; hasPageGlyph: boolean; sizeGraded: boolean; selected: number | null; selectedSer: string | null }>()
// `select` carries either a local-fiber RANK (polytope path, pre-existing — unchanged) or a canonical SERIALIZATION
// (page-glyph gallery path, #B1 fix): the gallery's own Handle is scoped to ONE fiber (a concrete n), which may not
// be the app's current binding (esp. when n is unbound — #175), so a fiber-local rank from it is meaningless against
// the app-level handle. The serialization is rank-space-independent; the owner resolves it via handle.rankOf(ser).
const emit = defineEmits<{ select: [number | string | null] }>()

const mode = ref<'single' | 'shared'>('single')
const data = ref<PolytopeData | null>(null)
const gallery = ref<DataResult[]>([])
const loading = ref(false)
const dimName = (d: number) => (d === 0 ? 'vertex' : d === 1 ? 'edge' : d === 2 ? 'face' : d === 3 ? 'cell' : `${d}-face`)
const GALLERY_MAX = 60

async function load() {
  data.value = null; gallery.value = []
  if (!props.collection) return
  loading.value = true
  try {
    if (props.isPolytope) data.value = await polytope(props.collection, Math.trunc(props.n))
    else if (props.hasPageGlyph) {
      if (props.sizeGraded) {
        const h = new Handle(props.collection, Math.trunc(props.n))
        const card = (await h.card()) ?? 0
        gallery.value = await h.window(0, Math.min(card, GALLERY_MAX), { glyph: true }) as DataResult[]
      } else {
        // ungraded (e.g. prime_numbers): no per-n fiber to slice — card() is null/Infinity, so building
        // Handle(coll, n) and capping at its card gives an empty "(4) … the first 0" ghost panel (#B5). Use the
        // unbound handle (the whole collection) and just LIMIT the window instead.
        const h = new Handle(props.collection, {})
        gallery.value = await h.window(0, GALLERY_MAX, { glyph: true }) as DataResult[]
      }
    }
  } finally { loading.value = false }
}
onMounted(load)
watch(() => [props.collection, props.n, props.isPolytope, props.hasPageGlyph, props.sizeGraded], load)

// map the selected element rank ⇄ the polytope cell index (cells carry their rank)
const selectedCell = computed(() => {
  if (props.selected == null || !data.value) return null
  const i = data.value.cells.findIndex((c: any) => c.rank === props.selected)
  return i >= 0 ? i : null
})
function onCell(ci: number) {
  const c: any = data.value?.cells[ci]
  emit('select', c && typeof c.rank === 'number' ? c.rank : null)
}
// The gallery's own Handle: fiber-pinned (n or the DISPLAY_N fallback) when size-graded — may not match the app's
// current binding (esp. when n is unbound, #B1) — so a fiber-local rank needs the owner to re-resolve it by serialization.
// UNGRADED: there's no n to pin, so the gallery's Handle(coll, {}) IS the app's own unbound handle — g.__rank is
// already the correct GLOBAL rank, and it must stay a rank: rankOf() is documented "finite handles only" and hangs
// (no LIMIT to short-circuit an infinite, ungraded scan) against an unbound handle like prime_numbers'.
function onGalleryClick(g: DataResult) {
  emit('select', props.sizeGraded ? (g.element ?? null) : Number(g.__rank))
}
const picked = computed(() => (selectedCell.value != null ? data.value?.cells[selectedCell.value] : null))
</script>

<template>
  <div class="detail">
    <!-- SCENE space: the polytope -->
    <template v-if="isPolytope">
      <div class="modebar">
        <Button size="small" label="This polytope" :severity="mode === 'single' ? 'primary' : 'secondary'" :outlined="mode !== 'single'" @click="mode = 'single'" />
        <Button size="small" label="Shared space" :severity="mode === 'shared' ? 'primary' : 'secondary'" :outlined="mode !== 'shared'" @click="mode = 'shared'" />
        <span class="mhint">{{ mode === 'single' ? 'the ' + polyTitle + ' of this collection' : 'every polytope in one projective space' }}</span>
      </div>
      <template v-if="mode === 'single'">
        <polytope-figure v-if="data && data.vertices.length"
                      :vertices="data.vertices" :edges="data.edges"
                      :cells="data.cells.map((c) => ({ verts: c.verts, label: c.label }))"
                      :selected="selectedCell" :scale="1.7" @select="onCell($event.detail)" />
        <p v-else-if="loading" class="hint">building…</p>
        <p v-if="data" class="cap">
          The <b>{{ polyTitle }}</b> of order {{ n }} — its <b>{{ data.vertices.length }}</b> vertices are the dim-0
          faces, and every one of its {{ data.cells.length }} {{ collection }} is a face. Click any face.
          <template v-if="picked"> &ensp;·&ensp; <span class="kind">{{ dimName(picked.dim) }}</span> <code>{{ picked.label }}</code></template>
        </p>
      </template>
      <ProjectiveView v-else />
    </template>

    <!-- PAGE space: a gallery of element glyphs -->
    <template v-else-if="hasPageGlyph">
      <p class="cap" v-if="sizeGraded">Every element of <code>{{ collection }}</code>({{ n }}) as a glyph — the first {{ gallery.length }}. Click one.</p>
      <p class="cap" v-else>The first {{ gallery.length }} elements of <code>{{ collection }}</code> as a glyph. Click one.</p>
      <div class="gallery">
        <button v-for="g in gallery" :key="String(g.__rank)" class="gcell" :class="{ sel: g.element != null && g.element === selectedSer }"
                :title="'#' + g.__rank + '  ' + g.element" @click="onGalleryClick(g)">
          <svg-figure v-if="typeof g.__svg === 'string'" :svg="g.__svg" />
          <span class="grank">{{ g.__rank }}</span>
        </button>
      </div>
    </template>

    <!-- no visual cast yet -->
    <div v-else class="disabled">
      <p>No collection-level visual for <code>{{ collection }}</code> yet.</p>
      <p class="hint">A glyph is a cast of the element data into a space; carriers without one fall through here.</p>
    </div>
  </div>
</template>

<style scoped>
.detail { min-height: 8rem; }
.disabled { padding: 2rem 1rem; color: var(--p-text-muted-color); }
.disabled code, .cap code { font-family: ui-monospace, monospace; color: var(--p-text-color); }
.hint { font-size: 0.85rem; color: var(--p-text-muted-color); }
.modebar { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
.mhint { font-size: 0.8rem; color: var(--p-text-muted-color); }
.cap { font-size: 0.9rem; color: var(--p-text-muted-color); margin: 0.2rem 0 0.8rem; }
.cap .kind { color: var(--p-text-muted-color); }
.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 0.5rem; }
.gcell { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; padding: 0.5rem; border: 1px solid var(--p-content-border-color); border-radius: 8px; background: var(--p-content-hover-background); cursor: pointer; min-height: 72px; justify-content: center; overflow: hidden; }
.gcell:hover { border-color: var(--p-primary-color); }
.gcell.sel { border-color: var(--p-primary-color); background: color-mix(in srgb, var(--p-primary-color) 12%, transparent); }
.gcell svg-figure { max-width: 100%; }
.grank { font: 600 0.7rem ui-monospace, monospace; color: var(--p-text-muted-color); }
</style>
