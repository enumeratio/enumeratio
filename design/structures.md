# Design: structures

Status: **two slices landed**: orders and floors, then algebras (below). A head requires structure; a type provides it. `Min` works on anything
with a total order, `Floor` on anything whose order has ticks, `Basis` on anything that is a
finite-dimensional algebra -- including a type a user declares in a notebook, as long as it
says (and satisfies) what it is.

## The idea

Today `Min`, `Round`, `Clamp` are compute-engine's numeric heads, widened to `any` so that
lists and our statistics' definitions get through (design/manifest.md, "What tightening
taught us"). That says nothing about what they need. What they need is mathematical
structure, and each needs a precise, small amount of it:

| head                                                           | needs                                                   | why                                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `Min`, `Max`, `Sort`, `Ordering`                               | a total order                                           | pick or arrange by comparison                                                         |
| `Min`, `Max` of a partial order                                | a lattice                                               | `Min` is the meet: subsets under inclusion (intersection), partitions under dominance |
| `Min` of nothing                                               | a bounded order                                         | the empty meet is the top element                                                     |
| `Clamp(x, lo, hi)`                                             | a lattice                                               | `Max(lo, Min(x, hi))`                                                                 |
| `Floor`, `Ceil`                                                | ticks: an order with a Galois-connected discrete subset | below                                                                                 |
| `Round` (half up, half down)                                   | ticks and midpoints                                     | "nearest" needs the point halfway between two ticks                                   |
| `Round` (half to even, Wolfram's default)                      | + a parity on the ticks                                 | which of two tied ticks is even                                                       |
| `Round` (half away from zero), `IntegerPart`, `FractionalPart` | + a zero                                                | truncation goes toward it                                                             |
| `Round(x, a)`, `Floor(x, a)`                                   | ticks that are multiples of `a`                         | a scaling action on the ticks                                                         |
| `Sign`, `Abs`                                                  | an ordered additive commutative group                   | a zero and a negation; `Abs(x) = Max(x, -x)`                                          |
| `Basis`, `AlgebraDimension`, `Element`, the ordered product    | a finite-dimensional algebra                            | what the `algebra` package's providers answer today                                   |
| `Random`                                                       | something sampleable                                    | what design/random.md's sampler registry answers today                                |

### Ticks, precisely

`Floor` and `Ceil` are adjoints. Take an ordered set $X$ and a subset $Z$ of it, the ticks,
with the inclusion $i : Z \to X$. `Floor` is the right adjoint of $i$ and `Ceil` the left:

$$ i(z) \le x \iff z \le \lfloor x \rfloor, \qquad \lceil x \rceil \le z \iff x \le i(z). $$

They exist exactly when every element is bracketed by ticks and the ticks are locally finite
-- every region of $X$ allocated to one tick. The ticks need not be the integers: multiples of
`a`, whole days in a timestamp, and, in a product order, the Gaussian integers inside the
complex numbers, which is why Wolfram's `Floor(2.5 + 3.7 i)` is `2 + 3 i`: the same
adjunction, componentwise. This is Mathlib's definition (`FloorSemiring`, `FloorRing` by a
Galois connection), minus its requirement that $X$ be a ring.

`Round` needs more than order: "nearest" compares two gaps, which takes either a metric or a
midpoint between consecutive ticks; each tie-breaking rule then needs its own extra piece, as
in the table.

## The mechanism: compute-engine's protocols

compute-engine already has what this needs (probed against 0.139):

- `declareProtocol(name, { functions: { Compare: "(Self, Self) -> integer" } })` declares a
  protocol, and each member becomes a head that dispatches on its argument's type.
- `declareProtocolImplementation(type, protocol, { functions: { Compare: … } })` makes a type
  conform. The type can be built in (`real` -- and `integer` through it), nominal (our
  carriers), or an application of a head (`expression<Chain>`).
- A signature constrains a type variable: `(T, T) -> T where T is LinearOrder`. A call with a
  type that doesn't conform is a `protocol-constraint-unsatisfied` error, not a silent
  fallthrough.
- A protocol with no members is a marker: structure with nothing to compute (a tick parity
  that is just "the ticks are ℤ").
- In Epsil, `DeclareProtocol` and `DeclareConformance` are statements, so a user can make
  their own type conform from a notebook.

What it lacks: **refinement**. There is no way to say `Lattice` extends `PartialOrder`, so the
hierarchy states its refinements as data, and a conformance to a protocol declares its
parents' conformances too. (An upstream candidate.)

## The hierarchy

