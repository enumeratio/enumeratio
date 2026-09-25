import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareGraphics } from "@enumeratio/formats";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { expect, test } from "vite-plus/test";
import { renderingOf } from "../src/symbols.ts";

// `Evaluator -> "Worker"` (notatio-lit's off-thread session, design/computation.md) only
// ever reaches the page as the `evaluator="worker"` attribute `renderingOf` lowers it to
// -- and that lowering only survives a REAL engine's canonicalisation. `symbols.test.ts`'s
// own golden corpus renders straight off `parseNotatio`'s tree, never through
// `ComputeEngine.box`, so it could not have caught the bug this guards: `Notebook`'s
// declared signature (`packages/formats/src/graphics.ts`) was `(any) -> any` -- ONE
// argument -- so canonicalising `Notebook(cells, Evaluator -> "Worker")` rejected the
// option outright as `unexpected-argument`, and the element silently fell back to local,
// page-thread evaluation with no error anywhere a reader would see it. `DynamicModule`'s
// own signature was already variadic (`any*`), which is why `TrackedSymbols` never showed
// the same failure and this went unnoticed.

const ce = new ComputeEngine();
declareGraphics(ce);

function evaluatorAttribute(src: string): string | undefined {
  const { json, errors } = parseNotatio(src, { allow: ["Assign"] });
  expect(errors).toEqual([]);
  const boxed = ce.box(json as never);
  // A rejected option shows up as compute-engine's own `Error` head somewhere in the
  // canonical tree -- assert its absence directly, not just that an attribute is missing,
  // so a future regression fails loudly here instead of silently downgrading to local.
  expect(JSON.stringify(boxed.json)).not.toContain('"Error"');
  const rendering = renderingOf(boxed.json);
  return rendering?.attributes.evaluator;
}

test('DynamicModule(cells, Evaluator -> Worker) lowers to evaluator="worker"', () => {
  expect(evaluatorAttribute("DynamicModule([Cell(a := 5)], Evaluator -> Worker)")).toBe("worker");
});

test('Notebook(cells, Evaluator -> Worker) lowers to evaluator="worker" too', () => {
  expect(evaluatorAttribute("Notebook([Cell(a := 5)], Evaluator -> Worker)")).toBe("worker");
});

test("Notebook(cells, TrackedSymbols -> All, Evaluator -> Worker) keeps both options", () => {
  const { json, errors } = parseNotatio("Notebook([Cell(a := 5)], TrackedSymbols -> All, Evaluator -> Worker)", {
    allow: ["Assign"],
  });
  expect(errors).toEqual([]);
  const boxed = ce.box(json as never);
  expect(JSON.stringify(boxed.json)).not.toContain('"Error"');
  const rendering = renderingOf(boxed.json);
  expect(rendering?.attributes.evaluator).toBe("worker");
  expect(rendering?.attributes["tracked-symbols"]).toBe("all");
});

test("Notebook(cells) with no options still canonicalises cleanly", () => {
  expect(evaluatorAttribute("Notebook([Cell(1 + 1)])")).toBeUndefined();
});
