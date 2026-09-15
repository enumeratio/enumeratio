# Wolfram Language

The Wolfram Language is the reason most of this repository is spelled the way it
is. Not a dependency — a **naming authority**, a design precedent, and an oracle
we check our answers against.

Three separate debts, and they are worth separating.

## The debt of names

Almost every head here is a Wolfram symbol. `Binomial`, `Subsets`, `Permutations`,
`IntegerPartitions`, `HurwitzZeta`, `PolyLog`, `StirlingS1`, `Manipulate`,
`ContourPlot`, `TeXForm`. When a thing we want already has a name in a kernel
somebody can go and check, we take that name rather than invent one.

The rule this repository actually follows:

> A head or a component that represents a symbol is named for that symbol. One
> that represents no symbol gets a descriptive name, and we say so out loud.

The second half is doing real work. `<notatio-knob>` is not a Wolfram symbol —
Wolfram has `Manipulator`, but that is a slider with chrome, not a number you drag
inside a sentence — so it is named for what it is. `Reversion` and
`GradeInvolution` have no symbol either. Saying which is which, in the source, is
how the rule survives contact with the parts that are genuinely ours.

The corollary is that names get **checked against a kernel** rather than
remembered. `wolframscript` is on the machine for exactly that, and it has caught
symbols we were sure existed and symbols we were sure did not.

## The debt of design

Two ideas are lifted wholesale.

**`*Form` symbols.** A single expression can be shown many ways, and each way is a
_named representation you can ask for_ rather than a mode the renderer happens to
be in. `StandardForm`, `TraditionalForm`, `FullForm`, `TeXForm` ship on
`<notatio-output>`; the pictorial ones live in `<notatio-figure>` and the plots.
The [playground overview](/playground/) tracks the whole table.

<Story
  title="TraditionalForm, FullForm, TeXForm — one expression">
<template #description>
Open the In/Out menu. Each entry is a representation, requested by name.
</template>
<notatio-output value="\frac{\sin(x)}{x^2+1}" label="Out" />
</Story>

**`Manipulate`.** A parameterised expression with a control per parameter, where
the control spec is part of the expression rather than part of the UI:
`{a, 0, 5}`, `{ {a, 2}, 0, 5, 0.5}`, `{k, {2, 3, 5, 7}}`. We parse Wolfram's own
tuple syntax, and [the Manipulate page](/playground/manipulate) is that idea more
or less intact — including the play button, which is `Manipulate`'s own looping
animation.

<Story
  title="Wolfram's control tuples, parsed as written">
<notatio-manipulate v-pre params="{ {A, 1}, 0, 2}; { {w, 2}, 0.5, 6}">
<notatio-plot value="_A * Sin(_w * x)" domain="-6.283,6.283" plot-range="-2,2" />
</notatio-manipulate>
</Story>

## The debt of verification

This is the one that has actually changed the code.

`@enumeratio/wolfram` compiles MathJSON to Wolfram Language, which makes a kernel
an **oracle**: take a reference entry, transpile it, evaluate it in a real kernel,
compare. The last full sweep agreed on the large majority of entries and left a
few dozen disagreements — each one classified and committed as golden data rather
than waved away, because a disagreement with a kernel is either our bug, their
quirk, or a genuine difference of convention, and those need different fixes.

<Story
  title="MathJSON out as Wolfram">
<template #description>
The transpiler, in the page. This is the same path the oracle sweep runs through.
</template>
<notatio-output value='["Binomial","n","k"]' format="mathjson" form="wolfram" label="Out" />
</Story>

Some of what the sweep found is worth keeping in public: `N[HurwitzZeta[-n, a]]`
comes back wrong for negative integer `n` unless you go through `FunctionExpand`
first. An oracle is a source of truth you argue with, not one you defer to.

## Where we do not follow

**`Head[…]` brackets.** Wolfram's square brackets for application are unambiguous
and we still did not take them, because the surface syntax here is
[Epsil](/playground/inspirations/compute-engine) and Epsil uses parentheses. The
`:wolfram` pragma reads Wolfram syntax when you want it; the default stays one
language.

**The all-in-one kernel.** Wolfram's coherence comes from everything living in one
system with one evaluator. Ours has to come from a seam — a set of libraries
declaring heads on a shared engine — and that is a real cost. Two libraries that
both want `Basis` have to agree to share it, which is why
`@enumeratio/algebra` exists at all.

**`Dynamic` everywhere.** Wolfram's reactivity is ambient: any displayed thing can
be `Dynamic` and the front end keeps it live. Ours is scoped on purpose, to the
inside of one wrapper, because an ambient version in a documentation site is a
page that never stops recomputing.
