// Runs INSIDE the worker `openSession` (./browser.ts) spawns when the caller has NOT
// supplied its own `createWorker`/`createSharedWorker` (a plain dev server, a test, or
// any caller with no bundler-literal constraints of its own) -- either a dedicated
// `Worker` (this script IS the worker) or a `SharedWorker` (this script runs once, and
// each connecting tab arrives via `onconnect` with its own port). The actual message
// loop is `./session-worker-core.ts`'s `startSessionWorker`; this file is just that
// function run standalone, with no `configure` of its own (a connection's own `{ setup
// }` handshake URL is resolved instead -- see that module's own comment on why a
// bundled site instead builds its OWN worker entry around `startSessionWorker(configure)`
// directly). No `node:*` imports -- its own build entry, never imported by `./index.ts`.

import { startSessionWorker } from "./session-worker-core.ts";

startSessionWorker();
