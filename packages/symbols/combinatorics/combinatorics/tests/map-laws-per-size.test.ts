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

const memo = new Map<string, string[]>();
/** The members of `collection` at size n, as JSON; fails if the count doesn't evaluate. */
const members = (collection: string, n: number): string[] => {
  const key = `${collection}:${n}`;
  let found = memo.get(key);
  if (found === undefined) {
    const count = value(["Count", [collection, n]]);
    if (typeof count !== "number")
      throw new Error(`Count(${collection}(${n})) did not evaluate: ${JSON.stringify(count)}`);
    found = Array.from({ length: count }, (_, i) => JSON.stringify(value(["At", [collection, n], i + 1])));
    memo.set(key, found);
  }
  return found;
};

// Size 5 takes minutes: the standard run stops at 3, the nightly deep run goes on.
const DEEP = process.env.DEEP_TESTS === "1";
const MAX_SIZE = DEEP ? 5 : 3;

for (const map of MAPS.filter((m) => m.graded !== undefined)) {
  const { from, to, sizeOffset = 0 } = map.graded!;
  const laws = map.laws ?? [];
  // `involution`, `inverse` and `orderIsomorphism` each make the map a bijection too.
  const oneToOne =
    laws.some((law) => law === "bijection" || law === "involution" || typeof law === "object") ||
    map.orderIsomorphism !== undefined;
  const onto = oneToOne || laws.includes("surjection");

  test(`${map.name} takes ${from} at size n to ${to} at size ${sizeOffset === 0 ? "n" : `n + ${sizeOffset}`}`, () => {
    for (let n = Math.max(0, -sizeOffset); n <= MAX_SIZE; n++) {
      const target = new Set(members(to, n + sizeOffset));
      const sources = members(from, n);
      // Cover is vacuous at size 0; from size 1 an empty source would pass everything below.
      if (n >= 1) expect(sources.length, `${n}: members of ${from}`).toBeGreaterThan(0);
      const images = sources.map((member) =>
        JSON.stringify(value(["CombinatorialMap", JSON.parse(member), `'${map.name}'`])),
      );
      expect(
        images.filter((image) => !target.has(image)),
        `${n}: images outside ${to}`,
      ).toEqual([]);
      if (onto) expect(new Set(images).size, `${n}: onto ${to}`).toEqual(target.size);
      if (oneToOne) expect(new Set(images).size, `${n}: one-to-one`).toEqual(images.length);
    }
  });
}

test("a map stating surjection or bijection also states graded, the collections it is checked against", () => {
  const ungraded = MAPS.filter(
    (m) => (m.laws ?? []).some((law) => law === "surjection" || law === "bijection") && m.graded === undefined,
  ).map((m) => `${m.name}@${m.from}`);
  expect(ungraded).toEqual([]);
});
