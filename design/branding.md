# Branding: enumeratio and the names under it

Status: **open**, and deliberately so. This note is the one place the candidate subproject
names are discussed. Until one of them names something that stands on its own — a distinct
structural piece, a product in its own right — it stays here and out of the site, the
guides, the reference and the READMEs.

## The rule

A name goes on a page when it names a thing a reader can point at: something with its own
entry point, its own documentation and its own reason to be used apart from the rest. A
logical segment of the project is not that. Describing segments as products before they are
products makes promises the code doesn't keep, and every page that repeats them has to be
unwritten when the idea moves — which it will.

So, in user-facing docs:

- **enumeratio** is the project and the site.
- **notatio** keeps the meaning `AGENTS.md` gives it — the interface and the syntax it reads
  and writes — because that is already a real, distinct thing people type and see.
- Nothing else below is mentioned as a layer, a pillar or a product.

## Candidate names

Latin nouns of the same shape as enumeratio and notatio. What each might cover is a guess,
recorded so the guesses can be compared, not a plan.

| name           | the word                   | what it might name                                                                                                                                                                                                                                                                                                                                                          |
| -------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **nucleus**    | a kernel, the nut's core   | the computation kernel: evaluation (bounded, cancellable, isolated in workers) and compilation (the `js`/`glsl`/`wgsl` code forms, the GPU paths)                                                                                                                                                                                                                           |
| **aestimatio** | a valuation, an estimate   | the mathematical core: arithmetic that knows where a number lives (residues, valuations, adèles, numerals) and numerics with honest error (special functions to arbitrary precision). Or — as the package of that name has it today — the evaluation-control layer, which is the nucleus reading above. The two readings compete.                                           |
| **notatio**    | a marking, a designation   | already in use: the interface and its syntax (see `AGENTS.md`)                                                                                                                                                                                                                                                                                                              |
| **computatio** | a reckoning, a calculation | everything `design/computation.md` covers, in its three stages: **interpretatio** (reading the input: parsing and canonicalising), **evaluatio** (pushing the expression down to compute-engine and our kernels, symbolic and numeric alike, which matches the code's `.evaluate()` and `N`), and **compilatio** (lowering it to code). Overlaps the nucleus reading above. |
| **enumeratio** | a counting out, a listing  | the whole project; or, more narrowly, the catalogue — collections with an index for every object, crosswalks, checked claims — that gives each object a permanent home                                                                                                                                                                                                      |

## What exists today, and what it does not commit us to

- `@enumeratio/aestimatio` is a package (`packages/symbols/evaluation/aestimatio`): time and
  memory constraints, isolated evaluators, sessions, `VerificationTest`. Its name predates
  this note and is not a decision about what "aestimatio" means. Packages are where code
  happens to be split, not a branding statement; if a subproject is ever cut, it may gather
  several packages or split one. Renames follow `component-naming.md`: folded into work that
  already touches the code, never done in passing.
- `design/computation.md` describes how we compute (interpretation, evaluation, compilation)
  in plain words, and documents that package in its §5.

## Before a name graduates

A candidate earns a page when all of these hold:

1. it has a boundary a reader can see — an entry point, an import, a route, a command;
2. it is useful on its own, without the rest of the project;
3. the name's meaning is settled here first, so there is one reading to document;
4. the docs that describe it describe code that exists.

Until then, keep building functionality, and describe it by what it does.
