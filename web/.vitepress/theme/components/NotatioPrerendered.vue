<script setup lang="ts">
// Where the build writes what it rendered for the element around it (data/prerender-markup.ts):
// a cell's typeset rows and answer, a plot's picture. On the first load the content is read
// back from the page before hydrating, so the two agree; after a client-side navigation there's
// none, and the element renders itself.
const props = defineProps<{ at: number }>();
const html = import.meta.env.SSR
  ? ""
  : (document.querySelector(`span.notatio-prerendered[data-prerender="${props.at}"]`)?.innerHTML ?? "");
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- written by this site's own build -->
  <span class="notatio-prerendered" :data-prerender="at" v-html="html"></span>
</template>
