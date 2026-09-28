import { expect, test } from "vite-plus/test";
import { escapeHtml, matchInlineMath, renderProseMath } from "./prose-math.ts";

// Cases below are taken from real reference records (see git blame on the same commit):
// TimeConstrained.yaml's `$Aborted` was a genuine bug -- a lone Wolfram-style system
// symbol sitting next to real inline math confused the old regex into pairing across
// both, leaving a mis-typeset span and a stray `$`. LambertW/examples.tsv and
// HeavisideTheta.yaml exercise prose that must NOT be mistaken for math or markup.

test("plain text with no `$` passes through HTML-escaped, unchanged otherwise", () => {
  expect(renderProseMath("Evaluates expr, but aborts after t seconds and returns failexpr.")).toEqual(
    "Evaluates expr, but aborts after t seconds and returns failexpr.",
  );
});

test("a single inline span becomes a notatio-out element", () => {
  expect(renderProseMath("The gamma function $\\Gamma(z)$, extending the factorial.")).toEqual(
    'The gamma function <notatio-out inline format="latex" value="\\Gamma(z)"></notatio-out>, extending the factorial.',
  );
});

test("an escaped `\\$` is a literal dollar sign, not a math delimiter", () => {
  // TimeConstrained.yaml, signatures[0].description, after the fix: the leading Wolfram
  // symbol is escaped so it no longer pairs with the real `$t$` that follows.
  expect(renderProseMath("aborts to \\$Aborted past $t$ seconds.")).toEqual(
    'aborts to $Aborted past <notatio-out inline format="latex" value="t"></notatio-out> seconds.',
  );
});

test("an un-escaped lone `$` next to real math mis-pairs (the TimeConstrained bug, unfixed)", () => {
  // What was actually in the repo before the fix. Kept as a regression fixture: it
  // documents the failure mode rather than asserting it's fine.
  expect(renderProseMath("aborts to $Aborted past $t$ seconds.")).toEqual(
    'aborts to <notatio-out inline format="latex" value="Aborted past $t"></notatio-out> seconds.',
  );
});

test("a lone `$` with no partner (a Wolfram system symbol, or a dollar amount) stays literal", () => {
  // Assuming/index.md's `$Assumptions`, and Negate/examples.tsv's "$42.50" -- both correct
  // as plain text today, and must stay that way.
  expect(renderProseMath("consult $Assumptions (Simplify, FullSimplify, Refine)")).toEqual(
    "consult $Assumptions (Simplify, FullSimplify, Refine)",
  );
  expect(renderProseMath("Recording a $42.50 charge as a negative balance adjustment")).toEqual(
    "Recording a $42.50 charge as a negative balance adjustment",
  );
});

test("display math `$$…$$` renders as a display notatio-out", () => {
  expect(renderProseMath("The identity: $$a^2 + b^2 = c^2$$ holds.")).toEqual(
    'The identity: <notatio-out display format="latex" value="a^2 + b^2 = c^2"></notatio-out> holds.',
  );
});

test("bare `<`/`>` in prose (inequalities, generic types) is HTML-escaped, not read as markup", () => {
  // HeavisideTheta.yaml's summary.
  expect(renderProseMath("The Heaviside step function: 0 for x < 0, 1 for x > 0.")).toEqual(
    "The Heaviside step function: 0 for x &lt; 0, 1 for x &gt; 0.",
  );
  // PermutahedronVertex.yaml: without escaping, a browser's HTML parser reads `<list<integer>`
  // as a bogus tag and swallows everything up to the next `>` -- confirmed by hand against
  // the unescaped string, which comes back from the DOM as "tuple, integer>".
  expect(renderProseMath("`tuple<list<integer>, integer>`")).toEqual("`tuple&lt;list&lt;integer&gt;, integer&gt;`");
});

test("`&` in prose is escaped so it can't be read as an entity", () => {
  expect(renderProseMath("Q & A")).toEqual("Q &amp; A");
});

test("braces inside math are preserved through entity-escaping (round-trips in the browser)", () => {
  expect(renderProseMath("$\\sqrt{-1}$")).toEqual(
    '<notatio-out inline format="latex" value="\\sqrt&#123;-1&#125;"></notatio-out>',
  );
});

test("matchInlineMath rejects `${…}` (Manipulate's template placeholder) and `$params`", () => {
  expect(matchInlineMath("a ${x} b", 2)).toBeUndefined();
  expect(matchInlineMath("see $params here", 4)).toBeUndefined();
});

test("escapeHtml escapes the three characters that matter for v-html text content", () => {
  expect(escapeHtml("<a> & </a>")).toEqual("&lt;a&gt; &amp; &lt;/a&gt;");
});
