# @enumeratio/boxes

Wolfram-style box primitives: the presentation tree between an expression and its
rendering. Plain JSON in Wolfram's `FullForm` shape — a leaf is a string token, a node is
`[head, ...args]` — with MathML, LaTeX, plain-text, AsciiMath, and Markdown-prose
serialisers, plus the reverse readers for MathML and Markdown. [`formats`](../formats/README.md)
builds its MathMLForm and AsciiMath on this package; the reference build uses it for
inline math in prose.

## Entry points

- `makeBoxes(json)` — `MakeBoxes`: an expression's traditional notation, as boxes. Pure
  function of the MathJSON tree (no engine, no canonicalization); parenthesization is
  precedence-driven, every node reporting how tightly it binds.
- `toLatex`, `toMathML`/`parseMathML`, `toText`/`toAscii` — boxes to LaTeX (for MathLive
  and KaTeX), to and from presentation MathML, to plain text and AsciiMath.
- `toMathJson`/`fromMathJson` — boxes as MathJSON, round-tripping.
- `readMarkdown`/`toMarkdown`, `texSource`, `closeDollar` — a small Markdown-as-prose-boxes
  pass: a `$…$` island held as `FormBox(tex, "TeXForm")`, `${…}` holes found by scanning
  running text and TeX alike.
- `declareBoxes` — declares the box heads (`RowBox`, `FractionBox`, `SuperscriptBox`, …)
  as compute-engine heads, typed and described from this package's own
  `reference/<Head>/` records; an evaluated box is itself.

## Usage

```ts
import { makeBoxes, toAscii, toLatex, toText } from "@enumeratio/boxes";

const boxes = makeBoxes(["Power", "x", 2]); // ["SuperscriptBox", "x", "2"]
toLatex(boxes); // "x^2"
toText(boxes); // "x²"
toAscii(boxes); // "x^2"
```

## Where to go next

- [Boxes](https://github.com/enumeratio/enumeratio/wiki/Boxes) — the design: what a box is, the
  head set, and the MakeExpression direction not yet built.
- [`formats`](../formats/README.md) — MathMLForm, AsciiMath, and the rest of the format registry
  built on this package.
- `reference/` — one folder per box head (`FractionBox`, `GridBox`, `StyleBox`, …), the
  source `declareBoxes` reads.
