import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vite-plus/test";
import { entries } from "../src/index.ts";
import { checkImplementations } from "../src/validate.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");
const exists = (path: string): boolean => existsSync(resolve(repoRoot, path));

test("every implementation block in this package is well formed", () => {
  expect(checkImplementations(entries, exists)).toEqual([]);
});

test("the rules actually reject", () => {
  // A validator nobody has seen fail is not evidence of anything.
  expect(
    checkImplementations(
      [
        {
          name: "A",
          domain: "",
          signature: "",
          summary: "",
          examples: [],
          implementations: [
            { origin: "native", form: "typescript", source: "packages/nope/does-not-exist.ts" },
          ],
        },
        {
          name: "B",
          domain: "",
          signature: "",
          summary: "",
          examples: [],
          implementations: [{ origin: "component", form: "<x-y>", environment: "engine" }],
        },
        {
          name: "C",
          domain: "",
          signature: "",
          summary: "",
          examples: [],
          implementations: [{ origin: "reference", form: "notatio" }],
        },
      ],
      exists,
    ).map((p) => p.entry),
  ).toEqual(["A", "A", "B", "B", "B", "C"]);
});
