// `runCases`: batch evaluation over the isolated evaluator (see ./isolated.test.ts for the
// single-call primitive this builds on). Real `worker_threads` workers throughout except
// where a fake stands in for an uncooperative worker (see the last test) — small deadlines
// and cases keep this fast.
import { expect, test } from "vite-plus/test";
import { createEvaluatorPool, runCases, type NodeWorkerLike } from "../src/node.ts";

// One of compute-engine's own cooperative loops (design/aestimatio.md §2): it checks a
// `timeMs` deadline itself and answers `"Aborted"` as an ordinary VALUE well inside the
// worker's cooperative window, long before any hard kill. So this reliably produces
// `{ outcome: "Evaluated", value: "Aborted" }`, not the `"Aborted"` OUTCOME — that one is
// reserved for a case that never got an answer at all (see the hard-kill test below).
const SLOW = ["Sum", ["Mod", "k", 97], ["Tuple", "k", 1, 2_000_000_000]];

test("runCases returns results in the same order as the input, regardless of completion order", async () => {
  // The slow case is listed first but finishes last — order in the result must still
  // follow `cases`, not completion order.
  const results = await runCases(
    [
      { id: "slow", input: SLOW, timeMs: 150 },
      { id: "fast-1", input: ["Add", 1, 1] },
      { id: "fast-2", input: ["Add", 2, 2] },
    ],
    { concurrency: 3 },
  );
  expect(results.map((r) => r.id)).toEqual(["slow", "fast-1", "fast-2"]);
  expect(results[0]).toMatchObject({ id: "slow", outcome: "Evaluated", value: "Aborted" });
  expect(results[1]).toMatchObject({ id: "fast-1", outcome: "Evaluated", value: 2 });
  expect(results[2]).toMatchObject({ id: "fast-2", outcome: "Evaluated", value: 4 });
});

test("materialize expands a lazy collection into its elements; without it the call stays", async () => {
  const cases = [{ id: "range", input: ["Range", 1, 3] }];
  const [lazy] = await runCases(cases);
  const [expanded] = await runCases(cases, { materialize: true });
  expect(lazy?.value).toEqual(["Range", 1, 3]);
  expect(expanded?.value).toEqual(["List", 1, 2, 3]);
});

test("materialize expands only the result: an argument is counted whole, not as its display", async () => {
  const [counted] = await runCases([{ id: "length", input: ["Length", ["Range", 1, 20]] }], {
    materialize: true,
  });
  expect(counted?.value).toBe(20);
});

test("a per-case timeout stops only that case cooperatively, not the others in the batch", async () => {
  const results = await runCases(
    [
      { id: "a", input: ["Add", 1, 1] },
      { id: "slow", input: SLOW, timeMs: 50 },
      { id: "b", input: ["Add", 3, 3] },
    ],
    { concurrency: 3 },
  );
  const byId = new Map(results.map((r) => [r.id, r]));
  expect(byId.get("a")).toMatchObject({ outcome: "Evaluated", value: 2 });
  expect(byId.get("slow")).toMatchObject({ outcome: "Evaluated", value: "Aborted" });
  expect(byId.get("b")).toMatchObject({ outcome: "Evaluated", value: 6 });
});

test("a case that outgrows its memory cap crashes its worker and comes back Aborted, without taking the batch down", async () => {
  // A deeply nested unevaluated Plus builds a large expression tree with no arithmetic
  // shortcut to collapse it — cheap to describe, expensive to hold boxed in memory. Unlike
  // the cooperative timeMs case above, this genuinely kills the worker (no answer at all).
  const wide: unknown[] = ["List"];
  for (let i = 0; i < 2_000_000; i++) wide.push(["Hold", i]);

  const results = await runCases(
    [
      { id: "heavy", input: wide, memoryBytes: 8 * 1024 * 1024, timeMs: 10_000 },
      { id: "light", input: ["Add", 1, 1] },
    ],
    { concurrency: 2 },
  );
  const byId = new Map(results.map((r) => [r.id, r]));
  expect(byId.get("heavy")).toMatchObject({ outcome: "Aborted" });
  expect(byId.get("light")).toMatchObject({ outcome: "Evaluated", value: 2 });
});

test("an evaluation error comes back as its own outcome, distinct from Aborted", async () => {
  // compute-engine turns almost anything malformed into an `["Error", …]` MathJSON value
  // rather than throwing, so a genuine `ok: false` needs a head that actually raises --
  // ./fixtures/throws-setup.ts declares one. `runCases` must not collapse this into
  // "Aborted", the way a hard-killed timeout or worker crash does.
  const setup = new URL("./fixtures/throws-setup.ts", import.meta.url).href;
  const results = await runCases([{ id: "bad", input: ["Boom"] }], { setup });
  expect(results[0]!.outcome).toBe("Error");
  expect(results[0]!.reason).toContain("Boom");
});

test("runCases reuses workers from a pool passed in rather than closing it", async () => {
  const pool = createEvaluatorPool({ size: 2 });
  try {
    const first = await runCases([{ id: "a", input: ["Add", 1, 1] }], { pool });
    expect(first[0]).toMatchObject({ outcome: "Evaluated", value: 2 });

    // The pool must still be usable after runCases returns -- it does not own or close it.
    const second = await runCases([{ id: "b", input: ["Add", 2, 2] }], { pool });
    expect(second[0]).toMatchObject({ outcome: "Evaluated", value: 4 });
  } finally {
    pool.close();
  }
});

/** A fake `worker_threads.Worker` that reports "started" (so the real `timeMs` kill
 * timer arms) but never answers -- stands in for a tight, uncooperative loop the
 * cooperative deadline can't reach, so the host's own hard-kill path is exercised
 * deterministically and fast rather than waiting out the (much larger) spawn-timeout
 * guard (mirrors ./pool.test.ts and ./session.test.ts's own fakes for the same
 * scenario). */
function fakeHangingWorker(): NodeWorkerLike {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const on = (event: string, listener: (...args: unknown[]) => void): void => {
    let set = listeners.get(event);
    if (set === undefined) listeners.set(event, (set = new Set()));
    set.add(listener);
  };
  return {
    postMessage: (message) => {
      const { id } = message as { id: number };
      for (const l of listeners.get("message") ?? []) l({ id, kind: "started" });
    },
    terminate: () => {},
    unref: () => {},
    ref: () => {},
    on,
    once: on,
    off: (event, listener) => listeners.get(event)?.delete(listener),
  };
}

test("a hard-killed case (no cooperative answer) reports outcome Aborted, not a value of Aborted", async () => {
  // Every worker this pool creates hangs (including the replacement after the kill), so
  // only the one case is run here -- ./pool.test.ts already covers a killed worker being
  // replaced by a real, usable one.
  const pool = createEvaluatorPool({ size: 1, createWorker: fakeHangingWorker });
  try {
    const results = await runCases([{ id: "hung", input: ["Add", 1, 1], timeMs: 5 }], { pool });
    // No worker ever answered "hung" -- it never produced any value, cooperative or
    // otherwise, so the OUTCOME itself is "Aborted" (not `value: "Aborted"`).
    expect(results[0]).toMatchObject({ id: "hung", outcome: "Aborted" });
    expect(results[0]!.value).toBeUndefined();
  } finally {
    pool.close();
  }
});
