<script setup lang="ts">
// A tiny live component: lists the pure-SQL core's collections in-page. Embedded in markdown as
// <ClientOnly><LiveCollections /></ClientOnly> to show that interactive, pglite-backed components sit right
// inside the prose docs.
import { onMounted, ref } from 'vue'
import { collections } from '@enumeratio/client'

// Db is ambient: the docs theme installs the single (off-thread) provider globally, so this widget shares the one
// pglite with every other live component and the explorer — no separate boot.
const colls = ref<string[]>([])
const ready = ref(false)
onMounted(async () => {
  colls.value = await collections()
  ready.value = true
})
</script>

<template>
  <div class="live">
    <p v-if="!ready" class="muted">booting the in-browser core…</p>
    <template v-else>
      <p class="muted">{{ colls.length }} collections, live from pglite:</p>
      <div class="grid">
        <a v-for="c in colls.slice(0, 24)" :key="c" class="chip" :href="`/explore/collection/${c}`">{{ c }}</a>
        <span v-if="colls.length > 24" class="muted">+{{ colls.length - 24 }} more…</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.live { border: 1px solid var(--vp-c-divider); border-radius: 8px; padding: 1rem; margin: 1rem 0; }
.grid { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: baseline; }
.chip { background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 0.1rem 0.45rem; font-size: 0.82rem; text-decoration: none; color: var(--vp-c-text-1); }
.muted { color: var(--vp-c-text-2); }
</style>
