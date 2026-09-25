// Browser session host logic, exercised without a real browser: fake Worker/SharedWorker
// constructors stand in, same approach as ./browser.test.ts and ./browser-pool.test.ts.
import { expect, test } from "vite-plus/test";
import {
  openSession,
  type MessagePortLike,
  type SharedWorkerLike,
  type WorkerLike,
} from "../src/browser.ts";

/** A message has an `id` exactly when it's an `evaluate` call (the `{ setup }` handshake
 * doesn't) -- used below to auto-fire `"started"` only for those, immediately, simulating
 * an already-warm worker/connection so `timeMs` tests exercise the small post-start kill
 * margin rather than the (much larger, separately tested) spawn-timeout guard. */
const idOf = (message: unknown): number | undefined => (message as { id?: number }).id;

function fakeWorker(options: { autoStart?: boolean } = {}) {
  const autoStart = options.autoStart ?? true;
  const posted: unknown[] = [];
  let terminated = 0;
  const worker: WorkerLike = {
    postMessage: (message) => {
      posted.push(message);
      const id = idOf(message);
      if (autoStart && id !== undefined) worker.onmessage?.({ data: { id, kind: "started" } });
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
    /** Sends the final result. */
    respond: (response: unknown) => worker.onmessage?.({ data: response }),
  };
}

function fakePort(options: { autoStart?: boolean } = {}) {
  const autoStart = options.autoStart ?? true;
  const posted: unknown[] = [];
  let closed = 0;
  const port: MessagePortLike = {
    postMessage: (message) => {
      posted.push(message);
      const id = idOf(message);
      if (autoStart && id !== undefined) port.onmessage?.({ data: { id, kind: "started" } });
    },
    onmessage: null,
    start: () => {},
    close: () => {
      closed++;
    },
  };
  return {
    port,
    posted,
    closedCount: () => closed,
    /** Sends the final result. */
    respond: (response: unknown) => port.onmessage?.({ data: response }),
  };
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

test("openSession (dedicated-Worker fallback) replaces a worker that never reports started", async () => {
  const workers: ReturnType<typeof fakeWorker>[] = [];
  const session = openSession({
    spawnTimeoutMs: 5, // small on purpose -- proving the guard fires, not timing production
    createWorker: () => {
      const fake = fakeWorker({ autoStart: false });
      workers.push(fake);
      return fake.worker;
    },
  });

  const killed = session.evaluate(["Add", 1, 1], { timeMs: 1000 });
  await expect(killed).resolves.toEqual({ value: "Aborted", reset: true });
  expect(workers[0]!.terminatedCount()).toBe(1);
  expect(workers).toHaveLength(2); // the never-started worker was replaced

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

test("a cooperative stop over a SharedWorker keeps reset: false (no poisoning)", async () => {
  const fake = fakePort();
  const session = openSession({
    createSharedWorker: (): SharedWorkerLike => ({ port: fake.port }),
  });

  const stopped = session.evaluate(["Sum", "k"], { timeMs: 5 });
  // The worker answers cooperatively -- ok:true with the "Aborted" value -- well inside
  // the host's own (much later) hard-kill timer, same message path as any other answer.
  fake.respond({ id: 0, ok: true, json: "Aborted" });
  await expect(stopped).resolves.toEqual({ value: "Aborted", reset: false });
  expect(fake.closedCount()).toBe(0);

  // Still the same shared port -- a later call needs no fresh handshake.
  const next = session.evaluate(["Add", 1, 1]);
  fake.respond({ id: 1, ok: true, json: 2 });
  await expect(next).resolves.toEqual({ value: 2, reset: false });
  expect(fake.posted).toHaveLength(3); // handshake + 2 evaluate calls, all on one port
});

test("an uncooperative SharedWorker call poisons this tab's session: switches to a dedicated worker, reset: true", async () => {
  const shared = fakePort();
  const dedicatedWorkers: ReturnType<typeof fakeWorker>[] = [];
  const session = openSession({
    name: "notebook",
    createSharedWorker: (): SharedWorkerLike => ({ port: shared.port }),
    createWorker: () => {
      const fake = fakeWorker();
      dedicatedWorkers.push(fake);
      return fake.worker;
    },
  });
  expect(shared.posted).toEqual([{ setup: undefined }]);

  // The shared worker never answers -- an uncooperative call the host can't safely kill.
  const poisoned = session.evaluate(["Sum", "k"], { timeMs: 5 });
  await expect(poisoned).resolves.toEqual({ value: "Aborted", reset: true });
  expect(shared.closedCount()).toBe(1); // this tab's handle to it is dropped...
  expect(dedicatedWorkers).toHaveLength(1); // ...and replaced with a private worker
  expect(dedicatedWorkers[0]!.posted).toEqual([{ setup: undefined }]); // fresh handshake

  // Later calls go to the dedicated worker, not the (still poisoned) shared port.
  const next = session.evaluate(["Add", 1, 1]);
  dedicatedWorkers[0]!.respond({ id: 1, ok: true, json: 2 });
  await expect(next).resolves.toEqual({ value: 2, reset: false });
  // The shared port only ever heard the handshake and the one call that got poisoned --
  // the "next" call above went to the dedicated worker instead.
  expect(shared.posted).toHaveLength(2);

  session.close();
  expect(dedicatedWorkers[0]!.terminatedCount()).toBe(1);
});

test("a SharedWorker that never reports started also poisons this tab's session (spawn-timeout guard)", async () => {
  const shared = fakePort({ autoStart: false });
  const dedicatedWorkers: ReturnType<typeof fakeWorker>[] = [];
  const session = openSession({
    name: "notebook",
    spawnTimeoutMs: 5, // small on purpose -- proving the guard fires, not timing production
    createSharedWorker: (): SharedWorkerLike => ({ port: shared.port }),
    createWorker: () => {
      const fake = fakeWorker();
      dedicatedWorkers.push(fake);
      return fake.worker;
    },
  });

  const poisoned = session.evaluate(["Add", 1, 1], { timeMs: 1000 });
  await expect(poisoned).resolves.toEqual({ value: "Aborted", reset: true });
  expect(shared.closedCount()).toBe(1);
  expect(dedicatedWorkers).toHaveLength(1); // switched to a private dedicated worker

  session.close();
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
