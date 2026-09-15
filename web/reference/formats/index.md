# Formats

Every syntax an expression can arrive in and every form it can come back out as, with
worked examples and the footguns each one carries.

## InputForm

- [InputForm](/reference/formats/inputform) — an expression printed as notatio you
  could have typed. What the components copy out, what the REPL prints, and the
  `InputForm` entry in any Out menu.

## Input syntax

The ways to write an expression.

- [MathJSON](/reference/formats/mathjson) — the expression AST; the most explicit input,
  and what every other form parses into.
- [LaTeX](/reference/formats/latex) — compute-engine's default text input (`ce.parse`).
- [AsciiMath](/reference/formats/asciimath) — a note on where it fits (compute-engine
  emits it, but does not yet parse it).

notatio itself — the restricted-Epsil subset the components take in their expression
attributes — is documented with the components, in the
[component reference](/reference/components/); printing an expression back out
as notatio is [InputForm](/reference/formats/inputform).

## Output syntax

The mirror image — the forms an expression comes back out in (the form selector on any
output cell), including code forms whose translations carry footguns.

- [Output syntax overview](/reference/formats/output/) — display, text and code forms.
- [MathML](/reference/formats/output/mathml) — presentation MathML, the one text form with
  a page of its own because it is export-only: nothing parses it back.
- Code forms (a language each, with an editable try-it cell + footguns):
  [Wolfram FullForm](/reference/formats/output/wolfram), [NumPy](/reference/formats/output/numpy),
  [GLSL](/reference/formats/output/glsl), [WGSL](/reference/formats/output/wgsl),
  [JavaScript](/reference/formats/output/javascript).

## Not here

These pages are about representing an **expression** — the syntax it is written in and
the forms it comes back out in. Representing a **number** is a different question with
its own guide: [numeral systems](/guide/numerals/) covers what goes in the base slot of
`IntegerDigits`, from mixed radix to Zeckendorf to residue systems.
