// Host-side logic of `evaluateInWorker`, exercised without a real browser: a fake
// `Worker` stands in (`createWorker`), so this never spawns anything and runs anywhere
// `vp test` does. See design/aestimatio.md §3 and ./browser.ts's own comments.
import { expect, test } from "vite-plus/test";
import { evaluateInWorker, type WorkerLike } from "../src/browser.ts";

/** A fake `Worker`: records what was posted, and lets a test drive its lifecycle.
 * Auto-fires a `"started"` reply for every posted message (unless `autoStart` is false)
 * -- simulating an already-warm worker, so `timeMs` tests exercise the small post-start
 * kill margin rather than the (much larger, separately tested) spawn-timeout guard. */
function fakeWorker(options: { autoStart?: boolean } = {}) {
  const autoStart = options.autoStart ?? true;
  const posted: unknown[] = [];
  let terminated = 0;
  const worker: WorkerLike = {
    postMessage: (message) => {
      posted.push(message);
      if (autoStart) worker.onmessage?.({ data: { kind: "started" } });
    },
    terminate: () => {
      terminated++;
    },
    onmessage: null,
    onerror: null,
  };
  return {
    worker,
    posted,
    terminatedCount: () => terminated,
    respond: (response: { ok: boolean; json?: unknown; error?: string }) =>
      worker.onmessage?.({ data: response }),
    fail: () => worker.onerror?.({ message: "boom" }),
  };
}

test("evaluateInWorker resolves the worker's answer and terminates it", async () => {
  const fake = fakeWorker();
  const done = evaluateInWorker(["Add", 2, 3], { createWorker: () => fake.worker });
  expect(fake.posted).toEqual([{ json: ["Add", 2, 3], setup: undefined }]);
  fake.respond({ ok: true, json: 5 });
  await expect(done).resolves.toBe(5);
  expect(fake.terminatedCount()).toBe(1);
});

test("evaluateInWorker resolves Aborted on a worker error", async () => {
  const fake = fakeWorker();
  const done = evaluateInWorker(["Add", 2, 3], { createWorker: () => fake.worker });
  fake.fail();
  await expect(done).resolves.toBe("Aborted");
});

test("evaluateInWorker kills a computation that outruns timeMs", async () => {
  const fake = fakeWorker();
  const done = evaluateInWorker(["Sum", "k"], {
    createWorker: () => fake.worker,
    timeMs: 10,
  });
  await expect(done).resolves.toBe("Aborted");
  expect(fake.terminatedCount()).toBe(1);
  // A late answer from the (already terminated) worker changes nothing.
  fake.respond({ ok: true, json: 42 });
  await expect(done).resolves.toBe("Aborted");
});

test("evaluateInWorker aborts when the caller's signal fires", async () => {
  const fake = fakeWorker();
  const controller = new AbortController();
  const done = evaluateInWorker(["Add", 1, 1], {
    createWorker: () => fake.worker,
    signal: controller.signal,
  });
  controller.abort();
  await expect(done).resolves.toBe("Aborted");
  expect(fake.terminatedCount()).toBe(1);
});

test("evaluateInWorker resolves immediately for an already-aborted signal", async () => {
  const fake = fakeWorker();
  const controller = new AbortController();
  controller.abort();
  const done = evaluateInWorker(["Add", 1, 1], {
    createWorker: () => fake.worker,
    signal: controller.signal,
  });
  await expect(done).resolves.toBe("Aborted");
});

test("evaluateInWorker terminates once memory polling exceeds memoryBytes", async () => {
  const fake = fakeWorker();
  const done = evaluateInWorker(["Range", 1, 1_000_000], {
    createWorker: () => fake.worker,
    memoryBytes: 1024,
    memoryPollMs: 5,
    measureMemory: () => Promise.resolve(2048),
  });
  await expect(done).resolves.toBe("Aborted");
  expect(fake.terminatedCount()).toBe(1);
});

test("evaluateInWorker does not trip its memory bound while usage stays under it", async () => {
  const fake = fakeWorker();
  const done = evaluateInWorker(["Add", 1, 1], {
    createWorker: () => fake.worker,
    memoryBytes: 1024,
    memoryPollMs: 5,
    measureMemory: () => Promise.resolve(512),
  });
  // Give a couple of poll ticks a chance to run before the worker answers.
  await new Promise((resolve) => setTimeout(resolve, 20));
  fake.respond({ ok: true, json: 2 });
  await expect(done).resolves.toBe(2);
});

test("evaluateInWorker passes setup through to the worker request", async () => {
  const fake = fakeWorker();
  const done = evaluateInWorker(["Add", 1, 1], {
    createWorker: () => fake.worker,
    setup: "https://example.test/configure.mjs",
  });
  expect(fake.posted).toEqual([
    { json: ["Add", 1, 1], setup: "https://example.test/configure.mjs" },
  ]);
  fake.respond({ ok: true, json: 2 });
  await expect(done).resolves.toBe(2);
});
