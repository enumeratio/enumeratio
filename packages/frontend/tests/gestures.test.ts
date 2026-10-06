import { expect, test } from "vite-plus/test";
import { wheelZooms } from "../src/gestures.ts";

const wheel = (modifier: boolean): WheelEvent => ({ ctrlKey: modifier, metaKey: false }) as unknown as WheelEvent;

/** A host as far as the policy looks: what has focus, and whether it sits in a full window. */
const host = (focused: boolean, fullWindow = false): Element => {
  const self: Record<string, unknown> = {
    contains: (node: unknown) => node === self,
    closest: (selector: string) => (fullWindow && selector === ".is-full-window" ? {} : null),
  };
  self.ownerDocument = { activeElement: focused ? self : null };
  return self as unknown as Element;
};

test("a plain wheel zooms only an engaged plot; ⌘/Ctrl zooms any", () => {
  expect(wheelZooms(wheel(false), host(false))).toBe(false);
  expect(wheelZooms(wheel(false), host(true))).toBe(true);
  expect(wheelZooms(wheel(false), host(false, true))).toBe(true);
  expect(wheelZooms(wheel(true), host(false))).toBe(true);
  expect(wheelZooms(wheel(false), undefined)).toBe(false);
});

test("greedy takes every wheel; none takes none", () => {
  expect(wheelZooms(wheel(false), host(false), "greedy")).toBe(true);
  expect(wheelZooms(wheel(true), host(true), "none")).toBe(false);
});
