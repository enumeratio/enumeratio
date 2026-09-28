# The `<Head>` syntax needs a canonical form

Status: **speculative**. Nothing here is decided or built.

The `<Head>` syntax (design/vdom.md) is the same tree as a MathJSON expression under a
renaming: heads are tags, arguments are children, options are attributes. For a given
expression, though, it can be written more than one way:

- an argument of a fixed-signature head can be a child or a named attribute
  (`<Binomial>n, 2</Binomial>` or `<Binomial n="n" k="2" />`);
- atoms can be leaf tags (`<Integer value="2" />`) or bare text inside the parent;
- options can come in any order, and keys can be spelled in more than one case;
- a run of atom children can be written one per element or comma-joined.

So "one to one with MathJSON" holds only after canonicalising both sides. Pinned markup
(component stories, reference examples), diffs and round-trip tests all want one spelling.

## What a canonical form would say

- **Direction:** from the MathJSON form (`ce.box(expr).json`, where options are already
  `Tuple`s) to markup, deterministically. The parser accepts every spelling; the printer
  emits one.
- **Named arguments:** a rule for when a positional argument is lifted into a named
  attribute, e.g. always for a head whose signature names its parameters and whose
  documentation writes them by name, and never otherwise. The signature decides, not the
  author.
- **Ordering:** attributes in signature order for named arguments, then options in a
  fixed order (declaration order in `optionsOf`, or alphabetical; pick one).
- **Atoms:** the short spelling (comma-joined text) wherever the children are all atoms,
  and leaf tags otherwise.
- **Names:** Vue/React names (`BarChart3D`) as the canonical tag spelling, with the lit
  tag (`notatio-bar-chart-3d`) as the web-component rendering of the same tree.

## Where it would live

- A `canonicalMarkupOf(expr)` next to `structuralOf` in packages/frontend/src/vdom.ts
  (browser-safe), replacing the story generator's `structuralMarkupOf`. Its inverse is a
  parser from markup to MathJSON.
- A round-trip test: `parse(canonicalMarkupOf(expr))` equals `expr` over every reference
  example and component story.

## Open questions

- Does canonical form belong to the engine (a canonical MathJSON with named arguments)
  or only to the printer?
- How much of Wolfram's own `FullForm`/`InputForm` ordering should it follow?
