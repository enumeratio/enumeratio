# enumeratio.dev

One repository, two names: the mathematics and its interconnections, and the tools to
explore and visualise it all.

## enumeratio: the symbols

_Latin_ **ēnumerātiō** (f.), from **ēnumerāre** "to count out, reckon up" (**ē-/ex-** "out" +
**numerāre** "to count," from **numerus** "number"). In classical rhetoric, the _enumeratio_ is the
closing recapitulation that lists the points made.

**enumeratio** is a family of mathematical symbol definitions, built on the
[Cortex compute-engine](https://cortexjs.io/compute-engine/) and written in its language,
[Epsil](https://epsil.dev). The engine supplies the core — the mathematics it already
knows, and the evaluation model it knows it in: canonical forms, types, assumptions,
numeric and symbolic evaluation, compilation to other targets. enumeratio builds up from
there: what each further symbol means, how it evaluates, and how it relates to the same
idea everywhere else it has a name.

Its base is enumerative combinatorics. Collections are its first-class citizens — subsets,
permutations, integer and set partitions, compositions, Dyck paths, tableaux, trees and a
few hundred more — realised as lazy indexed families with closed-form counts, ranking and
unranking, so `Count`, `At` and membership are answered without building the list. Over the
collections sit the combinatorial statistics and maps, each a definition over its carrier
that the engine can evaluate on any element, and the carrier domains that let a
permutation be a permutation rather than a list of integers. Around that core: number
theory, the special functions (Hurwitz zeta, polylogarithms, the Dirichlet family), and a
zoo of algebras — hypercomplex and geometric, diagram, Hecke, incidence, path, Hopf, group —
each a small library declared onto the engine.

The wider goal is to enumerate mathematics in general: to give as much of it as makes
sense a definition that is correct first, fully general second, and in time efficient —
and to give every piece a live, explorable, citable realisation in an open form that stays
where it was put. Correctness is checked rather than claimed. Every symbol has a reference
page that crosswalks it to [Wikipedia](https://en.wikipedia.org/),
[MathWorld](https://mathworld.wolfram.com/), [Wikidata](https://www.wikidata.org/), the
[DLMF](https://dlmf.nist.gov/), [Fungrim](https://fungrim.org/), the
[OEIS](https://oeis.org/), [FindStat](https://www.findstat.org/), the
[Wolfram Language](https://www.wolfram.com/language/) (Mathematica),
[SageMath](https://www.sagemath.org/), [SymPy](https://www.sympy.org/),
[mpmath](https://mpmath.org/) and [mathlib](https://leanprover-community.github.io/), and
where a claim can be computed — a statistic against FindStat's values, a family's count
against the OEIS's terms, an identity from Fungrim evaluated on both sides, an example run
in a Wolfram kernel — it is, and the page says so.

## notatio: the writing

_Latin_ **notātiō** (f.), from **notāre** "to mark, to note down, to observe" (from **nota** "a
mark, a sign"). The act of marking, and what the marks make: a note, a notation, a system
of signs. In classical rhetoric the _notatio_ is the character-sketch that describes a
person by their marks; Cicero also used it for etymology — explaining a word by the signs
of its origin, which is what these two entries are doing.

**notatio** is the interactive notebook and explorer for enumeratio, and the tools around
it: the user-interface side of the language. The notebook (`<notatio-notebook>`), the live
input and typeset output, the plots and glyphs and collection tables, the reactive prose
controls, the `notatio` command line and REPL, the format registry that turns an expression
into LaTeX or MathJSON or Wolfram or a shader, and this documentation site — which is also
the playground. It is where a person reads, writes and turns the mathematics over.

The name is also the notation, because that is what the word means: **notatio** is the
restricted subset of Epsil the interface reads and writes — one expression, no statements or
effects — chosen so that what you type is what you get back. It is just "notatio", never
"the notatio notation". The line between the two names runs by what they govern, not by
layer: enumeratio is what an expression _means_ — heads, definitions, evaluation, written in
full Epsil because a definition needs statements — and notatio is how a person _writes and
sees_ one: the expression subset, `$…$` LaTeX islands, InputForm printing it back, the
`*Form` heads, the components. A notebook cell is the one deliberate blur — notatio plus a
single `:=` binding, because a cell is where a reader names something.

## Development

A Vite+ monorepo. `vp run ready` checks, tests and builds everything; `vp run dev` serves
the site. Design notes live in `design/`, starting from [roadmap.md](design/roadmap.md) —
the index of where to look for work — and [namespaces.md](design/namespaces.md) for how the
symbol family is organised. `AGENTS.md` has the working conventions.
