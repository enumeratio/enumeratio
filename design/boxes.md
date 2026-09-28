# Design: boxes

Status: **first slice landed** (`@enumeratio/boxes`: the primitives, MathML / LaTeX /
linear-text serialisers, a MathML reader, and `makeBoxes` for the core heads, which
`formats`' MathMLForm now runs through). Declaring the box heads in the engine, reading
boxes back into expressions, and moving the other printers onto boxes are next.

## Three things, not two

Wolfram keeps three kinds of thing apart, and so do we:

| layer      | what it is                                | analogue | ours                  |
| ---------- | ----------------------------------------- | -------- | --------------------- |
| string     | text in some language, one-dimensional    | source   | Epsil, LaTeX, MathML… |
| boxes      | the presentation tree: layout, no meaning | CST      | `Box`                 |
| expression | the meaning: heads applied to arguments   | AST      | MathJSON              |

An expression is the abstract tree -- `Add(x, 1)` has no parentheses, no operator glyph,
no notion of where it sits on a line. Boxes are the concrete one: Wolfram's front end
parses `a+b` into `RowBox[{"a", "+", "b"}]`, tokens and all, and `MakeExpression`
interprets that into `Plus[a, b]`. Output runs the other way: `MakeBoxes` decides the
notation, and the renderer draws the boxes. Everything that has to do with _how it
looks_ -- precedence and parentheses, which glyph, what goes above what -- is decided
once, on the way into boxes, and never again.

So the arrows between the layers are typed, and every function that crosses one says
which it is:

| arrow               | Wolfram                   | here                                   |
| ------------------- | ------------------------- | -------------------------------------- |
| expression → boxes  | `MakeBoxes`, `ToBoxes`    | `makeBoxes(json)`                      |
| boxes → string      | the front end, `ToString` | `toMathML`, `toLatex`, `toText`        |
| string → boxes      | the front-end parser      | `parseMathML` (Markdown, LaTeX: later) |
| boxes → expression  | `MakeExpression`          | later                                  |
| expression → string | `ToString[e, InputForm]`  | InputForm / `serializeExpression`      |

The `*Form` heads (`TraditionalForm`, `StandardForm`) pick _which_ `MakeBoxes` rules
apply; they never change the expression. `DisplayForm(boxes)` says "these are boxes,
draw them" instead of showing them as an expression.

## What a box is

A medium-independent layout tree -- closer to TeX's box model than to either HTML or
MathML, though it realises into both. The math boxes map one-to-one onto MathML Core,
which every current engine renders natively (Chromium since 109; Firefox and WebKit
long before); the layout and text boxes map onto a small HTML/CSS subset. The same tree
realises as LaTeX (for MathLive, KaTeX, print), as Markdown (below) and as text (a
terminal, a pipe).

| box                  | MathML                   | LaTeX                   | text          |
| -------------------- | ------------------------ | ----------------------- | ------------- |
| a string             | `mi` / `mn` / `mo`       | the token               | the token     |
| `TextBox`            | `mtext` (`ms` if quoted) | `\text{…}`              | the text      |
| `RowBox`             | `mrow`                   | juxtaposed              | juxtaposed    |
| `SuperscriptBox`     | `msup`                   | `^{…}`                  | `^`           |
| `SubscriptBox`       | `msub`                   | `_{…}`                  | `_`           |
| `SubsuperscriptBox`  | `msubsup`                | `_{…}^{…}`              | `_ ^`         |
| `OverscriptBox`      | `mover`                  | `\overset`, `\overline` | `^`, overline |
| `UnderscriptBox`     | `munder`                 | `\underset`, limits     | `_`           |
| `UnderoverscriptBox` | `munderover`             | limits                  | `_ ^`         |
| `FractionBox`        | `mfrac`                  | `\frac`, `\genfrac`     | `a/b`         |
| `SqrtBox`            | `msqrt`                  | `\sqrt`                 | `√`           |
| `RadicalBox`         | `mroot`                  | `\sqrt[n]`              | `^(1/n)`      |
| `GridBox`            | `mtable`                 | `matrix`, `cases`       | nested lists  |
| `StyleBox`           | `mstyle`                 | `\textcolor`, `\bm`     | the text      |
| `FrameBox`           | `mrow` with a CSS border | `\boxed`                | the text      |
| `InterpretationBox`  | `semantics` + annotation | the display             | the display   |
| `TagBox`             | `semantics` + annotation | the display             | the display   |
| `ErrorBox`           | `merror`                 | red                     | the text      |

The names are Wolfram's. Where the shape is Wolfram's too, it is kept -- `RowBox` takes a
list, `GridBox` a list of rows, options are trailing rules (`FractionLine -> False`) --
so `ToBoxes[e, TraditionalForm]` from a Wolfram kernel can be compared with ours
directly. Wolfram's own output wraps TraditionalForm in `FormBox` and leans on
`TemplateBox` (a binomial is `TemplateBox[{n, k}, "Binomial"]`); we produce the
expanded boxes, and `TemplateBox` is later.

Still to come: `AdjustmentBox`, `PaneBox`, `PanelBox` (spacing and layout), `TooltipBox`,
`ButtonBox`, `DynamicBox`, `TemplateBox` (a named notation with its display function),
`GraphicsBox` (SVG), and prose (below).

### Leaves

A leaf is a string: a token. Its class -- identifier, number, operator -- is read off
the string by one lexer (`tokenClass`), the way Wolfram's front end and MathML's operator
dictionary do it: digits are a number, a letter (or `∞`, `∅`, `°`) starts an identifier,
anything else is an operator. Serialisers and the MathML reader use the same lexer, so a
leaf survives the round trip. Foreign MathML that insists on `<mi>2</mi>` loses that
insistence.

Literal text is not a quoted string. Wolfram writes it `"\"otherwise\""` -- a string
whose content starts with a quote -- which is the ambiguity every reader of boxes trips
on. Here it is `TextBox("otherwise")`, and a string _value_ shown with its quotes is
`TextBox("hello", ShowStringCharacters -> True)`. `TextBox` is our only name without a
Wolfram precedent.

### The link back to meaning

`InterpretationBox(boxes, expr)` shows `boxes` and means `expr`: whatever the notation,
reading it back gives exactly `expr`. `TagBox(boxes, tag)` is the lighter hint -- "read
these boxes as a `Piecewise`" -- for notations a reader could parse with help. Both are
`<semantics>` in MathML, the annotation carrying the MathJSON or the tag.

This is also where the box tree meets the vdom. The vdom (`design/vdom.md`) is the
_expression's_ tree: one element per head. Boxes are what an element draws inside
itself. The two meet at `InterpretationBox`: a hover on `<notatio-sin>` can find its
boxes in the output because they carry it, instead of the TreeForm folding
`<notatio-out>` does today.

A box tree is also what a structural editor edits. MathLive's atoms are one (not a
public API); Mathematica's input cells are boxes. A contentEditable math editor over
boxes, parsing to an expression on the way out, is where the `string → boxes →
expression` arrows lead. Not this slice.

