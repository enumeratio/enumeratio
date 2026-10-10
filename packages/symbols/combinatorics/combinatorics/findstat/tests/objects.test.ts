// FindStat's object text read as our carriers' values (`../src/objects.ts`): a few per carrier, the
// convention edges, and every sample object in the committed snapshot checked against our own
// collection of its size.

import { readFileSync } from "node:fs";
import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { CARRIERS, declareCombinatorics, declareMaps } from "../../src/index.ts";
import { COLLECTION_CARRIER, objectSize, readableCarriers, readObject } from "../src/objects.ts";

const ce = bareEngine();
declareCombinatorics(ce);
declareMaps(ce, Object.fromEntries(CARRIERS.map((c) => [c.type, c.name])));

const L = (...items: unknown[]): unknown => ["List", ...items];

test("a few objects per new carrier", () => {
  expect(readObject("BinaryWord", "0110")).toEqual(["BinaryWord", L(0, 1, 1, 0)]);
  expect(readObject("Composition", "[2,1,1]")).toEqual(["Composition", L(2, 1, 1)]);
  expect(readObject("SignedPermutation", "[-2,1,3]")).toEqual(["SignedPermutation", L(-2, 1, 3)]);
  expect(readObject("BinaryTree", "[[.,.],[.,.]]")).toEqual(["BinaryTree", L(L(0, 0), L(0, 0))]);
  expect(readObject("OrderedTree", "[[],[[]]]")).toEqual(["OrderedTree", L(L(), L(L()))]);
  expect(readObject("StandardTableau", "[[1,3],[2]]")).toEqual(["StandardTableau", L(L(1, 3), L(2))]);
  expect(readObject("ParkingFunction", "[1,1,2]")).toEqual(["ParkingFunction", L(1, 1, 2)]);
  expect(readObject("SetComposition", "[{2},{1,3}]")).toEqual(["SetComposition", L(L(2), L(1, 3))]);
  expect(readObject("AlternatingSignMatrix", "[[0,1,0],[1,-1,1],[0,1,0]]")).toEqual([
    "AlternatingSignMatrix",
    L(L(0, 1, 0), L(1, -1, 1), L(0, 1, 0)),
  ]);
});

test("the empty objects", () => {
  expect(readObject("BinaryWord", "")).toEqual(["BinaryWord", L()]);
  expect(readObject("Composition", "[]")).toEqual(["Composition", L()]);
  expect(readObject("BinaryTree", ".")).toEqual(["BinaryTree", 0]);
  expect(readObject("OrderedTree", "[]")).toEqual(["OrderedTree", L()]);
  expect(readObject("StandardTableau", "[]")).toEqual(["StandardTableau", L()]);
});

test("a perfect matching is read as the set partition of its pairs", () => {
  expect(readObject("PerfectMatching", "[(1,4),(2,3)]")).toEqual(["SetPartition", L(L(1, 4), L(2, 3))]);
});

test("a text that isn't the carrier's throws, and an unread carrier is undefined", () => {
  expect(() => readObject("BinaryWord", "012")).toThrow();
  expect(() => readObject("BinaryTree", "[.,.")).toThrow();
  expect(() => readObject("BinaryTree", "[.,.].")).toThrow();
  expect(() => readObject("OrderedTree", "[1]")).toThrow();
  expect(readObject("Graph", "([(0,1)],2)")).toBeUndefined();
});

test("sizes are what the collections grow by", () => {
  expect(objectSize("BinaryWord", "0110")).toBe(4);
  expect(objectSize("Composition", "[2,1,1]")).toBe(4);
  expect(objectSize("BinaryTree", "[[.,.],.]")).toBe(2);
  expect(objectSize("BinaryTree", ".")).toBe(0);
  expect(objectSize("OrderedTree", "[[],[[]]]")).toBe(3);
  expect(objectSize("StandardTableau", "[[1,3],[2]]")).toBe(3);
  expect(objectSize("PerfectMatching", "[(1,4),(2,3)]")).toBe(4);
  expect(objectSize("AlternatingSignMatrix", "[[0,1],[1,0]]")).toBe(2);
});

