// The elements, defined as a page uses them: each tag loads its own module. A cell or a plot
// asks the page's kernel, so neither needs an engine here. The first element that isn't a
// cell's also installs the page scope (its controls bind through it). A `notatio-*` tag no
// module claims is a generic element (`generic.ts`), and an element written structurally
// (its arguments as children) brings the lowering that reads them (`structure.ts`).
// `tests/lazy.test.ts` holds this table to every tag the package defines, and the modules a page
// of cells or plots loads to no engine.

export { configureMacros } from "./mathlive.ts";

const ELEMENTS: Readonly<Record<string, () => Promise<unknown>>> = {
  "notatio-in": () => import("./notatio-in.ts"),
  "notatio-out": () => import("./notatio-out.ts"),
  "notatio-cell": () => import("./notatio-cell.ts"),
  "notatio-code": () => import("./notatio-code.ts"),
  "notatio-clock": () => import("./notatio-clock.ts"),
  "notatio-torus-square": () => import("./notatio-torus-square.ts"),
  "notatio-notebook": () => import("./notatio-notebook.ts"),
  "notatio-worksheet": () => import("./notatio-worksheet.ts"),
  "notatio-figure": () => import("./notatio-figure.ts"),
  "notatio-plot": () => import("./notatio-plot.ts"),
  "notatio-plot-3d": () => import("./notatio-plot-3d.ts"),
  "notatio-curve-3d": () => import("./notatio-curve-3d.ts"),
  "notatio-contour-plot": () => import("./notatio-contour-plot.ts"),
  "notatio-density-plot": () => import("./notatio-density-plot.ts"),
  "notatio-vector-plot": () => import("./notatio-vector-plot.ts"),
  "notatio-polar-plot": () => import("./notatio-polar-plot.ts"),
  "notatio-list-plot-3d": () => import("./notatio-list-plot-3d.ts"),
  "notatio-bar-chart-3d": () => import("./notatio-bar-chart-3d.ts"),
  "notatio-chart": () => import("./notatio-chart.ts"),
  "notatio-graph-plot": () => import("./notatio-graph-plot.ts"),
  "notatio-complex-plot": () => import("./notatio-complex-plot.ts"),
  "notatio-complex-plot-3d": () => import("./notatio-complex-plot-3d.ts"),
  "notatio-show": () => import("./notatio-show.ts"),
  "notatio-stepper": () => import("./notatio-stepper.ts"),
  "notatio-string-template": () => import("./notatio-string-template.ts"),
  "notatio-gradient": () => import("./notatio-gradient.ts"),
  "notatio-palette": () => import("./notatio-palette.ts"),
  "notatio-manipulate": () => import("./notatio-manipulate.ts"),
  "notatio-dynamic-module": () => import("./notatio-dynamic-module.ts"),
  "notatio-dynamic": () => import("./notatio-dynamic.ts"),
  "notatio-when": () => import("./notatio-when.ts"),
  "notatio-slider": () => import("./notatio-slider.ts"),
  "notatio-vertical-slider": () => import("./notatio-vertical-slider.ts"),
  "notatio-animator": () => import("./notatio-animator.ts"),
  "notatio-slider-2d": () => import("./notatio-slider-2d.ts"),
  "notatio-setter-bar": () => import("./notatio-setter-bar.ts"),
  "notatio-radio-button-bar": () => import("./notatio-radio-button-bar.ts"),
  "notatio-toggler-bar": () => import("./notatio-toggler-bar.ts"),
  "notatio-toggler": () => import("./notatio-toggler.ts"),
  "notatio-knob": () => import("./notatio-knob.ts"),
  "notatio-popup-menu": () => import("./notatio-popup-menu.ts"),
  "notatio-list-picker": () => import("./notatio-list-picker.ts"),
  "notatio-checkbox": () => import("./notatio-checkbox.ts"),
  "notatio-interval-slider": () => import("./notatio-interval-slider.ts"),
  "notatio-color-slider": () => import("./notatio-color-slider.ts"),
  "notatio-locator": () => import("./notatio-locator.ts"),
  "notatio-input-field": () => import("./notatio-input-field.ts"),
  "notatio-row": () => import("./notatio-row.ts"),
  "notatio-column": () => import("./notatio-column.ts"),
  "notatio-grid": () => import("./notatio-grid.ts"),
  "notatio-panel": () => import("./notatio-panel.ts"),
  "notatio-labeled": () => import("./notatio-labeled.ts"),
  "notatio-terminal": () => import("./notatio-terminal.ts"),
  "notatio-collection-table": () => import("./notatio-collection-table.ts"),
  "notatio-test-result-object": () => import("./notatio-test-result-object.ts"),
};

/** The tags loaded by module, for the test that keeps this table in step with the main entry. */
export const LAZY_TAGS: readonly string[] = Object.keys(ELEMENTS);

/** Whether `tag` is a hand-written element's, so never to be defined as a generic one. */
export const isClaimed = (tag: string): boolean => Object.hasOwn(ELEMENTS, tag);

const CELL = new Set(["notatio-in", "notatio-out", "notatio-cell", "notatio-code"]);

let everything: Promise<unknown> | undefined;

/** Every element, the page scope and the generics: the main entry, loaded once. */
export const defineEverything = (): Promise<unknown> => (everything ??= import("./index.ts"));

let scoped = false;
let structures = false;
let generics: Promise<typeof import("./generic.ts")> | undefined;

/** Load what `el` needs, when it's an element not defined yet. */
function define(el: Element): void {
  const tag = el.localName;
  if (!tag.startsWith("notatio-") || customElements.get(tag) !== undefined) return;
  if (!CELL.has(tag) && !scoped) {
    scoped = true;
    void import("./scope.ts").then((m) => m.pageScope());
  }
  // An element given its arguments as children is lowered into its attributes as it arrives.
  if (!CELL.has(tag) && !structures && el.firstElementChild !== null) {
    structures = true;
    void import("./structure.ts").then((m) => m.watchStructures());
  }
  const load = ELEMENTS[tag];
  if (load !== undefined) {
    void load();
    return;
  }
  generics ??= import("./generic.ts");
  void generics.then((m) => m.defineUsed(el.ownerDocument));
}

function defineUsed(root: Element | Document): void {
  if (root instanceof Element) define(root);
  for (const el of root.querySelectorAll(":not(:defined)")) define(el);
}

let watching = false;

/** Define the elements the document uses, and keep defining them as more arrive. */
export function defineOnUse(): void {
  if (watching || typeof document === "undefined") return;
  watching = true;
  defineUsed(document);
  const observer = new MutationObserver((records) => {
    if (everything !== undefined) {
      observer.disconnect();
      return;
    }
    for (const record of records) for (const node of record.addedNodes) if (node instanceof Element) defineUsed(node);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
