import { expect, test } from "vite-plus/test";
import { SUMMARIES, SYMBOLS as BOXES } from "../src/generated/package/boxes.ts";
import { SYMBOLS, symbolInfo } from "../src/index.ts";

test("the engine's own heads come typed from a bare compute-engine", () => {
  const engine = symbolInfo("Add")?.overloads.find((o) => o.package === "compute-engine");
  expect(engine?.type).toMatch(/->/);
});

test("a record's rows are overloads of the package they name; its signature spells the parameters", () => {
  expect(symbolInfo("RowBox")).toEqual({
    name: "RowBox",
    documented: ["boxes"],
    overloads: [{ package: "boxes", type: "(list<boxes>) -> boxes" }],
  });
  expect(symbolInfo("SqrtBox")?.params).toEqual(["radicand"]);
  expect(symbolInfo("Binomial")?.params).toEqual(["n", "k"]);
});

test("a package module carries what its declare reads", () => {
  expect(BOXES.InterpretationBox).toMatchObject({ attributes: ["HoldAll"], type: expect.stringMatching(/-> boxes$/) });
  expect(SUMMARIES.RowBox).toBe(BOXES.RowBox?.summary);
});

test("names are in code-unit order, so the output is stable", () => {
  const names = Object.keys(SYMBOLS);
  expect(names).toEqual([...names].toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
});
