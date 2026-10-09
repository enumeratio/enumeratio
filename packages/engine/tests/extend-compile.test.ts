import { ComputeEngine } from "@cortex-js/compute-engine";
import { compile } from "@cortex-js/compute-engine/compile";
import { expect, test } from "vite-plus/test";
import { defineOverload, extendHead, syncLibraryHandlers, wrapOperator } from "../src/index.ts";

// compute-engine compiles a head only while its visible definition holds the library's
// handlers. A handler set on a definition `extendHead` already built from the library's would
// make `Sin` "a user definition that shadows the library operator" without the sync.
const compiled = (ce: ComputeEngine): string => {
  syncLibraryHandlers(ce);
  const result = compile(ce.box(["Sin", "x"])) as { code?: string };
  return result.code ?? "";
};

test("a head wrapped after a signature extension still compiles", () => {
  const ce = new ComputeEngine();
  defineOverload(ce, "Sin", { package: "test", on: ["Interval"], written: true, evaluate: () => undefined });
  wrapOperator(
    ce,
    ["Sin", 1],
    () => false,
    () => () => undefined,
    1,
  );
  expect(compiled(ce)).toBe("Math.sin(_.x)");
});

test("a head wrapped after a flag extension still compiles", () => {
  const ce = new ComputeEngine();
  extendHead(ce, "Sin", { broadcastable: true });
  wrapOperator(
    ce,
    ["Sin", 1],
    () => false,
    () => () => undefined,
    1,
  );
  expect(compiled(ce)).toBe("Math.sin(_.x)");
});
