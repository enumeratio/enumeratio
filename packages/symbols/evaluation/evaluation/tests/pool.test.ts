// Node pool logic, exercised with fake `worker_threads`-shaped workers: no real thread is
// spawned, so this stays fast and cheap (see the isolated-evaluator tests for the real
// thing). Mirrors ./browser-pool.test.ts's fake-Worker approach.
import { Worker } from "node:worker_threads";
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
 * lifecycle without spawning a real thread. Auto-fires a `"started"` reply for every
 * posted message (unless `autoStart` is false) -- simulating an already-warm worker, so
 * `timeMs` tests exercise the small post-start kill margin rather than the (much larger,
 * separately tested) spawn-timeout guard. */
function fakeNodeWorker(options: { autoStart?: boolean } = {}) {
  const autoStart = options.autoStart ?? true;
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const posted: PostedMessage[] = [];
  let terminated = 0;
  const on = (event: string, listener: (...args: unknown[]) => void): void => {
    let set = listeners.get(event);
    if (set === undefined) listeners.set(event, (set = new Set()));
    set.add(listener);
  };
  const worker: NodeWorkerLike = {
    postMessage: (message) => {
      const req = message as PostedMessage;
      posted.push(req);
      if (autoStart) {
        for (const l of listeners.get("message") ?? []) l({ id: req.id, kind: "started" });
      }
    },
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
    /** Responds (with the final result) to the most recently posted message. */
    respond: (payload: { ok: boolean; json?: unknown; error?: string }) => {
      const last = posted.at(-1);
      if (last === undefined) throw new Error("fakeNodeWorker: nothing was posted yet");
      for (const l of listeners.get("message") ?? []) l({ id: last.id, kind: "result", ...payload });
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

test("createEvaluatorPool replaces a worker that never reports started (spawn-timeout guard)", async () => {
  const created: ReturnType<typeof fakeNodeWorker>[] = [];
  const pool = createEvaluatorPool({
    size: 1,
    spawnTimeoutMs: 5, // small on purpose -- proving the guard fires, not timing production
    createWorker: () => {
      const fake = fakeNodeWorker({ autoStart: false });
      created.push(fake);
      return fake.worker;
    },
  });

  // A call needs `timeMs` for the spawn guard to matter at all -- see node.ts's own
  // comment on why it's only armed then.
  const stuck = pool.evaluate(["Add", 1, 1], { timeMs: 1000 });
  await expect(stuck).resolves.toBe("Aborted");
  expect(created[0]!.terminatedCount()).toBe(1);

  const next = pool.evaluate(["Add", 1, 1], { timeMs: 1000 });
  await tick();
  expect(created).toHaveLength(2); // the never-started worker was replaced
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

test("a cooperative timeMs stop keeps the pool worker reused (real worker.ts)", async () => {
  // Unlike the fakes above, this wraps the REAL `worker_threads.Worker` so `worker.ts`
  // actually runs compute-engine -- proving the cooperative deadline (evaluateCooperatively
  // -> ce.withTimeLimit/checkpoint) lets the worker answer normally instead of needing the
  // hard kill. Still fast: the loop is long enough to outrun 50ms, not long enough to matter.
  const created: NodeWorkerLike[] = [];
  const pool = createEvaluatorPool({
    size: 1,
    createWorker: (url, options) => {
      const worker = new Worker(url, options) as unknown as NodeWorkerLike;
      created.push(worker);
      return worker;
    },
  });
  try {
    const slow = ["Sum", ["Mod", "k", 97], ["Tuple", "k", 1, 2_000_000_000]];
    const stopped = await pool.evaluate(slow, { timeMs: 150 });
    expect(stopped).toBe("Aborted");
    expect(created).toHaveLength(1); // answered cooperatively -- no replacement needed

    const next = await pool.evaluate(["Add", 1, 1]);
    expect(next).toBe(2);
    expect(created).toHaveLength(1); // same worker, reused
  } finally {
    pool.close();
  }
});

test("an assignment in one pool call is not visible in the next call on the same (reused) worker", async () => {
  // Real worker.ts: proves the per-call `pushScope()`/`popScope()` actually isolates
  // bindings, not just that the pool reuses the worker process. If this leaked, the second
  // call would see `a` bound to 5 from the first.
  const created: NodeWorkerLike[] = [];
  const pool = createEvaluatorPool({
    size: 1,
    createWorker: (url, options) => {
      const worker = new Worker(url, options) as unknown as NodeWorkerLike;
      created.push(worker);
      return worker;
    },
  });
  try {
    const assigned = await pool.evaluate(["Assign", "a", 5]);
    expect(assigned).toBe(5);

    // Same worker (still just one created) -- `a` must be unbound again.
    const read = await pool.evaluate("a");
    expect(created).toHaveLength(1);
    expect(read).toBe("a"); // an undeclared symbol evaluates to itself, not 5
  } finally {
    pool.close();
  }
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
