// This SITE's own worker entry -- the whole reason `./worker-factories.ts` points
// `createWorker`/`createSharedWorker` here instead of at
// `@enumeratio/aestimatio/browser-session-worker.ts` directly.
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
// (`startSessionWorker`) and this site's own `configure` (`./worker-engine-setup.ts`,
// the ~20-library declare list) statically, so Vite bundles the two together into one
// self-contained worker chunk -- no runtime `import()` of a separate URL at all.
import { startSessionWorker } from "../../../packages/symbols/evaluation/aestimatio/src/session-worker-core.ts";
import { configure } from "./worker-engine-setup.ts";

startSessionWorker(configure);
