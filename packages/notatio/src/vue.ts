// @enumeratio/notatio/vue: notatio in Vue. The symbols as components -- `<Slider>`,
// `<Plot>`, `<Row>`, generated from the element sources (`generate.ts`) -- and
// `<Notatio expr>`, which renders an expression as the vdom it IS (`structuralOf`):
// every head a tag, every argument a child, every option an attribute, made by Vue's
// `h`. No lowering happens here -- the elements do that, reading their own children --
// and no scope is added: the page is one. The elements themselves are
// `@enumeratio/notatio-lit`, which the page imports once for their registration; this
// module only names them.

import { parseNotatio } from "@enumeratio/formats/notatio";
import {
  type App,
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  ref,
  type VNode,
  watchEffect,
} from "vue";
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
import { components } from "./vue-generated.ts";

export { components };
export * from "./vue-generated.ts";

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
    /** A preset to reduce for (`print`, `pipe`, …); by default the page's own, as it changes. */
    env: { type: String, required: false },
  },
  setup(props) {
    const tree = ref<Rendering | undefined>(undefined);
    // The page's environment: printing pins or samples the controls, a narrow window
    // stacks the rows -- the expression is reduced for it before it is drawn.
    const page = ref<Environment>(pageEnvironment());
    let unwatch = (): void => {};
    onMounted(() => {
      page.value = pageEnvironment();
      unwatch = watchPageEnvironment((env) => (page.value = env));
    });
    onUnmounted(() => unwatch());
    watchEffect(async () => {
      const json = await parse(props.expr, props.json);
      if (json === undefined) {
        tree.value = undefined;
        return;
      }
      const env = environmentNamed(props.env) ?? page.value;
      tree.value = structuralOf(reduce(json as never, env));
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
