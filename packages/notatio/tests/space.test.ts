import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { AUTO_VIEW, domainsOf, isSetting, resolveView, settingName } from "../src/space.ts";

const ce = new ComputeEngine();

/** Build a settings map the way the sheet does, from LaTeX right-hand sides. */
const settings = (pairs: Record<string, string>) =>
  new Map(Object.entries(pairs).map(([k, v]) => [k, ce.parse(v).evaluate()]));

// --- the settings namespace ----------------------------------------------------------

test("a setting is a symbol of its own, not a name a reader might want", () => {
  // `\mathsf{extent}` parses to `extent_sansserif`, so an author's ordinary `extent`
  // is untouched -- which is the whole reason for the separate namespace.
  expect(ce.parse("\\mathsf{extent}").json).toBe("extent_sansserif");
  expect(settingName("extent_sansserif")).toBe("extent");
  expect(settingName("extent")).toBeUndefined();
  expect(isSetting("center_sansserif")).toBe(true);
  expect(isSetting("center")).toBe(false);
});

// --- resolving a view ------------------------------------------------------------------

test("nothing said means the projection's own Auto framing", () => {
  expect(resolveView("portrait", new Map())).toEqual(AUTO_VIEW.portrait);
  expect(resolveView("curve", new Map())).toEqual(AUTO_VIEW.curve);
  expect(resolveView("surface", new Map())).toEqual(AUTO_VIEW.surface);
});

test("an unknown projection still yields a usable view", () => {
  expect(resolveView("nonsense", new Map()).extent).toBeGreaterThan(0);
});

test("settings override the defaults", () => {
  const v = resolveView("portrait", settings({ extent: "8", height: "500" }));
  expect(v.extent).toBe(8);
  expect(v.height).toBe(500);
  expect(v.center).toEqual([0, 0]); // untouched
});

test("an explicit Auto keeps the default, so a cell can ask for it back", () => {
  const v = resolveView("curve", settings({ extent: "\\mathrm{Auto}" }));
  expect(v.extent).toBe(AUTO_VIEW.curve.extent);
});

test("a centre is a pair, and a bare number means both axes", () => {
  expect(resolveView("portrait", settings({ center: "(1, -2)" })).center).toEqual([1, -2]);
  expect(resolveView("portrait", settings({ center: "3" })).center).toEqual([3, 3]);
});

test("a domain is a range, restated as the camera's centre and extent", () => {
  // Authors think in ranges; the camera holds centre and distance. Same statement.
  const v = resolveView("curve", settings({ xdomain: "(-1, 5)" }));
  expect(v.center[0]).toBe(2);
  expect(v.extent).toBe(6);
});

test("two domains take the wider axis, so nothing asked for is cropped", () => {
  const v = resolveView("surface", settings({ xdomain: "(-1, 1)", ydomain: "(-10, 10)" }));
  expect(v.center).toEqual([0, 0]);
  expect(v.extent).toBe(20);
});

test("orientation is part of the same view", () => {
  const v = resolveView("surface", settings({ azimuth: "90", elevation: "15" }));
  expect(v.azimuth).toBe(90);
  expect(v.elevation).toBe(15);
});

test("a nonsensical setting is ignored rather than breaking the view", () => {
  const v = resolveView("portrait", settings({ extent: "-4", height: "0", center: "\\sin(x)" }));
  expect(v).toEqual(AUTO_VIEW.portrait);
});

// --- back out to a plot element ---------------------------------------------------------

test("domains come back out of the camera as a plot element wants them", () => {
  const { x, y } = domainsOf({ center: [2, -1], extent: 6, azimuth: 0, elevation: 0, height: 300 });
  expect(x).toEqual([-1, 5]);
  expect(y).toEqual([-4, 2]);
});

test("a domain survives the round trip through the camera", () => {
  const v = resolveView("curve", settings({ xdomain: "(-1, 5)", ydomain: "(-1, 5)" }));
  expect(domainsOf(v).x).toEqual([-1, 5]);
});
