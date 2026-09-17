// @enumeratio/notatio-vue: notatio in Vue. The symbols as components -- `<Slider>`,
// `<Plot>`, `<Row>`, generated from the element sources (`generate.ts`) -- and
// `<Notatio expr>`, which renders an expression as the vdom `vdomOf` gives it: a tree
// of the same custom elements, made by Vue's `h`. The elements themselves come from
// `@enumeratio/notatio-lit`, imported here for their registration.

import { parseNotatio } from "@enumeratio/formats/notatio";
import { type Rendering, structuralOf, toVNode, vdomOf } from "@enumeratio/notatio";
import { loadEngine } from "@enumeratio/notatio-lit";
import { type App, defineComponent, h, ref, type VNode, watchEffect } from "vue";
import { components } from "./generated.ts";

export { components };
export * from "./generated.ts";

/**
 * `<Notatio expr="Row([Slider(k, (0, 5)), Dynamic(k^2)])" />` -- an expression drawn as
 * the vdom it is: the controls, the layout, the readouts, each a component, the
 * controls' variables bound through the page. `structural` draws the expression
 * verbatim instead -- every head a tag, every argument a child -- which is the tree
 * with nothing interpreted. `json` takes MathJSON in place of notatio.
 */
export const Notatio = defineComponent({
  name: "Notatio",
  props: {
    /** The expression, as notatio. */
    expr: { type: String, required: false },
    /** The expression, as a MathJSON string -- an alternative to `expr`. */
    json: { type: String, required: false },
    /** Draw the structural tree rather than the one that draws. */
    structural: { type: Boolean, required: false },
  },
  setup(props) {
    const tree = ref<Rendering | undefined>(undefined);
    watchEffect(async () => {
      const json = await parse(props.expr, props.json);
      if (json === undefined) {
        tree.value = undefined;
        return;
      }
      tree.value = props.structural ? structuralOf(json as never) : vdomOf(json as never);
    });
    return () =>
      tree.value === undefined
        ? h("span", { class: "notatio-pending" })
        : toVNode<VNode>(tree.value, (tag, attrs, children) => h(tag, { ...attrs }, [...children]));
  },
});

/** Parse the source: MathJSON as given, notatio with the engine for its `$…$` islands. */
async function parse(expr?: string, json?: string): Promise<unknown> {
  if (json) return JSON.parse(json);
  if (!expr?.trim()) return undefined;
  const engine = await loadEngine();
  const parsed = parseNotatio(expr, { parseLatex: (tex) => engine.parse(tex).json });
  return parsed.errors.length ? undefined : parsed.json;
}

/** Register every symbol component and `<Notatio>` on an app, by name. */
export function registerNotatio(app: App): void {
  app.component("Notatio", Notatio);
  for (const [name, component] of Object.entries(components)) app.component(name, component);
}
