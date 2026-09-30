// @enumeratio/frontend/vue: notatio in Vue. The symbols as components -- `<Slider>`,
// `<Plot>`, `<Row>`, generated from the element sources (`generate.ts`) -- and
// `<Notatio expr>`, which renders an expression as the vdom it IS (`structuralOf`):
// every head a tag, every argument a child, every option an attribute, made by Vue's
// `h`. No lowering happens here -- the elements do that, reading their own children --
// and no scope is added: the page is one. The elements themselves are
// `@enumeratio/components`, which the page imports once for their registration; this
// module only names them.

import { type App, defineAsyncComponent } from "vue";
import { components } from "./vue-generated.ts";

export { components };
export * from "./vue-generated.ts";

/**
 * `<Notatio expr="Row([Slider(k, (0, 5)), Dynamic(k^2)])" />` -- an expression drawn as
 * the vdom it is (notatio-vue.ts), loaded when one first renders: it brings the engine,
 * which a page of symbol wrappers alone never needs.
 */
export const Notatio = defineAsyncComponent(() => import("./notatio-vue.ts").then((m) => m.Notatio));

/** Register every symbol component and `<Notatio>` on an app, by name. */
export function registerNotatio(app: App): void {
  app.component("Notatio", Notatio);
  for (const [name, component] of Object.entries(components)) app.component(name, component);
}
