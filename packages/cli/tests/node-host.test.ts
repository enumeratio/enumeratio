import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { NodeHost } from "../src/index.ts";

const tmp = (ext: string) => join(tmpdir(), `notatio-test-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);

test("a glyph writes an SVG and reports its path", () => {
  const host = new NodeHost(false);
  const out = host.eval(":glyph partition [4, 2, 1]");
  expect(out.text).toMatch(/partition\(\[4, 2, 1\]\) -> file:\/\/.*notatio-partition-\d+\.svg/);
});

test(":export writes the last result in the format from the extension", () => {
  const host = new NodeHost(false);
  host.eval("x^2 + 1");
  const path = tmp("wl");
  const out = host.eval(`:export ${path}`);
  expect(out.text).toBe(`  wrote ${path} (WL)`);
});

test(":export .png needs a graphic first, then round-trips a glyph", () => {
  const host = new NodeHost(false);
  expect(host.eval(`:export ${tmp("png")}`).text).toMatch(/error: no graphic yet/);
  host.eval(":glyph dyck [1, 1, 0, 0]");
  expect(host.eval(`:export ${tmp("png")}`).text).toMatch(/wrote .* \(PNG\)/);
});

test(":import reads a file back as the next result", () => {
  const host = new NodeHost(false);
  host.eval("x^2 + 1");
  const path = tmp("wl");
  host.eval(`:export ${path}`);
  const out = host.eval(`:import ${path}`);
  expect(out.text).toMatch(/Out\[\d+\]= /);
});
