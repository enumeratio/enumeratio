// stories-data.ts is written at build by scripts/collect-stories.ts from reference/<Name>.stories.yaml
// (the component reference pages read it, not the YAML). The records are checked here, and that
// the build produced a table for each.

import { readdirSync } from "node:fs";
import { COMPONENT_STORIES_SCHEMA, validateSchema } from "@enumeratio/entry/schema";
import { readStories, STORIES_SUFFIX } from "@enumeratio/entry/node";
import { expect, test } from "vite-plus/test";
import { STORIES_DATA } from "../src/stories-data.ts";

const referenceDir = new URL("../reference/", import.meta.url);

const names = readdirSync(referenceDir)
  .filter((f) => f.endsWith(STORIES_SUFFIX))
  .map((f) => f.slice(0, -STORIES_SUFFIX.length))
  .toSorted();

test("every stories file is valid, and the build collected each story", () => {
  expect(Object.keys(STORIES_DATA).toSorted()).toEqual(names);
  for (const name of names) {
    const stories = readStories(referenceDir, name);
    expect(validateSchema(COMPONENT_STORIES_SCHEMA, stories), name).toEqual([]);
    expect(new Set(stories.map((s) => s.id)).size, `${name}: duplicate story id`).toBe(stories.length);
    expect(
      STORIES_DATA[name]?.map((s) => s.id),
      name,
    ).toEqual(stories.map((s) => s.id));
  }
});

test("every story has its written forms", () => {
  for (const stories of Object.values(STORIES_DATA)) {
    for (const story of stories) expect(story.forms.map((f) => f.id)).toEqual(["epsil", "html", "vdom"]);
  }
});
