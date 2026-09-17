// The AST as a vdom (design/vdom.md): a MathJSON node `[head, ...args]` and a vdom node
// `{ tag, props, children }` are the same tree under a renaming, and this module is the
// renaming both ways. `structuralOf` writes the expression out verbatim -- every head a
// tag, every argument a child, atoms as the leaf tags Wolfram uses -- and `vdomOf`
// gives the tree that draws, which is `renderingOf` with a typeset fallback. `toVNode`
// hands either to any framework's `h`.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { type Rendering, renderingOf } from "./symbols.ts";

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

const opsOf = (node: unknown): Json[] => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) ? (fn.slice(1) as Json[]) : [];
};

/**
 * An atom as its leaf: Wolfram's `Integer`, `Real`, `String` and `Symbol`, with the
 * value as the node's text. `True`/`False` are symbols like any other.
 */
function atom(node: Json): Rendering | undefined {
  if (typeof node === "number") {
    return {
      tag: Number.isInteger(node) ? "notatio-integer" : "notatio-real",
      attributes: {},
      text: String(node),
    };
  }
  if (typeof node === "string") {
    if (node.length >= 2 && node.startsWith("'") && node.endsWith("'")) {
      return { tag: "notatio-string", attributes: {}, text: node.slice(1, -1) };
    }
    return { tag: "notatio-symbol", attributes: {}, text: node };
  }
  const num = (node as { num?: unknown }).num;
  if (typeof num === "string" || typeof num === "number") {
    const text = String(num);
    return { tag: /^-?\d+$/.test(text) ? "notatio-integer" : "notatio-real", attributes: {}, text };
  }
  const str = (node as { str?: unknown }).str;
  if (typeof str === "string") return { tag: "notatio-string", attributes: {}, text: str };
  const sym = (node as { sym?: unknown }).sym;
  if (typeof sym === "string") return { tag: "notatio-symbol", attributes: {}, text: sym };
  return undefined;
}

/**
 * The expression verbatim as a vdom: no props anywhere, every argument a child, atoms
 * as leaves. Nothing is interpreted, so nothing is lost -- the tree is the expression,
 * addressable node by node.
 */
export function structuralOf(expr: Json): Rendering {
  const leaf = atom(expr);
  if (leaf !== undefined) return leaf;
  const head = headOf(expr);
  if (head === undefined) {
    return { tag: "notatio-symbol", attributes: {}, text: JSON.stringify(expr) };
  }
  return { tag: tagOf(head), attributes: {}, children: opsOf(expr).map(structuralOf) };
}

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
    rendering.text !== undefined
      ? [rendering.text]
      : (rendering.children?.map((c) => toVNode(c, h)) ?? []);
  return h(rendering.tag, rendering.attributes, children);
}