## Prose, and Markdown

Boxes are not only for formulas. Wolfram's documents are boxes all the way up: a
paragraph is `Cell[TextData[{…}], "Text"]`, the runs in it are strings and `StyleBox`es,
a link is a `ButtonBox`, and a formula inside a sentence is just another box in the
run. Larger documents need the same, so prose gets primitives of its own: a block
(`Cell`, with a style -- `"Text"`, `"Section"`, `"Item"`, `"Code"`), inline runs
(`TextData`), emphasis and code as `StyleBox` options, links as `ButtonBox`.

**Markdown is a target and a source.** It is the conservative text form of those
primitives:

- **Out**: boxes → Markdown. Prose boxes become CommonMark; a formula becomes a
  `$…$` island (`toLatex`) inline, `$$…$$` on its own line for display. GitHub, VitePress
  and Observable all read that.
- **In**: a small subset -- paragraphs, headings, emphasis and strong, code spans and
  fences, lists, links, block quotes, `$…$` / `$$…$$` math -- parses to prose boxes.
  Nothing outside the subset (raw HTML, tables at first) is accepted; the subset grows
  by adding a primitive, never by passing markup through.

**Live documents.** The prose template of a prose-mode Manipulate (`prose.ts`: `{k}` a
knob, `{2 * _k + 1}` a readout, `$…$` typeset) is already this idea at paragraph scale.
In boxes, a readout is a `DynamicBox(expr)` and a knob a control box in the run, so a
Markdown document with holes is an Observable-style notebook: its prose, formulas and
controls are one box tree, drawn by whichever renderer the environment has
(`design/rendering-environments.md` -- a pipe pins the controls, a page drives them).
The hole syntax is the prose template's, carried over rather than reinvented.

## Representation

In TypeScript a box is plain JSON in Wolfram's FullForm shape: `string | [head, ...]`,
lists as arrays, options as a trailing object:

```ts
["RowBox", [["SuperscriptBox", "x", "2"], "+", ["FractionBox", ["SqrtBox", "y"], "3"]]];
["FractionBox", "n", "k", { FractionLine: false }];
```

That is not MathJSON -- in MathJSON an array is an application and a bare string a
symbol -- so `toMathJson` / `fromMathJson` convert at the boundary: strings become
`{str}`, lists `List`, options `KeyValuePair` rules (read back through `boxed`'s
`optionsOf`). `InterpretationBox`'s second argument is an expression already and crosses
unchanged.

## Where it sits

`@enumeratio/boxes` depends on compute-engine's types and nothing else at runtime -- no
engine, no DOM -- so it serves Node and the browser alike. `formats` depends on it:
MathMLForm is `toMathML(makeBoxes(json))`, and its goldens (moved into `boxes` with the
corpus) are the parity proof that the port changed nothing. A box serialiser is one more
kind of format -- which is what Wolfram's `DisplayForm` is.

## Next

1. **Declare the box heads** as inert heads of a nominal type (`ce.declareType`), so a
   signature can say `(expression) -> boxes` and `ToBoxes`, `MakeBoxes`, `DisplayForm`
   and `RawBoxes` work in a cell. `InterpretationBox` holds its expression.
2. **Boxes → expression.** `MakeExpression` for what `makeBoxes` produces (the tokens in
   a `RowBox` are Epsil's), `InterpretationBox` exact, `TagBox` guided.
3. **Notation as data.** `traditional.ts`'s LaTeX dictionary entries become `makeBoxes`
   rules declared per head, and TeX export becomes `toLatex(makeBoxes(…))`.
4. **Formatting constructs** -- `Row`, `Column`, `Grid`, `Labeled`, `Panel`,
   `Superscript` -- become `makeBoxes` rules to the layout boxes, and their elements
   render the boxes.
5. **Prose and Markdown**: `Cell`, `TextData`, `ButtonBox`, `DynamicBox`; `toMarkdown`
   and the subset reader; the prose template moved onto them.
6. **Two-dimensional text** for the terminal, and `GraphicsBox` for the glyphs and plots.
7. **The Wolfram oracle**: compare `makeBoxes` with `ToBoxes[_, TraditionalForm]` once
   `TemplateBox` and `FormBox` are understood on our side.
