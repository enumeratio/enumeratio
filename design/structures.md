# Design: structures

Status: **proposed**. A head requires structure; a type provides it. `Min` works on anything
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
not `OrderedAddCommGroup`); aliases later if wanted. A first cut:

| protocol                          | refines        | members                                   | laws (checked by Plausible)         | Mathlib               |
| --------------------------------- | -------------- | ----------------------------------------- | ----------------------------------- | --------------------- |
| `Preorder`                        | --             | `LessEqual`                               | reflexive, transitive               | `Preorder`            |
| `PartialOrder`                    | `Preorder`     | --                                        | antisymmetric                       | `PartialOrder`        |
| `LinearOrder`                     | `PartialOrder` | `Compare`                                 | total                               | `LinearOrder`         |
| `Lattice`                         | `PartialOrder` | `Meet`, `Join`                            | greatest lower / least upper bounds | `Lattice`             |
| `BoundedOrder`                    | `PartialOrder` | `Top`, `Bottom`                           | extremal                            | `BoundedOrder`        |
| `FloorOrder`                      | `PartialOrder` | `Floor`, `Ceil` (to the ticks)            | the Galois connections above        | `FloorSemiring`       |
| `MidpointOrder`                   | `FloorOrder`   | `Midpoint`                                | between, equidistant                | --                    |
| `TickParity`                      | `FloorOrder`   | `IsEvenTick`                              | alternates along consecutive ticks  | --                    |
| `OrderedAdditiveCommutativeGroup` | `PartialOrder` | `Zero`, `Negate`, `Add`                   | a group, order-compatible           | `OrderedAddCommGroup` |
| `FiniteDimensionalAlgebra`        | --             | `Basis`, `AlgebraDimension`, `Element`, … | --                                  | `FiniteDimensional`   |
| `Sampleable`                      | --             | `Sample`                                  | draws lie in the domain             | --                    |

Names are open (`FloorOrder` has no exact Mathlib counterpart, since Mathlib's needs a ring);
the table is the proposal to argue with.

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
- `algebra` becomes the `FiniteDimensionalAlgebra` protocol: its providers are conformances.
  Most of the package is that registry, so structures subsumes it.
- `Random`'s sampler registry (`@enumeratio/engine`'s `random.ts`) becomes `Sampleable`.
- The `Min`/`Round`/`Clamp` widenings in collections go away, replaced by conformances.

## First slice

The order and tick families -- `Min`, `Max`, `Clamp`, `Floor`, `Ceil`, `Round` with its
modes -- generic, proved on three kinds of type: `real` (native), the complex numbers (ticks in
the product order, matching Wolfram's componentwise `Floor`), and partitions under dominance (a
lattice that is not a total order: `Min` is the meet). `algebra` and `Sampleable` follow.
