<script setup lang="ts">
// Where the build writes what it rendered for the element around it (data/prerender-markup.ts):
// a cell's typeset rows and answer, a plot's picture. On the first load the content is read
// back from the page before hydrating, so the two agree; after a client-side navigation there's
// none, and the element renders itself.
import { onMounted, useTemplateRef } from "vue";
import { HYDRATED_ATTRIBUTE, HYDRATED_EVENT } from "../hydration.ts";

const props = defineProps<{ at: number }>();
const root = useTemplateRef("root");
const html = import.meta.env.SSR
  ? ""
  : (document.querySelector(`span.notatio-prerendered[data-prerender="${props.at}"]`)?.innerHTML ?? "");

// Runs after Vue has dropped any children the element rendered beside the placeholder: the signal
// that it is safe to define the elements (hydration.ts).
onMounted(() => {
  root.value?.setAttribute(HYDRATED_ATTRIBUTE, "");
  document.dispatchEvent(new Event(HYDRATED_EVENT));
});
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- written by this site's own build -->
  <span ref="root" class="notatio-prerendered" :data-prerender="at" v-html="html"></span>
</template>
