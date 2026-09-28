import { expect, test } from "vite-plus/test";
import { Orbit } from "../src/orbit.ts";

const host = (): { azimuth: number; elevation: number; zoom: number } => ({
  azimuth: 30,
  elevation: 25,
  zoom: 1,
});

/** Enough of a PointerEvent for the controller; `currentTarget` has no capture in node. */
const pointer = (id: number, x: number, y: number, button = 0): PointerEvent =>
  ({ pointerId: id, clientX: x, clientY: y, button, currentTarget: {} }) as unknown as PointerEvent;

const wheel = (deltaY: number, modifier: boolean): WheelEvent =>
  ({
    deltaY,
    ctrlKey: modifier,
    metaKey: false,
    preventDefault: () => {},
  }) as unknown as WheelEvent;

test("a drag turns the camera half a degree per pixel", () => {
  const h = host();
  const orbit = new Orbit(h);
  orbit.onPointerDown(pointer(1, 100, 100));
  orbit.onPointerMove(pointer(1, 160, 80));
  expect(h.azimuth).toBe(60);
  expect(h.elevation).toBe(15);
  orbit.onPointerUp(pointer(1, 160, 80));
  orbit.onPointerMove(pointer(1, 400, 400));
  expect(h.azimuth, "no longer dragging").toBe(60);
});

test("attributes that arrive as strings still add rather than concatenate", () => {
  // A custom element's attributes are set as STRING properties by the host framework, which
  // bypasses Lit's Number conversion — `"45" + 50` is `"4550"`, and a small drag once sent a
  // camera from 45 degrees to 230 that way.
  const h = { azimuth: "45", elevation: "20", zoom: "1" } as unknown as ReturnType<typeof host>;
  const orbit = new Orbit(h);
  orbit.onPointerDown(pointer(1, 0, 0));
  orbit.onPointerMove(pointer(1, 20, 0));
  expect(h.azimuth).toBe(55);
});

test("elevation is clamped and azimuth wraps", () => {
  const h = host();
  const orbit = new Orbit(h);
  orbit.onPointerDown(pointer(1, 0, 0));
  orbit.onPointerMove(pointer(1, 2000, 2000));
  expect(h.elevation).toBe(90);
  expect(Math.abs(h.azimuth)).toBeLessThan(360);
});

test("a click is told apart from the click that ends a drag", () => {
  const orbit = new Orbit(host());
  orbit.onPointerDown(pointer(1, 100, 100));
  orbit.onPointerMove(pointer(1, 101, 100));
  expect(orbit.dragged, "a wobble is still a click").toBe(false);
  orbit.onPointerMove(pointer(1, 140, 100));
  expect(orbit.dragged, "a turn is not a click").toBe(true);
  // A fresh press starts the reckoning over.
  orbit.onPointerUp(pointer(1, 140, 100));
  orbit.onPointerDown(pointer(2, 0, 0));
  expect(orbit.dragged).toBe(false);
});

test("a plain wheel scrolls the page; a modified one zooms the figure", () => {
  const h = host();
  const orbit = new Orbit(h);
  orbit.onWheel(wheel(-100, false));
  expect(h.zoom, "page scroll is left alone").toBe(1);
  orbit.onWheel(wheel(-100, true));
  expect(h.zoom).toBeGreaterThan(1);
  for (let i = 0; i < 100; i++) orbit.onWheel(wheel(-100, true));
  expect(h.zoom, "clamped").toBe(4);
});

test("double-click comes back to where the attributes first put the camera", () => {
  const h = host();
  const orbit = new Orbit(h);
  orbit.remember();
  orbit.onPointerDown(pointer(1, 0, 0));
  orbit.onPointerMove(pointer(1, 120, 40));
  orbit.onWheel(wheel(-100, true));
  orbit.onDblClick();
  expect(h).toEqual({ azimuth: 30, elevation: 25, zoom: 1 });
});

test("a secondary button does not start a drag", () => {
  const h = host();
  const orbit = new Orbit(h);
  orbit.onPointerDown(pointer(1, 0, 0, 2));
  orbit.onPointerMove(pointer(1, 200, 0));
  expect(h.azimuth).toBe(30);
});
