<script setup lang="ts">
// Storybook cards on a component's reference page: each of the component's stories
// (packages/components/reference/<Name>.stories.yaml, via stories-data.ts) as a live render
// plus its source. `expr` is the source of truth (https://github.com/enumeratio/enumeratio/wiki/Vdom); the live render is
// `vdomOf(expr)` handed to Vue's `h` through `toVNode`, computed here at runtime -- that
// lowering is cheap and pure. The source panel shows `story.forms`, a tab per written form --
// `epsil` (the default), `vue`, `react`, `html`, and `vdom` -- each with a caption saying
// where it's actually written, derived once at generation time and pinned in the generated
// data -- never re-derived here, so a tab cannot show something that doesn't match what was
// reviewed. More forms land as more tabs, not a wider switch statement.
import type { StoryData } from "../../data/stories.ts";
import StoryCard from "./StoryCard.vue";

defineProps<{ stories: readonly StoryData[] }>();

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
      <h3 v-if="group.category" class="story-category">{{ group.category }}</h3>
      <StoryCard v-for="story in group.stories" :key="story.id" :story="story" />
    </template>
  </div>
</template>

<style scoped>
.stories {
  margin: 1.5rem 0;
}
</style>
