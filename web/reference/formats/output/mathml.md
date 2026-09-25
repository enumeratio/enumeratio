# MathML

A **text output form**: presentation MathML, surfaced as the `MathMLForm` form. It is a
pure function of the MathJSON tree — no engine, no canonicalisation — so the same tree
always prints the same string, with attributes in a fixed order.

Unlike [Wolfram FullForm](/reference/formats/output/wolfram), MathML **does not
round-trip**. The registry format `MathML` (aliases `mathml`, `MathMLForm`) has an
`encode` and no `decode` (`packages/formats/src/formats.ts`), because there is no MathML
parser on the other side. That is a freedom rather than a limitation: the emitter owes
nothing to being read back, so it can pick whatever typesets best — a `<mfrac>` for a
`Divide`, an `<msqrt>` for a `Sqrt`, a zero-thickness `<mfrac>` in delimiters for a
`Binomial`.

Parenthesisation is precedence-driven the way a TraditionalForm printer works: every node
reports how tightly it binds, and a parent wraps a child in `<mo>(</mo> … <mo>)</mo>` only
when the child binds looser than the slot it is going into.

|               |                                                                 |
| ------------- | --------------------------------------------------------------- |
| Registry name | `MathML`                                                        |
| Aliases       | `mathml`, `MathMLForm`                                          |
| MIME types    | `application/mathml-presentation+xml`, `application/mathml+xml` |
| Extension     | `.mml`                                                          |
| Direction     | export only                                                     |

`:mime application/mathml+xml` in the [CLI](/docs/cli/) resolves to it, and `:formats` shows it
with `[export]` and no import.

<Story
  title="MathMLForm, live">
<template #description>
Any output cell reaches this through its form selector; <code>out-form</code> pins it.
</template>
<notatio-cell value="Sqrt(x ^ 2 + y ^ 2)" out-form="mathml" box />
</Story>

There is no `in-form="mathml"` counterpart — with no decoder, there is nothing to type
into.

Each row below shows an expression and its presentation MathML.

<SourceOutput language="mathml" />
