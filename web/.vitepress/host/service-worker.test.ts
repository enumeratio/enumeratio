// The service worker's install list: the kernel worker and every library chunk it imports,
// statically or not; the shell every page runs, and what cells and plots load; the fonts.

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test } from "vite-plus/test";
import { precacheList, writeServiceWorker } from "./service-worker.ts";

function site(): string {
  const out = mkdtempSync(join(tmpdir(), "sw-"));
  const assets = join(out, "assets");
  mkdirSync(join(assets, "chunks"), { recursive: true });
  const files: Record<string, string> = {
    "assets/session-worker-entry-a1.js": 'import("./index-b2.js");import{x}from"./shared-c3.js";',
    "assets/index-b2.js": 'import("./deep-d4.js")',
    "assets/shared-c3.js": "",
    "assets/deep-d4.js": "",
    "assets/unused-e5.js": "",
    "assets/app.f6.js": "",
    "assets/style.g7.css": "",
    "assets/KaTeX_Main-Regular.h8.woff2": "",
    "assets/KaTeX_Main-Regular.h8.ttf": "",
    "assets/chunks/lazy.i9.js": 'import("./notatio-cell.j0.js")',
    "assets/chunks/notatio-cell.j0.js": 'import"./kernel-client.k1.js"',
    "assets/chunks/kernel-client.k1.js": "",
    "assets/chunks/notatio-terminal.l2.js": "",
    "assets/guide.md.m3.js": "",
    "vendor/engine@1.0.0/dist/chunks/shared.js": "",
    "vendor/mathlive@2.0.0/mathlive.min.mjs": "",
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(out, path)), { recursive: true });
    writeFileSync(join(out, path), text);
  }
  return out;
}

test("the install list is the worker's graph, the page shell, the cells' chunks, the fonts and vendor files but the editor's", () => {
  expect(precacheList(site())).toEqual([
    "/assets/KaTeX_Main-Regular.h8.woff2",
    "/assets/app.f6.js",
    "/assets/chunks/kernel-client.k1.js",
    "/assets/chunks/lazy.i9.js",
    "/assets/chunks/notatio-cell.j0.js",
    "/assets/deep-d4.js",
    "/assets/index-b2.js",
    "/assets/session-worker-entry-a1.js",
    "/assets/shared-c3.js",
    "/assets/style.g7.css",
    "/vendor/engine@1.0.0/dist/chunks/shared.js",
  ]);
});

test("the written worker carries its version, its list and its configuration", () => {
  const out = site();
  expect(writeServiceWorker(out, { libraries: ["structures"] })).toBe(11);
  const sw = readFileSync(join(out, "sw.js"), "utf8");
  expect(sw).toMatch(/const VERSION = "[0-9a-f]{12}";/);
  expect(sw).toContain('"/assets/session-worker-entry-a1.js"');
  expect(sw).toContain('const CONFIGURATION = {"libraries":["structures"]};');
});
