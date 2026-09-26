# Design: components and symbols

Split from design/components-and-symbols.md: §7 Open questions, plus the "Other
renderers" idea from §3 (an experiment, not a plan).

## From §3: other renderers

- **Other renderers.** A tree of `Cell`, `Plot`, `Manipulate`, `Histogram` is a small
  interface description, and nothing about it is the DOM's. The same tree could render
  in a terminal (the REPL already has `notatio-terminal`'s host side) or natively on
  mobile, with a different set of components behind the same symbols. An experiment, not
  a plan — but it only works if the symbols are the interface, which is the alignment
  argument again.

## Open questions

- **Argument conventions.** Wolfram's `{x, 0, 10}` iterator is our `(x, 0, 10)` tuple
  (InputForm already prints `Integrate` bounds that way); options (`PlotRange -> …`) have
  no notatio spelling yet — Epsil's `a -> b` is a `KeyValuePair`, not Wolfram's `Rule`,
  and the elements take attributes. Whether a `Plot` head takes options as trailing pairs
  or as a settings record is the same question the worksheet's `\mathsf{…}` settings
  namespace answered one way.
- **Which symbol for the symbol-less components.** `Cell` is Wolfram's (a notebook
  cell), so `notatio-cell` is aligned after all and the wrapper is rightly `<Cell>`.
  `notatio-worksheet` has no Wolfram name; `Notebook` is taken by our notebook.
  `notatio-figure`'s eleven glyphs are the hardest case — a `Figure(kind, …)` family
  head is the §4 answer, if the glyphs are worth a symbol at all.
- **Hints for the family heads.** `Chart(data, "pie")` names the member; anything richer
  — an axis mapping, a bin count — has no notatio spelling beyond the attributes, which
  is the argument-conventions question again.
- **Other renderers.** The terminal (`notatio-terminal`'s host side) could draw a `Plot`
  head through `@enumeratio/raster` the way it already draws glyphs — the same
  `renderingOf` map with a different set of components behind the tags.
