import { expect, test } from "vite-plus/test";
import { fullEngine } from "../src/engine.ts";
import { RENAME_QUEUE } from "../src/rename-queue.ts";

const ce = fullEngine();

test("every queued rename is still pending: the old head is declared, the new one is not", () => {
  const stale = RENAME_QUEUE.filter(
    ({ from, to }) =>
      ce.lookupDefinition(from) === undefined || ce.lookupDefinition(to) !== undefined,
  ).map(({ from, to }) => `${from} → ${to}`);
  // A row here has landed (or its head was dropped): remove it from the queue.
  expect(stale).toEqual([]);
});

test("no head is queued twice, and no target is claimed twice", () => {
  const froms = RENAME_QUEUE.map((r) => r.from);
  const tos = RENAME_QUEUE.map((r) => r.to);
  expect(new Set(froms).size).toBe(froms.length);
  expect(new Set(tos).size).toBe(tos.length);
});
