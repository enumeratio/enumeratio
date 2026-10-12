import { expect, test } from "vite-plus/test";
import { colorBytes, MAX_RASTER_CELLS, rasterHref } from "../src/raster.ts";
import { decodePng } from "./png.ts";

test("only #hex colors are read; anything else is clear", () => {
  expect(colorBytes("#f00")).toEqual([255, 0, 0, 255]);
  expect(colorBytes("#336699")).toEqual([51, 102, 153, 255]);
  expect(colorBytes("#33669980")).toEqual([51, 102, 153, 128]);
  for (const hostile of ['"><script>alert(1)</script>', "red", "rgb(1,2,3)", "#12", "#gggggg", "url(#x)", "", 3, null])
    expect(colorBytes(hostile), String(hostile)).toBeUndefined();
});

test("rows run bottom to top, so the first listed row is the last row of the image", () => {
  const href = rasterHref([
    ["#ff0000", "#00ff00"],
    ["#0000ff", "#ffffff"],
  ])!;
  const { width, height, pixels } = decodePng(href);
  expect([width, height]).toEqual([2, 2]);
  expect(pixels[1]![0]).toEqual([255, 0, 0, 255]);
  expect(pixels[1]![1]).toEqual([0, 255, 0, 255]);
  expect(pixels[0]![0]).toEqual([0, 0, 255, 255]);
});

test("a cell that is not a color is clear, and cannot carry markup out", () => {
  const href = rasterHref([['"><script>', "#010203"]])!;
  expect(href).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/);
  const { pixels } = decodePng(href);
  expect(pixels[0]![0]![3]).toBe(0);
  expect(pixels[0]![1]).toEqual([1, 2, 3, 255]);
});

test("many colors go as RGBA, few as an indexed image, and both read back", () => {
  const few = Array.from({ length: 4 }, (_, j) =>
    Array.from({ length: 4 }, (_, i) => ((i + j) % 2 ? "#102030" : "#a0b0c0")),
  );
  expect(decodePng(rasterHref(few)!).pixels[3]![0]).toEqual([0xa0, 0xb0, 0xc0, 255]);
  expect(decodePng(rasterHref(few)!).pixels[3]![1]).toEqual([0x10, 0x20, 0x30, 255]);
  const many = Array.from({ length: 20 }, (_, j) =>
    Array.from({ length: 20 }, (_, i) => `#${(j * 20 + i).toString(16).padStart(6, "0")}`),
  );
  const { pixels } = decodePng(rasterHref(many)!);
  expect(pixels[0]![0]).toEqual([0, 1, 124, 255]);
  expect(pixels[19]![0]).toEqual([0, 0, 0, 255]);
});

test("a large image is split into stored blocks that still inflate", () => {
  const side = 300;
  const rows = Array.from({ length: side }, (_, j) =>
    Array.from({ length: side }, (_, i) => `#${((i * 7 + j * 3) % 4096).toString(16).padStart(6, "0")}`),
  );
  const { width, pixels } = decodePng(rasterHref(rows)!);
  expect(width).toBe(side);
  expect(pixels[side - 1]![5]).toEqual([0, 0, 35, 255]);
});

test("an empty, ragged or oversized grid draws nothing", () => {
  expect(rasterHref([])).toBeUndefined();
  expect(rasterHref([[]])).toBeUndefined();
  expect(rasterHref([["#000000"], ["#000000", "#000000"]])).toBeUndefined();
  expect(MAX_RASTER_CELLS).toBeGreaterThan(0);
});

test("the same cells are the same bytes", () => {
  const rows = [["#123456", "#654321"]];
  expect(rasterHref(rows)).toBe(rasterHref(rows));
});
