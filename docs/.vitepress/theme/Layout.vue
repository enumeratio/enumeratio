<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { computed, defineAsyncComponent, watchEffect } from 'vue'
import { useData } from 'vitepress'
// Async so the whole explorer app (@enumeratio/explorer/app + pglite) is a LAZY chunk, out of the eager theme
// bundle — it only ever mounts client-side in the not-found slot (onExplorer gates on `window`), never in SSR.
const Explorer = defineAsyncComponent(() => import('../components/Explorer.vue'))

// The explorer is a self-contained app owning the /explore/collection/* route slice. Deep paths are folded to
// /explore/collection/ in dev (config middleware) and 404 in the built site; either way this not-found slot
// renders the Explorer, which reads window.location.pathname to route itself. Everything else falls through to
// VitePress's default layout.
const { page } = useData()
const onExplorer = computed(
  () =>
    page.value.isNotFound &&
    typeof window !== 'undefined' &&
    window.location.pathname.startsWith('/explore/collection'),
)

// Back-compat (#176): the explorer used to own /explorer/* — bookmarked/linked paths there now 404, so redirect
// them once to the equivalent /explore/collection/* address instead of showing a dead page.
watchEffect(() => {
  if (!page.value.isNotFound || typeof window === 'undefined') return
  const path = window.location.pathname
  if (/^\/explorer(\/|$)/.test(path)) {
    window.location.replace(path.replace(/^\/explorer/, '/explore/collection') + window.location.search)
  }
})
</script>

<template>
  <DefaultTheme.Layout>
    <template v-if="onExplorer" #not-found>
      <Explorer />
    </template>
  </DefaultTheme.Layout>
</template>
