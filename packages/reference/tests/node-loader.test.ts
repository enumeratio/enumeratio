// `@enumeratio/reference/node`'s fs loader, over small fixture directories -- not real data
// (none exists yet; the data flip is step 4 of design/examples-as-data.md). Each fixture
// under tests/fixtures/ mimics `<packagesRoot>/<package>/reference/*.yaml`.

import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { loadReferenceData } from "../src/node.ts";

const fixture = (name: string): string =>
  fileURLToPath(new URL(`fixtures/${name}`, import.meta.url));

test("loads every head from every package's reference/ directory", () => {
  const result = loadReferenceData(fixture("node-loader"));
  expect(result.issues).toEqual([]);
  expect(result.heads.map((h) => `${h.package}/${h.head}`)).toEqual([
    "pkg-a/Mod",
    "pkg-b/FromDigits",
  ]);
});

test("reads the optional .implementations.yaml alongside its entry", () => {
  const result = loadReferenceData(fixture("node-loader"));
  const mod = result.heads.find((h) => h.head === "Mod");
  expect(mod?.implementations).toEqual({
    "zero-modulus": {
      epsil: { in: "Mod(5, 0)", out: "NaN" },
      wolfram: {
        in: "Mod[5, 0]",
        out: "Indeterminate",
        tex: { in: "(5 \\bmod 0)", out: "\\text{Indeterminate}" },
      },
    },
  });
});

test("a head with no .implementations.yaml loads with implementations undefined", () => {
  const result = loadReferenceData(fixture("node-loader"));
  const fromDigits = result.heads.find((h) => h.head === "FromDigits");
  expect(fromDigits?.implementations).toBeUndefined();
  expect(fromDigits?.entry.examples[0]?.expected).toBe(123);
});

test("flags an id collision on a head shared between two packages (§9)", () => {
  const result = loadReferenceData(fixture("node-loader-collision"));
  expect(result.heads).toHaveLength(2);
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]?.message).toBe(
    'id collision: "FromDigits/base-ten" is also declared in ' +
      fixture("node-loader-collision/pkg-a/reference/FromDigits.yaml"),
  );
});

test("flags schema violations instead of throwing", () => {
  const result = loadReferenceData(fixture("node-loader-invalid"));
  expect(result.heads).toHaveLength(1);
  expect(result.issues.map((i) => i.message).sort()).toEqual(
    ['$.examples[0]: unexpected property "typo"', '$: missing required property "summary"'].sort(),
  );
});

test("an empty packages root loads nothing", () => {
  const result = loadReferenceData(fixture("node-loader-empty"));
  expect(result).toEqual({ heads: [], issues: [] });
});
