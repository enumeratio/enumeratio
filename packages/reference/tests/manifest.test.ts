import { SYMBOLS } from "@enumeratio/manifest";
import { expect, test } from "vite-plus/test";
import { declaredEngine } from "../scripts/engines.ts";

// The manifest (design/manifest.md) is built from the records, and the packages declare from
// it; this is the check that the code did what the record says. A typed overload is a claim
// about the declared engine, and so is `HoldAll`.

const ce = declaredEngine();
const operator = (name: string) =>
  (ce.lookupDefinition(name) as { operator?: { signature?: unknown; lazy?: boolean } } | undefined)?.operator;

test("every typed overload in a record is the signature its package declares", () => {
  const wrong: string[] = [];
  for (const symbol of Object.values(SYMBOLS)) {
    for (const overload of symbol.overloads) {
      if (overload.type === undefined || overload.package === "compute-engine") continue;
      const declared = `${operator(symbol.name)?.signature as string}`;
      if (declared !== overload.type)
        wrong.push(`${symbol.name} (${overload.package}): record ${overload.type}, engine ${declared}`);
    }
  }
  expect(wrong).toEqual([]);
});

test("a record's HoldAll is the engine's lazy, both ways, for every typed head", () => {
  const wrong: string[] = [];
  for (const symbol of Object.values(SYMBOLS)) {
    if (!symbol.overloads.some((o) => o.type !== undefined && o.package !== "compute-engine")) continue;
    const hold = symbol.attributes?.includes("HoldAll") ?? false;
    if ((operator(symbol.name)?.lazy ?? false) !== hold) wrong.push(`${symbol.name}: HoldAll ${hold}`);
  }
  expect(wrong).toEqual([]);
});

test("the check is looking at something", () => {
  expect(SYMBOLS.InterpretationBox?.attributes).toEqual(["HoldAll"]);
  expect(SYMBOLS.RowBox?.overloads).toEqual([{ package: "boxes", type: "(list<boxes>) -> boxes" }]);
});