interface Snapshot {
  readonly items: Readonly<
    Record<string, { collection?: string; domain?: string; codomain?: string; sample: readonly [string, unknown][] }>
  >;
}
const snapshot = (file: string): Snapshot =>
  JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), "utf8")) as Snapshot;
const maps = snapshot("maps.json").items;

/** Each tree's Dyck path, walking the children in order: up on the way in, down on the way out. */
const dyckOfTree = (children: unknown[]): number[] =>
  children.flatMap((child) => [1, ...dyckOfTree(child as unknown[]), 0]);

test("an ordered tree is the Dyck path's own walk, as FindStat's Mp00051", () => {
  for (const [tree, path] of maps.Mp00051!.sample) {
    const [, nested] = readObject("OrderedTree", tree) as [string, unknown[]];
    const walk = (node: unknown[]): unknown[] => (node as unknown[]).slice(1).map((c) => walk(c as unknown[]));
    expect(dyckOfTree(walk(nested)), tree).toEqual(JSON.parse(path as string));
  }
});

test("a binary tree is oriented as our Dyck path conversion, FindStat's Mp00034", () => {
  for (const [path, tree] of maps.Mp00034!.sample) {
    const dyck = readObject("DyckPath", path);
    const image = ce.box(["BinaryTree", dyck] as never).evaluate().json;
    expect(image, path).toEqual(readObject("BinaryTree", tree as string));
  }
});

/** The collection of each size that our own carriers' elements are drawn from, and its size argument. */
const FAMILY: Readonly<Record<string, [head: string, argument: (size: number) => number]>> = {
  BinaryWord: ["BinaryWords", (n) => n],
  Composition: ["IntegerCompositions", (n) => n],
  SignedPermutation: ["SignedPermutations", (n) => n],
  BinaryTree: ["BinaryTrees", (n) => n],
  OrderedTree: ["OrderedTrees", (n) => n],
  StandardTableau: ["StandardTableaux", (n) => n],
  ParkingFunction: ["ParkingFunctions", (n) => n],
  PerfectMatching: ["PerfectMatchings", (n) => n / 2],
  AlternatingSignMatrix: ["AlternatingSignMatrices", (n) => n],
  SetComposition: ["SetCompositions", (n) => n],
};

test("every snapshot object of the new carriers is an element of our collection of its size", () => {
  const texts = new Map<string, Set<string>>();
  const add = (collection: string, text: unknown): void => {
    const carrier = COLLECTION_CARRIER[collection];
    if (carrier && FAMILY[carrier] && typeof text === "string")
      texts.set(carrier, (texts.get(carrier) ?? new Set()).add(text));
  };
  for (const item of Object.values(snapshot("statistics.json").items))
    for (const [object] of item.sample) add(item.collection!, object);
  for (const item of Object.values(maps))
    for (const [object, image] of item.sample) {
      add(item.domain!, object);
      add(item.codomain!, image);
    }
  expect([...texts.keys()].toSorted()).toEqual(Object.keys(FAMILY).toSorted());
  for (const [carrier, set] of texts) {
    const [head, argument] = FAMILY[carrier]!;
    for (const text of set) {
      const size = objectSize(carrier, text)!;
      if (size > 5) continue;
      let value = readObject(carrier, text) as [string, unknown];
      // AlternatingSignMatrices yields the bare rows.
      if (carrier === "AlternatingSignMatrix") value = value[1] as never;
      const member = ce.box(["Element", value, [head, argument(size)]] as never).evaluate().json;
      expect(member, `${carrier} ${text}`).toBe("True");
    }
  }
});

test("every carrier we read has a collection", () => {
  const collected = new Set(Object.values(COLLECTION_CARRIER));
  for (const carrier of readableCarriers()) expect(collected.has(carrier), carrier).toBe(true);
});
