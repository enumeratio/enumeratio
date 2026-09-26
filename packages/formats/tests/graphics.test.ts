import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { dataUri, declareGraphics, GRAPHICS_HEADS, imageUri, setRasterizer, svgDataUri } from "../src/graphics.ts";
import { parseExpression } from "../src/expression.ts";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';

const engine = () => {
  const ce = new ComputeEngine();
  declareGraphics(ce);
  return ce;
};

test("an Image is a value: it evaluates to itself and keeps its URI", () => {
  const ce = engine();
  const img = ce.box(["Image", { str: "data:image/png;base64,AAA" }] as never).evaluate();
  expect(imageUri(img)).toBe("data:image/png;base64,AAA");
});

test("imageUri ignores anything that is not an Image", () => {
  const ce = engine();
  expect(imageUri(ce.box(["Add", 1, 2]))).toBeUndefined();
  expect(imageUri(ce.box("x"))).toBeUndefined();
  expect(imageUri(undefined)).toBeUndefined();
});

test("Rasterize turns an SVG document into an Image", () => {
  const ce = engine();
  setRasterizer(() => new Uint8Array([137, 80, 78, 71])); // PNG magic
  try {
    const out = ce.box(["Rasterize", { str: SVG }] as never).evaluate();
    const uri = imageUri(out);
    expect(uri?.startsWith("data:image/png;base64,")).toBe(true);
  } finally {
    setRasterizer(undefined);
  }
});

test("the width is passed through to the rasterizer", () => {
  const ce = engine();
  let seen: number | undefined;
  setRasterizer((_svg, options) => {
    seen = options?.width;
    return new Uint8Array([1]);
  });
  try {
    ce.box(["Rasterize", { str: SVG }, 64] as never).evaluate();
    expect(seen).toBe(64);
  } finally {
    setRasterizer(undefined);
  }
});

test("with no rasterizer the document still becomes a drawable Image", () => {
  // A browser has no synchronous path to pixels, but an SVG is already something a
  // page can draw -- so this yields a picture rather than nothing.
  const ce = engine();
  setRasterizer(undefined);
  const uri = imageUri(ce.box(["Rasterize", { str: SVG }] as never).evaluate());
  expect(uri?.startsWith("data:image/svg+xml;base64,")).toBe(true);
});

test("Rasterize leaves an Image alone and declines a non-graphic", () => {
  const ce = engine();
  const img = ce.box(["Image", { str: "data:image/png;base64,AAA" }] as never);
  expect(imageUri(ce.box(["Rasterize", img.json] as never).evaluate())).toBe("data:image/png;base64,AAA");
  // A number is not a picture; it stays as it was written rather than becoming one.
  expect(imageUri(ce.box(["Rasterize", 42] as never).evaluate())).toBeUndefined();
});

test("data URIs encode without a DOM", () => {
  expect(dataUri(new Uint8Array([0, 1, 2]), "image/png")).toBe("data:image/png;base64,AAEC");
  expect(svgDataUri(SVG).startsWith("data:image/svg+xml;base64,")).toBe(true);
});

// The heads that draw are held, not evaluated: what the engine hands back is what a
// component can render, with the arguments as they were written.
test("a graphics head holds, arguments and all", () => {
  const ce = engine();
  const held = (src: string): unknown => ce.box(parseExpression(src).json).evaluate().json;
  expect(held("Plot(Sin(x), (x, 0, 10))")).toEqual(["Plot", ["Sin", "x"], ["Tuple", "x", 0, 10]]);
  expect(held("Manipulate(Plot(Sin(a * x), (x, 0, 10)), (a, 1, 5))")).toEqual([
    "Manipulate",
    ["Plot", ["Sin", ["Multiply", "a", "x"]], ["Tuple", "x", 0, 10]],
    ["Tuple", "a", 1, 5],
  ]);
  expect(held("Chart([1, 2, 3])")).toEqual(["Chart", ["List", 1, 2, 3]]);
  for (const head of GRAPHICS_HEADS) expect(ce.lookupDefinition(head), head).toBeDefined();
});

test("Histogram draws at one argument and still computes at two", () => {
  const ce = engine();
  const run = (src: string): unknown => ce.box(parseExpression(src).json).evaluate().json;
  expect(run("Histogram([1, 2, 2, 3])")).toEqual(["Histogram", ["List", 1, 2, 2, 3]]);
  expect(run("Histogram([1, 2, 2, 3], 2)")).toEqual(["List", ["Tuple", 1, 1], ["Tuple", 2, 3]]);
});
