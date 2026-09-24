import { expect, test } from "vite-plus/test";
import { parseNotatio, serializeNotatio } from "../src/notatio.ts";
import { isOptionList, optionsOf, ruleOf, withOptions } from "@enumeratio/boxed";

const parse = (src: string) => parseNotatio(src).json;

test("trailing rules are options, bare or in lists, and the leftmost setting wins", () => {
  const { ops, options } = optionsOf(
    parse("Plot(Sin(x), (x, 0, 10), PlotRange -> (-1, 1), [Frame -> True, PlotRange -> All])"),
  );
  expect(ops.map((o) => serializeNotatio(o))).toEqual(["Sin(x)", "(x, 0, 10)"]);
  expect(Object.keys(options)).toEqual(["PlotRange", "Frame"]);
  expect(serializeNotatio(options.PlotRange)).toBe("(-1, 1)");
  expect(serializeNotatio(options.Frame)).toBe("True");
});

test("a rule before a positional argument is data, not an option", () => {
  const { ops, options } = optionsOf(parse("F(a -> 1, x, b -> 2)"));
  expect(ops.length).toBe(2);
  expect(Object.keys(options)).toEqual(["b"]);
});

test("the canonical Tuple a rule becomes still reads as one, an iterator does not", () => {
  expect(ruleOf(["Tuple", "PlotRange", 1] as never)?.name).toBe("PlotRange");
  expect(ruleOf(["Tuple", "x", 0, 10] as never)).toBeUndefined();
  expect(ruleOf(["Tuple", "x", 0] as never)).toBeUndefined(); // a lower-case first entry is a point
  expect(ruleOf(["KeyValuePair", "'Epilog'", ["Point", 0]] as never)?.name).toBe("Epilog");
  expect(isOptionList(parse("[a -> 1, [b -> 2]]"))).toBe(true);
  expect(isOptionList(parse("[1, 2]"))).toBe(false);
});

test("options are written back as trailing rules, and round-trip", () => {
  const expr = withOptions("Plot", [parse("Sin(x)")], { PlotRange: parse("All") });
  expect(serializeNotatio(expr)).toBe("Plot(Sin(x), PlotRange -> All)");
  expect(Object.keys(optionsOf(expr).options)).toEqual(["PlotRange"]);
});
