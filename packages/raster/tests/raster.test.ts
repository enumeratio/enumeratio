import { expect, test } from "vite-plus/test";
import { flattenCss, rasterize } from "../src/index.ts";

test("flattenCss resolves nested var() to the innermost fallback", () => {
  expect(flattenCss("fill:var(--a, var(--b, #d97706))")).toBe("fill:#d97706");
  expect(flattenCss("stroke:var(--x, currentColor)", { color: "#000" })).toBe("stroke:#000");
});

test("flattenCss substitutes currentColor and valueless var()", () => {
  expect(flattenCss("a currentColor b", { color: "#111" })).toBe("a #111 b");
  expect(flattenCss("fill:var(--only)", { color: "#abc" })).toBe("fill:#abc");
});

test("rasterize emits a PNG (magic bytes) sized to the SVG", () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="var(--c, #d97706)"/></svg>`;
  const png = rasterize(svg, { width: 20 });
  // PNG signature: 89 50 4E 47.
  expect(Array.from(png.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  expect(png.length).toBeGreaterThan(50);
});
