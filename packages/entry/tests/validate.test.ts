import type { ReferenceEntry } from "@enumeratio/entry";
import { checkImplementations } from "@enumeratio/entry";
import { expect, test } from "vite-plus/test";

const base: Omit<ReferenceEntry, "bindings" | "primitive"> = {
  name: "Foo",
  domain: "Test",
  signature: "Foo(x)",
  summary: "A test head.",
  examples: [],
};

test("a mapped-only binding needs no primitive reason (symbol-metadata step 5)", () => {
  const entry: ReferenceEntry = {
    ...base,
    bindings: [{ origin: "mapped", form: "sympy", template: "foo($1)" }],
  };
  expect(checkImplementations([entry])).toEqual([]);
});

test("a native binding with no reference row still needs a primitive reason", () => {
  const entry: ReferenceEntry = {
    ...base,
    bindings: [{ origin: "native", form: "typescript", source: "packages/x/src/foo.ts" }],
  };
  expect(checkImplementations([entry])).toEqual([
    { entry: "Foo", message: "has bindings but neither a reference row nor a `primitive` reason" },
  ]);
});

test("a native binding alongside a primitive reason passes", () => {
  const entry: ReferenceEntry = {
    ...base,
    primitive: "numeric",
    bindings: [{ origin: "native", form: "typescript", source: "packages/x/src/foo.ts" }],
  };
  expect(checkImplementations([entry])).toEqual([]);
});
