// This SITE's own worker entry -- the whole reason `./worker-factories.ts` points
// `createWorker`/`createSharedWorker` here instead of at
// `@enumeratio/evaluation/browser-session-worker.ts` directly.
//
// That file's own worker loop takes a `configure` URL over the wire (a connection's `{
// setup }` handshake) and `import()`s it at RUNTIME -- fine for a plain dev server,
// which serves whatever path is asked for, but invisible to a bundler's worker plugin
// (it only ever emits what a worker entry statically imports) and, worse, capable of
// resolving to something that isn't even valid JavaScript once a production build's own
// asset handling gets involved (a `.ts` URL read as an asset can come back typed as
// `video/mp2t`, which a worker's `import()` then refuses outright).
//
// This file sidesteps the whole problem: it imports BOTH the worker's message loop
// (`startSessionWorker`) and this site's catalogue (`./worker-catalogue.ts`) statically, so
// Vite bundles them into the worker, each library a chunk of its own -- no runtime
// `import()` of a URL the build never emitted.
import { startSessionWorker } from "../../../packages/symbols/evaluation/evaluation/src/session-worker-core.ts";
import { ComputeEngine, LATEX_DICTIONARY, LatexSyntax } from "@cortex-js/compute-engine";
import { BOXES_LATEX } from "@enumeratio/boxes/render";
import { displayDictionary } from "@enumeratio/frontend/display";
import { NOTEBOOK_KERNEL } from "@enumeratio/frontend/kernel-host";
import { RESIDUES_LATEX } from "@enumeratio/residues";
import { CATALOGUE } from "./worker-catalogue.ts";

// A kernel: no libraries up front, each one declared when a call first needs it. It reads a
// cell's text, keeps each notebook's session, and writes each answer's display itself, with
// the page's notation: a dictionary is fixed at construction, so the notation is the host's,
// up front.
startSessionWorker(undefined, {
  catalogue: CATALOGUE,
  createEngine: () =>
    new ComputeEngine({
      latexSyntax: new LatexSyntax({
        dictionary: displayDictionary(LATEX_DICTIONARY, [...RESIDUES_LATEX, ...BOXES_LATEX]),
      }),
    }),
  ...NOTEBOOK_KERNEL,
});
