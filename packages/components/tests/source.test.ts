import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { afterAll, expect, test } from "vite-plus/test";
import { splitHead, stripHead } from "../src/heads.ts";
import { editorLatexOf, toEditorLatex } from "../src/source.ts";

// What an author writes in a `value` attribute, and what the math field is handed for
// it. The corpus is the shapes the docs actually use: library heads the engine has not
// heard of, list arguments, strings, subscripts, a wrapper head, an island, a binding.
const CORPUS = [
  "IntegerDigits(93784, MixedRadix([24, 60, 60]))",
  "FromDigits([1, 2, 3, 4], MixedRadix([24, 60, 60]))",
  "At(SymmetricGroup(4), 6)",
  "CircleTimes(f_1, f_2, f_1, f_2)",
  "CircleTimes(theta_2, theta_1)",
  'LorenzBraid("LLRLR")',
  "1 / 2 + 1 / 3",
  "Integrate(x ^ 2, (x, 0, 1))",
  "Sin(x) * Cos(y)",
  "x^2 - y^2",
  "Binomial(n, k) + Sin(x)",
  "Zeta(3)",
  "N(Zeta(3))",
  "TraditionalForm(Binomial(10, 3))",
  "$\\frac{1}{2}$ + Sqrt(2)",
  "{1, 2, 3}",
  "HurwitzZeta(s, a)",
];

const ce = new ComputeEngine();
// The docs engine has every library declared; an undeclared head parses back from LaTeX
// as a product (`\mathrm{Foo}(x)` is `Foo * x`), in either spelling, so the corpus's
// library heads are declared here the way the site would.
for (const head of ["MixedRadix", "SymmetricGroup", "LorenzBraid", "HurwitzZeta"]) {
  ce.declare(head, "(any*) -> any");
}

/** What the notatio means, for comparing against what its LaTeX means. */
const meaning = (src: string): unknown =>
  ce.box(parseNotatio(src, { parseLatex: (tex) => ce.parse(tex).json }).json).json;

// Golden JSON compared with `toEqual`, never a snapshot (see AGENTS.md). Regenerate with
// `UPDATE_SOURCE=1 vp test` after an intended change.
const GOLDEN = fileURLToPath(new URL("./source.golden.json", import.meta.url));
const updating = process.env.UPDATE_SOURCE === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

for (const src of CORPUS) {
  test(`editor LaTeX: ${src}`, () => {
    const result = toEditorLatex(ce, src);
    if (updating) {
      fresh[src] = result;
      return;
    }
    expect(result).toEqual(golden[src]);
  });

  // The LaTeX is what the Out evaluates, so it has to mean what the notatio meant. A
  // wrapper head is read off before either side reaches the engine, so it is read off here.
  test(`editor LaTeX round-trips: ${src}`, () => {
    const { latex, errors } = toEditorLatex(ce, src);
    expect(errors).toEqual([]);
    expect(ce.parse(stripHead(latex)).json).toEqual(meaning(stripHead(src)));
  });
}

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, JSON.stringify(fresh, null, 2) + "\n");
});

test("a wrapper head survives the conversion, in a spelling splitHead reads", () => {
  const { latex } = toEditorLatex(ce, "TraditionalForm(Binomial(10, 3))");
  expect(splitHead(latex).head).toEqual("TraditionalForm");
  expect(splitHead(toEditorLatex(ce, "N(Zeta(3))").latex).head).toEqual("N");
});

test("a binding is a statement, let through only when asked", () => {
  expect(toEditorLatex(ce, "s := 2").errors).toEqual(["notatio: Assign is not allowed"]);
  const bound = toEditorLatex(ce, "s := 2", { assign: true });
  expect(bound.errors).toEqual([]);
  expect(ce.parse(bound.latex).json).toEqual(["Assign", "s", 2]);
});

test("what will not parse reports why and hands the editor nothing", () => {
  const { latex, errors } = toEditorLatex(ce, "Sin(x");
  expect(latex).toEqual("");
  expect(errors.length).toBeGreaterThan(0);
  expect(toEditorLatex(ce, "   ")).toEqual({ latex: "", errors: [] });
});

test("in-form=latex is the escape hatch: the source is the LaTeX", () => {
  expect(editorLatexOf(ce, "latex", "\\operatorname{Foo}(x)")).toEqual({
    latex: "\\operatorname{Foo}(x)",
    errors: [],
  });
  expect(editorLatexOf(ce, "notatio", "Sin(x)").latex).toEqual(toEditorLatex(ce, "Sin(x)").latex);
});
