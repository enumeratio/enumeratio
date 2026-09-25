# Design: which names are ours, and which are Wolfram's

Status: **landed**. The rule in §2 is enforced by `packages/census`; the backlog §4 produces
is indexed from [roadmap.md](./roadmap.md).

Companion to [namespaces.md](./namespaces.md). That document asks which of our names should
be heads at all. This one takes the heads we actually declare and asks a narrower question:
**when a name is already Wolfram's, what do we do about it.**

The answer turns out to be "usually nothing", and the interesting part is why.

## 1. What we declare

Measured, not estimated — diff the binding table of a bare `ComputeEngine` against one with
every `declare*` installed:

|                                                      |          |
| ---------------------------------------------------- | -------: |
| bare compute-engine                                  |      687 |
| with every library of ours                           |    ~1150 |
| **added by us**                                      | **~460** |
| of which: carrier TYPES (`permutation`, `dyck_path`) |       86 |
| **heads**                                            | **~375** |

The 86 lowercase entries are minted types, not functions — compute-engine keeps types and
symbols in one table, and the three-name convention in `domains/types.ts` is what keeps
`permutation` / `Permutation` / `Permutations` apart. They are not namespace pressure.

The rest divides as the packages do: carriers and their constructors, the statistics, the
collection families, and one package per subject area (modular, braid, hopf, hecke, quiver,
incidence, groupalgebra, hypercomplex, diagram, numerals, analytic).

`packages/census` is where the whole-namespace questions live, because they are only
answerable against a COMPLETE engine and no other package can depend on everything —
`reference` is a dependency of `collections`, so it cannot depend back. Its
`namespace.test.ts` holds the crudest rule down: declaring a library may add heads and
nothing else. It exists because three libraries used to leak `x`, `y` and `q` into the
session — boxing a probe expression declares the free symbols in it, and capturing a
built-in's native definition means boxing a probe.

## 2. A shared name is an overload, not a clash

About thirty of our heads are also Wolfram `System`` symbols. The first instinct is to read
that as a collision to be renamed away. It is usually the opposite.

A statistic is scoped to its carrier ([namespaces.md §2.2](./namespaces.md)), so `Area` on a
Dyck path and `Area[region]` are one name resolved by argument — which is what Wolfram does
too, and what the reference already renders as an overload set. Renaming to `DyckPathArea`
would buy nothing, cost the reader the one entry they look for, and contradict the whole
carrier-scoping design. `Order`, `Depth`, `Perimeter`, `Composition`, `Word` are the same
story.

So the rule is:

> A name Wolfram also uses is not a reason to rename. What is a reason is a name that
> misdescribes its own result.

`Cycles` was the one head that failed that test — it returned the _number_ of cycles, while
its own siblings are spelled `TwoCycleCount`, and Wolfram's `Cycles` holds the
decomposition itself. It is now `CycleCount`, recorded with the reason in
`statistics/src/naming.ts`, which is also where the rule lives so the next rename has to
argue against it.

Two conventions we do **not** take from Wolfram, because compute-engine's come first:

- predicates are `Is…` (`IsPrime`, `IsSelfConjugate`), not `…Q`. The transpiler maps between
  them; the declared name is compute-engine's.
- types are lowercase snake_case, as the engine spells `integer` and `indexed_collection`.

## 3. Where the collision is real: emitted Wolfram

The place a shared name actually hurts is the transpiler. `Area(DyckPath(…))` falling through
as `Area[DyckPath[…]]` does not fail — a kernel answers it, with the area of a region. A
wrong answer is worse than a missing one, and nothing downstream would notice.

So every head of ours that shares a Wolfram name is sorted into one of two lists in
`packages/wolfram/src/to-wolfram.ts`:

- **`HEADS`** — same function. It emits as itself, and `isWolframHead` then lets the oracle
  probe a kernel for it, which is the real prize: a head Wolfram can answer is a head we can
  be cross-checked on.
- **`FOREIGN`** — different function. It emits into ``enumeratio`Area[…]``, which is
  Wolfram's own answer to a name clash and inert in a kernel rather than misleading.

Falling through by name is the third option and it is always wrong.
`packages/census/tests/alignment.test.ts` is what says so — a head that collides and is in
neither list fails the build. That test needs Wolfram's symbol table without a kernel, which
is why `packages/wolfram/src/system-names.ts` commits all ~7700 of them.

It works twice over. It caught nine analytic heads within a day of them landing — and the
first version passed vacuously, because the engine it ran against was missing collections,
domains and statistics, which is where most of the collisions are. Booting the complete
engine also turned up `ContinuedFraction`: the carrier constructor had been declared
straight over compute-engine's own, so `ContinuedFraction(355, 113)` had stopped working.
The two are overloads now (`domains/src/declare.ts`), disjoint by argument type.

## 4. Wolfram's examples as a backlog

`packages/census/scripts/collect-wolfram-frontier.ts` reads the documentation examples for
every Wolfram symbol our head map claims, and records two things in
`census/src/wolfram-frontier-data.ts`:

- **`CALL_FORMS`** — what Wolfram's version of a symbol we map is shown doing. This is where
  the call shapes nobody thinks to ask for show up: `Subsets[Range[20], All, {69381}]` is the
  n-th subset without materialising the rest, which is exactly the unranking our collections
  already do internally and do not expose.
- **`FRONTIER`** — every head those examples call that we cannot answer, ranked by how often
  Wolfram reaches for it. Heads we have under another spelling are excluded (`ArcTan` is our
  `Arctan`), so every line is real work rather than a naming difference. What tops it:
  `FullSimplify`, the whole `Function*` property family (`FunctionDomain`, `FunctionRange`,
  `FunctionInjective`, …), `HarmonicNumber` — which the head map claims and the engine does
  not actually evaluate — and the plotting heads.

The premise is that Wolfram's examples are a better feature backlog than our imagination:
they are what the people who built the function thought worth showing, and there are enough
of them to rank. [roadmap.md](./roadmap.md) is where that lands as work to pick up, next to
the statistics and maps frontiers, which are the same discipline at a smaller scale.

Open questions moved to speculative/symbols.md.
