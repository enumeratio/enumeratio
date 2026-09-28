import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { exportFormats, exportTo, getFormat, importFormats } from "../src/index.ts";
import { toMathML } from "../src/mathml.ts";

// The notation itself is `@enumeratio/boxes`' (its corpus and goldens); this is the format.
test("MathML: root element and display option", () => {
  expect(toMathML("x")).toBe('<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>');
  expect(toMathML("x", { display: "block" })).toBe(
    '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mi>x</mi></math>',
  );
});

test("MathML: registered as an export-only format", () => {
  const ce = new ComputeEngine();
  const format = getFormat("mathml");
  expect(format?.name).toBe("MathML");
  expect(exportFormats()).toContain("MathML");
  expect(importFormats()).not.toContain("MathML");
  expect(getFormat("MathMLForm")).toBe(format);
  expect(exportTo(ce.box(["Add", "x", 1]), "MathML")).toBe(
    '<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow></math>',
  );
  expect(exportTo(ce.parse("\\frac{x+1}{2}", { form: "raw" }), "MathML", { fragment: true })).toBe(
    "<mfrac><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow><mn>2</mn></mfrac>",
  );
});
