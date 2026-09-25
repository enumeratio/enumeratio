<script setup lang="ts">
// Wraps VitePress's DefaultTheme.Layout to mount the dev-only review sidebar on
// every docs page (see web/.vitepress/theme/components/ReviewPanel.vue). The
// `import.meta.env.DEV` check has to gate the dynamic import itself, not just this
// component -- Rollup's static analysis otherwise still emits ReviewPanel's chunk
// into the production bundle even though no built page ever renders it (same trap
// noted for the old ReviewMode.vue in index.mts).
import DefaultTheme from "vitepress/theme";
import { defineAsyncComponent } from "vue";

const { Layout: Base } = DefaultTheme;

const ReviewPanel = import.meta.env.DEV
  ? defineAsyncComponent(() => import("./components/ReviewPanel.vue"))
  : undefined;
</script>

<template>
  <Base>
    <template #layout-top>
      <component :is="ReviewPanel" v-if="ReviewPanel" />
    </template>
  </Base>
</template>
