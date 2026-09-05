<script setup lang="ts">
// The shared-space projective view (permutahedron / associahedron / octahedron / hypercube overlaid in one
// projective coordinate system), lifted out of the explorer for embedding on its own docs page (issue #163). It is
// the same Vue component the explorer's Projective tab drives, running against the global pglite core. Browser-only
// (pglite + WebGL) — wrap the usage in <ClientOnly>.
import ProjectiveView from '@enumeratio/explorer/projective-view'
</script>

<template>
  <ProjectiveView />
</template>
