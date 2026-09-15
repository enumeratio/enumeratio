<script setup lang="ts">
import { data as components } from "../../data/components.data.ts";
import { inline } from "./jsdoc.ts";

// The first paragraph of the class JSDoc, with the leading `<tag …>` example trimmed --
// the tag is already the link text next to it.
const blurb = (summary: string): string => {
  const first = summary
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, " ")
    .trim();
  return inline(first.replace(/^`<[^`]*>`\s*(--|—)\s*/, ""));
};
</script>

<template>
  <ul class="component-index">
    <li v-for="c in components" :key="c.tag">
      <a :href="`/reference/components/${c.tag}`"
        ><code>&lt;{{ c.tag }}&gt;</code></a
      >
      — <span v-html="blurb(c.summary)" />
      <span class="count">{{ c.attributes.length }} attributes</span>
    </li>
  </ul>
</template>

<style scoped>
.component-index {
  padding-left: 1.2rem;
}
.component-index li {
  margin: 0.55rem 0;
}
.count {
  color: var(--vp-c-text-3);
  font-size: 0.85em;
  white-space: nowrap;
}
</style>
