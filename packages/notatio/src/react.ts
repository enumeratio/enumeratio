// @enumeratio/notatio/react: notatio in React. The symbols as components -- `<Slider>`,
// `<Plot>`, `<Row>`, generated from the element sources (`generate.ts`) -- and
// `<Notatio expr>`, which renders an expression as the vdom it IS (`structuralOf`):
// every head a tag, every argument a child, every option an attribute, made by
// `createElement`. No lowering happens here -- the elements do that, reading their own
// children -- and no scope is added: the page is one. The elements themselves are
// `@enumeratio/notatio-lit`, which the page imports once for their registration; this
// module only names them.

import { parseNotatio } from "@enumeratio/formats/notatio";
import { createElement, type ReactElement, useEffect, useState } from "react";
import { loadEngine } from "./engine.ts";
import {
  type Environment,
  environmentNamed,
  pageEnvironment,
  watchPageEnvironment,
} from "./environment.ts";
import { reduce } from "./reduce.ts";
import type { Rendering } from "./symbols.ts";
import { structuralOf, toVNode } from "./vdom.ts";
import { components } from "./react-generated.ts";

export { components };
export * from "./react-generated.ts";

export interface NotatioProps {
  /** The expression, as notatio. */
  expr?: string;
  /** The expression, as a MathJSON string -- an alternative to `expr`. */
  json?: string;
  /** A preset to reduce for (`print`, `pipe`, …); by default the page's own, as it changes. */
  env?: string;
}

/**
 * `<Notatio expr="Row([Slider(k, (0, 5)), Dynamic(k^2)])" />` -- an expression drawn as
 * the vdom it is: every head a tag, every argument a child, every option an attribute;
 * the controls, the layout, the readouts each find their component by name, and the
 * controls' variables bind through the page.
 */
export function Notatio({ expr, json, env }: NotatioProps): ReactElement {
  const [tree, setTree] = useState<Rendering | undefined>(undefined);
  // The page's environment: printing pins or samples the controls, a narrow window
  // stacks the rows -- the expression is reduced for it before it is drawn.
  const [page, setPage] = useState<Environment>(pageEnvironment);
  useEffect(() => watchPageEnvironment(setPage), []);
  useEffect(() => {
    let live = true;
    void parse(expr, json).then((parsed) => {
      if (!live) return;
      const target = environmentNamed(env) ?? page;
      setTree(parsed === undefined ? undefined : structuralOf(reduce(parsed as never, target)));
    });
    return () => {
      live = false;
    };
  }, [expr, json, env, page]);
  if (tree === undefined) return createElement("span", { className: "notatio-pending" });
  let key = 0;
  const node = toVNode<ReactElement>(tree, (tag, attrs, children) =>
    createElement(tag, { ...attrs, key: key++ }, ...children),
  );
  // A forced environment rides on a wrapper, not the root -- see the Vue twin.
  return env ? createElement("span", { env, style: { display: "contents" } }, node) : node;
}

/** Parse the source: MathJSON as given, notatio with the engine for its `$…$` islands. */
async function parse(expr?: string, json?: string): Promise<unknown> {
  if (json) return JSON.parse(json);
  if (!expr?.trim()) return undefined;
  const engine = await loadEngine();
  const parsed = parseNotatio(expr, { parseLatex: (tex) => engine.parse(tex).json });
  return parsed.errors.length ? undefined : parsed.json;
}
