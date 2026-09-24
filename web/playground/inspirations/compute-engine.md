# Compute Engine

Everything here runs on [Compute Engine](https://cortexjs.io/compute-engine/),
with [MathLive](https://cortexjs.io/mathlive/) for the editing and the
typesetting and **Epsil** for the syntax — three pieces of Arno Gourdol's Cortex
JS, and the reason enumeratio is a family of definitions declared onto an engine
rather than a computer algebra system of its own, and notatio a set of components
over the engine's own editor rather than a new editor.

That is worth saying plainly, because the borrowing is total. We did not write a
parser, a typesetter, a term representation, a canonicaliser, an evaluator, a
rule engine, an arbitrary-precision numeric tower or a LaTeX renderer. We wrote
heads.

## What each piece is

**MathJSON** is the term format: an expression is JSON, `["Add", ["Power", "x", 2], 1]`,
with no class hierarchy to serialise through. It travels over a wire, sits in a
test fixture, and diffs in a pull request.

**Compute Engine** boxes that into expressions with a canonical form, a type
system, assumptions, exact arithmetic over a numeric tower that includes
bignums and rationals, and — the part we lean on hardest —
`ce.declare`, which lets a library add a head as a first-class citizen rather
than as a preprocessing pass.

**MathLive** is the editor and the renderer: `<math-field>` is a real math input
with a virtual keyboard and screen-reader support, and the same engine renders
static markup, which is what every piece of typeset maths on this site goes
through — the prose, the reference pages, the readouts.

**Epsil** is compute-engine's own surface syntax: `Binomial(10, 3)`, capitalised
heads, `(` for calls, `[…]` for lists. Our `notatio` is Epsil
[restricted to a single expression](/reference/formats/) with no statements and
no effects — a gate over it, not a fork.

## The engine, in the page

<Story
  title="An editable cell">
<template #description>
A MathLive field on top, the engine's answer underneath. Click into it and
retype — the arithmetic is exact, so the answer is a fraction rather than
<code>0.8333…</code>.
</template>
<notatio-cell value="1 / 2 + 1 / 3" />
</Story>

<Story
  title="One expression, several forms">
<template #description>
The In/Out label opens a menu of representations. They are not renderers we
bolted on: <code>StandardForm</code>, <code>FullForm</code> and
<code>TeXForm</code> come out of the same boxed expression, and the MathJSON
underneath is what all of them are reading.
</template>
<notatio-out value="\binom{n}{k}" label="Out" />
</Story>

<Story
  title="Exact until you ask otherwise">
<template #description>
Drag the number. The left side stays a surd or an integer as the case may be; the
right is the same value asked for numerically. Exactness is the default and
approximation is a request — which is the property that lets a coefficient stay
π all the way through a product.
</template>
<notatio-dynamic-module>
The square root of <notatio-knob name="n" value="12" min="1" max="40" /> is
<notatio-dynamic value="Sqrt(_n)" digits="0" />, or
<notatio-dynamic value="N(Sqrt(_n))" digits="12" /> if you insist.
</notatio-dynamic-module>
</Story>

## Why we could extend it at all

A computer algebra system that cannot be extended from outside is a system you
have to fork. Compute Engine's extension surface is what made this repository
possible, and it is worth naming the four seams we actually use:

- **`ce.declare(head, …)`** — a new operator with a signature, algebraic flags
  and an `evaluate` handler. Every head in
  [the reference](/reference/symbol/) is one of these.
- **Replacing a definition while keeping the native one.** `ce.declare` replaces
  the whole definition, but the previous handler can be captured first and called
  through. That is how the two-argument `Zeta` extends the built-in one instead of
  shadowing it, and how the hypercomplex generators ride inside ordinary `Add` and
  `Multiply`.
- **`ce.declareType`** — nominal types (`mint`) and structural aliases, with real
  dispatch: a head declared over a minted `Permutation` refuses a structurally
  identical bare list. That is the substrate for
  [domains](/reference/domains/).
- **A pluggable compiler.** The engine compiles an expression to a target, and
  the target list is open — which is why `<notatio-out>` can show you the same
  expression as Python, as JavaScript, as WGSL, and why the GPU phase portraits
  compile a notatio expression straight to a shader.

<Story
  title="The same expression, compiled">
<template #description>
Not a pretty-printer — this is the compile target the GPU pages actually run.
</template>
<notatio-out value="\sin(x) + y^2" form="gpushader" label="Out" />
</Story>

## Where we diverge

Three places, each deliberate.

**notatio is a subset of Epsil, not a superset.** Epsil has statements, assignment,
declarations, control flow and pragmas. An attribute on a web component has room
for one expression and no room for an effect, so `parseNotatio` gates all of that
out and reports a diagnostic rather than throwing. The gate is the whole
difference; the grammar underneath is the engine's, unchanged.

**LaTeX is the escape hatch, not the default.** Bare LaTeX is an error here — it
goes in `$…$` islands inside a notatio line. The engine is perfectly happy to
parse LaTeX and for a long time we let it; the trouble is that LaTeX has no
notion of a head, so `\mathrm{Foo}(x)` and a product of five letters look the same
until you evaluate them. Epsil says which is which.

**We print notatio, not LaTeX, as the canonical text.** A result should read back
as itself. `InputForm` is the rule: whatever the engine hands back, the printed
form re-parses to the same value.

## What we would still like

- **Set-builder notation.** Epsil has set literals, a membership operator and a
  type-declaration statement, but no `{x ∈ S : P(x)}`. Half the domains we want to
  describe are described that way in the literature.
- **A canonicalisation seam.** Canonical form runs before any `evaluate` handler
  and is not extensible, which is what makes an anticommuting product awkward to
  express — the operand order is gone before a handler can see it.
- **Assumptions that reach the extensions.** The engine has an assumptions
  mechanism; our heads mostly cannot consult it yet, so a `Sqrt` that knows its
  argument is positive is not a thing our libraries can act on.
