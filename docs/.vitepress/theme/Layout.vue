<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { computed, watchEffect } from 'vue'
import { useData } from 'vitepress'
import Explorer from '../components/Explorer.vue'

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
