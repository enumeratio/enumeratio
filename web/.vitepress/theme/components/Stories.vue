<script setup lang="ts">
// Storybook cards on a component's reference page: each of the component's stories
// (packages/components/reference/<Name>.stories.yaml, via stories-data.ts) as a live render
// plus its markup. The vdom is the source of truth and renders through `toVNode`; the markup
// shown under it is `markupOf(story.vdom)`, derived once at generation time and pinned in the
// generated data -- never re-derived here, so it cannot show something the live render didn't.
import type { Rendering } from "@enumeratio/frontend/symbols";
import { toVNode } from "@enumeratio/frontend/vdom";
import { h } from "vue";
import { renderProseMath } from "../../prose-math.ts";
import type { StoryData, StoryVdom } from "../../data/stories.ts";

defineProps<{ stories: readonly StoryData[] }>();

// A story's caption/notes are prose like an example's caption, not markdown: `$…$` becomes
// typeset math and everything else is escaped (renderProseMath, shared with ReferencePage.vue's
// `linkify` and the guides' markdown-it plugin -- the same syntax works the same way everywhere).
const prose = (text?: string): string => renderProseMath(text ?? "");

/** A story's vdom, with every node's attributes defaulted -- `toVNode` reads them unconditionally. */
function asRendering(vdom: StoryVdom): Rendering {
  return {
    tag: vdom.tag,
    attributes: vdom.attributes ?? {},
    children: vdom.children?.map(asRendering),
    text: vdom.text,
  };
}

/** A render-function component for one story: `<component :is="liveNode(story)" />`. */
const liveNode = (story: StoryData) => () => toVNode(asRendering(story.vdom), h);

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
          <summary>markup</summary>
          <pre><code>{{ story.markup }}</code></pre>
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
</style>
