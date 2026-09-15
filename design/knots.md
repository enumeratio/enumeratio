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
family, so `TwistKnot(n)` and `PretzelKnot(p, q, r)` (§4's "more knot families") slotted
in without the record growing an optional field apiece — only the two that also brought a
closed-form Jones ever would have, and neither does.

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

## 3. `KnotData`, and why it is not this

Wolfram has no `JonesPolynomial`. It has `KnotData["Trefoil", "JonesPolynomial"]` — a
**lookup keyed by knot name**, over the Rolfsen and Hoste–Thistlethwaite tables. That is
a genuinely different facility from computing an invariant of a knot you constructed,
and wanting one does not remove the need for the other:

- `KnotData` answers "what is known about the knot called $6_2$" from a table.
- `JonesPolynomial(knot)` answers "what is $V$ of the knot I just built" by computing.

A table would want: named knots (`Trefoil`, `FigureEight`, $8_{19}$), the standard
properties (crossing number, genus, braid word, signature, unknotting number, symmetry
type), and a way to go from a name to a `Knot` this package can compute with — which is
the part that matters, because it is what lets the table cross-check the computation the
way `TorusKnot` already does for torus knots.

The reason not to build it yet is that it is data, not design. Its value is in the table
being right, and the table is large; the interesting question — what shape a knot takes
in this package — is settled by §2 without it.

## 4. Loose ends

- **Knot families do not get heads of their own.** `TorusKnotCurve(p, q)` became
  `KnotCurve(knot, samples?)` for the same reason `TorusKnotJones` went: the head names
  the operation, the argument names the knot. The `*Curve` suffix is the family — a head
  ending in `Curve` evaluates to a list of points (`ParametricCurve`, `LorenzCurve`,
  `KnotCurve`). `LorenzCurve` keeps its name because its argument is a step count, not a
  knot: it is a trajectory of an ODE that happens to draw knots, which is Ghys's point
  rather than a naming accident.
- **Links are not knots.** `KauffmanBracket` is defined for links and `JonesPolynomial`
  is not, which `Knot` does not currently express — the bracket simply takes a knot and
  works anyway when the closure has several components. A `Link` alongside `Knot` is the
  eventual answer; today the distinction lives in which head declines.
