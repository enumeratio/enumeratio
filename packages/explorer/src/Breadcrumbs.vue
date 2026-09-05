<script setup lang="ts">
// The route-STACK trail (#181): the places this session has hopped through via an internal cross-link — a
// map/through image, a drill-element, a sibling, the root back-link — plus where it is now. Past places are
// clickable (jump back, truncating the trail to that point); the current place is not. `via`, when a hop came
// from following a map, is drawn on the connector so the trail reads "Permutations —inverse→ Permutations", not
// just a repeated name. Purely a renderer: CollectionView owns the trail (route.ts's pushCrumb/reconcileCrumbs)
// and the actual navigation; this only draws it and reports which crumb was clicked.
import type { RouteCrumb } from './route'

defineProps<{
  crumbs: RouteCrumb[]
  /** the CURRENT place — not part of `crumbs` (that's past places only), drawn last and unclickable */
  currentTitle: string
  /** the current element serialization; undefined/null = collection view, no element pinned; '' = the bottom element */
  currentElement?: string | null
}>()
const emit = defineEmits<{ go: [number] }>()
</script>

<template>
  <nav v-if="crumbs.length" class="crumbs" aria-label="navigation trail">
    <template v-for="(c, i) in crumbs" :key="i">
      <button type="button" class="crumb" :title="`back to ${c.title}`" @click="emit('go', i)">
        {{ c.title }}<code v-if="c.address.element != null" class="el">{{ c.address.element || '∅' }}</code>
      </button>
      <span class="sep" :class="{ via: !!c.via }">{{ c.via ? `–${c.via}→` : '›' }}</span>
    </template>
    <span class="crumb current">
      {{ currentTitle }}<code v-if="currentElement != null" class="el">{{ currentElement || '∅' }}</code>
    </span>
  </nav>
</template>

<style scoped>
.crumbs { display: flex; align-items: center; flex-wrap: wrap; gap: 0.3rem; margin: 0 0 0.4rem; font-size: 0.82rem; }
.crumb { display: inline-flex; align-items: baseline; gap: 0.3rem; border: none; background: none; padding: 0.1rem 0.3rem;
  border-radius: 4px; color: var(--p-primary-color); cursor: pointer; font: inherit; }
button.crumb:hover { text-decoration: underline; background: var(--p-content-hover-background); }
.crumb.current { color: var(--p-text-muted-color); font-weight: 600; cursor: default; }
.el { font-family: var(--e-font-mono, ui-monospace, monospace); font-size: 0.85em; opacity: 0.75; }
.sep { color: var(--p-text-muted-color); opacity: 0.6; font-size: 0.78rem; }
.sep.via { opacity: 0.9; font-style: italic; }
</style>
