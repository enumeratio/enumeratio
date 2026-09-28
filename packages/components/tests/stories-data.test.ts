// stories-data.ts is generated from reference/<Name>.stories.yaml by
// scripts/collect-stories.ts -- the component reference pages read this file, not the YAML
// (it runs in the browser and the site build, and cannot parse YAML there). This pins that the
// generated file is current; regenerate with:
//
//   vp node packages/components/scripts/collect-stories.ts

import { readdirSync } from "node:fs";
import { COMPONENT_STORIES_SCHEMA, validateSchema } from "@enumeratio/entry/schema";
import { readStories, STORIES_SUFFIX } from "@enumeratio/entry/node";
import type { StoryVdom as EntryStoryVdom } from "@enumeratio/entry";
import { markupOf, type Rendering } from "@enumeratio/frontend";
import { expect, test } from "vite-plus/test";
import { type StoryData, type StoryVdom, STORIES_DATA } from "../src/stories-data.ts";

const referenceDir = new URL("../reference/", import.meta.url);

// `StoryVdom` (both the entry type and the generated module's mirror of it) leaves
// `attributes` optional; `Rendering` always carries it. Mirrors collect-stories.ts.
const asRendering = (vdom: StoryVdom | EntryStoryVdom): Rendering => ({
  tag: vdom.tag,
  attributes: vdom.attributes ?? {},
  children: vdom.children?.map(asRendering),
  text: vdom.text,
});

test("stories-data.ts is what the current records collect to", () => {
  const names = readdirSync(referenceDir)
    .filter((f) => f.endsWith(STORIES_SUFFIX))
    .map((f) => f.slice(0, -STORIES_SUFFIX.length))
    .sort();

  const rebuilt: Record<string, StoryData[]> = {};
  for (const name of names) {
    const stories = readStories(referenceDir, name);
    expect(validateSchema(COMPONENT_STORIES_SCHEMA, stories), name).toEqual([]);
    rebuilt[name] = stories.map((story) => ({ ...story, markup: markupOf(asRendering(story.vdom)) }));
  }

  expect(STORIES_DATA).toEqual(rebuilt);
});

test("every story's pinned markup is its own vdom's markupOf, not something re-derived live", () => {
  for (const stories of Object.values(STORIES_DATA)) {
    for (const story of stories) expect(story.markup).toBe(markupOf(asRendering(story.vdom)));
  }
});
