<script setup lang="ts">
// A live Hasse diagram of a collection's element relation (e.g. the refinement order on set partitions), drawn by
// the db's own hasse_svg(collection, rel_id, n) — no client-side layout, the geometry comes straight from SQL.
// Embedded in markdown as <ClientOnly><HasseDiagram collection="set_partitions" rel="refinement" :n="3" /></ClientOnly>.
import { onMounted, ref, watch } from 'vue'
import { runSql } from '@enumeratio/client'

const props = defineProps<{ collection: string; rel: string; n: number; title?: string }>()

const svg = ref('')
const ready = ref(false)
const error = ref('')

async function load() {
  ready.value = false
  error.value = ''
  try {
    const [row] = await runSql<{ svg: string }>('SELECT hasse_svg($1, $2, $3) AS svg', [props.collection, props.rel, props.n])
    svg.value = row?.svg ?? ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
  ready.value = true
}

onMounted(load)
watch(() => [props.collection, props.rel, props.n], load)
</script>

<template>
  <div class="hasse">
    <p v-if="!ready" class="muted">drawing the {{ title ?? rel }} lattice…</p>
    <p v-else-if="error" class="err">⚠ {{ error }}</p>
    <svg-figure v-else fullscreenable :svg="svg"></svg-figure>
  </div>
</template>

<style scoped>
.hasse { margin: 1rem 0; }
.hasse svg-figure { display: block; height: auto; max-height: 22rem; }
.muted { color: var(--vp-c-text-2); }
.err { color: var(--p-red-500, #dc2626); }
</style>
