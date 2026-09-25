// Browser session host logic, exercised without a real browser: fake Worker/SharedWorker
// constructors stand in, same approach as ./browser.test.ts and ./browser-pool.test.ts.
import { expect, test } from "vite-plus/test";
import {
  openSession,
  type MessagePortLike,
  type SharedWorkerLike,
  type WorkerLike,
} from "../src/browser.ts";

function fakeWorker() {
  const posted: unknown[] = [];
  let terminated = 0;
  const worker: WorkerLike = {
    postMessage: (message) => posted.push(message),
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
    respond: (response: unknown) => worker.onmessage?.({ data: response }),
  };
}

function fakePort() {
  const posted: unknown[] = [];
  const port: MessagePortLike = {
    postMessage: (message) => posted.push(message),
    onmessage: null,
    start: () => {},
  };
  return { port, posted, respond: (response: unknown) => port.onmessage?.({ data: response }) };
}

test("openSession (dedicated-Worker fallback) sends a handshake and persists state", async () => {
  const workers: ReturnType<typeof fakeWorker>[] = [];
  const session = openSession({
    createWorker: () => {
      const fake = fakeWorker();
      workers.push(fake);
      return fake.worker;
    },
  });
  expect(workers[0]!.posted).toEqual([{ setup: undefined }]);

  const assigned = session.evaluate(["Assign", "a", 5]);
  workers[0]!.respond({ id: 0, ok: true, json: 5 });
  await expect(assigned).resolves.toEqual({ value: 5, reset: false });

  const squared = session.evaluate(["Power", "a", 2]);
  workers[0]!.respond({ id: 1, ok: true, json: 25 });
  await expect(squared).resolves.toEqual({ value: 25, reset: false });

  expect(workers).toHaveLength(1); // same worker served both calls
  session.close();
  expect(workers[0]!.terminatedCount()).toBe(1);
});

test("openSession (dedicated-Worker fallback) resets (reset: true) on a timeMs kill", async () => {
  const workers: ReturnType<typeof fakeWorker>[] = [];
  const session = openSession({
    createWorker: () => {
      const fake = fakeWorker();
      workers.push(fake);
      return fake.worker;
    },
  });

  const killed = session.evaluate(["Sum", "k"], { timeMs: 5 });
  await expect(killed).resolves.toEqual({ value: "Aborted", reset: true });
  expect(workers[0]!.terminatedCount()).toBe(1);
  expect(workers).toHaveLength(2); // replaced with a fresh worker
  expect(workers[1]!.posted).toEqual([{ setup: undefined }]); // fresh handshake

  session.close();
});

test("openSession over a SharedWorker sends the handshake and evaluates over its port", async () => {
  const fake = fakePort();
  const session = openSession({
    name: "notebook",
    createSharedWorker: (): SharedWorkerLike => ({ port: fake.port }),
  });
  expect(fake.posted).toEqual([{ setup: undefined }]);

  const done = session.evaluate(["Add", 1, 1]);
  fake.respond({ id: 0, ok: true, json: 2 });
  await expect(done).resolves.toEqual({ value: 2, reset: false });

  // Nothing to terminate from this side -- other tabs may still be using the session.
  session.close();
});

test("openSession's timeMs on a SharedWorker only gives up locally: reset stays false", async () => {
  const fake = fakePort();
  const session = openSession({
    createSharedWorker: (): SharedWorkerLike => ({ port: fake.port }),
  });

  const timedOut = session.evaluate(["Sum", "k"], { timeMs: 5 });
  await expect(timedOut).resolves.toEqual({ value: "Aborted", reset: false });
});

test("openSession passes its name through to createSharedWorker", () => {
  const fake = fakePort();
  let seenName: string | undefined;
  openSession({
    name: "shared-notebook",
    createSharedWorker: (_url, options) => {
      seenName = options.name;
      return { port: fake.port };
    },
  });
  expect(seenName).toBe("shared-notebook");
});
