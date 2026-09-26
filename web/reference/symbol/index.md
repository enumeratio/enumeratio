# Symbol reference

Language-reference pages for compute-engine functions, generated from verified
example data. Each example is re-evaluated live and pinned by a test, so the
docs can't drift from the engine.

## Elsewhere

Every symbol page opens with where the same thing lives in other systems — Wikipedia,
MathWorld, Wikidata, DLMF, Fungrim, the OEIS, FindStat, the Wolfram Language, SageMath,
SymPy, mpmath, mathlib4 and more. Nothing there is typed twice: a chip's tooltip says
which of the crosswalk's sources it came from.

- **written** on the entry, or on one call form when the head means something else at
  another arity (`Zeta(s, a)` is Hurwitz's function and links to Hurwitz's pages)
- **curated** in the reference package's hand-kept table
- the enumeratio **catalog**'s own crosswalk, which is where FindStat ids and Sage
  classes come from; a carrier domain inherits what its collections recorded
- compute-engine's own **Wikidata** id — audited, since 41 of the 101 the engine declares
  are dead or about something else (`PlanckConstant` pointed at Mount Vesuvius) — and
  everything that item points at
- the **DLMF**'s defining equation, found in the handbook's index of notations by the
  names the head already has
- **FindStat**, asked by value: every object of the carrier up to a size, our definition
  evaluated on each, and the finder's answer kept only where it agrees on everything
- the **OEIS**, asked by count: a family's own count kernel for the first sizes, searched,
  and kept where the terms agree once aligned

Four of those are checks rather than pointers, and the chips say so. A **✓** means the
claim was put to a computation — a definition evaluated against theirs, a count against
their terms, this head's own examples run in that kernel, or a Fungrim identity
instantiated and evaluated on both sides — and the tooltip says how many. A **!** means
the same computation ran and something disagreed, which is the more interesting outcome:
every one of them so far has been a bug on our side, and the entry says which.

The scripts in `@enumeratio/reference` keep it honest: `crosswalk:collect` (offline,
test-guarded), `crosswalk:fetch` (the outside indexes), `crosswalk:find` (FindStat by
value, the OEIS by count), `crosswalk:verify` (Fungrim's identities, numerically), `crosswalk:audit` (the engine's
Wikidata ids) and `crosswalk:check` (follows every link).

- **Fungrim**: the symbol page, and every identity the engine compiled that mentions the head
- the **Wolfram** symbol the transpiler vouches for, and the **oracle**'s equivalent call in
  each kernel — resolved to its documentation anchor through the system's Sphinx inventory

Prose can lean on the same table: `<Symbol type="sage">SetComposition</Symbol>` is our
name, and the link is whatever Sage calls it.

<ReferenceIndex />
