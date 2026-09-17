import { parseNotatio } from "@enumeratio/formats/notatio";
import { expect, test } from "vite-plus/test";
import { structuralOf, tagOf, toVNode, vdomOf } from "../src/vdom.ts";

/** A vnode factory that keeps everything, for looking at. */
const h = (tag: string, props: Readonly<Record<string, string>>, children: readonly unknown[]) => ({
  tag,
  props,
  children,
});

test("the tag is the naming rule: notatio- plus the head, kebab-cased", () => {
  expect(tagOf("Plot")).toBe("notatio-plot");
  expect(tagOf("Plot3D")).toBe("notatio-plot-3d");
  expect(tagOf("Slider2D")).toBe("notatio-slider-2d");
  expect(tagOf("CollectionTable")).toBe("notatio-collection-table");
});

test("the structural tree is the expression verbatim: heads are tags, arguments children, atoms leaves", () => {
  const { json } = parseNotatio("Binomial(n, 2)");
  expect(toVNode(structuralOf(json), h)).toEqual({
    tag: "notatio-binomial",
    props: {},
    children: [
      { tag: "notatio-symbol", props: {}, children: ["n"] },
      { tag: "notatio-integer", props: {}, children: ["2"] },
    ],
  });
  const nested = parseNotatio("Sin(x)^2 + 1").json;
  const tree = structuralOf(nested);
  expect(tree.tag).toBe("notatio-add");
  expect(tree.children?.map((c) => c.tag)).toEqual(["notatio-power", "notatio-integer"]);
  expect(structuralOf(parseNotatio('"so"').json)).toEqual({
    tag: "notatio-string",
    attributes: {},
    text: "so",
  });
  expect(structuralOf(parseNotatio("2.5").json).tag).toBe("notatio-real");
});

test("the realized tree lowers a component's arguments into props, and typesets the rest", () => {
  const plot = vdomOf(parseNotatio("Plot(Sin(k * x), (x, 0, 10))").json);
  expect(plot.tag).toBe("notatio-plot");
  expect(plot.attributes).toEqual({ value: "Sin(k * x)", var: "x", domain: "0,10" });
  expect(plot.children).toBeUndefined();

  const scoped = vdomOf(parseNotatio("Row([Slider((k, 2), (0, 5)), Dynamic(k^2)])").json);
  expect(scoped.tag).toBe("notatio-tangle");
  const row = scoped.children?.[0];
  expect(row?.tag).toBe("notatio-row");
  expect(row?.children?.map((c) => [c.tag, c.attributes])).toEqual([
    ["notatio-slider", { name: "k", value: "2", min: "0", max: "5" }],
    ["notatio-dynamic", { value: "_k ^ 2" }],
  ]);

  const plain = vdomOf(parseNotatio("Binomial(n, 2)").json);
  expect(plain.tag).toBe("notatio-out");
  expect(plain.attributes.format).toBe("mathjson");
});

test("toVNode hands the tree to any h, text as a lone child", () => {
  const v = toVNode(
    { tag: "notatio-row", attributes: {}, children: [{ tag: "span", attributes: {}, text: "so" }] },
    h,
  );
  expect(v).toEqual({
    tag: "notatio-row",
    props: {},
    children: [{ tag: "span", props: {}, children: ["so"] }],
  });
});
