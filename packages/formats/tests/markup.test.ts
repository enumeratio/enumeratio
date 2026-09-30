import { expect, test } from "vite-plus/test";
import { parseExpression } from "../src/expression.ts";
import { markupOf, readMarkupText, stripMetadata } from "../src/markup.ts";

const read = (text: string) => readMarkupText(text, { parseText: parseExpression });

test("an element is its head over its children, a text run its atoms", () => {
  expect(read("<Binomial>n 2</Binomial>")).toEqual({ json: ["Binomial", "n", 2], errors: [] });
  expect(
    read(`<Plot PlotRange="All">
      <Sin><Multiply>k x</Multiply></Sin>
      <Tuple>x 0 10</Tuple>
    </Plot>`).json,
  ).toEqual(["Plot", ["Sin", ["Multiply", "k", "x"]], ["Tuple", "x", 0, 10], ["KeyValuePair", "PlotRange", "All"]]);
});

// `<` can't sit in htm's (or JSX's) text, even in a string: it is written `\u003c`.
test("atoms: numbers, symbols, strings, verbatim symbols", () => {
  expect(read('<List>-1.5 1e3 100000000000000000001 x "a \\u003c b" `a b` _k</List>').json).toEqual([
    "List",
    -1.5,
    { num: "1e3" },
    { num: "100000000000000000001" },
    "x",
    "'a < b'",
    "a b",
    "_k",
  ]);
});

test("a childless element is a symbol; Apply spells a call with no arguments", () => {
  expect(read("<Add><NaN/> 1</Add>").json).toEqual(["Add", "NaN", 1]);
  expect(read("<Pi/>").json).toBe("Pi");
  expect(read("<Apply>Random</Apply>").json).toEqual(["Random"]);
  expect(read("<Apply><Random/></Apply>").json).toEqual(["Random"]);
  expect(read("<Apply><List>f g</List> x</Apply>").json).toEqual(["Apply", ["List", "f", "g"], "x"]);
});

test("slots are trailing pairs; a bare one is True; Epsil where one token won't do", () => {
  expect(read('<Plot Axes PlotRange="(-1, 1)">x</Plot>').json).toEqual([
    "Plot",
    "x",
    ["KeyValuePair", "Axes", "True"],
    ["KeyValuePair", "PlotRange", ["Tuple", -1, 1]],
  ]);
});

test("value holds the arguments, or with ToExpression the whole expression, as Epsil", () => {
  expect(read('<Binomial value="n, 2" />').json).toEqual(["Binomial", "n", 2]);
  expect(read('<ToExpression value="Sin(k * x)" />').json).toEqual(["Sin", ["Multiply", "k", "x"]]);
  expect(read("<ToExpression>2</ToExpression>").json).toBe(2);
});

test("a dotted tag is a member call, as Epsil's `.` parses it", () => {
  expect(read("<Stats.Mean><List>1 2 3</List></Stats.Mean>").json).toEqual(
    stripMetadata(parseExpression("Stats.Mean([1, 2, 3])").json),
  );
  expect(read("<a.b.C>x</a.b.C>").json).toEqual(stripMetadata(parseExpression("a.b.C(x)").json));
  expect(read("<Stats.Mean/>").json).toEqual(["Field", "Stats", "'Mean'"]);
});

test("reading needs no Epsil parser unless the markup has Epsil in it", () => {
  expect(readMarkupText("<Binomial>n 2</Binomial>").errors).toEqual([]);
  expect(readMarkupText('<Binomial value="n, 2" />').errors).toEqual([
    'markup: "[n, 2]" is Epsil, and no Epsil parser was given',
  ]);
});

test("what isn't FullForm is an error, not a guess", () => {
  expect(read("<Add>x+1</Add>").errors).toEqual(['markup: "x+1" isn\'t an atom (Epsil goes in a value attribute)']);
  expect(read('<Plot domain="0,10" />').errors).toEqual([
    'markup: <Plot> has "domain", which is neither a slot (PascalCase) nor value',
  ]);
  expect(read("<A/><B/>").errors).toEqual(["markup: expected one root element"]);
});

const ROUND_TRIPS: unknown[] = [
  ["Binomial", "n", 2],
  "Pi",
  2,
  "'hello'",
  ["Random"],
  ["Apply", ["List", "f", "g"], "x"],
  ["List", "'it\\'s \"quoted\" <b>{x} & `y`\n'", "a😀b→c", "x'", { num: "1.(3)" }, -0, 1e21],
  ["Plot", ["Sin", "x"], ["Tuple", "x", 0, 10], ["KeyValuePair", "PlotRange", "All"], ["KeyValuePair", "Axes", "True"]],
  ["Graph", ["List", 1, 2], ["KeyValuePair", "EdgeWeight", ["List", 1, 1]]],
  ["F", ["KeyValuePair", "A", 1], "x"],
  ["F", ["KeyValuePair", "A", 1], ["KeyValuePair", "A", 2]],
  ["MemberCall", ["Field", "a", "'b'"], "'C'", "x"],
  ["MemberCall", "Stats", "'Mean'"],
  ["ToExpression", "'x'"],
  [
    "Add",
    ["Multiply", ["Power", "x", 2], ["Sin", ["Divide", ["Multiply", "Pi", "x"], 4]]],
    ["Hypergeometric2F1", 1, 2, 3, "z"],
    1,
  ],
];

test.each(ROUND_TRIPS.map((e) => [JSON.stringify(e), e]))("round trip: %s", (_, expr) => {
  const markup = markupOf(expr);
  expect(readMarkupText(markup)).toEqual({ json: stripMetadata(expr), errors: [] });
});

test("the printer's spelling", () => {
  expect(markupOf(["Plot", ["Sin", "x"], ["Tuple", "x", 0, 10], ["KeyValuePair", "PlotRange", "All"]])).toBe(
    '<Plot PlotRange="All"><Sin>x</Sin> <Tuple>x 0 10</Tuple></Plot>',
  );
  expect(markupOf(["Random"])).toBe("<Apply>Random</Apply>");
  expect(markupOf("Pi")).toBe("<Pi />");
  expect(markupOf(["MemberCall", "Stats", "'Mean'", "xs"])).toBe("<Stats.Mean>xs</Stats.Mean>");
});
