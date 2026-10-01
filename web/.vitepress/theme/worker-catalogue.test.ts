import { HIERARCHY, plan } from "@enumeratio/manifest";
import { expect, test } from "vite-plus/test";
import { CATALOGUE } from "./worker-catalogue.ts";

// The catalogue names packages, and what a library needs declared first is the hierarchy's.
test("every catalogue library is a placed package, and none restates its requirements", () => {
  for (const library of CATALOGUE) {
    expect(HIERARCHY[library.name], library.name).toBeDefined();
    expect(library.requires ?? [], library.name).toEqual([]);
  }
});

test("a kernel that plans analytic doesn't bring it for anything else", () => {
  const without = CATALOGUE.map((l) => l.name).filter((name) => name !== "analytic");
  for (const name of without)
    expect(
      plan([name], CATALOGUE).libraries.map((l) => l.name),
      name,
    ).not.toContain("analytic");
});
