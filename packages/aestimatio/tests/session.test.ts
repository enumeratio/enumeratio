// Node session: a real worker_threads worker held across evaluate() calls. Small
// deadlines keep this fast (see design/aestimatio.md §3 and node.ts's own comments).
import { expect, test } from "vite-plus/test";
import { openSession, type NodeWorkerLike } from "../src/node.ts";

test("openSession persists := bindings across evaluate calls", async () => {
  const session = openSession();
  try {
    const assigned = await session.evaluate(["Assign", "a", 5]);
    expect(assigned).toEqual({ value: 5, reset: false });

    const squared = await session.evaluate(["Power", "a", 2]);
    expect(squared).toEqual({ value: 25, reset: false });
  } finally {
    session.close();
  }
});

test("a cooperative timeMs stop (compute-engine's own loop) keeps bindings: reset stays false", async () => {
  const session = openSession();
  try {
    await session.evaluate(["Assign", "a", 5]);

    // Sum is one of compute-engine's own loops (design/aestimatio.md §2): it checks the
    // deadline itself and stops well inside the worker's cooperative timeMs, long before
    // the host's own (much later) hard-kill timer would ever fire.
    const slow = ["Sum", ["Mod", "k", 97], ["Tuple", "k", 1, 2_000_000_000]];
    const stopped = await session.evaluate(slow, { timeMs: 150 });
    expect(stopped).toEqual({ value: "Aborted", reset: false });

    // The binding survived -- same engine, same worker.
    const after = await session.evaluate(["Power", "a", 2]);
    expect(after).toEqual({ value: 25, reset: false });
  } finally {
    session.close();
  }
});

/** A fake `worker_threads.Worker` that never responds -- stands in for an uncooperative,
 * tight loop the cooperative deadline can't reach, so the hard-kill path is exercised
 * deterministically and fast rather than needing a real one to actually hang. */
function fakeHangingWorker() {
  const posted: unknown[] = [];
  let terminated = 0;
  const worker: NodeWorkerLike = {
    postMessage: (message) => posted.push(message),
    terminate: () => {
      terminated++;
    },
    unref: () => {},
    ref: () => {},
    on: () => {},
    once: () => {},
    off: () => {},
  };
  return { worker, posted, terminatedCount: () => terminated };
}

test("an uncooperative worker still gets the hard kill: reset: true, worker replaced", async () => {
  const spawned: ReturnType<typeof fakeHangingWorker>[] = [];
  const session = openSession({
    createWorker: () => {
      const fake = fakeHangingWorker();
      spawned.push(fake);
      return fake.worker;
    },
  });
  try {
    const killed = await session.evaluate(["Sum", "k"], { timeMs: 5 });
    expect(killed).toEqual({ value: "Aborted", reset: true });
    expect(spawned[0]!.terminatedCount()).toBe(1);
    expect(spawned).toHaveLength(2); // a fresh worker now backs the session
  } finally {
    session.close();
  }
});

test("openSession's evaluate() throws once the session is closed", () => {
  const session = openSession();
  session.close();
  expect(() => session.evaluate(["Add", 1, 1])).toThrow();
});
