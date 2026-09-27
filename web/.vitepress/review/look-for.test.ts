import { describe, expect, test } from "vite-plus/test";
import { exampleIdFromAnchor, lookForText, symbolNameFromPath } from "./look-for.ts";

describe("symbolNameFromPath", () => {
  test("extracts the symbol name", () => {
    expect(symbolNameFromPath("/reference/symbol/Floor")).toBe("Floor");
  });

  test("tolerates a trailing slash", () => {
    expect(symbolNameFromPath("/reference/symbol/Floor/")).toBe("Floor");
  });

  test("undefined for any other path shape", () => {
    expect(symbolNameFromPath("/guide/")).toBeUndefined();
    expect(symbolNameFromPath("/reference/symbol/")).toBeUndefined();
  });
});

describe("exampleIdFromAnchor", () => {
  test("strips the example/ prefix", () => {
    expect(exampleIdFromAnchor("example/two-b-terms")).toBe("two-b-terms");
  });

  test("undefined for a non-example anchor", () => {
    expect(exampleIdFromAnchor("signatures")).toBeUndefined();
    expect(exampleIdFromAnchor("")).toBeUndefined();
  });
});

describe("lookForText", () => {
  test("prefers the caption", () => {
    expect(lookForText({ caption: "Floor to a multiple", expr: ["Floor", 226, 10] })).toBe("Floor to a multiple");
  });

  test("falls back to the expr as compact JSON when there's no caption", () => {
    expect(lookForText({ expr: ["Floor", 226, 10] })).toBe('["Floor",226,10]');
  });

  test("falls back when the caption is blank", () => {
    expect(lookForText({ caption: "   ", expr: 1 })).toBe("1");
  });
});
