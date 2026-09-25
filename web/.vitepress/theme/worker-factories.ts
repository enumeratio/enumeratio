// The worker Vite must actually BUNDLE for a static build, not resolve at runtime the
// way @enumeratio/aestimatio's own browser.ts does internally: it computes
// `new URL('./browser-session-worker.ts', import.meta.url)` in one function
// (`sessionWorkerUrl`) and hands the resulting URL to `new Worker(url, options)` in a
// different one (`globalWorkerFactory`'s returned closure). Vite's worker plugin only
// recognises the literal `new Worker(new URL('./relative/path', import.meta.url), …)` /
// `new SharedWorker(…)` SHAPE at the call site itself, with BOTH the URL and the options
// object as static literals -- a URL (or an options property) computed elsewhere and
// passed in as a plain variable is invisible to it, so the session worker was never
// emitted as a bundled asset. In dev this went unnoticed: Vite serves the raw `.ts` file
// straight off disk on request, no bundling needed. A production build has no dev server
// to answer that request, so the constructed URL 404s -- "Failed to fetch a worker
// script" -- and the whole point of `Evaluator -> "Worker"` (never blocking the page)
// silently reverted to nothing running at all.
//
// The literal points at `./session-worker-entry.ts`, THIS SITE's own worker entry --
// not `@enumeratio/aestimatio/browser-session-worker.ts` directly -- because that
// aestimatio file ALSO takes its `configure` (this site's ~20-library declare list) as
// a URL, resolved via a runtime `import()` inside the worker. That has the identical
// problem one level down: invisible to the bundler, and a production build's own asset
// handling can turn a `.ts` URL into something typed as `video/mp2t`, which a worker's
// `import()` refuses outright ("Failed to fetch dynamically imported module"). This
// site's own worker entry imports both the worker loop AND `configure` statically, so
// Vite bundles the two together into one self-contained chunk -- see that file's own
// comment.
//
// `notatio-dynamic-module.ts` can't write any of this itself: it doesn't know (and
// shouldn't hardcode) this site's own directory layout, and the literal-path
// requirement means the `new URL(...)` has to live in a file whose OWN `import.meta.url`
// sits next to the target. So this site-owned module writes it once, for both worker
// kinds aestimatio already accepts a factory for (`createWorker`/`createSharedWorker`
// on `openSession`), and `./index.mts` hands them down through the `__notatioWorkerFactories`
// gate -- the same seam `__notatioWorkerSetup` used for the (now unused, for this site's
// own worker) `setup` module URL.
//
// Each factory ignores the `url`/`options.name` aestimatio would otherwise compute and
// pass in: the whole point is that THIS file's own `import.meta.url`, not aestimatio's,
// is what has to sit next to the literal relative path for Vite to find it. The literal
// is repeated (not hoisted to a shared constant) because Vite's detection is per call
// site, not per string value.

import type { SharedWorkerFactory, WorkerFactory, WorkerLike } from "@enumeratio/aestimatio/browser";

export const createSessionWorker: WorkerFactory = () =>
  new Worker(new URL("./session-worker-entry.ts", import.meta.url), {
    type: "module",
  }) as unknown as WorkerLike;

// Vite's worker plugin requires the WHOLE options object at the call site to be a
// static literal, not just the URL -- `{ name: options.name, type: "module" }` fails
// the same way a computed URL does ("Vite is unable to parse the worker options as the
// value is not static"). This drops `name` (multi-tab session sharing) rather than
// working around it: `notatio-dynamic-module.ts` never passes one today (each module
// gets its own private session, per its own comment), so there is nothing to preserve.
export const createSessionSharedWorker: SharedWorkerFactory = () =>
  new SharedWorker(new URL("./session-worker-entry.ts", import.meta.url), {
    type: "module",
  }) as unknown as ReturnType<SharedWorkerFactory>;
