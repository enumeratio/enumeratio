import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { collectComponents } from "../src/reflect.ts";

const summaryOf = (source: string): string | undefined => {
  const dir = mkdtempSync(join(tmpdir(), "reflect-"));
  writeFileSync(join(dir, "notatio-x.ts"), source);
  return collectComponents(dir)[0]?.summary;
};

const attributesOf = (source: string) => {
  const dir = mkdtempSync(join(tmpdir(), "reflect-"));
  writeFileSync(join(dir, "notatio-x.ts"), source);
  return collectComponents(dir)[0]?.attributes;
};

describe("attribute description", () => {
  it("is the entry's own JSDoc, not an earlier one", () => {
    const attributes = attributesOf(`
export class NotatioX extends LitElement {
  static properties = {
    /** Inherited. */
    ...Base.properties,
    /** The first. */
    first: { type: String },
    second: { type: String },
    /** The third. */
    third: { type: String },
  };
}
customElements.define("notatio-x", NotatioX);
`);
    expect(attributes?.map((a) => [a.property, a.description])).toEqual([
      ["first", "The first."],
      ["second", ""],
      ["third", "The third."],
    ]);
  });
});

describe("component summary", () => {
  it("is the class's own JSDoc, not an earlier top-level one", () => {
    const summary = summaryOf(`
/** A type alias. */
export type Syntax = "a" | "b";

function helper() {
  return 1;
}

/**
 * The element.
 */
export class NotatioX extends LitElement {}
customElements.define("notatio-x", NotatioX);
`);
    expect(summary).toBe("The element.");
  });

  it("is empty when the class has no JSDoc of its own", () => {
    const summary = summaryOf(`
/** A type alias. */
export type Syntax = "a" | "b";

export class NotatioX extends LitElement {}
customElements.define("notatio-x", NotatioX);
`);
    expect(summary).toBe("");
  });
});
