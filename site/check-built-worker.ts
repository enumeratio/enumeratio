// Checks the built site's kernel worker without a browser.
//
//   node site/check-built-worker.ts
//
// Loads `site/dist/assets/kernel-worker-*.js`, the worker exactly as the build
// bundled it (its library chunks included), in a Node worker thread dressed as
// a web worker, and talks to it through notatio's own session client
// (`openSession`), as the page does. It asks a few expressions and fails
// unless each comes back with its known value. Run after the site build.

import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { type WorkerLike, openSession } from '@notatio/evaluation/browser';

const assets = resolve(import.meta.dirname, 'dist/assets');
const bundle = readdirSync(assets).find((f) => /^kernel-worker-.*\.js$/.test(f));
if (!bundle) throw new Error('No built kernel worker: build the site first.');

// A web worker's global scope, over a worker thread's port.
const bootstrap = `
  const { parentPort, workerData } = require('node:worker_threads');
  globalThis.self = globalThis;
  globalThis.postMessage = (message) => parentPort.postMessage(message);
  parentPort.on('message', (data) => globalThis.onmessage?.({ data }));
  import(workerData.bundle).then(
    () => parentPort.postMessage({ __loaded: true }),
    (error) => parentPort.postMessage({ __failed: String(error && error.stack || error) }),
  );
`;

let failure: string | undefined;
const threads: Worker[] = [];

function createWorker(): WorkerLike {
  const thread = new Worker(bootstrap, {
    eval: true,
    workerData: { bundle: pathToFileURL(join(assets, bundle as string)).href },
  });
  threads.push(thread);
  const like: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage: (message) => thread.postMessage(message),
    terminate: () => void thread.terminate(),
  };
  thread.on('message', (data: { __loaded?: boolean; __failed?: string }) => {
    if (data?.__failed !== undefined) failure = data.__failed;
    else if (data?.__loaded !== true) like.onmessage?.({ data });
  });
  thread.on('error', (error) => {
    failure = String(error);
    like.onerror?.({ message: String(error) });
  });
  return like;
}

const expected: [string, string][] = [
  ['Area(DyckPath([1, 1, 0, 1, 0, 0, 1, 0]))', '2'],
  ['CycleType(Inverse(Permutation([3, 1, 4, 2])))', '["IntegerPartition",["List",4]]'],
  ['Count(KSubsets(5, 2))', '10'],
  ['FactorInteger(360)', '["List",["Tuple",2,3],["Tuple",3,2],["Tuple",5,1]]'],
];

const session = openSession({ createWorker, spawnTimeoutMs: 60000 });
let bad = 0;
try {
  for (const [text, want] of expected) {
    const started = Date.now();
    const answer = await session.evaluate(undefined, {
      source: { text, format: 'epsil' },
      timeMs: 30000,
    });
    const got = JSON.stringify(answer.value);
    const ok = got === want && answer.error === undefined;
    if (!ok) bad++;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${text} -> ${got}${answer.error ? ` (${answer.error})` : ''} (${Date.now() - started} ms)`,
    );
  }
} finally {
  session.close();
  for (const thread of threads) await thread.terminate();
}
if (failure !== undefined) console.error(failure);
if (bad > 0 || failure !== undefined) process.exit(1);
console.log(`the built worker (${bundle}) answered ${expected.length} of ${expected.length}`);
