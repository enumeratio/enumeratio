// stories-data.ts is generated from reference/<Name>.stories.yaml by
// scripts/collect-stories.ts -- the component reference pages read this file, not the YAML
// (it runs in the browser and the site build, and cannot parse YAML there). This pins that the
// generated file is current; regenerate with:
//
//   vp node packages/components/scripts/collect-stories.ts

import { readdirSync } from "node:fs";
import { COMPONENT_STORIES_SCHEMA, validateSchema } from "@enumeratio/entry/schema";
import { readStories, STORIES_SUFFIX } from "@enumeratio/entry/node";
import { toInputForm } from "@enumeratio/formats";
import { reactMarkupOf, usageOf, vueMarkupOf } from "@enumeratio/frontend/generate";
import { markupOf, renderingOf } from "@enumeratio/frontend/symbols";
import { structuralMarkupOf } from "@enumeratio/frontend/reflect";
import { structuralOf, vdomOf } from "@enumeratio/frontend/vdom";
import { expect, test } from "vite-plus/test";
import { type StoryData, type StoryForm, STORIES_DATA } from "../src/stories-data.ts";

const referenceDir = new URL("../reference/", import.meta.url);

const escapeAttr = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const notatioFallback = (json: never): string => `<Notatio expr="${escapeAttr(toInputForm(json))}" />`;

/** Every written form of `expr`, mirroring collect-stories.ts's `formsOf`. */
function formsOf(expr: StoryData["expr"]): StoryForm[] {
  const json = expr as never;
  const usage = usageOf(json);
  return [
    { id: "epsil", label: "Epsil", caption: "notebook cells, the CLI, <Notatio expr>", text: toInputForm(json) },
    {
      id: "vue",
      label: "Vue",
      caption: "VitePress, Vue SFCs, Nuxt",
      text: usage ? vueMarkupOf(usage) : notatioFallback(json),
    },
    {
      id: "react",
      label: "React",
      caption: "MDX, Next, any React",
      text: usage ? reactMarkupOf(usage) : notatioFallback(json),
    },
    { id: "html", label: "Web component", caption: "plain HTML", text: markupOf(renderingOf(json) ?? vdomOf(json)) },
    {
      id: "vdom",
      label: "vdom",
      caption: "the expression's own tree -- every head a tag, every argument a child",
      text: structuralMarkupOf(structuralOf(json)),
    },
  ];
}

test("stories-data.ts is what the current records collect to", () => {
  const names = readdirSync(referenceDir)
    .filter((f) => f.endsWith(STORIES_SUFFIX))
    .map((f) => f.slice(0, -STORIES_SUFFIX.length))
    .sort();

  const rebuilt: Record<string, StoryData[]> = {};
  for (const name of names) {
    const stories = readStories(referenceDir, name);
    expect(validateSchema(COMPONENT_STORIES_SCHEMA, stories), name).toEqual([]);
    expect(new Set(stories.map((s) => s.id)).size, `${name}: duplicate story id`).toBe(stories.length);
    rebuilt[name] = stories.map((story) => ({
      ...story,
      forms: formsOf(story.expr),
    }));
  }

  expect(STORIES_DATA).toEqual(rebuilt);
});

test("every story's pinned forms are its own expr's formsOf, not something re-derived live", () => {
  for (const stories of Object.values(STORIES_DATA)) {
    for (const story of stories) expect(story.forms).toEqual(formsOf(story.expr));
  }
});
