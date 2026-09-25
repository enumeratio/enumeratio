import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { applyItemPatch, parseBacklog, serializeItem, upsertItem } from "./backlog.ts";

// Golden-example data, not snapshots -- see packages/cli/tests/demos.test.ts and
// packages/utils/tests/no-snapshots.test.ts. Regenerate with
// `UPDATE_REVIEW_BACKLOG=1 vp test`.
const GOLDEN = fileURLToPath(new URL("./backlog.golden.json", import.meta.url));
const updating = process.env.UPDATE_REVIEW_BACKLOG === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

function check(name: string, value: unknown): void {
  if (updating) {
    fresh[name] = value;
    return;
  }
  expect(value).toEqual(golden[name]);
}

// A representative backlog: one item mid-review with multi-paragraph feedback, one
// reviewed item with an empty Feedback section, one item with an unknown bullet key
// and no Feedback section at all, and one item with existing single-paragraph feedback.
const FIXTURE = `# Review backlog

Some intro text.

More intro, on its own paragraph.

### [ ] Numeric sets as indexed collections {#pr86-numeric-sets-indexed}
- link: https://enumeratio.dev/reference/symbol/Primes
- pr: #86 · collections · open PR
- check: What to look at and what a good answer looks like.
- note: optional

#### Feedback

Looks solid overall.

Second paragraph of feedback.

### [x] Second item {#second-id}
- link: https://enumeratio.dev/reference/symbol/Foo
- pr: #90 · analytic · merged
- check: check this

#### Feedback

### [!] Third item {#third-id}
- link: https://enumeratio.dev/x
- pr: #91 · misc · open PR
- check: whatever
- custom: an unknown bullet key

### [ ] Fourth item {#fourth-id}
- link: https://enumeratio.dev/y
- pr: #92 · misc · open PR
- check: whatever else

#### Feedback

One paragraph already here.
`;

describe("parseBacklog", () => {
  test("parses intro and every item", () => {
    check("parse", parseBacklog(FIXTURE));
  });
});

describe("applyItemPatch", () => {
  test("round-trip: patching with the item's own current values changes nothing", () => {
    const items = parseBacklog(FIXTURE).items;
    const item = items.find((i) => i.id === "pr86-numeric-sets-indexed")!;
    const result = applyItemPatch(FIXTURE, item.id, {
      status: item.status,
      feedback: item.feedback,
    })!;
    expect(result.raw).toBe(FIXTURE);
  });

  test("status change touches only the checkbox character", () => {
    const result = applyItemPatch(FIXTURE, "pr86-numeric-sets-indexed", { status: "reviewed" })!;
    // Exactly one character differs, and it's the checkbox.
    let firstDiff = -1;
    for (let i = 0; i < Math.max(result.raw.length, FIXTURE.length); i++) {
      if (result.raw[i] !== FIXTURE[i]) {
        firstDiff = i;
        break;
      }
    }
    expect(result.raw.length).toBe(FIXTURE.length);
    expect(result.raw.slice(firstDiff + 1)).toBe(FIXTURE.slice(firstDiff + 1));
    expect(FIXTURE[firstDiff]).toBe(" ");
    expect(result.raw[firstDiff]).toBe("x");
    check("status-change", { raw: result.raw, item: result.item });
  });

  test("feedback edit: empty section gains text", () => {
    const result = applyItemPatch(FIXTURE, "second-id", {
      feedback: "Nice work, ship it.",
    })!;
    check("feedback-empty-to-text", { raw: result.raw, item: result.item });
  });

  test("feedback edit: existing text replaced with new text", () => {
    const result = applyItemPatch(FIXTURE, "fourth-id", {
      feedback: "Replaced entirely.",
    })!;
    check("feedback-text-to-text", { raw: result.raw, item: result.item });
  });

  test("feedback edit: multi-paragraph text is preserved", () => {
    const result = applyItemPatch(FIXTURE, "fourth-id", {
      feedback: "First paragraph.\n\nSecond paragraph.\n\nThird.",
    })!;
    const reparsed = parseBacklog(result.raw).items.find((i) => i.id === "fourth-id")!;
    expect(reparsed.feedback).toBe("First paragraph.\n\nSecond paragraph.\n\nThird.");
    check("feedback-multi-paragraph", { raw: result.raw, item: result.item });
  });

  test("feedback edit: item with no Feedback section at all gets one inserted", () => {
    const result = applyItemPatch(FIXTURE, "third-id", { feedback: "Now reviewed." })!;
    const reparsed = parseBacklog(result.raw).items.find((i) => i.id === "third-id")!;
    expect(reparsed.feedback).toBe("Now reviewed.");
    check("feedback-inserted", { raw: result.raw, item: result.item });
  });

  test("unknown bullet keys survive parsing and an unrelated patch", () => {
    const before = parseBacklog(FIXTURE).items.find((i) => i.id === "third-id")!;
    expect(before.bullets).toContainEqual({ key: "custom", value: "an unknown bullet key" });
    const result = applyItemPatch(FIXTURE, "second-id", { status: "needs-work" })!;
    const after = parseBacklog(result.raw).items.find((i) => i.id === "third-id")!;
    expect(after.bullets).toContainEqual({ key: "custom", value: "an unknown bullet key" });
  });

  test("unknown id returns undefined (caller responds 409)", () => {
    expect(applyItemPatch(FIXTURE, "does-not-exist", { status: "reviewed" })).toBeUndefined();
  });

  test("CRLF files parse and patch without corrupting line endings", () => {
    const crlf = FIXTURE.replace(/\n/g, "\r\n");
    const items = parseBacklog(crlf).items;
    expect(items.map((i) => i.id)).toEqual([
      "pr86-numeric-sets-indexed",
      "second-id",
      "third-id",
      "fourth-id",
    ]);
    const pr86 = items.find((i) => i.id === "pr86-numeric-sets-indexed")!;
    expect(pr86.feedback).toBe("Looks solid overall.\r\n\r\nSecond paragraph of feedback.");

    const result = applyItemPatch(crlf, "pr86-numeric-sets-indexed", { status: "reviewed" })!;
    expect(result.raw.length).toBe(crlf.length);
    // Every line in the untouched remainder still ends \r\n.
    expect(result.raw.includes("\r\n### [x] Second item")).toBe(true);
  });
});

