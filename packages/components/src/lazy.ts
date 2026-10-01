// The elements, defined as a page uses them. A cell (`<notatio-cell>`, `<notatio-in>`,
// `<notatio-out>`, `<notatio-code>`) loads alone: it asks the page's kernel, so it needs no
// engine here. Any other `notatio-*` tag loads every element, the page scope and the generic
// elements, as the main entry does. `tests/lazy.test.ts` holds a cell's modules to that.

const CELL: Readonly<Record<string, () => Promise<unknown>>> = {
  "notatio-cell": () => import("./notatio-cell.ts"),
  "notatio-in": () => import("./notatio-in.ts"),
  "notatio-out": () => import("./notatio-out.ts"),
  "notatio-code": () => import("./notatio-code.ts"),
};

let everything: Promise<unknown> | undefined;

/** Every element, the page scope and the generics: the main entry, loaded once. */
export const defineEverything = (): Promise<unknown> => (everything ??= import("./index.ts"));

/** Load what `el` needs, when it's an element not defined yet. */
function define(el: Element): void {
  const tag = el.localName;
  if (everything !== undefined || !tag.startsWith("notatio-") || customElements.get(tag) !== undefined) return;
  const load = CELL[tag];
  void (load === undefined ? defineEverything() : load());
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
