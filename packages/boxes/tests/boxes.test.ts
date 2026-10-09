import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, expect, test } from "vite-plus/test";
import {
  type Box,
  fraction,
  frame,
  fromMathJson,
  interpretation,
  isBox,
  makeBoxes,
  row,
  style,
  tag,
  text,
  tokenClass,
  toMathJson,
} from "../src/index.ts";
import { exprOfData, MathMLSyntaxError, parseMathML, toLatex, toMathML, toAscii, toText } from "../src/render/index.ts";
import { CORPUS } from "./corpus.ts";

// Goldens are committed JSON compared with `toEqual`, never snapshots. Regenerate with
// `UPDATE_BOXES=1 vp test` after an intended change, then `vp check --fix`.
const MATHML = fileURLToPath(new URL("./mathml.golden.json", import.meta.url));
const BOXES = fileURLToPath(new URL("./boxes.golden.json", import.meta.url));
const updating = process.env.UPDATE_BOXES === "1";
const read = (path: string): Record<string, unknown> => (updating ? {} : JSON.parse(readFileSync(path, "utf8")));
const mathmlGolden = read(MATHML);
const boxesGolden = read(BOXES);
const freshMathml: Record<string, unknown> = {};
const freshBoxes: Record<string, unknown> = {};

/** Every open tag is closed, in order -- the cheap well-formedness check node lacks. */
function assertBalanced(xml: string, label: string): void {
  const stack: string[] = [];
  for (const m of xml.matchAll(/<(\/?)([a-z]+)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) expect(stack.pop(), `${label}: closing </${m[2]}>`).toBe(m[2]);
    else stack.push(m[2]);
  }
  expect(stack, `${label}: unclosed tags`).toEqual([]);
  expect(xml.replace(/<[^>]*>/g, ""), `${label}: unescaped text`).not.toMatch(
    /[<>]|&(?!#x?[0-9a-f]+;|amp;|lt;|gt;|quot;)/i,
  );
}

for (const [name, json] of Object.entries(CORPUS)) {
  test(`boxes: ${name}`, () => {
    const boxes = makeBoxes(json);
    expect(isBox(boxes)).toBe(true);
    const mathml = toMathML(boxes, { fragment: true });
    assertBalanced(mathml, name);

    // The serialisers and the reader share one lexer, so MathML reads back exactly.
    expect(parseMathML(mathml)).toEqual(boxes);
    // And the MathJSON encoding round-trips.
    expect(fromMathJson(toMathJson(boxes))).toEqual(boxes);

    const record = { boxes, latex: toLatex(boxes), text: toText(boxes), ascii: toAscii(boxes) };
    if (updating) {
      freshMathml[name] = { json, mathml };
      freshBoxes[name] = record;
      return;
    }
    expect({ json, mathml }).toEqual(mathmlGolden[name]);
    expect(record).toEqual(boxesGolden[name]);
  });
}

test("tokenClass reads a leaf's class off its text", () => {
  expect(["x", "sin", "∞", "ℝ", "", "Γ"].map(tokenClass)).toEqual(Array(6).fill("identifier"));
  expect(["2", "3.25", "1.", ".5"].map(tokenClass)).toEqual(Array(4).fill("number"));
  expect(["+", "−", "(", "⁢", "∑", "!!"].map(tokenClass)).toEqual(Array(6).fill("operator"));
});

test("layout and semantic boxes round-trip through MathML", () => {
  const boxes: Box[] = [
    frame(row(["x", "+", "1"])),
    style("x", { FontColor: "red", FontWeight: "Bold" }),
    interpretation(row(["F", "⁢", "n"]), ["Fibonacci", "n"]),
    tag(fraction("n", "k", { FractionLine: false }), "Binomial"),
    text("a < b & c", { ShowStringCharacters: true }),
  ];
  for (const box of boxes) {
    expect(parseMathML(toMathML(box))).toEqual(box);
    expect(fromMathJson(toMathJson(box))).toEqual(box);
  }
});

test("MathJSON encoding is what Epsil would write", () => {
  expect(toMathJson(fraction("n", "k", { FractionLine: false }))).toEqual([
    "FractionBox",
    { str: "n" },
    { str: "k" },
    ["KeyValuePair", "FractionLine", "False"],
  ]);
  expect(toMathJson(row(["a", "+", "b"]))).toEqual(["RowBox", ["List", { str: "a" }, { str: "+" }, { str: "b" }]]);
});

test("reads foreign MathML: whitespace, inferred rows, namespaces, references", () => {
  const source = `<?xml version="1.0"?>
    <m:math xmlns:m="http://www.w3.org/1998/Math/MathML">
      <m:msqrt> <m:mi> x </m:mi> <m:mo>&#x2B;</m:mo> <m:mn>1</m:mn> </m:msqrt>
    </m:math>`;
  expect(parseMathML(source)).toEqual(["SqrtBox", ["RowBox", ["x", "+", "1"]]]);
});

test("malformed MathML throws MathMLSyntaxError", () => {
  expect(() => parseMathML("<mrow><mi>x</mrow>")).toThrow(MathMLSyntaxError);
  expect(() => parseMathML("<msup><mi>x</mi></msup>")).toThrow(MathMLSyntaxError);
});

test("an interpretation keeps its expression on the typeset node when asked, base64url so TeX and KaTeX leave it be", () => {
  const expr = ["Plus", { str: "a, b = %" }, 1];
  const box = interpretation(row(["x", "+", "1"]), expr as never);
  expect(toLatex(box)).toBe("x+1");
  const written = toLatex(box, { data: true });
  const value = /^\\htmlData\{expr=([A-Za-z0-9_-]+)\}\{x\+1\}$/.exec(written)?.[1];
  expect(value).toBeDefined();
  expect(exprOfData(value!)).toEqual(expr);
});

test("a huge interpretation is left off the typeset node, and malformed data decodes to nothing", () => {
  const big = interpretation(row(["x"]), ["List", ...Array.from({ length: 20000 }, (_, i) => i)] as never);
  expect(toLatex(big, { data: true })).toBe("x");
  expect(exprOfData("not base64!")).toBeUndefined();
  expect(exprOfData("AAAA")).toBeUndefined();
});

afterAll(() => {
  if (!updating) return;
  writeFileSync(MATHML, `${JSON.stringify(freshMathml, null, 2)}\n`);
  writeFileSync(BOXES, `${JSON.stringify(freshBoxes, null, 2)}\n`);
});
