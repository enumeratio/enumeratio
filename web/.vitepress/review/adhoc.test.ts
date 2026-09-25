import { describe, expect, test } from "vite-plus/test";
import { adhocId, adhocTitle, buildAdhocItem, buildProdLink } from "./adhoc.ts";

describe("buildProdLink", () => {
  test("builds an absolute prod-host link, same form as a hand-authored `- link:`", () => {
    expect(buildProdLink("/reference/symbol/Arccos", "example-19")).toBe(
      "https://enumeratio.dev/reference/symbol/Arccos#example-19",
    );
  });
});

describe("adhocId", () => {
  test("is deterministic for the same path + anchor", () => {
    const a = adhocId("/reference/symbol/Arccos", "example-19");
    const b = adhocId("/reference/symbol/Arccos", "example-19");
    expect(a).toBe(b);
  });

  test("fits the backlog heading id charset [A-Za-z0-9_-]+", () => {
    const id = adhocId("/reference/symbol/Arccos", "example-19");
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("differs for different anchors on the same page", () => {
    expect(adhocId("/reference/symbol/Arccos", "example-19")).not.toBe(
      adhocId("/reference/symbol/Arccos", "example-20"),
    );
  });

  test("differs for the same anchor on different pages", () => {
    expect(adhocId("/reference/symbol/Arccos", "example-19")).not.toBe(
      adhocId("/reference/symbol/Arcsin", "example-19"),
    );
  });

  test("never inspects or assumes an `example-N` shape -- opaque anchors round-trip too", () => {
    // A hypothetical post-migration anchor shape, including a slash -- must not throw
    // or collide, and must not attempt to extract any embedded number.
    const id = adhocId("/reference/symbol/Arccos", "example/finding-42");
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(id).not.toBe(adhocId("/reference/symbol/Arccos", "example-19"));
  });
});

describe("adhocTitle", () => {
  test("is the page label and the anchor text verbatim, never reformatted", () => {
    expect(adhocTitle("Arccos", "example-19")).toBe("Arccos · example-19");
    // Not "example 19", not a stripped/renumbered form -- the anchor's shape is opaque.
    expect(adhocTitle("Arccos", "example/finding-42")).toBe("Arccos · example/finding-42");
  });
});

describe("buildAdhocItem", () => {
  test("produces a full open item with a single link bullet and empty feedback", () => {
    const item = buildAdhocItem("Arccos", "/reference/symbol/Arccos", "example-19");
    expect(item.status).toBe("open");
    expect(item.feedback).toBe("");
    expect(item.title).toBe("Arccos · example-19");
    expect(item.link).toBe("https://enumeratio.dev/reference/symbol/Arccos#example-19");
    expect(item.bullets).toEqual([{ key: "link", value: "https://enumeratio.dev/reference/symbol/Arccos#example-19" }]);
    expect(item.id).toBe(adhocId("/reference/symbol/Arccos", "example-19"));
  });
});
