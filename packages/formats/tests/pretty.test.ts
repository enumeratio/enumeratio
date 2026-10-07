import { expect, test } from "vite-plus/test";
import { parseExpression } from "../src/expression.ts";
import { prettyEpsil, readMarkupText, sourceMarkupOf, stripMetadata } from "../src/markup.ts";

const parse = (text: string) => parseExpression(text);
const SHOW = `Labeled(
  Show(
    LatticeTiles(QuadraticIntegers(_d), ColorRules -> [IsPrime -> ColorData(["Dusk", [0, 10]])(Sqrt(Abs(Norm))), IsUnit -> White]),
    GridLines -> [10, 10], Axes -> True, Selection -> _s),
  StringTemplate("Primes of $\\\\sqrt{_d}$, d = {_d}."),
  Bottom,
  Variables -> [_d -> Variable(Integers, -5, Where -> IsSquareFree && !IsSquare), _s -> []])`;

test("source markup reads back as the expression it prints", () => {
  const json = stripMetadata(parse(SHOW).json);
  const markup = sourceMarkupOf(json, { width: 80 });
  expect(markup).toContain("<StringTemplate>Primes of $\\sqrt{_d}$, d = {_d}.</StringTemplate>");
  expect(markup).toContain("<QuadraticIntegers>_d</QuadraticIntegers>");
  const back = readMarkupText(markup, { parseText: parse });
  expect(back.errors).toEqual([]);
  expect(stripMetadata(back.json)).toEqual(json);
});

test("pretty Epsil keeps names as written, fits its width, and reads back", () => {
  const json = stripMetadata(parse(SHOW).json);
  const text = prettyEpsil(json, { width: 80 });
  expect(text).toContain("IsPrime -> ColorData");
  expect(text).toContain(")(Sqrt(Abs(Norm)))");
  for (const line of text.split("\n")) expect(line.length).toBeLessThanOrEqual(100);
  expect(stripMetadata(parse(text).json)).toEqual(json);
});
