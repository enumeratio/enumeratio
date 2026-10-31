// @vitest-environment happy-dom
// The element picker, scripted the way a reader uses it: the size stepper by keyboard, the rank
// slider, and what the element and its announcement then are. A kernel stand-in answers over
// permutations, so no engine loads. The attributes after each pick are golden data
// (`UPDATE_ELEMENT_PICKER=1 vp test` regenerates them).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vite-plus/test";
import type { ElementPick, NotatioElementPicker } from "../src/notatio-element-picker.ts";

const GOLDEN = join(import.meta.dirname, "element-picker.golden.json");
const updating = process.env.UPDATE_ELEMENT_PICKER === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

// Defining the controls starts the page scope, which loads its parser lazily; load it up front and
// let the scope settle after each test, so no import is still in flight when the environment goes.
beforeAll(async () => {
  await import("../src/notatio-element-picker.ts");
  await import("@enumeratio/formats/expression");
}, 60_000);

afterEach(async () => {
  document.body.replaceChildren();
  await (await import("../src/scope.ts")).pageScope().refresh();
});

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});

function check(id: string, actual: unknown): void {
  if (updating) fresh[id] = actual;
  else expect(actual).toEqual(golden[id]);
}

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

/** The `rank`-th permutation of 1..n in lexicographic order. */
function unrank(n: number, rank: number): number[] {
  const pool = Array.from({ length: n }, (_, i) => i + 1);
  let k = rank - 1;
  return Array.from({ length: n }, (_, i) => {
    const block = factorial(n - 1 - i);
    const at = Math.floor(k / block);
    k %= block;
    return pool.splice(at, 1)[0]!;
  });
}

/** A kernel that knows `SymmetricGroup(n)`: its count, and its elements by rank. */
async function kernel(text: string): Promise<unknown> {
  const count = /^Count\(SymmetricGroup\((\d+)\)\)$/.exec(text);
  if (count) return factorial(Number(count[1]));
  const at = /^At\(SymmetricGroup\((\d+)\), (\d+)\)$/.exec(text);
  if (at) return ["Permutation", ["List", ...unrank(Number(at[1]), Number(at[2]))]];
  throw new Error(`unexpected: ${text}`);
}

async function picker(): Promise<NotatioElementPicker> {
  const el = document.createElement("notatio-element-picker") as NotatioElementPicker;
  Object.assign(el, {
    template: "SymmetricGroup({size})",
    carrier: "Permutation",
    glyph: "permutation",
    size: 3,
    sizeMin: 1,
    sizeMax: 4,
    evaluate: kernel,
  });
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const track = (el: Element): HTMLInputElement => el.querySelector<HTMLInputElement>("input[type=range]")!;

/** What a reader can read and operate. */
function drawn(el: NotatioElementPicker): unknown {
  const stepper = el.querySelector("[role=spinbutton]");
  return {
    group: el.querySelector("[role=group]")?.getAttribute("aria-label"),
    size: { label: stepper?.getAttribute("aria-label"), now: stepper?.getAttribute("aria-valuenow") },
    rank: {
      label: track(el).getAttribute("aria-label"),
      min: track(el).min,
      max: track(el).max,
      now: track(el).value,
      text: track(el).getAttribute("aria-valuetext"),
    },
    count: el.querySelector(".element-picker-count")?.textContent,
    glyph: el.querySelector(".element-picker-glyph svg") !== null,
    glyphLabel: el.querySelector(".element-picker-glyph")?.getAttribute("aria-label") ?? null,
    value: el.querySelector(".element-picker-value")?.textContent ?? null,
  };
}

/** The next announcement of a pick. */
const nextPick = (el: Element): Promise<ElementPick> =>
  new Promise((resolve) =>
    el.addEventListener("notatio-element-pick", (e) => resolve((e as CustomEvent<ElementPick>).detail), {
      once: true,
    }),
  );

async function toRank(el: NotatioElementPicker, rank: number): Promise<ElementPick> {
  const picked = nextPick(el);
  track(el).value = String(rank);
  track(el).dispatchEvent(new Event("input", { bubbles: true }));
  return picked;
}

async function stepSize(el: NotatioElementPicker, key: "ArrowLeft" | "ArrowRight"): Promise<ElementPick> {
  const picked = nextPick(el);
  el.querySelector("[role=spinbutton]")!.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  return picked;
}

test("opens on the count and says nothing until a control moves", async () => {
  const announced = vi.fn();
  const el = document.createElement("notatio-element-picker") as NotatioElementPicker;
  el.addEventListener("notatio-element-pick", announced);
  Object.assign(el, { template: "SymmetricGroup({size})", carrier: "Permutation", glyph: "permutation", size: 3 });
  Object.assign(el, { sizeMin: 1, sizeMax: 4, evaluate: kernel });
  document.body.append(el);
  await vi.waitFor(() => expect(el.querySelector(".element-picker-count")?.textContent).toBe("of 6"));
  check("opened", drawn(el));
  expect(announced).not.toHaveBeenCalled();
  el.remove();
});

test("the slider picks by rank, the stepper moves the size, and a rank past the new count is clamped", async () => {
  const el = await picker();
  const steps: Record<string, unknown> = {};

  const slid = await toRank(el, 4);
  expect(slid).toEqual({ size: 3, rank: 4, count: 6, element: ["Permutation", ["List", 2, 3, 1]] });
  await el.updateComplete;
  steps.rank4 = drawn(el);

  const grown = await stepSize(el, "ArrowRight");
  expect(grown).toMatchObject({ size: 4, rank: 4, count: 24 });
  await el.updateComplete;
  steps.size4 = drawn(el);

  await toRank(el, 20);
  const shrunk = await stepSize(el, "ArrowLeft");
  expect(shrunk).toMatchObject({ size: 3, rank: 6, count: 6 });
  await el.updateComplete;
  steps.clamped = drawn(el);

  check("steps", steps);
  el.remove();
});

test("a kernel that cannot answer is said, not thrown", async () => {
  const el = document.createElement("notatio-element-picker") as NotatioElementPicker;
  Object.assign(el, { template: "SymmetricGroup({size})", size: 3, evaluate: () => Promise.reject(new Error("no")) });
  document.body.append(el);
  await vi.waitFor(() => expect(el.querySelector("[role=status]")?.textContent).toContain("no elements"));
  el.remove();
});
