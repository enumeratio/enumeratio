import { ComputeEngine } from "@cortex-js/compute-engine";
import { definitionRegistry, type Library } from "@enumeratio/manifest";
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

test("a function a cell defines survives its own recording", async () => {
  const ce = new ComputeEngine();
  const scope = ce.createScope({});
  const kernel = createKernel(ce, [], {
    // As the notebook's session does: an `Assign` claims its name in this scope first.
    session: () => ({
      run: (fn, input) => {
        ce.pushScope(scope);
        try {
          if (Array.isArray(input) && input[0] === "Assign" && typeof input[1] === "string")
            try {
              ce.declare(input[1], "unknown");
            } catch {
              // already claimed here
            }
          return fn();
        } finally {
          ce.popScope();
        }
      },
      record: () => 1,
    }),
  });
  const square = ce.parse("h(x)\\coloneq x^2+1").json;
  expect(await kernel.evaluate({ json: square, session: "s" })).toMatchObject({ ok: true, line: 1 });
  expect((await kernel.evaluate({ json: ["h", 4], session: "s" })).json).toBe(17);
});

test("a compile request hands the input to the host's compile, evaluating nothing", async () => {
  const seen: unknown[] = [];
  const kernel = createKernel(new ComputeEngine(), catalogue([]), {
    compile: (_ce, json, spec) => {
      seen.push([json, spec]);
      return { code: "x" };
    },
  });
  const answer = await kernel.evaluate({ json: ["Add", 1, 2], compile: { target: "javascript" } });
  expect(answer.compiled).toEqual({ code: "x" });
  expect(answer.json).toEqual(["Add", 1, 2]);
  expect(seen).toEqual([[["Add", 1, 2], { target: "javascript" }]]);
  const without = await createKernel(new ComputeEngine(), catalogue([])).evaluate({ json: 1, compile: {} });
  expect(without.ok).toBe(false);
});

test("a published library's qualified names resolve after the catalogue's, with its notation handed over", async () => {
  const notation: string[] = [];
  const fig = definitionRegistry<ComputeEngine>("fig", {
    Polygonal: {
      signature: "(n: integer, sides: integer?) -> integer",
      body: [
        "Function",
        [
          "Divide",
          [
            "Subtract",
            ["Multiply", ["Subtract", "sides", 2], ["Power", "n", 2]],
            ["Multiply", ["Subtract", "sides", 4], "n"],
          ],
          2,
        ],
        "n",
        "sides",
      ],
      defaults: { sides: 3 },
      notation: { traditional: [{ params: ["n"], box: ["SubscriptBox", "T", ["TemplateSlot", "n"]] }] },
      examples: [{ id: "t4", expr: ["MemberCall", "fig", "'Polygonal'", 4], expected: 10 }],
    },
  });
  const kernel = createKernel(new ComputeEngine(), catalogue([]), {
    libraries: fig,
    notation: (_ce, head) => notation.push(head),
  });
  const answer = await kernel.evaluate({ json: ["MemberCall", "fig", "'Polygonal'", 4, 5] });
  expect(answer).toMatchObject({ ok: true, json: 22 });
  expect(answer.declared).toHaveLength(1);
  expect(notation).toEqual(answer.declared);
  const nowhere = await kernel.evaluate({ json: ["MemberCall", "fig", "'Nowhere'", 1] });
  expect(nowhere.missing).toContain("fig.Nowhere");
});

test("a published library's definition can build on the catalogue's heads", async () => {
  const log: string[] = [];
  const fig = definitionRegistry<ComputeEngine>("fig", {
    Quadruple: {
      signature: "(x: number) -> number",
      body: ["Function", ["Double", ["Double", "x"]], "x"],
      examples: [{ id: "q3", expr: ["MemberCall", "fig", "'Quadruple'", 3], expected: 12 }],
    },
  });
  const kernel = createKernel(new ComputeEngine(), catalogue(log), { libraries: fig });
  const answer = await kernel.evaluate({ json: ["MemberCall", "fig", "'Quadruple'", 5] });
  expect(answer).toMatchObject({ ok: true, json: 20 });
  // Declared in the install check's engine and in the kernel's.
  expect(log).toEqual(["doubling", "doubling"]);
});

test("a call rejected for its arguments stays unevaluated, with a message saying why", async () => {
  const kernel = createKernel(new ComputeEngine(), catalogue([]));
  const answer = await kernel.evaluate({ json: ["Double", ["Rational", 1, 2], "x"] });
  expect(answer.ok).toBe(true);
  // Only the one-argument signature exists, so the second argument is the rejected one.
  expect(answer.json).toEqual(["Double", ["Rational", 1, 2], "x"]);
  expect(answer.messages).toMatchObject([{ head: "Double", code: "argx" }]);
});
