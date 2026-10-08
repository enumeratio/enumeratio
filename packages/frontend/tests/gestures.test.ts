import { expect, test } from "vite-plus/test";
import { wheelZooms } from "../src/gestures.ts";

const wheel = (ctrlKey: boolean, metaKey = false): WheelEvent => ({ ctrlKey, metaKey }) as unknown as WheelEvent;

/** A host as far as the policy looks: whether it sits in a full window. */
const host = (fullWindow = false): Element =>
  ({ closest: (selector: string) => (fullWindow && selector === ".is-full-window" ? {} : null) }) as unknown as Element;

test("a plain wheel scrolls the page; ⌘/Ctrl zooms; a full-window figure zooms", () => {
  expect(wheelZooms(wheel(false), host())).toBe(false);
  expect(wheelZooms(wheel(false), host(true))).toBe(true);
  expect(wheelZooms(wheel(true), host())).toBe(true);
  expect(wheelZooms(wheel(false, true), host())).toBe(true);
  expect(wheelZooms(wheel(false), undefined)).toBe(false);
});

test("greedy takes every wheel; none takes none", () => {
  expect(wheelZooms(wheel(false), host(), "greedy")).toBe(true);
  expect(wheelZooms(wheel(true), host(), "none")).toBe(false);
  expect(wheelZooms(wheel(false), host(true), "none")).toBe(false);
});