Mathlib's concepts and axioms, with its abbreviations spelled out (`OrderedAdditiveCommutativeGroup`,
not `OrderedAddCommGroup`); aliases later if wanted. Where we go past Mathlib, the row says
"extension": Mathlib is the spec we inherit proofs from, so every departure is marked.

| protocol                          | refines                             | members                                        | laws (checked by Plausible)                     | Mathlib                |
| --------------------------------- | ----------------------------------- | ---------------------------------------------- | ----------------------------------------------- | ---------------------- |
| `PartialOrder`                    | --                                  | `Compare` (-1, 0, 1, or `NaN` if incomparable) | reflexive, antisymmetric, transitive            | `PartialOrder`         |
| `LinearOrder`                     | `PartialOrder`                      | --                                             | total: never incomparable                       | `LinearOrder`          |
| `Lattice`                         | `PartialOrder`                      | `GreatestLowerBound`, `LeastUpperBound`        | greatest lower / least upper bounds             | `Lattice`              |
| `BoundedOrder`                    | `PartialOrder`                      | `Top`, `Bottom`                                | extremal                                        | `BoundedOrder`         |
| `FloorOrder`                      | `PartialOrder`                      | `LowerTick`, `UpperTick`                       | the Galois connections above                    | extension              |
| `MidpointOrder`                   | `FloorOrder`                        | `Midpoint`                                     | between, equidistant                            | extension (`midpoint`) |
| `TickParity`                      | `FloorOrder`                        | `IsEvenTick`                                   | alternates along consecutive ticks              | extension              |
| `Ring`                            | --                                  | (compute-engine's `Add`, `Multiply`, `Negate`) | a ring                                          | `Ring`                 |
| `FloorRing`                       | `LinearOrder`, `Ring`, `FloorOrder` | `IntegerFloor`, `IntegerCeil`                  | the Galois connections with ℤ                   | `FloorRing`            |
| `ProductOrder`                    | `PartialOrder`                      | `Coordinates`, `WithCoordinates`               | the order and every operation are componentwise | extension (`Prod`)     |
| `OrderedAdditiveCommutativeGroup` | `PartialOrder`                      | (compute-engine's `Add`, `Negate`, `0`)        | a group, order-compatible                       | `OrderedAddCommGroup`  |
| `FiniteDimensionalAlgebra`        | --                                  | `Basis`, `AlgebraDimension`, `HasElement`      | --                                              | `FiniteDimensional`    |
| `Sampleable`                      | --                                  | `Sample`                                       | draws lie in the domain                         | --                     |

A member becomes a head of its own, so its name must be free: a member named like an existing
head (`Floor`, `Join`, `Infimum`, `LessEqual`) is silently shadowed by it and never dispatches;
one named like a record another package keeps collides with it in the manifest (`Components`
is a FindStat endofunction statistic's stub record; hence `Coordinates`).
So the public heads -- `Min`, `Max`, `Clamp`, `Floor`, `Ceil`, `Round`, `Sign` -- stay
compute-engine's and take a plain number down the native path; anything else goes to the
members of whichever protocols its type conforms to. A product order (the complex numbers, and
vectors later) is the case a single `Compare` can't round through -- one component above the
midpoint and the other below -- so it has its own protocol, and every generic head works
componentwise over it.

**Floors, after Mathlib and past it.** Mathlib's `FloorRing` needs a ring: its floor is an
integer, and its `round` is the floor when `2 fract(x) < 1`, else the ceiling, so ties go up.
We follow it exactly. Below it sits `FloorOrder`, our extension: ticks in any order, no ring,
so whole days or multiples of a step can floor too; a floor ring is a floor order whose ticks
are its integers. `MidpointOrder` and `TickParity` extend that, for rounding without a ring's
arithmetic and for Wolfram's half-to-even ties. `Round` compares against the midpoint when there
is one, and uses Mathlib's `round` otherwise.

## How heads use it

A generic head's signature constrains its argument and its handler calls the members:
`Min: (T+) -> T where T is LinearOrder`, and `Min` folds `Compare`. Numbers keep
compute-engine's native path -- `real` conforms, and its implementation is the native
arithmetic -- so nothing numeric gets slower; the generic path is what a non-number takes.

That is also dispatch (design/manifest.md, "Overloads across packages") for these heads: no
more `wrapOperator` chains where each package takes over `Min` for its own values. The package
declares its type's conformance; the head is written once.

## What the records say

- A **protocol** gets a record like a head's: `refines`, members and their types, laws (as
  Epsil predicates), the Mathlib name.
- A **type's** record gets `conformsTo: [LinearOrder, Lattice, …]`.
- A **head's** requirements are already in its type (`where T is LinearOrder`).

So the manifest answers "which heads work on my type" and "what does my type need to add to
get `Round`" without loading code, and the census completeness test grows a clause: every
declared conformance is on the type's record.

## Laws, tested

A conformance is a claim: antisymmetry, the adjunction, a midpoint between its ticks. Plausible
(design/plausible.md) samples every conforming type -- through `Sampleable`, which most of our
carriers are -- and checks each protocol's laws, so "any type with enough structure" is a
promise we can keep, including for a type declared in a notebook.

## What moves

- `@enumeratio/structures`, a new package: the protocols, their records, and the generic
  heads' handlers.
- `algebra` became the `FiniteDimensionalAlgebra` protocol, and is gone (second slice, below).
- `Random`'s sampler registry (`@enumeratio/engine`'s `random.ts`) becomes `Sampleable`.
- The `Min`/`Round`/`Clamp` widenings in collections go away, replaced by conformances.

## First slice

The order and tick families -- `Min`, `Max`, `Clamp`, `Floor`, `Ceil`, `Round` -- generic,
over four kinds of type: `real` (native), strings (a linear order), the complex numbers (the
product order, so ticks are the Gaussian integers and `Floor(2.5 + 3.7i)` is `2 + 3i`), and
integer partitions under dominance (a lattice that is not a total order: `Min` is the meet,
`Max` the join). The package's tests add a type declared in the test itself, with ticks and
a tick parity, and it gets `Floor`, `Min` and half-even `Round` with no other code.

How it runs:

- A generic head takes a real number, or anything with an unknown in it, down the native path.
  Anything else goes to the protocol members, called through compute-engine's own dispatch, so
  a conformance declared in Epsil (`DeclareConformance`) answers the same as one declared in
  TypeScript. When no member answers, the native handler has the call as before.
- `Round` ties go to the even tick when the ticks have a parity, else up. Numbers keep
  compute-engine's half-away-from-zero; the other modes (and `Round(x, a)`) are still to come.
- Collections' complex-rounding special case is gone: the complex numbers' `ProductOrder`
  conformance covers it.

What it taught us:

- **`Self` binds to the first argument's exact type.** `Compare(5, 1/2)` is an
  `incompatible-type` error: `Self` becomes `integer`, and `1/2` isn't one. The generic heads
  never send numbers through members, so they don't hit it, but a member called by name
  does. The fix belongs upstream: `Self` should widen to the conforming type.
- **No "does T conform to P" query.** compute-engine dispatches, but doesn't expose whether a
  type conforms. We call the member and treat `protocol-implementation-missing` as no.

`algebra` and `Sampleable` follow.

## Second slice: algebras

`@enumeratio/algebra` was a provider registry. It is gone. Each algebra family mints the type
its algebras' names carry and conforms it to `FiniteDimensionalAlgebra`:

| type                  | names                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------- |
| `clifford_algebra`    | `CliffordAlgebra`, its sibling constructors, `Quaternions` and the other named algebras |
| `diagram_algebra`     | `PartitionAlgebra`, `BrauerAlgebra`, `TemperleyLiebAlgebra`, …                          |
| `group_algebra`       | `GroupAlgebra`                                                                          |
| `hecke_algebra`       | `HeckeAlgebra`                                                                          |
| `graded_hopf_algebra` | `NSymAlgebra`, `QSymAlgebra`                                                            |
| `incidence_algebra`   | `IncidenceAlgebra`                                                                      |
| `path_algebra`        | `PathAlgebra`                                                                           |

`Basis` and `AlgebraDimension` dispatch on that type, and `Element(x, A)` asks `HasElement`
when `A`'s type conforms. `AlgebraSignature` is a Clifford algebra's own, so it is
hypercomplex's head over `clifford_algebra`.

A type whose values _name_ an algebra is a Sage parent more than a Mathlib typeclass: in
Mathlib the algebra is the type of its elements. The element-level structure -- the product as
a `Ring` -- waits until an algebra's elements have types to dispatch on. Until then the ordered
product (`NonCommutativeMultiply`, `GeometricProduct`, `CircleTimes`) stays a registry of
products, each declining what isn't its own, in `@enumeratio/structures`.

## Upstream

This is the layer compute-engine's protocols were built to carry, and they have no hierarchy
yet. Once the order, tick and algebraic protocols have settled here and we're happy with them,
they go to compute-engine as an issue (design/upstreaming.md): the hierarchy, refinement as a
protocol feature, the `Self` widening and a conformance query. Nothing is proposed until then.
