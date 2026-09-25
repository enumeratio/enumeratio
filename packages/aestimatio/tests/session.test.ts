// Node session: a real worker_threads worker held across evaluate() calls. Small
// deadlines keep this fast (see design/aestimatio.md §3 and node.ts's own comments).
import { expect, test } from "vite-plus/test";
import { openSession } from "../src/node.ts";

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

test("openSession resets state (reset: true) after a timeMs kill", async () => {
  const session = openSession();
  try {
    await session.evaluate(["Assign", "a", 5]);

    // Long enough to outrun a 50ms deadline -- see isolated.test.ts's own SLOW constant.
    const slow = ["Sum", ["Mod", "k", 97], ["Tuple", "k", 1, 2_000_000_000]];
    const killed = await session.evaluate(slow, { timeMs: 50 });
    expect(killed).toEqual({ value: "Aborted", reset: true });

    // A fresh worker (fresh engine) now backs the session -- `a` is unbound again, so
    // a^2 stays symbolic rather than reducing to 25.
    const after = await session.evaluate(["Power", "a", 2]);
    expect(after.reset).toBe(false);
    expect(after.value).not.toBe(25);
  } finally {
    session.close();
  }
});

test("openSession's evaluate() throws once the session is closed", () => {
  const session = openSession();
  session.close();
  expect(() => session.evaluate(["Add", 1, 1])).toThrow();
});