describe("serializeItem / upsertItem", () => {
  test("serializes a full item back to the standard block shape", () => {
    const item = parseBacklog(FIXTURE).items.find((i) => i.id === "pr86-numeric-sets-indexed")!;
    check("serialize-with-feedback", serializeItem(item));
  });

  test("serializes an item with empty feedback (still gets the Feedback heading)", () => {
    const item = parseBacklog(FIXTURE).items.find((i) => i.id === "second-id")!;
    check("serialize-empty-feedback", serializeItem({ ...item, feedback: "" }));
  });

  test("upsertItem patches an existing id exactly like applyItemPatch", () => {
    const viaUpsert = upsertItem(FIXTURE, {
      id: "second-id",
      title: "Second item",
      status: "reviewed",
      bullets: [],
      feedback: "Nice work, ship it.",
    });
    const viaPatch = applyItemPatch(FIXTURE, "second-id", {
      status: "reviewed",
      feedback: "Nice work, ship it.",
    })!;
    expect(viaUpsert.raw).toBe(viaPatch.raw);
  });

  test("upsertItem appends a brand-new id without touching anything else", () => {
    const item = {
      id: "adhoc-new-item",
      title: "Arccos · example-19",
      status: "open" as const,
      link: "https://enumeratio.dev/reference/symbol/Arccos#example-19",
      bullets: [
        { key: "link", value: "https://enumeratio.dev/reference/symbol/Arccos#example-19" },
      ],
      feedback: "",
    };
    const result = upsertItem(FIXTURE, item);
    expect(result.raw.startsWith(FIXTURE)).toBe(true);
    const reparsed = parseBacklog(result.raw);
    expect(reparsed.items).toHaveLength(5);
    const appended = reparsed.items.at(-1)!;
    expect(appended.id).toBe("adhoc-new-item");
    expect(appended.link).toBe("https://enumeratio.dev/reference/symbol/Arccos#example-19");
    check("upsert-append", { raw: result.raw, item: result.item });
  });

  test("upsertItem into an empty file produces a parseable single-item backlog", () => {
    const item = {
      id: "adhoc-first",
      title: "Guide · overview",
      status: "open" as const,
      bullets: [{ key: "link", value: "https://enumeratio.dev/guide/#overview" }],
      feedback: "",
    };
    const result = upsertItem("", item);
    const reparsed = parseBacklog(result.raw);
    expect(reparsed.items.map((i) => i.id)).toEqual(["adhoc-first"]);
  });
});

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});
