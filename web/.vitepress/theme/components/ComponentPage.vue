<script setup lang="ts">
import { computed } from "vue";
import { DRAWING_SYMBOLS } from "@enumeratio/frontend/symbols";
import { data as components } from "../../data/components.data.ts";
import { storiesFor } from "../../data/stories.ts";
import { inline, paragraphs as split } from "./jsdoc.ts";
import Stories from "./Stories.vue";

// The page is keyed by the Vue/React name (`BarChart3D`), not the lit tag -- the route
// /reference/component/<Name> matches /reference/symbol/<Head>, and every heading, the props
// table and the prose below are all in that vdom vocabulary. The tag itself shows up only in
// the "As a web component" section at the bottom.
const props = defineProps<{ name: string }>();
const component = computed(() => components.find((c) => c.name === props.name));

const paragraphs = computed(() => split(component.value?.summary ?? ""));
const stories = computed(() => storiesFor(props.name));

// Every head this tag draws -- a family tag (`notatio-chart`) draws several (`Histogram`,
// `PieChart`, …), each with its own symbol page; a direct element draws just its own.
const heads = computed(() => {
  const tag = component.value?.tag;
  return tag === undefined ? [] : DRAWING_SYMBOLS.filter((s) => s.tag === tag).map((s) => s.head);
});

// A prop the generated Vue/React component actually declares -- `attribute: false` entries
// are JS-only properties with no attribute at all, so they don't reach the wrapper's typed
// props (@enumeratio/frontend/generate's `componentSource` excludes them the same way) and
// are called out separately below instead of in the props table.
const props_ = computed(() => component.value?.attributes.filter((a) => !a.propertyOnly) ?? []);
const propertyOnly = computed(() => component.value?.attributes.filter((a) => a.propertyOnly) ?? []);
</script>

<template>
  <div v-if="component" class="component-page">
    <p v-for="(p, i) in paragraphs" :key="i" v-html="p" />

    <p class="meta">
      <a v-if="component.playground" :href="component.playground">Stories in the playground</a>
      <span v-if="component.playground" class="sep">·</span>
      <code>{{ component.source }}</code>
      <template v-if="heads.length > 0">
        <span class="sep">·</span>
        draws
        <template v-for="(h, i) in heads" :key="h"
          ><a :href="`/reference/symbol/${h}`"
            ><code>{{ h }}</code></a
          ><span v-if="i < heads.length - 1">, </span></template
        >
      </template>
    </p>

    <template v-if="stories.length > 0">
      <h2>Stories</h2>
      <Stories :stories="stories" />
    </template>

    <h2>Props</h2>
    <p v-if="props_.length === 0">This component takes no props.</p>
    <table v-else>
      <thead>
        <tr>
          <th>Prop</th>
          <th>Type</th>
          <th>Default</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in props_" :key="a.property">
          <td>
            <code>{{ a.property }}</code>
            <div v-if="a.property !== a.attribute" class="prop">
              attribute <code>{{ a.attribute }}</code>
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

    <h2>As a web component</h2>
    <p>
      Plain custom elements, no framework required: import <code>@enumeratio/frontend</code> for the side effect and
      write <code>&lt;{{ component.tag }}&gt;</code> in any HTML. Attributes are kebab-case and always strings; the
      props table above names each one's attribute where it differs from its prop.
    </p>
    <p v-if="propertyOnly.length > 0">
      Settable only as a JS property, not an attribute --
      <template v-for="(a, i) in propertyOnly" :key="a.property"
        ><code>{{ a.property }}</code
        ><span v-if="i < propertyOnly.length - 1">, </span></template
      >: bind with <code>:{{ propertyOnly[0]?.property }}.prop="…"</code> directly on the tag.
    </p>
  </div>
  <p v-else>
    No component named <code>{{ name }}</code
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
