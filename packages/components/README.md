# @enumeratio/components

The `notatio-*` custom elements (Lit): every symbol that draws or controls, built on
[`frontend`](../frontend/README.md). This is the package an app installs to get notatio working in
plain HTML, or under the Vue/React wrappers `@enumeratio/frontend` generates.

Importing the package registers every element as a side effect and installs a page-level
`Scope`: controls and readouts with no `<DynamicModule>` around them bind through it,
client side.

```ts
import "@enumeratio/components";
```

```html
<notatio-slider name="k" from="0" to="5"></notatio-slider> <notatio-dynamic expr="k^2"></notatio-dynamic>
```

## What's here

- **Editable cells** — `<notatio-in>` (a MathLive field reading Epsil), `<notatio-out>`
  (renders an evaluated expression, or the raw encoding a `format` prop names),
  `<notatio-cell>` (the unified In/Out pair), `<notatio-notebook>` and
  `<notatio-worksheet>` (a reactive sheet of cells built on `<notatio-dynamic-module>`).
- **Plots and charts** — `<notatio-plot>`, `<notatio-plot-3d>`, `<notatio-contour-plot>`,
  `<notatio-density-plot>`, `<notatio-vector-plot>`, `<notatio-polar-plot>`,
  `<notatio-complex-plot>` (and `-3d`), `<notatio-chart>` (the family head for
  Histogram/BarChart/PieChart-style symbols), `<notatio-graph-plot>`.
- **Controls** — `<notatio-slider>` (and `-2d`, `-vertical`, `-interval`,
  `-color`), `<notatio-knob>`, `<notatio-toggler>` (and `-bar`),
  `<notatio-radio-button-bar>`, `<notatio-setter-bar>`, `<notatio-checkbox>`,
  `<notatio-list-picker>`, `<notatio-locator>`, `<notatio-input-field>` — every one
  keeping the control contract from [`frontend`](../frontend/README.md) (`controls.ts`): a `name`, a
  MathJSON `binding`, a `notatio-control-change` event.
- **Layout** — `<notatio-row>`, `<notatio-column>`, `<notatio-grid>`, `<notatio-panel>`,
  `<notatio-labeled>`.
- **Reactive scopes** — `<notatio-manipulate>`, `<notatio-dynamic>`,
  `<notatio-dynamic-module>`: bind a body's controls to its own expression and re-render
  on change.
- **Other** — `<notatio-code>`, `<notatio-terminal>` (a real terminal emulator running
  `@enumeratio/cli`'s logic), `<notatio-collection-table>`, `<notatio-clock>`,
  `<notatio-torus-square>`, `<notatio-polytope>`, `<notatio-curve-3d>`.

`./define.ts`'s `defineControl` is how a new control registers its tag and joins
`CONTROL_TAGS`, the set a scope's `querySelectorAll` reads.

## Where to go next

- [`/reference/component/`](https://enumeratio.dev/reference/component/) — every element's props, generated from
  these sources so the reference can't drift from the code.
- [Components, one at a time](https://enumeratio.dev/docs/components/overview) — each component demoed live; `reference/*.stories.yaml`
  in this package back those pages.
- [`frontend`](../frontend/README.md) — the symbol map, the vdom, and the Vue/React wrappers.
- [Components and Symbols](https://github.com/enumeratio/enumeratio/wiki/Components-and-Symbols) — the design
  linking a symbol to its element.
