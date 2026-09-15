import { expect, test } from "vite-plus/test";
import { ResourceRegistry } from "../src/registry.ts";
import { qualify, type Resource, unqualify } from "../src/types.ts";

const res = (context: string, name: string): Resource => ({ name, context, kind: "collection" });

test("a bare name does not resolve until its context is blessed", () => {
  const reg = new ResourceRegistry().add(res("enumeratio", "Subsets"));
  expect(reg.resolve("Subsets")).toBeUndefined();
  reg.bless("enumeratio");
  expect(reg.resolve("Subsets")?.context).toBe("enumeratio");
});

test("a qualified spelling ignores the search path entirely", () => {
  // This is what makes promotion a path change rather than a rename: a fully-qualified
  // reference written today keeps resolving after any later blessing or unblessing.
  const reg = new ResourceRegistry().add(res("ada", "Widgets"));
  expect(reg.resolve("ada`Widgets")?.context).toBe("ada");
  reg.bless("enumeratio");
  expect(reg.resolve("ada`Widgets")?.context).toBe("ada");
  expect(reg.resolve("Widgets")).toBeUndefined();
});

test("search path order is the precedence rule, and shadowing is reportable", () => {
  const reg = new ResourceRegistry().addAll([res("enumeratio", "Trees"), res("ada", "Trees")]);
  reg.bless("ada", "enumeratio");
  expect(reg.resolve("Trees")?.context).toBe("ada");
  expect(
    reg
      .candidates("Trees")
      .map((r) => r.context)
      .sort(),
  ).toEqual(["ada", "enumeratio"]);

  reg.unbless("ada");
  expect(reg.resolve("Trees")?.context).toBe("enumeratio");
});

test("blessing is idempotent and order-preserving", () => {
  const reg = new ResourceRegistry();
  reg.bless("a", "b").bless("a");
  expect(reg.searchPath).toEqual(["a", "b"]);
});

test("qualify and unqualify round-trip, and a bare name has no context", () => {
  expect(unqualify(qualify("ada", "Widgets"))).toEqual({ context: "ada", name: "Widgets" });
  expect(unqualify("Widgets")).toEqual({ name: "Widgets" });
});
