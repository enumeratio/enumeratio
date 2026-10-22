import { ComputeEngine } from "@cortex-js/compute-engine";
import { parseExpression } from "@enumeratio/formats/expression";
import { Transcript, type TrackedSymbols } from "@enumeratio/frontend";
import { expect, test } from "vite-plus/test";
import { ReactiveModule } from "../src/reactive-module.ts";

// DOM-free: the module only touches `querySelector`, attributes and `value`/`block`/`revalidate`.
class FakeOut {
  shown = "stale value";
  blocked: string | undefined;
  block(reason: string | undefined): void {
    this.blocked = reason;
    if (reason !== undefined) this.shown = `error: ${reason}`;
  }
  async revalidate(): Promise<void> {
    if (this.blocked === undefined) this.shown = "fresh value";
  }
}
class FakeCell {
  value: string;
  out = new FakeOut();
  attrs = new Map<string, string>();
  constructor(value: string) {
    this.value = value;
  }
  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }
  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }
  removeAttribute(name: string): void {
    this.attrs.delete(name);
  }
  toggleAttribute(name: string, on: boolean): void {
    if (on) this.attrs.set(name, "");
    else this.attrs.delete(name);
  }
  querySelector(): FakeOut {
    return this.out;
  }
}

const settle = () => new Promise((r) => setTimeout(r, 0));

function setup(...sources: string[]) {
  const cells = sources.map((s) => new FakeCell(s));
  const root = { querySelectorAll: () => cells };
  const engine = new ComputeEngine();
  const module = new ReactiveModule("All" as TrackedSymbols);
  module.register(root as never, engine, new Transcript(engine, { history: false }));
  const commit = (i: number, source: string) => {
    cells[i]!.value = source;
    module.commit(cells[i] as never, source, parseExpression(source, { allow: ["Assign"] }).json);
  };
  return { cells, commit };
}

test("a duplicate definition blocks both definers and every reader, with no stale value", async () => {
  const { cells } = setup("f := 1", "f := 2", "f + 1", "g := f * 2", "g + 1", "h := 3");
  await settle();
  for (const i of [0, 1, 2, 3, 4]) {
    expect(cells[i]!.out.shown, `cell ${i}`).toMatch(/^error: /);
    expect(cells[i]!.attrs.has("data-reactive-error")).toBe(true);
  }
  expect(cells[2]!.out.shown).toContain("`f` is defined in more than one cell");
  expect(cells[4]!.out.shown).toContain("`f`"); // the root cause travels through g
  expect(cells[5]!.out.shown).toBe("fresh value");
});

test("removing the duplicate recovers the definers and their readers", async () => {
  const { cells, commit } = setup("f := 1", "f := 2", "f + 1", "g := f * 2");
  await settle();
  commit(1, "k := 2");
  await settle();
  for (const i of [0, 1, 2, 3]) {
    expect(cells[i]!.out.shown, `cell ${i}`).toBe("fresh value");
    expect(cells[i]!.attrs.has("data-reactive-error")).toBe(false);
  }
});

test("a cell edited into a duplicate loses its value and blocks its readers", async () => {
  const { cells, commit } = setup("f := 1", "k := 2", "f + 1");
  await settle();
  expect(cells[2]!.out.shown).toBe("fresh value");
  commit(1, "f := 2");
  await settle();
  for (const i of [0, 1, 2]) expect(cells[i]!.out.shown).toMatch(/^error: /);
});
