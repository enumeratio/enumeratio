# Mathlib

[Mathlib](https://leanprover-community.github.io/) is the Lean community's library of
formalised mathematics: several hundred thousand theorems, every one of them checked by a
proof assistant. We don't prove anything. What we take from it is the part a proof
assistant forces you to get right before anything else: **what structure a statement
needs.**

## The idea we take

Mathlib does not define `min` for numbers, then again for strings, then again for
anything else that gets a `min` later. It defines `min` once, for any type with a linear
order, and a type gets `min` by showing that it has one. The same goes for everything
above it. A lattice is a partial order with meets and joins. `⌊x⌋` needs a floor
structure. An ordered additive group has a zero, a negation and an order that respects
them. Each structure is a small set of operations with laws, and each refines the ones
beneath it.

That is the right shape for a symbol library, and we had the wrong one. Our `Min` was
compute-engine's numeric head, widened to accept anything, with each package bolting on a
special case for its own values. It said nothing about what `Min` needs. Now it does:

- **A head requires structure.** `Min` needs a linear order, or a lattice, where it is
  the meet. `Floor` needs a floor ring, or at least ticks. `Round` needs the same, and
  breaks a tie towards the even tick only when the ticks have a parity.
- **A type provides it.** A type _conforms_ to a protocol by giving that protocol's
  operations: `Compare` for a partial order, `GreatestLowerBound` and `LeastUpperBound`
  for a lattice, `IntegerFloor` and `IntegerCeil` for a floor ring. compute-engine has protocols in
  its type system, so this is its machinery, not a layer beside it.
- **The head is written once.** A package that adds a type declares its conformances and
  gets every head that needs them. A type a user declares gets them too.

## In the page

<Story
  title="An order that isn't numbers">
<template #description>
Strings are a linear order, so <code>Min</code>, <code>Max</code> and
<code>Clamp</code> work on them the way they work on numbers.
</template>
<notatio-cell in-form="input" value='Clamp("zebra", "cat", "moose")' />
</Story>

<Story
  title="A lattice that isn't a total order">
<template #description>
Integer partitions of the same n under dominance. [3, 1, 1, 1] and [2, 2, 2] are
incomparable (<code>Compare</code> answers NaN), so <code>Min</code> can't pick either
one. It gives their meet: the greatest partition dominated by both.
</template>
<notatio-cell in-form="input" value="Min(IntegerPartition([3, 1, 1, 1]), IntegerPartition([2, 2, 2]))" />
</Story>

<Story
  title="Ticks in a product order">
<template #description>
The complex numbers ordered coordinate by coordinate. Their ticks are the Gaussian
integers, so <code>Floor</code> and <code>Round</code> work on the real and imaginary
parts separately, which is also Wolfram's answer.
</template>
<notatio-cell in-form="input" value="Floor(2.5 + 3.7i)" />
</Story>

## Where we diverge

**Names are spelled out.** Mathlib abbreviates heavily: `OrderedAddCommGroup`,
`CompleteLattice`, `FloorSemiring`. Its names are read by people who write Lean every day.
Ours are symbol names, typed by people who don't, so we use Mathlib's concepts with the
words written out: `OrderedAdditiveCommutativeGroup`. Where a name has no Mathlib
counterpart, the protocol's record says which Mathlib structure is nearest.

**Laws are tested, not proved.** A conformance to a protocol is a claim: antisymmetry, the
adjunction between `Floor` and the ticks, a midpoint lying between its two ticks. Mathlib
makes you prove the claim. We sample it instead: every conforming type is drawn from, and
the protocol's laws are checked on the draws. That is weaker, but it is also what makes
"any type with enough structure" a promise we can keep for a type declared in a notebook.

**Floors: Mathlib's, then more.** Mathlib's `FloorRing` defines floor and ceiling through a
Galois connection with the integers, and its `round` sends ties up. We follow it exactly:
where Mathlib has proved something about floors, we inherit it. Our extension sits below it.
In a `FloorOrder` the ticks can be any discrete points of an order, with no ring, so whole
days in a timestamp or multiples of a step can floor too. With a midpoint between ticks and a
parity on them, `Round` can also break ties towards the even tick, which is Wolfram's rule.
A floor ring is a floor order whose ticks are its integers.

**Refinement is data.** A Lean typeclass `extends` its parents. compute-engine's
protocols have no refinement yet, so the hierarchy states it separately, and a type that
claims a lattice has to have claimed a partial order first.

## What we would still like

- **The algebraic half.** `Basis`, `AlgebraDimension` and `Element` already dispatch on a
  finite-dimensional algebra's type, so the Clifford, diagram and Hecke algebras are
  conformances rather than special cases. What's missing is the element level: monoids,
  groups, rings and modules over an algebra's elements, so the ordered product is a ring's
  multiplication rather than a registry.
- **Bounded orders.** `Min` of nothing is the top element, when the type has one.
- **Proof, where it's cheap.** Mathlib already runs as one of our oracles and checks our
  answers. It could also check our _laws_: a conformance whose law has a Mathlib theorem
  behind it is one we'd no longer have to sample.

The design is written up on the wiki's [Structures](https://github.com/enumeratio/enumeratio/wiki/Structures) page.

## Reading

- [_Mathematics in Lean_](https://leanprover-community.github.io/mathematics_in_lean/),
  the chapter on structures and hierarchies, for how Mathlib builds its hierarchy and why
  it is built the way it is.
- Mathlib's `Order` and `Algebra.Order.Floor` modules, for the definitions we follow.
