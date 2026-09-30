import { ComputeEngine } from "@cortex-js/compute-engine";
import type { Library } from "@enumeratio/manifest";
import { expect, test } from "vite-plus/test";
import { createKernel } from "../src/kernel.ts";

// A library known only by the names it claims, so the test needs no real package.
const catalogue = (log: string[]): Library<ComputeEngine>[] => [
  {
    name: "doubling",
    names: ["Double"],
    declare: async (ce) => {
      log.push("doubling");
      ce.declare("Double", { signature: "(number) -> number", evaluate: ([x]) => x!.mul(2) });
    },
  },
];

test("a kernel declares a library when a call first names it, and only then", async () => {
  const log: string[] = [];
  const kernel = createKernel(new ComputeEngine(), catalogue(log));
  expect(await kernel.evaluate({ json: ["Add", 1, 2] })).toMatchObject({ ok: true, json: 3, declared: [] });
  expect(await kernel.evaluate({ json: ["Double", 4] })).toMatchObject({ ok: true, json: 8, declared: ["doubling"] });
  expect(await kernel.evaluate({ json: ["Double", 5] })).toMatchObject({ ok: true, json: 10, declared: [] });
  expect(log).toEqual(["doubling"]);
});

test("calls queue behind a library still declaring", async () => {
  const log: string[] = [];
  const kernel = createKernel(new ComputeEngine(), catalogue(log));
  const [a, b] = await Promise.all([
    kernel.evaluate({ json: ["Double", 1] }),
    kernel.evaluate({ json: ["Double", 2] }),
  ]);
  expect([a.json, b.json]).toEqual([2, 4]);
  expect(log).toEqual(["doubling"]);
});

test("an answer carries the display the host builds, and none when building it fails", async () => {
  const shown = createKernel(new ComputeEngine(), [], { display: (_ce, json) => ({ StandardForm: String(json) }) });
  expect(await shown.evaluate({ json: ["Add", 1, 2] })).toMatchObject({
    ok: true,
    json: 3,
    boxes: { StandardForm: "3" },
  });
  const failing = createKernel(new ComputeEngine(), [], {
    display: () => {
      throw new Error("no display");
    },
  });
  const answer = await failing.evaluate({ json: ["Add", 1, 2] });
  expect(answer).toMatchObject({ ok: true, json: 3 });
  expect(answer.boxes).toBeUndefined();
});

test("a kernel parses text with the host's reader, and says why when it can't", async () => {
  const kernel = createKernel(new ComputeEngine(), [], {
    parse: (_ce, { text }) => {
      if (text === "oops") throw new Error("no such syntax");
      return JSON.parse(text);
    },
  });
  expect(await kernel.evaluate({ source: { text: '["Add", 2, 3]', format: "mathjson" } })).toMatchObject({
    ok: true,
    json: 5,
    input: ["Add", 2, 3],
  });
  expect(await kernel.evaluate({ source: { text: "oops", format: "mathjson" } })).toMatchObject({
    ok: false,
    error: "no such syntax",
  });
});

test("a session keeps its history, and a call outside it doesn't touch it", async () => {
  const lines: unknown[] = [];
  const kernel = createKernel(new ComputeEngine(), [], {
    session: (_ce, id) =>
      id === undefined
        ? { run: (fn) => fn() }
        : { run: (fn) => fn(), record: (_source, _input, value) => lines.push(value) },
  });
  expect(await kernel.evaluate({ json: ["Add", 1, 1], session: "a" })).toMatchObject({ json: 2, line: 1 });
  expect(await kernel.evaluate({ json: ["Add", 2, 2], session: "a" })).toMatchObject({ json: 4, line: 2 });
  expect((await kernel.evaluate({ json: ["Add", 3, 3] })).line).toBeUndefined();
  expect(await kernel.evaluate({ json: ["Add", 1, 2], session: "a", evaluate: false })).toMatchObject({
    json: 3,
  });
  expect(lines).toEqual([2, 4]);
});

test("a translation reads and writes without evaluating", async () => {
  const kernel = createKernel(new ComputeEngine(), [], {
    parse: (_ce, { text }) => JSON.parse(text),
    write: (_ce, json, syntax) => `${syntax}:${JSON.stringify(json)}`,
  });
  expect(await kernel.evaluate({ source: { text: '["Add", 3, 4]', format: "mathjson" }, write: "x" })).toMatchObject({
    ok: true,
    json: ["Add", 3, 4],
    written: 'x:["Add",3,4]',
  });
});

test("a call without a session binds nothing another call sees, and a closed session starts over", async () => {
  const ce = new ComputeEngine();
  const scopes: string[] = [];
  const kernel = createKernel(ce, [], {
    session: (_ce, id) => {
      const scope = ce.createScope({});
      scopes.push(id ?? "(own)");
      return {
        run: (fn) => {
          ce.pushScope(scope);
          try {
            return fn();
          } finally {
            ce.popScope();
          }
        },
      };
    },
  });
  await kernel.evaluate({ json: ["Assign", "a", 5] });
  expect((await kernel.evaluate({ json: "a" })).json).toBe("a");
  await kernel.evaluate({ json: ["Assign", "b", 7], session: "s" });
  expect((await kernel.evaluate({ json: "b", session: "s" })).json).toBe(7);
  expect(await kernel.evaluate({ session: "s", close: true })).toMatchObject({ ok: true });
  expect((await kernel.evaluate({ json: "b", session: "s" })).json).toBe("b");
  expect(scopes).toEqual(["(own)", "(own)", "s", "s"]);
});
