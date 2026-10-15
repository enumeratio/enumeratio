import { bareEngine } from "@enumeratio/engine/testing";
import { declareStructures } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { CARRIERS, declareCombinatorics, declareMaps, MAPS } from "../src/index.ts";

// The laws about a map's whole image -- `graded`, `surjection`, `bijection` -- checked a size at
// a time: every member of `graded.from` at size n, mapped, against every member of `graded.to`
// at size n + sizeOffset. (The pointwise laws are checked by `checkLaws`.)
const ce = bareEngine();
declareStructures(ce);
declareCombinatorics(ce);
declareMaps(ce, Object.fromEntries(CARRIERS.map((c) => [c.type, c.name])));

const value = (json: unknown) => ce.box(json as never).evaluate().json;
const members = (collection: string, n: number): string[] =>
  Array.from({ length: value(["Count", [collection, n]]) as number }, (_, i) =>
    JSON.stringify(value(["At", [collection, n], i + 1])),
  );

const MAX_SIZE = 5;

for (const map of MAPS.filter((m) => m.graded !== undefined)) {
  const { from, to, sizeOffset = 0 } = map.graded!;
  const laws = map.laws ?? [];
  const onto = laws.includes("surjection") || laws.includes("bijection");

  test(`${map.name} takes ${from} at size n to ${to} at size ${sizeOffset === 0 ? "n" : `n + ${sizeOffset}`}`, () => {
    for (let n = Math.max(0, -sizeOffset); n <= MAX_SIZE; n++) {
      const target = new Set(members(to, n + sizeOffset));
      const images = members(from, n).map((member) =>
        JSON.stringify(value(["CombinatorialMap", JSON.parse(member), `'${map.name}'`])),
      );
      expect(
        images.filter((image) => !target.has(image)),
        `${n}: images outside ${to}`,
      ).toEqual([]);
      if (onto) expect(new Set(images).size, `${n}: onto ${to}`).toEqual(target.size);
      if (laws.includes("bijection")) expect(new Set(images).size, `${n}: one-to-one`).toEqual(images.length);
    }
  });
}

test("a map stating surjection or bijection also states graded, the collections it is checked against", () => {
  const ungraded = MAPS.filter(
    (m) => (m.laws ?? []).some((law) => law === "surjection" || law === "bijection") && m.graded === undefined,
  ).map((m) => `${m.name}@${m.from}`);
  expect(ungraded).toEqual([]);
});
