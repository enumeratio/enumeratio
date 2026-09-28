<script setup lang="ts">
// Storybook cards on a component's reference page: each of the component's stories
// (packages/components/reference/<Name>.stories.yaml, via stories-data.ts) as a live render
// plus its source. `expr` is the source of truth (design/vdom.md); the live render is
// `vdomOf(expr)` handed to Vue's `h` through `toVNode`, computed here at runtime -- that
// lowering is cheap and pure. The source panel shows `story.forms`, a tab per written form
// (today: `head`, the STRUCTURAL tree with PascalCase heads; `html`, the lit-tag markup a
// plain-HTML host would write), each derived once at generation time and pinned in the
// generated data -- never re-derived here, so a tab cannot show something that doesn't match
// what was reviewed. More forms land as more tabs, not a wider switch statement.
import { toVNode, vdomOf } from "@enumeratio/frontend/vdom";
import { h, reactive } from "vue";
import { renderProseMath } from "../../prose-math.ts";
import type { StoryData } from "../../data/stories.ts";

defineProps<{ stories: readonly StoryData[] }>();

// A story's caption/notes are prose like an example's caption, not markdown: `$…$` becomes
// typeset math and everything else is escaped (renderProseMath, shared with ReferencePage.vue's
// `linkify` and the guides' markdown-it plugin -- the same syntax works the same way everywhere).
const prose = (text?: string): string => renderProseMath(text ?? "");

/** A render-function component for one story: `<component :is="liveNode(story)" />`. */
const liveNode = (story: StoryData) => () => toVNode(vdomOf(story.expr as never), h);

/** The active tab per story id, defaulting to the first form (`head`). */
const activeForm = reactive(new Map<string, string>());
const formFor = (story: StoryData): string => activeForm.get(story.id) ?? story.forms[0]?.id ?? "";
const selectForm = (story: StoryData, id: string): void => {
  activeForm.set(story.id, id);
};

/** Stories grouped by category, in first-seen order; an uncategorised story falls under "". */
function grouped(stories: readonly StoryData[]): { category: string; stories: StoryData[] }[] {
  const groups: { category: string; stories: StoryData[] }[] = [];
  for (const story of stories) {
    const category = story.category ?? "";
    let group = groups.find((g) => g.category === category);
    if (!group) groups.push((group = { category, stories: [] }));
    group.stories.push(story);
  }
  return groups;
}
</script>

<template>
  <div v-if="stories.length > 0" class="stories">
    <template v-for="group in grouped(stories)" :key="group.category">
      <h2 v-if="group.category">{{ group.category }}</h2>
      <div v-for="story in group.stories" :id="`story/${story.id}`" :key="story.id" class="story">
        <div class="story-head">
          <h3 class="story-title">
            <a :href="`#story/${story.id}`" class="story-anchor" aria-hidden="true">#</a>
            <span v-html="prose(story.caption)" />
          </h3>
          <p v-if="story.notes" class="story-notes" v-html="prose(story.notes)" />
        </div>
        <div class="story-canvas">
          <ClientOnly>
            <component :is="liveNode(story)" />
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
              :aria-selected="formFor(story) === form.id"
              :class="{ active: formFor(story) === form.id }"
              @click="selectForm(story, form.id)"
            >
              {{ form.label }}
            </button>
          </div>
          <pre
            v-for="form in story.forms.filter((f) => f.id === formFor(story))"
            :key="form.id"
            role="tabpanel"
          ><code>{{ form.text }}</code></pre>
        </details>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stories {
  margin: 1.5rem 0;
}
.story {
  margin: 1.25rem 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
  background: var(--vp-c-bg);
}
.story-head {
  padding: 0.7rem 1rem 0;
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
  padding: 1.25rem 1rem;
  background:
    radial-gradient(var(--vp-c-divider) 1px, transparent 1px) 0 0 / 16px 16px,
    var(--vp-c-bg-soft);
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
  padding: 0.5rem 1rem 0.9rem;
  overflow-x: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 0.8rem;
  color: var(--vp-c-text-1);
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
</style>
