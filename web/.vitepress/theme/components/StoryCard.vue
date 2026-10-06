<script setup lang="ts">
// One story card: the live render in a canvas (which can take over the window), and its source
// as a tab per written form. See Stories.vue for where the data comes from.
import { toVNode, vdomOf } from "@enumeratio/frontend/vdom";
import { h, ref } from "vue";
import { renderInline } from "../../prose.ts";
import type { StoryData } from "../../data/stories.ts";
import { useFullWindow } from "../composables/useFullWindow.ts";
import FullWindowButton from "./FullWindowButton.vue";

const props = defineProps<{ story: StoryData }>();

// A story's caption and notes are prose like an example's caption (prose.ts).
const prose = (text?: string): string => renderInline(text ?? "");

/** A render-function component for the story: `<component :is="live" />`. */
const live = () => toVNode(vdomOf(props.story.expr as never), h);

const root = ref<HTMLElement | null>(null);
const fullWindow = useFullWindow(root);

/** The active tab, defaulting to the first form (`head`). */
const selected = ref<string | undefined>();
const formId = (): string => selected.value ?? props.story.forms[0]?.id ?? "";
</script>

<template>
  <div
    :id="`story/${story.id}`"
    ref="root"
    class="story"
    :class="{ 'is-full-window': fullWindow.active.value }"
    :style="fullWindow.style.value"
  >
    <FullWindowButton :active="fullWindow.active.value" :label="fullWindow.label.value" @toggle="fullWindow.toggle" />
    <div class="story-head">
      <h4 class="story-title">
        <a :href="`#story/${story.id}`" class="story-anchor" aria-hidden="true">#</a>
        <span v-html="prose(story.caption)" />
      </h4>
      <p v-if="story.notes" class="story-notes" v-html="prose(story.notes)" />
    </div>
    <div class="story-canvas">
      <ClientOnly>
        <component :is="live" />
      </ClientOnly>
    </div>
    <details class="story-code">
      <summary>source</summary>
      <div v-if="story.forms.length > 1" class="story-tabs" role="tablist">
        <button
          v-for="form in story.forms"
          :key="form.id"
          type="button"
          role="tab"
          :aria-selected="formId() === form.id"
          :class="{ active: formId() === form.id }"
          @click="selected = form.id"
        >
          {{ form.label }}
        </button>
      </div>
      <template v-for="form in story.forms.filter((f) => f.id === formId())" :key="form.id">
        <pre role="tabpanel"><code>{{ form.text }}</code></pre>
        <p class="story-form-caption">{{ form.caption }}</p>
      </template>
    </details>
  </div>
</template>

<style scoped>
.story {
  position: relative;
  margin: 1.25rem 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
  background: var(--vp-c-bg);
}
.story-head {
  padding: 0.7rem 2.5rem 0 1rem;
}
.story-title {
  position: relative;
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  scroll-margin-top: var(--vp-nav-height, 64px);
}
.story-anchor {
  position: absolute;
  margin-left: -1.05em;
  padding-right: 0.35em;
  color: var(--vp-c-brand-1);
  opacity: 0;
  text-decoration: none;
  transition: opacity 0.15s;
}
.story-head:hover .story-anchor,
.story-anchor:focus {
  opacity: 1;
}
.story:target {
  scroll-margin-top: var(--vp-nav-height, 64px);
}
.story:target .story-title {
  color: var(--vp-c-brand-1);
}
.story-notes {
  margin: 0.3rem 0 0;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}
.story-canvas {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
  /* A wide child (a table) scrolls here rather than being clipped by .story. */
  overflow-x: auto;
  padding: 1.25rem 1rem;
  background:
    radial-gradient(var(--vp-c-divider) 1px, transparent 1px) 0 0 / 16px 16px,
    var(--vp-c-bg-soft);
}
.story-canvas :deep(notatio-collection-table) {
  max-width: 100%;
  min-width: 0;
}
.story-code {
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
}
.story-code summary {
  padding: 0.4rem 1rem;
  cursor: pointer;
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
  user-select: none;
}
.story-code pre {
  margin: 0;
  padding: 0.5rem 1rem 0;
  overflow-x: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 0.8rem;
  color: var(--vp-c-text-1);
}
.story-form-caption {
  margin: 0.2rem 0 0.7rem;
  padding: 0 1rem;
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
}
.story-tabs {
  display: flex;
  gap: 0.25rem;
  padding: 0 1rem;
}
.story-tabs button {
  padding: 0.25rem 0.6rem;
  border: none;
  border-radius: 6px 6px 0 0;
  background: none;
  font: inherit;
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
  cursor: pointer;
}
.story-tabs button:hover {
  color: var(--vp-c-text-2);
}
.story-tabs button.active {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}
.story-tabs button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -2px;
}
/* Full window: the canvas covers the browser window; its content fills it. */
.story.is-full-window .story-head,
.story.is-full-window .story-code {
  display: none;
}
.story.is-full-window .story-canvas {
  position: fixed;
  inset: 0;
  z-index: calc(var(--vp-z-index-sidebar) + 10);
  flex-direction: column;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 0;
  padding: 0;
  overflow: auto;
  background: var(--vp-c-bg);
}
.story.is-full-window .story-canvas > :deep(*) {
  flex: 1 1 0;
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
