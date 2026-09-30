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
  expect(await kernel.evaluate(["Add", 1, 2])).toMatchObject({ ok: true, json: 3, declared: [] });
  expect(await kernel.evaluate(["Double", 4])).toMatchObject({ ok: true, json: 8, declared: ["doubling"] });
  expect(await kernel.evaluate(["Double", 5])).toMatchObject({ ok: true, json: 10, declared: [] });
  expect(log).toEqual(["doubling"]);
});

test("calls queue behind a library still declaring", async () => {
  const log: string[] = [];
  const kernel = createKernel(new ComputeEngine(), catalogue(log));
  const [a, b] = await Promise.all([kernel.evaluate(["Double", 1]), kernel.evaluate(["Double", 2])]);
  expect([a.json, b.json]).toEqual([2, 4]);
  expect(log).toEqual(["doubling"]);
});

test("an answer carries the display the host builds, and none when building it fails", async () => {
  const shown = createKernel(new ComputeEngine(), [], { display: (_ce, json) => ({ StandardForm: String(json) }) });
  expect(await shown.evaluate(["Add", 1, 2])).toMatchObject({ ok: true, json: 3, boxes: { StandardForm: "3" } });
  const failing = createKernel(new ComputeEngine(), [], {
    display: () => {
      throw new Error("no display");
    },
  });
  const answer = await failing.evaluate(["Add", 1, 2]);
  expect(answer).toMatchObject({ ok: true, json: 3 });
  expect(answer.boxes).toBeUndefined();
});
