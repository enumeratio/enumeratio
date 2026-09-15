import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import "../src/node.ts"; // also registers the Node-only PNG codec used below
import {
  exportTo,
  fileFormat,
  getFormat,
  type ImageValue,
  importFrom,
  isImageFormat,
  isImageValue,
  mimeTypeToFormatList,
  sniffFormat,
} from "../src/index.ts";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#d97706"/></svg>`;

const ce = new ComputeEngine();
const box = (mj: unknown) => ce.box(mj as Parameters<ComputeEngine["box"]>[0]);

test("alias, extension, and MIME resolution", () => {
  expect(getFormat("numpy")?.name).toBe("Python");
  expect(getFormat("WolframLanguage")?.name).toBe("WL");
  expect(fileFormat("out/plot.png")?.name).toBe("PNG");
  expect(mimeTypeToFormatList("image/png")).toEqual(["PNG"]);
  expect(mimeTypeToFormatList("application/json")).toEqual(["MathJSON"]);
});

test("export math and code formats", () => {
  expect(exportTo(box(["Binomial", 10, 3]), "WL")).toBe("Binomial[10, 3]");
  expect(exportTo(box(["Add", "x", 1]), "TeX")).toContain("x");
  expect(JSON.parse(exportTo(box(["Add", "x", 1]), "MathJSON") as string)).toEqual(["Add", "x", 1]);
  expect(exportTo(box(["Add", ["Power", "x", 2], 1]), "JavaScript")).toMatch(/x/);
});

test("import WL and MathJSON back to MathJSON", () => {
  expect(importFrom("Binomial[10, 3]", "WL")).toEqual(["Binomial", 10, 3]);
  expect(importFrom('["Add", 1, 2]', "MathJSON")).toEqual(["Add", 1, 2]);
});

test("Epsil round-trips and evaluates; a parse error throws", () => {
  expect(exportTo(box(["Add", "x", 1]), "Epsil")).toBe("x + 1");
  expect(box(importFrom("2 + 3", "Epsil")).evaluate().toString()).toBe("5");
  expect(() => importFrom("1 +", "epsil")).toThrow(/Epsil/);
});

test("TeX import needs an engine", () => {
  expect(importFrom("x^2", "TeX", { ce })).toBeDefined();
  expect(() => importFrom("x^2", "TeX")).toThrow();
});

test("PNG is an image format and exports PNG bytes from an SVG", () => {
  expect(isImageFormat("PNG")).toBe(true);
  expect(isImageFormat("TeX")).toBe(false);
  const png = exportTo(SVG, "PNG") as Uint8Array;
  expect(Array.from(png.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
});

test("sniffFormat recognises content, not just extensions", () => {
  expect(sniffFormat('["Add", 1, 2]')?.name).toBe("MathJSON");
  expect(sniffFormat("Binomial[10, 3]")?.name).toBe("WL");
  expect(sniffFormat(SVG)?.name).toBe("SVG");
  expect(sniffFormat(exportTo(SVG, "PNG"))?.name).toBe("PNG");
  expect(sniffFormat("just prose")).toBeUndefined();
});

test("SVG and PNG import as image values", () => {
  const svg = importFrom(SVG, "SVG");
  expect(isImageValue(svg)).toBe(true);
  expect((svg as ImageValue).text).toContain("<svg");
  const png = importFrom(exportTo(SVG, "PNG"), "PNG") as ImageValue;
  expect(png.mimeType).toBe("image/png");
  expect(png.data.length).toBeGreaterThan(50);
});
