import { expect, test } from "vite-plus/test";
import { isOpaqueField, PROJECTION_DIMENSION, stackLayers } from "../src/space.ts";

/** Items are `kind:label`, so a stack reads directly in assertions. */
const kindOf = (s: string) => s.split(":")[0];
const stack = (...items: string[]) =>
  stackLayers(items, kindOf)
    .sort((a, b) => a.z - b.z)
    .map((l) => l.item);

test("lower-dimensional things sit above higher-dimensional ones", () => {
  // A point under a plane is invisible; a plane under a point loses almost nothing.
  expect(stack("point:a", "curve:b", "surface:c")).toEqual(["surface:c", "curve:b", "point:a"]);
  expect(PROJECTION_DIMENSION.point).toBeLessThan(PROJECTION_DIMENSION.curve);
  expect(PROJECTION_DIMENSION.curve).toBeLessThan(PROJECTION_DIMENSION.surface);
});

test("within a dimension, an earlier cell sits on top", () => {
  const [under, over] = stack("curve:first", "curve:second");
  expect(under).toBe("curve:second");
  expect(over).toBe("curve:first");
});

test("only the topmost domain colouring is drawn", () => {
  // Two of them cannot usefully overlap: the upper simply hides the lower.
  expect(isOpaqueField("portrait")).toBe(true);
  expect(stack("portrait:a", "portrait:b")).toEqual(["portrait:a"]);
  expect(stack("portrait:a", "portrait:b", "portrait:c")).toEqual(["portrait:a"]);
});

test("an opaque field discards only what is beneath it", () => {
  // The curve is above the portrait by dimension, so it survives.
  expect(stack("curve:line", "portrait:a", "portrait:b")).toEqual(["portrait:a", "curve:line"]);
});

test("z-indices are consecutive from the bottom", () => {
  const layers = stackLayers(["point:a", "curve:b", "surface:c"], kindOf);
  expect(layers.map((l) => l.z).sort((a, b) => a - b)).toEqual([0, 1, 2]);
});

test("an empty or single-item stack is well-formed", () => {
  expect(stackLayers([], kindOf)).toEqual([]);
  expect(stack("portrait:only")).toEqual(["portrait:only"]);
});

test("an unknown kind does not crash the ordering", () => {
  expect(stack("mystery:x", "curve:y")).toHaveLength(2);
});
