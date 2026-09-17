// @enumeratio/notatio-react: notatio in React. The symbols as components -- `<Slider>`,
// `<Plot>`, `<Row>`, generated from the element sources (`generate.ts`) -- and
// `<Notatio expr>`, which renders an expression as the vdom `vdomOf` gives it: a tree
// of the same custom elements, made by `createElement`. The elements themselves come
// from `@enumeratio/notatio-lit`, imported here for their registration.

import { parseNotatio } from "@enumeratio/formats/notatio";
import { type Rendering, structuralOf, toVNode, vdomOf } from "@enumeratio/notatio";
import { loadEngine } from "@enumeratio/notatio-lit";
import { createElement, type ReactElement, useEffect, useState } from "react";
import { components } from "./generated.ts";

export { components };
export * from "./generated.ts";

export interface NotatioProps {
  /** The expression, as notatio. */
  expr?: string;
  /** The expression, as a MathJSON string -- an alternative to `expr`. */
  json?: string;
  /** Draw the structural tree rather than the one that draws. */
  structural?: boolean;
}

/**
 * `<Notatio expr="Row([Slider(k, (0, 5)), Dynamic(k^2)])" />` -- an expression drawn as
 * the vdom it is: the controls, the layout, the readouts, each a component, the
 * controls' variables bound through the page. `structural` draws the expression
 * verbatim instead -- every head a tag, every argument a child.
 */
export function Notatio({ expr, json, structural }: NotatioProps): ReactElement {
  const [tree, setTree] = useState<Rendering | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void parse(expr, json).then((parsed) => {
      if (!live) return;
      setTree(
        parsed === undefined
          ? undefined
          : structural
            ? structuralOf(parsed as never)
            : vdomOf(parsed as never),
      );
    });
    return () => {
      live = false;
    };
  }, [expr, json, structural]);
  if (tree === undefined) return createElement("span", { className: "notatio-pending" });
  let key = 0;
  return toVNode<ReactElement>(tree, (tag, attrs, children) =>
    createElement(tag, { ...attrs, key: key++ }, ...children),
  );
}

/** Parse the source: MathJSON as given, notatio with the engine for its `$…$` islands. */
async function parse(expr?: string, json?: string): Promise<unknown> {
  if (json) return JSON.parse(json);
  if (!expr?.trim()) return undefined;
  const engine = await loadEngine();
  const parsed = parseNotatio(expr, { parseLatex: (tex) => engine.parse(tex).json });
  return parsed.errors.length ? undefined : parsed.json;
}
