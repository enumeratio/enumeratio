// readStories/writeStories (node.ts): the reader and writer every component's
// <Name>.stories.yaml goes through, mirroring readEntry/writeEntry for examples.

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import type { ComponentStory } from "../src/types.ts";
import { readStories, STORIES_SUFFIX, writeStories } from "../src/node.ts";

const dirs: string[] = [];
const tmpDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "entry-stories-"));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const STORY: ComponentStory = {
  id: "a-3-3-matrix",
  caption: "A 3×3 matrix",
  vdom: { tag: "notatio-bar-chart-3d", attributes: { data: "[[1,2,3],[2,4,3],[3,1,5]]" } },
};

test("readStories on a component with no stories file reads as none", () => {
  expect(readStories(tmpDir(), "BarChart3D")).toEqual([]);
});

test("writeStories then readStories round-trips", async () => {
  const dir = tmpDir();
  await writeStories(dir, "BarChart3D", [STORY, { ...STORY, id: "again", category: "Bars" }]);
  expect(readStories(dir, "BarChart3D")).toEqual([STORY, { ...STORY, id: "again", category: "Bars" }]);
});

test("writing no stories removes an existing file", async () => {
  const dir = tmpDir();
  await writeStories(dir, "BarChart3D", [STORY]);
  const path = join(dir, `BarChart3D${STORIES_SUFFIX}`);
  expect(existsSync(path)).toBe(true);
  await writeStories(dir, "BarChart3D", []);
  expect(existsSync(path)).toBe(false);
});
