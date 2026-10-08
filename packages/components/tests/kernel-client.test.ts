// The page kernel without a SharedWorker (Chrome for Android) or with a throwing factory:
// fake workers stand in, and fake timers show nothing waits on a spawn timeout.
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import type { WorkerLike } from "@enumeratio/evaluation/browser";

interface FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}

/** Answers every evaluate call at once: `started`, then a result of "done". */
function answeringWorker(): FakeWorker {
  const worker: FakeWorker = {
    onmessage: null,
    postMessage(message) {
      const id = (message as { id?: number }).id;
      if (id === undefined) return;
      worker.onmessage?.({ data: { id, kind: "started" } });
      worker.onmessage?.({ data: { id, kind: "result", ok: true, json: "done" } });
    },
    terminate() {},
  };
  return worker;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("without a SharedWorker constructor the page kernel uses the dedicated worker, with no wait", async () => {
  vi.stubGlobal("SharedWorker", undefined);
  const createSharedWorker = vi.fn((): never => {
    throw new Error("a shared worker must not be attempted");
  });
  const workers: FakeWorker[] = [];
  vi.stubGlobal("__notatioWorkerFactories", {
    createSharedWorker,
    createWorker: () => {
      const worker = answeringWorker();
      workers.push(worker);
      return worker;
    },
  });

  const { pageKernel } = await import("../src/kernel-client.ts");
  const ask = pageKernel();
  const answer = await ask!({ source: { text: "1+1", format: "epsil" } });

  expect(createSharedWorker).not.toHaveBeenCalled();
  expect(workers).toHaveLength(1);
  expect(answer.value).toBe("done");
});

test("a throwing worker factory means no kernel at once, so cells run on the page", async () => {
  vi.stubGlobal("SharedWorker", class {});
  vi.stubGlobal("__notatioWorkerFactories", {
    createSharedWorker: () => {
      throw new ReferenceError("SharedWorker is not defined");
    },
    createWorker: () => {
      throw new ReferenceError("Worker is not defined");
    },
  });

  const { pageKernel } = await import("../src/kernel-client.ts");
  expect(pageKernel()).toBeUndefined();
  expect(pageKernel()).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});

test("a module's session (openHostSession) skips the shared factory without a SharedWorker", async () => {
  vi.stubGlobal("SharedWorker", undefined);
  const createSharedWorker = vi.fn((): never => {
    throw new Error("a shared worker must not be attempted");
  });
  const workers: FakeWorker[] = [];
  const { openHostSession } = await import("../src/kernel-client.ts");
  const session = openHostSession(undefined, {
    createSharedWorker,
    createWorker: () => {
      const worker = answeringWorker();
      workers.push(worker);
      return worker as unknown as WorkerLike;
    },
  });

  await expect(session.evaluate(["Add", 1, 1])).resolves.toMatchObject({ value: "done", reset: false });
  expect(createSharedWorker).not.toHaveBeenCalled();
  expect(workers).toHaveLength(1);
  session.close();
});

test("a module's session whose dedicated worker cannot be built throws at once, for the module to fall back on", async () => {
  vi.stubGlobal("SharedWorker", undefined);
  const { openHostSession } = await import("../src/kernel-client.ts");
  expect(() =>
    openHostSession(undefined, {
      createWorker: () => {
        throw new ReferenceError("Worker is not defined");
      },
    }),
  ).toThrow(ReferenceError);
  expect(vi.getTimerCount()).toBe(0);
});
