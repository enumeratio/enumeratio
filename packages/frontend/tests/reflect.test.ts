import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseExpression } from "@enumeratio/formats/expression";
import { describe, expect, it, test } from "vite-plus/test";
import { collectComponents, structuralMarkupOf, wrapperName } from "../src/reflect.ts";
import { structuralOf } from "../src/vdom.ts";

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

test("wrapperName is tagOf run backwards", () => {
  expect(wrapperName("notatio-bar-chart-3d")).toBe("BarChart3D");
  expect(wrapperName("notatio-plot-3d")).toBe("Plot3D");
  expect(wrapperName("notatio-collection-table")).toBe("CollectionTable");
});

describe("structuralMarkupOf", () => {
  const markupOf = (source: string): string => structuralMarkupOf(structuralOf(parseExpression(source).json as never));

  it("collapses a run of leaves to comma-joined values", () => {
    expect(markupOf("Binomial(n, 2)")).toBe("<Binomial>n, 2</Binomial>");
  });

  it("nests a compound child instead of collapsing it", () => {
    expect(markupOf("Plot(Sin(x), (x, 0, 10))")).toBe(
      ["<Plot>", "  <Sin>x</Sin>", "  <Tuple>x, 0, 10</Tuple>", "</Plot>"].join("\n"),
    );
  });

  it("prints options as attributes on the tag they belong to", () => {
    expect(markupOf('BarChart3D([3,1,4], Label -> "digits of π")')).toBe(
      ['<BarChart3D label="digits of π">', "  <List>3, 1, 4</List>", "</BarChart3D>"].join("\n"),
    );
  });

  it("prints a matrix of rows as nested collapsed lists", () => {
    expect(markupOf("BarChart3D([[1,2,3],[2,4,3]])")).toBe(
      [
        "<BarChart3D>",
        "  <List>",
        "    <List>1, 2, 3</List>",
        "    <List>2, 4, 3</List>",
        "  </List>",
        "</BarChart3D>",
      ].join("\n"),
    );
  });

  it("prints a bare atom self-closed", () => {
    expect(markupOf("2.5")).toBe('<Real value="2.5" />');
  });
});
