# SageMath

[SageMath](https://www.sagemath.org/) is the one on this list we have taken the
least code from and have the most to learn from. It is a Python system that
unifies GAP, PARI/GP, Singular, Maxima, FLINT and a dozen others under one
language — but the interesting part is not the aggregation. It is that Sage took
the trouble to model **what a mathematical object belongs to**, and we have not.

## The idea we do not have

In Sage, every element knows its **parent**:

```python
sage: a = GF(2)(1)
sage: b = GF(5)(1)
sage: type(a) is type(b)
True
sage: parent(a); parent(b)
Finite Field of size 2
Finite Field of size 5
```

Two elements of the same Python type, and they are not the same kind of thing.
Sage's answer is that the type is an implementation detail and the **parent** is
the mathematics. Parents are unique objects — `RR['x','y'] is RR['x','y']` — so
identity of structures is cheap and reliable.

On top of that sits the **category framework**, which is about structure rather
than implementation:

```python
sage: ZZ.category()
Join of Category of Dedekind domains
    and Category of euclidean domains
    and Category of noetherian rings
    and Category of infinite enumerated sets
    and Category of metric spaces
sage: ZZ in Fields()
False
```

A category carries generic methods and tests that any parent in it inherits, so a
theorem proved once is available to everything that qualifies. And **coercion** is
the rule for when arithmetic between two parents is allowed and what it lands in —
`1 + 1/2` works not because integers and rationals are both numbers but because
there is a declared map $\mathbb{Z} \to \mathbb{Q}$ and the answer belongs to
$\mathbb{Q}$.

## What that would mean here

Our version of the same question is open and
[written up](/reference/domains/) as a gap rather than an answer. Today a
permutation is a `List` of integers, a partition is a `List` of integers, and a
composition is a `List` of integers — three different things wearing the same
clothes. Writing down a map like RSK, which takes a permutation to a pair of
tableaux, needs a way to say what a permutation _is_.

The engine does give us the first piece. `ce.declareType` supports genuinely
**nominal** types, and heads dispatch on them:

```ts
ce.declareType("Permutation", "list<integer>", { mint: true });
ce.type("Permutation").matches("list<integer>"); // false — opaque, both ways
```

That is a parent, more or less, in the narrow sense of "this value belongs to this
structure and a structurally identical value does not". What it is not is a
**category**: there is no way to say that permutations of $n$ form a group, and
get the group's generic machinery for free. Nor is there coercion: no declared
map from one carrier to another that the evaluator consults when two of them meet.

The honest summary is that Sage answered a question we are still circling, and the
answer has three parts — parent, category, coercion — of which we have a thin
version of the first.

## The debt of names

The combinatorics is close enough to be worth noticing. Sage writes
`Permutations(4)`, `Subsets(4)`, `Partitions(5)`; we write <Symbol
type="sage">SymmetricGroup</Symbol>, <Symbol type="sage">Subsets</Symbol>, <Symbol
type="sage">IntegerPartitions</Symbol>. Where a name is already taken we keep it:
compute-engine's own spelling first, since that is the engine we run on, and
[Wolfram](/playground/inspirations/wolfram)'s where the engine is silent — but a name
Sage has is just as good a precedent, and often the same one. Where we depart from
both it is for consistency with ourselves. Sage has `SetPartitions` and
`OrderedSetPartitions`; we have <Symbol>SetPartitions</Symbol> and <Symbol
type="sage">SetCompositions</Symbol>, because a <Symbol
type="wikipedia">SetComposition</Symbol> stands to a <Symbol
type="wikipedia">SetPartition</Symbol> exactly as a <Symbol
type="wikipedia">Composition</Symbol> stands to an <Symbol
type="wikipedia">IntegerPartition</Symbol>, and the names should say so. Each of those
links is the crosswalk at work: the name is ours, and its reference page says what
Sage, Wikipedia and the rest call the same thing.

Enumerated sets that are lazy, countable and rankable — with `unrank` and `rank` —
are Sage's shape as much as anyone's, and it is the shape our collections take.

<Story
  title="Unranking, the shape Sage made familiar">
<template #description>
A lazy enumerated set indexed by position. Drag the matrix to walk it. The
collection is never built — <code>At</code> unranks.
</template>
<notatio-tangle>
Permutation <notatio-dynamic value="_k" /> of 24:
<notatio-knob name="k" value="1" min="1" max="24">
<notatio-figure kind="permutation" value="At(Permutations(Range(1,4)), _k)" />
</notatio-knob>
</notatio-tangle>
</Story>

## What we would take, and what we would not

**Take: the parent as the carrier of meaning.** A value plus the structure it
belongs to, where the structure is a real object you can ask questions of. This is
the direction the domains work is already pointed.

**Take: categories as a place to put generic facts.** Most of what a reference
entry says about a head is really a fact about the structure its arguments live
in. Somewhere to attach that, once, is worth a great deal.

**Take: uniqueness of parents.** `RR['x','y'] is RR['x','y']` is a small decision
with large consequences — it makes structure identity a pointer comparison and
makes caching sound.

**Leave: implicit coercion, at least at first.** Sage's coercion model is powerful
and it is also the part users trip over, because an expression's meaning depends on
a graph of declared maps they cannot see. In a system whose output has to _read_ as
mathematics, silently moving a value into another structure is a change we would
want to be able to point at.

**Leave: the aggregation.** Sage's strength is that it wraps everything; ours has
to be that the pieces are small and the whole thing runs in a browser tab. Those
are different projects and it would be a mistake to pretend otherwise.

## Reading

- The Sage tutorial's [Parents, Conversion and
  Coercion](https://doc.sagemath.org/html/en/tutorial/tour_coercion.html) — the
  clearest short statement of the idea.
- The thematic tutorial on implementing parents and categories, for what it costs
  to actually build one.
- Sage's combinatorics reference, whose enumerated-set conventions are the closest
  prior art to [our collections](/reference/collections/).
