# Wolfram FullForm

A **code output form**: the Wolfram Language full form (functional `Head[…]`
syntax) of an expression, via `@enumeratio/wolfram` — surfaced as the
`WolframFullForm` form. Wolfram's uniform `Head[args]` means most heads translate
directly; only differing names are remapped, and a few argument forms are
rewritten. Unmapped heads pass through as `Head[args]`, so coverage degrades
gracefully.

Unlike the other code forms, Wolfram full form is a **format** — it round-trips.
The cell below is the reverse direction: type Wolfram full form and it parses
back to an expression (via `fromWolfram`), rendered here as StandardForm.

<notatio-cell in-form="wolfram" value="Plus[Binomial[10, 3], Power[x, 2]]" />

Each row below shows an expression and its Wolfram full-form source. Some carry a
known behavioural divergence — compute-engine's result is correct for
compute-engine; Wolfram simply does something different, and the translation
can't hide it.

<SourceOutput language="wolfram" />
