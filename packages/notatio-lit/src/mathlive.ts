// Lazy MathLive/compute-engine loaders. Each dynamic import becomes its own
// hashed chunk: fetched once, browser-cached, and deduped by the module registry
// so multiple elements on a page share a single instance. Read-only pages pull
// only the lighter `mathlive/ssr` markup chunk and never the editor.
//
// This module owns the whole MathLive integration (fonts, CSS) so hosts depend on
// @enumeratio/notatio-lit alone, not on mathlive.

// The engine itself lives in the base (`@enumeratio/notatio`); re-exported here so
// the elements' imports read as before.
export { configureEngine, loadEngine } from "@enumeratio/notatio";

let assetsPromise: Promise<void> | undefined;
let markupPromise: Promise<(latex: string) => string> | undefined;

/**
 * Load MathLive's stylesheet + fonts and disable its own font loader (its default
 * path 404s under bundling and hides the editor; the imported CSS provides the
 * faces instead). Idempotent.
 */
export function ensureMathliveAssets(): Promise<void> {
  assetsPromise ??= (async () => {
    await Promise.all([import("mathlive/fonts.css"), import("mathlive/static.css")]);
    const m = await import("mathlive");
    (
      m as unknown as { MathfieldElement: { fontsDirectory: string | null } }
    ).MathfieldElement.fontsDirectory = null;
  })();
  return assetsPromise;
}

/** Load + register MathLive's `<math-field>` editor (heavy) with fonts ready. */
export function loadEditor(): Promise<void> {
  return ensureMathliveAssets();
}

/** Load MathLive's DOM-free static markup renderer (light), CSS ready. */
export function loadMarkup(): Promise<(latex: string) => string> {
  markupPromise ??= ensureMathliveAssets()
    .then(() => import("mathlive/ssr"))
    .then((m) => m.convertLatexToMarkup);
  return markupPromise;
}
