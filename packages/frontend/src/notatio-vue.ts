// `<Notatio>`'s implementation: it parses, reduces and draws an expression, so it brings the
// engine; vue.ts loads it on first use, keeping the symbol wrappers light.

import { parseExpression } from "@enumeratio/formats/expression";
import { defineComponent, h, onMounted, onUnmounted, ref, type VNode, watchEffect } from "vue";
import { loadEngine } from "./engine.ts";
import { type Environment, environmentNamed, pageEnvironment, watchPageEnvironment } from "./environment.ts";
import { reduce } from "./reduce.ts";
import type { Rendering } from "./symbols.ts";
import { structuralOf, toVNode } from "./vdom.ts";

/**
 * `<Notatio expr="Row([Slider(k, (0, 5)), Dynamic(k^2)])" />` -- an expression drawn as
 * the vdom it is: every head a tag, every argument a child, every option an attribute;
 * the controls, the layout, the readouts each find their component by name, and the
 * controls' variables bind through the page. `json` takes MathJSON in place of Epsil.
 */
export const Notatio = defineComponent({
  name: "Notatio",
  props: {
    /** The expression, as Epsil. */
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
    return () => {
      if (tree.value === undefined) return h("span", { class: "notatio-pending" });
      const node = toVNode<VNode>(tree.value, (tag, attrs, children) => h(tag, { ...attrs }, [...children]));
      // A forced environment is ambient context, not part of the expression, so it rides
      // on a wrapper the elements find with `closest("[env]")` rather than on the root --
      // an attribute there would be read as an option by a generic element.
      return props.env ? h("span", { env: props.env, style: "display: contents" }, [node]) : node;
    };
  },
});

/** Parse the source: MathJSON as given, Epsil with the engine for its `$…$` islands. */
async function parse(expr?: string, json?: string): Promise<unknown> {
  if (json) return JSON.parse(json);
  if (!expr?.trim()) return undefined;
  const engine = await loadEngine();
  const parsed = parseExpression(expr, { parseLatex: (tex) => engine.parse(tex).json });
  return parsed.errors.length ? undefined : parsed.json;
}
