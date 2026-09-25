# Design: naming knots

Status: **the value landed, the table did not**. `TorusKnot(p, q)` exists and the
invariant heads and `KnotCurve` take it; `KnotData` is written up here and deliberately
not built.

## 1. What was wrong

The invariant heads took a **braid**. That is defensible — every knot is the closure of
some braid — but it meant a knot could only be named by a presentation of it, and any
knot with a closed form needed a second head to reach it:

| retired               | what it was                                    |
| --------------------- | ---------------------------------------------- |
| `TorusKnotJones`      | $V(t)$ of $T(p,q)$, closed form                |
| `TorusKnotPolynomial` | $\Delta(t)$ of $T(p,q)$, closed form           |
| `TorusKnotCurve`      | the points $T(p,q)$'s embedding passes through |

Both named their argument's _presentation_ in the head, which does not scale: a figure-
eight knot or a pretzel knot would each want their own pair. And they were not even
buying speed — `JonesPolynomial(TorusBraid(3,7))` and `TorusKnotJones(3,7)` returned the
same polynomial in the same 1–2 ms. They were a second spelling, not a fast path.

## 2. What replaced it

A knot is now a value in its own right, separate from any braid presenting it
(`knot.ts`):

```ts
type ClosedForm =
  | { kind: "torus"; torus: { p: number; q: number } }
  | { kind: "twist"; twist: { n: number } }
  | { kind: "pretzel"; pretzel: { p: number; q: number; r: number } };

interface Knot {
  braid?: Braid; // the closure it is, when a word exists
  closed?: ClosedForm; // the closed form it was named by, when it was named by one
}
```

Both fields are optional and at least one is present, because the two carry different
reach. `torusBraid` stops at 32 strands and needs $p \ge 2$; the closed forms have their
own bounds ($p, q \le 20$ for Jones) and none at all for the genus. So `SeifertGenus`
answers for $T(41, 2)$ where no braid word exists, and `JonesPolynomial` declines there
rather than answering something else. `closed` is a tagged union rather than a field per
family, so `TwistKnot(n)` and `PretzelKnot(p, q, r)` (the other knot families this package
added) slotted in without the record growing an optional field apiece — only the two that
also brought a closed-form Jones ever would have, and neither does.

`knotOf` resolves whatever names the knot — `TorusKnot(p, q)`, `TwistKnot(n)`,
`PretzelKnot(p, q, r)`, `FigureEightKnot()`, a `Braid`, or a modular $LR$ word — and each
invariant picks its route from what the knot turned out to carry. A twist or pretzel knot
carries a braid only in the couple of cases this package already had one for (the
figure-eight and the trefoil, both twist knots); the general families are closed form only,
same as $T(p, q)$ past its own braid bound.
The head names the invariant; the argument names the knot.

The closed forms did not go away. They are still the independent check on the braid
machinery — no braid, no bracket, no diagrams in them — and the tests assert that both
routes through one head agree. That check got _better_, not worse: it now runs through
the same public head rather than comparing two.

`KnotData` (a lookup keyed by knot name, deliberately not built) and the remaining loose
ends moved to design/speculative/knots.md.
