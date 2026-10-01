import { expect, test } from "vite-plus/test";
import {
  type Box,
  fence,
  indexed,
  type Options,
  makeBoxes,
  named,
  row,
  scalars,
  subscript,
  subscripted,
  superscript,
} from "../src/index.ts";
import { type NotationData, notationProblem } from "@enumeratio/manifest";
import { compileNotation } from "../src/notation-data.ts";
import type { Notation } from "../src/notation.ts";
import { toLatex } from "../src/render/index.ts";

const tex = (json: unknown, notation: Notation): string => toLatex(makeBoxes(json as never, notation));
const slot = (name: string, options?: Options): Box =>
  options === undefined ? ["TemplateSlot", name] : ["TemplateSlot", name, options];

// Each data template beside the code it replaces: the same boxes, written the same way.
const CASES: [string, NotationData, Notation[string], unknown[]][] = [
  [
    "StieltjesGamma",
    {
      traditional: [
        { params: ["n"], box: ["SubscriptBox", "γ", slot("n")] },
        { params: ["n", "x"], call: ["SubscriptBox", "γ", slot("n")] },
      ],
    },
    scalars(indexed("γ")),
    [
      ["StieltjesGamma", 2],
      ["StieltjesGamma", 1, "a"],
      ["StieltjesGamma", ["List", 1, 2]],
    ],
  ],
  [
    "BarnesG",
    { traditional: [{ params: ["z"], call: "G" }] },
    scalars(named("G", 1)),
    [
      ["BarnesG", ["Add", "z", 1]],
      ["BarnesG", 1, 2],
    ],
  ],
  [
    "ClausenCl",
    { traditional: [{ params: ["s", "z"], call: ["SubscriptBox", "Cl", slot("s")] }] },
    scalars(subscripted("Cl", 2)),
    [["ClausenCl", 2, "z"]],
  ],
  [
    "HarmonicNumber",
    {
      traditional: [
        { params: ["n"], box: ["SubscriptBox", "H", slot("n")] },
        {
          params: ["n", "r"],
          box: ["SuperscriptBox", ["SubscriptBox", "H", slot("n")], ["RowBox", ["(", slot("r"), ")"]]],
        },
      ],
    },
    scalars(([n, r, ...rest], write) => {
      if (n === undefined || rest.length > 0) return undefined;
      const base = subscript("H", write.box(n));
      return r === undefined ? base : superscript(base, fence("(", [write.box(r)], ")"));
    }),
    [
      ["HarmonicNumber", "n"],
      ["HarmonicNumber", 5, 2],
    ],
  ],
  [
    "RisingFactorial",
    {
      traditional: [
        { params: ["x", "n"], box: ["SuperscriptBox", slot("x", { Tight: true }), ["OverscriptBox", slot("n"), "‾"]] },
      ],
    },
    scalars(([x, n, ...rest], write) =>
      x === undefined || n === undefined || rest.length > 0
        ? undefined
        : superscript(write.tight(x), ["OverscriptBox", write.box(n), "‾"]),
    ),
    [["RisingFactorial", ["Add", "x", 1], 3]],
  ],
  [
    "DirichletCharacter",
    {
      traditional: [{ params: ["k", "j", "n"], call: ["SubscriptBox", "χ", ["RowBox", [slot("k"), ",", slot("j")]]] }],
    },
    scalars(([k, j, n, ...rest], write) =>
      k === undefined || j === undefined || n === undefined || rest.length > 0
        ? undefined
        : write.call(subscript("χ", row([write.box(k), ",", write.box(j)])), [n]),
    ),
    [["DirichletCharacter", 5, 2, "n"]],
  ],
];

test.each(CASES)("%s: data writes what its code did", (head, data, code, calls) => {
  expect(notationProblem(data)).toBeUndefined();
  const { traditional } = compileNotation(head, data);
  for (const call of calls) expect(tex(call, traditional)).toBe(tex(call, { [head]: code }));
});

test("a library's notation follows its definition to the head it is declared as", () => {
  const data: NotationData = {
    traditional: [{ params: ["x"], call: "S" }],
    latex: [{ trigger: "\\scaled", kind: "function" }],
  };
  const { traditional, latex } = compileNotation("bob_Scaled_f234", data);
  expect(tex(["bob_Scaled_f234", "x"], traditional)).toBe(tex(["S", "x"], {}));
  expect(latex).toEqual([{ name: "bob_Scaled_f234", latexTrigger: "\\scaled", kind: "function" }]);
});

test("a template uses its own params, and gives a box or a call", () => {
  expect(notationProblem({ traditional: [{ params: ["n"], box: ["SubscriptBox", "H", slot("m")] }] })).toBe(
    "a template uses m, which aren't among its params",
  );
  expect(notationProblem({ traditional: [{ params: ["n"] }] })).toBe("a template has one of box and call");
});
