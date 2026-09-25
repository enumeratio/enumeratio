// Browser pool logic, exercised without a real browser: a fake `Worker` stands in, same
// approach as ./browser.test.ts's own fakeWorker() (which covers evaluateInWorker's
// non-pooled path -- passing createWorker there bypasses the pool entirely, see
// browser.ts's own comment on why).
import { expect, test } from "vite-plus/test";
import { createEvaluatorPool, type WorkerLike } from "../src/browser.ts";

/** `pool.evaluate()` resolves its worker via a `.then()`, so `postMessage` lands one
 * microtask after the call returns -- await this before driving a fake worker. */
const tick = (): Promise<void> => Promise.resolve();

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
    respond: (response: { ok: boolean; json?: unknown; error?: string }) =>
      worker.onmessage?.({ data: response }),
    fail: () => worker.onerror?.({ message: "boom" }),
  };
}

test("createEvaluatorPool reuses a worker across sequential calls", async () => {
  const created: ReturnType<typeof fakeWorker>[] = [];
  const pool = createEvaluatorPool({
    size: 1,
    createWorker: () => {
      const fake = fakeWorker();
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
  const created: ReturnType<typeof fakeWorker>[] = [];
  const pool = createEvaluatorPool({
    size: 1,
    createWorker: () => {
      const fake = fakeWorker();
      created.push(fake);
      return fake.worker;
    },
  });

  const timedOut = pool.evaluate(["Sum", "k"], { timeMs: 5 });
  await expect(timedOut).resolves.toBe("Aborted");
  expect(created[0]!.terminatedCount()).toBe(1);

  const next = pool.evaluate(["Add", 1, 1]);
  await tick();
  expect(created).toHaveLength(2);
  created[1]!.respond({ ok: true, json: 2 });
  await expect(next).resolves.toBe(2);
  pool.close();
});

test("createEvaluatorPool replaces a worker whose memory bound trips", async () => {
  const created: ReturnType<typeof fakeWorker>[] = [];
  const pool = createEvaluatorPool({
    size: 1,
    createWorker: () => {
      const fake = fakeWorker();
      created.push(fake);
      return fake.worker;
    },
    measureMemory: () => Promise.resolve(2048),
  });

  const tripped = pool.evaluate(["Range", 1, 1_000_000], { memoryBytes: 1024, memoryPollMs: 5 });
  await expect(tripped).resolves.toBe("Aborted");
  expect(created[0]!.terminatedCount()).toBe(1);
  pool.close();
});

test("createEvaluatorPool reuses a worker whose call was never sent (already-aborted signal)", async () => {
  const created: ReturnType<typeof fakeWorker>[] = [];
  const pool = createEvaluatorPool({
    size: 1,
    createWorker: () => {
      const fake = fakeWorker();
      created.push(fake);
      return fake.worker;
    },
  });
  const controller = new AbortController();
  controller.abort();

  const aborted = pool.evaluate(["Add", 1, 1], { signal: controller.signal });
  await expect(aborted).resolves.toBe("Aborted");
  expect(created[0]!.posted).toHaveLength(0);
  expect(created[0]!.terminatedCount()).toBe(0);

  const next = pool.evaluate(["Add", 1, 1]);
  await tick();
  created[0]!.respond({ ok: true, json: 2 });
  await expect(next).resolves.toBe(2);
  expect(created).toHaveLength(1); // the never-used worker was reused, not replaced
  pool.close();
});

test("createEvaluatorPool queues a call past its size cap and reuses the released worker", async () => {
  const created: ReturnType<typeof fakeWorker>[] = [];
  const pool = createEvaluatorPool({
    size: 1,
    createWorker: () => {
      const fake = fakeWorker();
      created.push(fake);
      return fake.worker;
    },
  });

  const first = pool.evaluate(["Add", 1, 1]);
  const second = pool.evaluate(["Add", 2, 2]);
  expect(created).toHaveLength(1);
  await tick();
  expect(created[0]!.posted).toHaveLength(1);

  created[0]!.respond({ ok: true, json: 2 });
  await expect(first).resolves.toBe(2);

  await tick();
  expect(created).toHaveLength(1);
  created[0]!.respond({ ok: true, json: 4 });
  await expect(second).resolves.toBe(4);
  pool.close();
});
