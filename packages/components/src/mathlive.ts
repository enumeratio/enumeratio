// Lazy MathLive/KaTeX/compute-engine loaders. Each dynamic import becomes its own
// hashed chunk: fetched once, browser-cached, and deduped by the module registry
// so multiple elements on a page share a single instance. Typeset math is KaTeX
// (selectable, and the same renderer the pages use at build); MathLive loads only
// for an editor.
//
// This module owns the whole MathLive integration (fonts, CSS) so hosts depend on
// @enumeratio/components alone, not on mathlive.

import { katexStrict, trustExpression } from "@enumeratio/boxes/render";
import { portableTeX, registerTeXMacros, texMacros } from "@enumeratio/formats/tex";

// The engine itself lives in the base (`@enumeratio/frontend`); re-exported here so
// the elements' imports read as before.
export {
  configureEngine,
  configureLatex,
  ensureFor,
  loadBareEngine,
  loadEngine,
  parseFor,
} from "@enumeratio/frontend/core";

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
    (m as unknown as { MathfieldElement: { fontsDirectory: string | null } }).MathfieldElement.fontsDirectory = null;
  })();
  return assetsPromise;
}

let macrosPromise: Promise<void> = Promise.resolve();

/**
 * The packages' LaTeX macros (`combineNotation(…).macros`), for the commands their notation
 * writes: the typesetter expands them and the editor shows them. Set before the first
 * element typesets; a page with no engine still needs them.
 */
export function configureMacros(
  macros: Readonly<Record<string, string>> | Promise<Readonly<Record<string, string>>>,
): void {
  macrosPromise = Promise.resolve(macros).then(registerTeXMacros);
}

/** Load + register MathLive's `<math-field>` editor (heavy) with fonts ready, and the
 *  macros it shows. */
export async function loadEditor(): Promise<Readonly<Record<string, string>>> {
  await Promise.all([ensureMathliveAssets(), macrosPromise]);
  return texMacros();
}

/**
 * Load the typesetter: LaTeX to HTML, by KaTeX, with its stylesheet. compute-engine's
 * LaTeX is written for MathLive, so it goes through `portableTeX` first.
 */
export function loadMarkup(): Promise<(latex: string) => string> {
  markupPromise ??= Promise.all([import("katex"), import("katex/dist/katex.min.css"), macrosPromise]).then(([m]) => {
    const katex = m.default;
    return (latex: string): string =>
      katex.renderToString(portableTeX(latex), {
        throwOnError: false,
        output: "htmlAndMathml",
        strict: katexStrict(),
        trust: trustExpression,
      });
  });
  return markupPromise;
}
