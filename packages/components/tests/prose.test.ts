import { expect, test } from "vite-plus/test";
import { parseHoleOptions, parseProse } from "../src/prose.ts";

const NAMES = new Set(["k", "a"]);

test("a declared name is a knob and anything else in braces is a readout", () => {
  expect(parseProse("with {k}, crossing {2 _k + 1} times", NAMES)).toEqual([
    { kind: "text", text: "with " },
    { kind: "knob", name: "k", options: {} },
    { kind: "text", text: ", crossing " },
    { kind: "dynamic", value: "2 _k + 1", options: {} },
    { kind: "text", text: " times" },
  ]);
});

test("options ride after a bar; a bare word is a boolean attribute", () => {
  expect(parseProse("{k | axis=y play}{N(_a) | digits=4}", NAMES)).toEqual([
    { kind: "knob", name: "k", options: { axis: "y", play: "" } },
    { kind: "dynamic", value: "N(_a)", options: { digits: "4" } },
  ]);
  expect(parseHoleOptions("  play  sensitivity=4 ")).toEqual({ play: "", sensitivity: "4" });
});

test("dollar islands are typeset and braces inside them are not holes", () => {
  expect(parseProse("the curve $\\sin(kx)$ here", NAMES)).toEqual([
    { kind: "text", text: "the curve " },
    { kind: "tex", latex: "\\sin(kx)" },
    { kind: "text", text: " here" },
  ]);
  expect(parseProse("$\\frac{a}{b}$", NAMES)).toEqual([{ kind: "tex", latex: "\\frac{a}{b}" }]);
});

test("nested braces in a readout stay whole, and unbalanced ones stay text", () => {
  expect(parseProse("{At({1,2,3}, _k)}", NAMES)).toEqual([
    { kind: "dynamic", value: "At({1,2,3}, _k)", options: {} },
  ]);
  expect(parseProse("a { b", NAMES)).toEqual([{ kind: "text", text: "a { b" }]);
  expect(parseProse("costs $5", NAMES)).toEqual([{ kind: "text", text: "costs $5" }]);
});

test("a backslash escapes a brace or a dollar", () => {
  expect(parseProse("set \\{1\\} costs \\$5", NAMES)).toEqual([
    { kind: "text", text: "set {1} costs $5" },
  ]);
});
