import { expect, test } from "vite-plus/test";
import { definitionsOf, parameterNames } from "../scripts/epsil-definitions.ts";
import { pinOf } from "../src/registry.ts";

test("a signature's parameter names, whatever their types", () => {
  expect(parameterNames("(n: integer, sides: integer?) -> integer")).toEqual(["n", "sides"]);
  expect(parameterNames("(p: tuple<integer, integer>, xs: list<real>) -> real")).toEqual(["p", "xs"]);
  expect(parameterNames("() -> integer")).toEqual([]);
  expect(parameterNames("(integer) -> integer")).toBeUndefined();
});

const written = {
  Polygonal: {
    definition: {
      signature: "(n: integer, sides: integer?) -> integer",
      body: "((sides - 2) * n^2 - (sides - 4) * n) / 2",
      defaults: { sides: "3" },
    },
  },
  Pyramidal: {
    definition: { signature: "(n: integer) -> integer", body: "Sum(fig.Polygonal(k), (k, 1, n))" },
  },
};

test("a body is a Function over the signature's names, its own library's names pinned", async () => {
  const defs = await definitionsOf("fig", written, () => undefined);
  expect(defs.Polygonal!.body).toEqual([
    "Function",
    [
      "Divide",
      [
        "Subtract",
        ["Multiply", ["Subtract", "sides", 2], ["Power", "n", 2]],
        ["Multiply", ["Subtract", "sides", 4], "n"],
      ],
      2,
    ],
    "n",
    "sides",
  ]);
  expect(defs.Polygonal!.defaults).toEqual({ sides: 3 });
  expect(defs.Pyramidal!.requires).toEqual({ "fig.Polygonal": await pinOf(defs.Polygonal!) });
});

test("a name another library serves is pinned from its installed index, or written in requires", async () => {
  const uses = { Twice: { definition: { signature: "(x: number) -> number", body: "2 * ada.Id(x)" } } };
  const pinned = await definitionsOf("bob", uses, (name) => (name === "ada.Id" ? "sha256-ada" : undefined));
  expect(pinned.Twice!.requires).toEqual({ "ada.Id": "sha256-ada" });
  await expect(definitionsOf("bob", uses, () => undefined)).rejects.toThrow(
    "Twice uses ada.Id, and nothing installed pins it: add it to requires",
  );
});

test("symbols that use each other can't be pinned", async () => {
  const loop = {
    A: { definition: { signature: "(x: number) -> number", body: "fig.B(x)" } },
    B: { definition: { signature: "(x: number) -> number", body: "fig.A(x)" } },
  };
  await expect(definitionsOf("fig", loop, () => undefined)).rejects.toThrow("A uses B uses A");
});
