// The build as a kernel (https://github.com/enumeratio/enumeratio/wiki/Speculative-Kernels-and-Front-Ends §9):
// one engine in Node, set up as the site's worker kernel is (its dictionary, every package's
// notation, the libraries an expression names), that writes each reference example's answer
// into its page. The answers are the recorded ones: the tests re-evaluate them, the build
// doesn't.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ComputeEngine, LATEX_DICTIONARY, LatexSyntax } from "@cortex-js/compute-engine";
import { combineNotation, type PackageNotation, registerNotation } from "@enumeratio/boxes";
import { portableTeX } from "@enumeratio/formats/tex";
import { displayDictionary } from "@enumeratio/frontend/display";
import { type Prerendered, prerender } from "@enumeratio/frontend/prerender";
import { createResolver, NOTATIONS } from "@enumeratio/manifest";
import type { ReferenceEntry } from "@enumeratio/reference";
import katex from "katex";
import { CATALOGUE } from "../theme/worker-catalogue.ts";

export type { Prerendered };

// The typeset HTML is the bulk of an answer (tenfold its data), so it isn't page data: each
// page's goes in a file here, which `fillPrerendered` writes into the page's HTML, and the
// page reads it back from the DOM before it hydrates.
const HTML_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../cache/prerender");
const htmlFile = (page: string): string => resolve(HTML_DIR, `${encodeURIComponent(page)}.json`);

/** `page`'s HTML, written into its placeholders (`<span data-prerender="3:in"></span>`). */
export function fillPrerendered(html: string, page: string): string {
  let parts: Record<string, string>;
  try {
    parts = JSON.parse(readFileSync(htmlFile(page), "utf8")) as Record<string, string>;
  } catch {
    return html;
  }
  return html.replace(
    /(<span data-prerender="([^"]+)"[^>]*>)(<\/span>)/g,
    (whole, open: string, key: string, close: string) =>
      parts[key] === undefined ? whole : `${open}${parts[key]}${close}`,
  );
}

/** TeX as the page's `<notatio-out>` typesets it (`@enumeratio/components`' `loadMarkup`). */
const typeset = (latex: string): string =>
  katex.renderToString(portableTeX(latex), { throwOnError: false, output: "htmlAndMathml" });

let kernel: Promise<{ ce: ComputeEngine; ensure: (json: unknown) => Promise<unknown> }> | undefined;

function buildKernel(): NonNullable<typeof kernel> {
  kernel ??= (async () => {
    const entries = await Promise.all(
      Object.values(NOTATIONS).map(
        async (specifier) => ((await import(specifier)) as { notation: PackageNotation }).notation,
      ),
    );
    const notation = combineNotation(entries);
    const ce = new ComputeEngine({
      latexSyntax: new LatexSyntax({ dictionary: displayDictionary(LATEX_DICTIONARY, notation.latex) }),
    });
    registerNotation(ce, notation.traditional);
    const resolver = createResolver(CATALOGUE);
    return { ce, ensure: (json) => resolver.ensure(ce, json) };
  })();
  return kernel;
}

/**
 * Each of `entry`'s examples answered ahead of time, by index, `undefined` where the browser
 * must answer it: a volatile or aspirational one, or one whose display can't be built here.
 */
export async function prerenderExamples(entry: ReferenceEntry): Promise<(Prerendered | undefined)[]> {
  const examples = entry.examples ?? [];
  if (examples.length === 0) return [];
  const answers = await answer(entry);
  const parts: Record<string, string> = {};
  answers.forEach((a, i) => {
    if (a?.html === undefined) return;
    parts[`${i}:in`] = a.html.input;
    parts[`${i}:out`] = a.html.output;
  });
  mkdirSync(HTML_DIR, { recursive: true });
  writeFileSync(htmlFile(entry.name), JSON.stringify(parts));
  return answers.map((a) => (a === undefined ? undefined : { ...a, html: undefined }));
}

async function answer(entry: ReferenceEntry): Promise<(Prerendered | undefined)[]> {
  const examples = entry.examples ?? [];
  const { ce, ensure } = await buildKernel();
  const evaluates = entry.outEvaluate !== false;
  const out: (Prerendered | undefined)[] = [];
  for (const ex of examples) {
    // A volatile value changes per run; an aspirational one is what it should become, not
    // what it is.
    if ((ex.volatile !== undefined && ex.volatile.length > 0) || ex.role === "aspirational") {
      out.push(undefined);
      continue;
    }
    const value = evaluates ? ex.expected : ex.expr;
    try {
      await ensure(["List", ex.expr, value]);
      out.push(prerender(ce, { text: JSON.stringify(ex.expr), format: "mathjson" }, ex.expr, value, typeset));
    } catch {
      out.push(undefined);
    }
  }
  return out;
}
