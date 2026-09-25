// The AST as a vdom (design/vdom.md): a MathJSON node `[head, ...args]` and a vdom node
// `{ tag, props, children }` are the same tree under a renaming, and this module is the
// renaming both ways. `structuralOf` writes the expression out verbatim -- every head a
// tag, every argument a child, atoms as the leaf tags Wolfram uses -- and `vdomOf`
// gives the tree that draws, which is `renderingOf` with a typeset fallback. `toVNode`
// hands either to any framework's `h`.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { optionsOf } from "@enumeratio/formats";
import { serializeNotatio } from "@enumeratio/formats/notatio";
import { optionAttribute, type Rendering, renderingOf } from "./symbols.ts";

type Json = MathJsonExpression;

/** A framework's element factory: Vue's `h`, React's `createElement`, or anything shaped so. */
export type VNodeFactory<N> = (
  tag: string,
  props: Readonly<Record<string, string>>,
  children: readonly (N | string)[],
) => N;

/** `Plot3D` -> `notatio-plot-3d`: the naming rule, kebab-cased with digits kept together. */
export function tagOf(head: string): string {
  // A digit run stays with its letter: `Plot3D` is `plot-3d`, as the symbols test pins.
  return `notatio-${head.replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase()}`;
}

const headOf = (node: unknown): string | undefined => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) && typeof fn[0] === "string" ? fn[0] : undefined;
};

/**
 * An atom as its leaf: Wolfram's `Integer`, `Real`, `String` and `Symbol`, with the
 * value as the node's text. `True`/`False` are symbols like any other.
 */
function atom(node: Json): Rendering | undefined {
  const leaf = (tag: string, value: string): Rendering => ({ tag, attributes: { value } });
  if (typeof node === "number") {
    return leaf(Number.isInteger(node) ? "notatio-integer" : "notatio-real", String(node));
  }
  if (typeof node === "string") {
    if (node.length >= 2 && node.startsWith("'") && node.endsWith("'")) {
      return leaf("notatio-string", node.slice(1, -1));
    }
    return leaf("notatio-symbol", node);
  }
  const num = (node as { num?: unknown }).num;
  if (typeof num === "string" || typeof num === "number") {
    const text = String(num);
    return leaf(/^-?\d+$/.test(text) ? "notatio-integer" : "notatio-real", text);
  }
  const str = (node as { str?: unknown }).str;
  if (typeof str === "string") return leaf("notatio-string", str);
  const sym = (node as { sym?: unknown }).sym;
  if (typeof sym === "string") return leaf("notatio-symbol", sym);
  return undefined;
}

/**
 * The expression verbatim as a vdom: every positional argument a child, atoms as leaves
 * with their literal as `value`, and the trailing options (Wolfram's rules) as props --
 * `PlotRange -> All` is `plot-range="All"`, and an option whose value is itself an
 * application is a slotted child, since an attribute whose value is a node is a named
 * child. Nothing else is interpreted: the element the tag names does the lowering.
 */
export function structuralOf(expr: Json): Rendering {
  const leaf = atom(expr);
  if (leaf !== undefined) return leaf;
  const head = headOf(expr);
  if (head === undefined) {
    return { tag: "notatio-symbol", attributes: { value: JSON.stringify(expr) } };
  }
  const { ops, options } = optionsOf(expr);
  const attributes: Record<string, string> = {};
  const children = ops.map(structuralOf);
  for (const [name, value] of Object.entries(options)) {
    const attr = optionAttribute(name);
    const valueHead = headOf(value);
    if (valueHead !== undefined && !PRIMITIVE_HEADS.has(valueHead)) {
      const child = structuralOf(value);
      children.push({ ...child, attributes: { ...child.attributes, slot: attr } });
      continue;
    }
    const sym = typeof value === "string" ? value : (value as { sym?: unknown }).sym;
    if (sym === "False") continue;
    attributes[attr] = sym === "True" ? "true" : (stringOf(value) ?? serializeNotatio(value));
  }
  return { tag: tagOf(head), attributes, children };
}

/** Graphics primitives travel as text: a plot draws them in its own coordinates. */
const PRIMITIVE_HEADS = new Set([
  "Point",
  "Line",
  "Arrow",
  "Circle",
  "Disk",
  "Polygon",
  "Rectangle",
  "Text",
  "List",
  "Tuple",
]);

const stringOf = (node: Json): string | undefined => {
  if (typeof node === "string" && node.length >= 2 && node.startsWith("'") && node.endsWith("'")) {
    return node.slice(1, -1);
  }
  const str = (node as { str?: unknown }).str;
  return typeof str === "string" ? str : undefined;
};

/**
 * The tree that draws: a head with a component has its arguments lowered into that
 * component's props (`renderingOf`); anything else typesets through `<notatio-out>`.
 * Always something -- every expression has a picture, if only of itself.
 */
export function vdomOf(expr: Json): Rendering {
  return (
    renderingOf(expr) ?? {
      tag: "notatio-out",
      attributes: { format: "mathjson", value: JSON.stringify(expr) },
    }
  );
}

/** Hand a rendering to a framework: `toVNode(vdomOf(expr), h)`. */
export function toVNode<N>(rendering: Rendering, h: VNodeFactory<N>): N {
  const children: (N | string)[] =
    rendering.text !== undefined ? [rendering.text] : (rendering.children?.map((c) => toVNode(c, h)) ?? []);
  return h(rendering.tag, rendering.attributes, children);
}
