// @enumeratio/notatio-vue: notatio in Vue. The symbols as components -- `<Slider>`,
// `<Plot>`, `<Row>`, generated from the element sources (`generate.ts`) -- and
// `<Notatio expr>`, which renders an expression as the vdom it IS (`structuralOf`):
// every head a tag, every argument a child, every option an attribute, made by Vue's
// `h`. No lowering happens here -- the elements do that, reading their own children --
// and no scope is added: the page is one. The elements come from
// `@enumeratio/notatio-lit`, imported here for their registration.

import { parseNotatio } from "@enumeratio/formats/notatio";
import { type Rendering, structuralOf, toVNode } from "@enumeratio/notatio";
import { loadEngine } from "@enumeratio/notatio-lit";
import { type App, defineComponent, h, ref, type VNode, watchEffect } from "vue";
import { components } from "./generated.ts";

export { components };
export * from "./generated.ts";

/**
 * `<Notatio expr="Row([Slider(k, (0, 5)), Dynamic(k^2)])" />` -- an expression drawn as
 * the vdom it is: every head a tag, every argument a child, every option an attribute;
 * the controls, the layout, the readouts each find their component by name, and the
 * controls' variables bind through the page. `json` takes MathJSON in place of notatio.
 */
export const Notatio = defineComponent({
  name: "Notatio",
  props: {
    /** The expression, as notatio. */
    expr: { type: String, required: false },
    /** The expression, as a MathJSON string -- an alternative to `expr`. */
    json: { type: String, required: false },
  },
  setup(props) {
    const tree = ref<Rendering | undefined>(undefined);
    watchEffect(async () => {
      const json = await parse(props.expr, props.json);
      if (json === undefined) {
        tree.value = undefined;
        return;
      }
      tree.value = structuralOf(json as never);
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
