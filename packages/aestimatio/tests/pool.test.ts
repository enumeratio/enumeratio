// Node pool logic, exercised with fake `worker_threads`-shaped workers: no real thread is
// spawned, so this stays fast and cheap (see the isolated-evaluator tests for the real
// thing). Mirrors ./browser-pool.test.ts's fake-Worker approach.
import { expect, test } from "vite-plus/test";
import { createEvaluatorPool, type NodeWorkerLike } from "../src/node.ts";

/** `pool.evaluate()` resolves its worker (even a synchronously-created one) via a
 * `.then()`, so `postMessage` lands one microtask after the call returns -- await this
 * before driving a fake worker's response. */
const tick = (): Promise<void> => Promise.resolve();

interface PostedMessage {
  readonly id: number;
  readonly json: unknown;
  readonly setup?: string;
}

/** A fake `worker_threads.Worker`: records what was posted, and lets a test drive its
 * lifecycle without spawning a real thread. */
function fakeNodeWorker() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const posted: PostedMessage[] = [];
  let terminated = 0;
  const on = (event: string, listener: (...args: unknown[]) => void): void => {
    let set = listeners.get(event);
    if (set === undefined) listeners.set(event, (set = new Set()));
    set.add(listener);
  };
  const worker: NodeWorkerLike = {
    postMessage: (message) => posted.push(message as PostedMessage),
    terminate: () => {
      terminated++;
    },
    unref: () => {},
    ref: () => {},
    on,
    once: on,
    off: (event, listener) => listeners.get(event)?.delete(listener),
  };
  return {
    worker,
    posted,
    terminatedCount: () => terminated,
    /** Responds to the most recently posted message (correlates by its `id`). */
    respond: (payload: { ok: boolean; json?: unknown; error?: string }) => {
      const last = posted.at(-1);
      if (last === undefined) throw new Error("fakeNodeWorker: nothing was posted yet");
      for (const l of listeners.get("message") ?? []) l({ id: last.id, ...payload });
    },
    fail: () => {
      for (const l of listeners.get("error") ?? []) l();
    },
  };
}

test("createEvaluatorPool reuses a worker across sequential calls", async () => {
  const created: ReturnType<typeof fakeNodeWorker>[] = [];
  const pool = createEvaluatorPool({
    size: 1,
    createWorker: () => {
      const fake = fakeNodeWorker();
      created.push(fake);
      return fake.worker;
    },
  });

  const first = pool.evaluate(["Add", 1, 1]);
  await tick();
  created[0]!.respond({ ok: true, json: 2 });
  await expect(first).resolves.toBe(2);

  const second = pool.evaluate(["Add", 2, 2]);
  await tick();
  created[0]!.respond({ ok: true, json: 4 });
  await expect(second).resolves.toBe(4);

  expect(created).toHaveLength(1);
  expect(created[0]!.terminatedCount()).toBe(0);
  pool.close();
});

test("createEvaluatorPool replaces a worker killed by timeMs", async () => {
  const created: ReturnType<typeof fakeNodeWorker>[] = [];
  const pool = createEvaluatorPool({
    size: 1,
    createWorker: () => {
      const fake = fakeNodeWorker();
      created.push(fake);
      return fake.worker;
    },
  });

  const timedOut = pool.evaluate(["Sum", "k"], { timeMs: 5 });
  await expect(timedOut).resolves.toBe("Aborted");
  expect(created[0]!.terminatedCount()).toBe(1);

  const next = pool.evaluate(["Add", 1, 1]);
  await tick();
  expect(created).toHaveLength(2); // the killed worker was replaced, not reused
  created[1]!.respond({ ok: true, json: 2 });
  await expect(next).resolves.toBe(2);
  pool.close();
});

test("createEvaluatorPool replaces a worker that errors", async () => {
  const created: ReturnType<typeof fakeNodeWorker>[] = [];
  const pool = createEvaluatorPool({
    size: 1,
    createWorker: () => {
      const fake = fakeNodeWorker();
      created.push(fake);
      return fake.worker;
    },
  });

  const errored = pool.evaluate(["Add", 1, 1]);
  await tick();
  created[0]!.fail();
  await expect(errored).resolves.toBe("Aborted");
  expect(created[0]!.terminatedCount()).toBe(1);

  const next = pool.evaluate(["Add", 1, 1]);
  await tick();
  created[1]!.respond({ ok: true, json: 2 });
  await expect(next).resolves.toBe(2);
  expect(created).toHaveLength(2);
  pool.close();
});

test("createEvaluatorPool queues a call past its size cap and reuses the released worker", async () => {
  const created: ReturnType<typeof fakeNodeWorker>[] = [];
  const pool = createEvaluatorPool({
    size: 1,
    createWorker: () => {
      const fake = fakeNodeWorker();
      created.push(fake);
      return fake.worker;
    },
  });

  const first = pool.evaluate(["Add", 1, 1]);
  const second = pool.evaluate(["Add", 2, 2]);
  // The cap is 1: the second call must wait rather than spawn a worker of its own.
  expect(created).toHaveLength(1);
  await tick();
  expect(created[0]!.posted).toHaveLength(1);

  created[0]!.respond({ ok: true, json: 2 });
  await expect(first).resolves.toBe(2);

  // Releasing the worker lets the queued call proceed on the SAME (reused) worker.
  await tick();
  expect(created).toHaveLength(1);
  created[0]!.respond({ ok: true, json: 4 });
  await expect(second).resolves.toBe(4);
  pool.close();
});

test("createEvaluatorPool keys workers by memory limit separately from the default", async () => {
  const created: { key?: number }[] = [];
  const pool = createEvaluatorPool({
    size: 4,
    createWorker: (_url, options) => {
      created.push({ key: options.resourceLimits?.maxOldGenerationSizeMb });
      return fakeNodeWorker().worker;
    },
  });

  void pool.evaluate(["Add", 1, 1]);
  void pool.evaluate(["Add", 1, 1], { memoryBytes: 8 * 1024 * 1024 });
  expect(created).toEqual([{ key: undefined }, { key: 8 }]);
  pool.close();
});
