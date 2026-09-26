# Design: naming knots

Split from design/knots.md: §3 `KnotData` (deliberately not built), §4 loose ends.

## `KnotData`, and why it is not this

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
in this package — is settled by §2 (design/knots.md) without it.

## Loose ends

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
