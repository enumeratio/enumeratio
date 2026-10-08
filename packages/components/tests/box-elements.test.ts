// Every box primitive is a registered tag: empty elements for the boxes without behavior, the
// interactive ones left to their own modules, and a tag someone else defined left alone.

import { BOX_TAGS } from "@enumeratio/frontend/box-tags";
import { expect, test } from "vite-plus/test";
import { defineBoxElements, INTERACTIVE_BOX_TAGS, PLAIN_BOX_TAGS } from "../src/box-elements.ts";
import { LAZY_TAGS } from "../src/lazy.ts";

// Node has no DOM; the registry only needs a class to extend.
(globalThis as { HTMLElement?: unknown }).HTMLElement ??= class {};

function fakeRegistry(taken: readonly string[] = []) {
  const defined = new Map<string, unknown>(taken.map((tag) => [tag, "someone else's"]));
  return {
    defined,
    registry: {
      define: (tag: string, constructor: CustomElementConstructor) => void defined.set(tag, constructor),
      get: (tag: string) => defined.get(tag) as CustomElementConstructor | undefined,
    },
  };
}

test("every box tag is registered, either empty or by its own lazily loaded module", () => {
  const { defined, registry } = fakeRegistry();
  defineBoxElements(registry);
  expect([...defined.keys()].toSorted()).toEqual([...PLAIN_BOX_TAGS].toSorted());
  expect(PLAIN_BOX_TAGS.length + INTERACTIVE_BOX_TAGS.size).toBe(BOX_TAGS.length);
  for (const tag of INTERACTIVE_BOX_TAGS) expect(LAZY_TAGS).toContain(tag);
  expect(PLAIN_BOX_TAGS).toContain("row-box");
  expect(PLAIN_BOX_TAGS).not.toContain("table-view-box");
});

test("a tag already defined is left to its definer, and a second call changes nothing", () => {
  const { defined, registry } = fakeRegistry(["row-box"]);
  defineBoxElements(registry);
  expect(defined.get("row-box")).toBe("someone else's");
  const before = new Map(defined);
  defineBoxElements(registry);
  expect(defined).toEqual(before);
});
