<script setup lang="ts">
import { computed } from "vue";
import { data as components } from "../../data/components.data.ts";
import { inline, paragraphs as split } from "./jsdoc.ts";

const props = defineProps<{ tag: string }>();
const component = computed(() => components.find((c) => c.tag === props.tag));

const paragraphs = computed(() => split(component.value?.summary ?? ""));

// The same rule data/wrappers.ts names the generated Vue component by.
const wrapper = computed(() =>
  props.tag
    .replace(/^notatio-/, "")
    .split("-")
    .map((part) => (/^\d/.test(part) ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)))
    .join(""),
);
</script>

<template>
  <div v-if="component" class="component-page">
    <p v-for="(p, i) in paragraphs" :key="i" v-html="p" />

    <p class="meta">
      <a v-if="component.playground" :href="component.playground">Stories in the playground</a>
      <span v-if="component.playground" class="sep">·</span>
      <code>{{ component.source }}</code>
      <span class="sep">·</span>
      in Vue: <code>&lt;{{ wrapper }}&gt;</code>
    </p>

    <h2>Attributes</h2>
    <p v-if="component.attributes.length === 0">This component takes no attributes.</p>
    <table v-else>
      <thead>
        <tr>
          <th>Attribute</th>
          <th>Type</th>
          <th>Default</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in component.attributes" :key="a.attribute">
          <td>
            <code>{{ a.attribute }}</code>
            <div v-if="a.property !== a.attribute" class="prop">
              property <code>{{ a.property }}</code>
            </div>
          </td>
          <td>
            <code v-if="a.type">{{ a.type }}</code>
            <span v-else>—</span>
          </td>
          <td>
            <code v-if="a.default">{{ a.default }}</code>
            <span v-else>—</span>
          </td>
          <td>
            <span v-if="a.description" v-html="inline(a.description)" />
            <em v-if="a.reflects" class="reflects">reflects</em>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <p v-else>
    No component named <code>{{ tag }}</code
    >.
  </p>
</template>

<style scoped>
.component-page table {
  display: table;
  width: 100%;
}
.component-page td {
  vertical-align: top;
}
.prop,
.reflects {
  color: var(--vp-c-text-3);
  font-size: 0.85em;
}
.reflects {
  margin-left: 0.4em;
  white-space: nowrap;
}
.meta {
  color: var(--vp-c-text-2);
  font-size: 0.9em;
}
.sep {
  margin: 0 0.5em;
}
</style>
