# Notebook examples

A spread of [`<enumeratio-notebook>`](/develop/packages/components/expression-set)s exercising different cases —
all computed through [`@enumeratio/compute-engine`](/develop/packages/components/) (the pure `ts + ce + ce-enum`
stack, no pglite). Names are written in **PascalCase** (`Bell`, `RandomElement`, `Permutations`) — no underscores,
no `\operatorname{}`. Each is live: edit any line and everything downstream recomputes.

## Counting sequences

Closed-form counts, evaluated exactly on the compute-engine.

<ClientOnly>
<enumeratio-notebook value='{"lines":[
  {"id":"a1","latex":"\\binom{10}{3}"},
  {"id":"a2","latex":"Bell(6)"},
  {"id":"a3","latex":"CatalanNumber(7)"},
  {"id":"a4","latex":"Fubini(5)"},
  {"id":"a5","latex":"PartitionNumber(12)"},
  {"id":"a6","latex":"7!"}
]}'></enumeratio-notebook>
</ClientOnly>

## Number theory

Curated identities compute-engine shares with us — `\gcd`, `\mathrm{lcm}`, binomial, factorial — alongside a
collection's cardinality and a running sum. (Broader CE math — `\max`, `\sqrt`, `\zeta`, … — is being wired in.)

<ClientOnly>
<enumeratio-notebook value='{"lines":[
  {"id":"n1","latex":"\\gcd(48,36)"},
  {"id":"n2","latex":"lcm(8,12)"},
  {"id":"n3","latex":"\\binom{20}{10}"},
  {"id":"n4","latex":"\\left|Permutations(6)\\right|"},
  {"id":"n5","latex":"\\sum_{k=1}^{10}k"}
]}'></enumeratio-notebook>
</ClientOnly>

## Arithmetic & fractions

Exact integer arithmetic; a genuine fraction reduces to a rational (`6/4` → `3/2 ∈ ℚ`).

<ClientOnly>
<enumeratio-notebook value='{"lines":[
  {"id":"b1","latex":"2^{10}"},
  {"id":"b2","latex":"3 \\cdot 4 + 5"},
  {"id":"b3","latex":"\\frac{22}{7}"},
  {"id":"b4","latex":"\\binom{20}{10} - 1"}
]}'></enumeratio-notebook>
</ClientOnly>

## Define & apply functions

A function defines with no value of its own (`f: (n) ↦` in the meta line); calling it recomputes down the graph.

<ClientOnly>
<enumeratio-notebook value='{"lines":[
  {"id":"c1","latex":"g(x) = x^3 - x"},
  {"id":"c2","latex":"g(5)"},
  {"id":"c3","latex":"h(n) = g(n) + 1"},
  {"id":"c4","latex":"h(2)"}
]}'></enumeratio-notebook>
</ClientOnly>

## Random draws & shuffles

`RandomElement`/`RandomSample` draw through the library's O(1) `at`; `Scramble` permutes a list. The **reshuffle**
button (bottom-right) rerolls them all; it is disabled when a notebook has no randomness.

<ClientOnly>
<enumeratio-notebook value='{"lines":[
  {"id":"d1","latex":"RandomElement(Permutations(5))"},
  {"id":"d2","latex":"RandomSample(Subsets(4), 3)"},
  {"id":"d3","latex":"Scramble(\\left\\lbrack1,2,3,4,5\\right\\rbrack)"}
]}'></enumeratio-notebook>
</ClientOnly>

## Lists & locating

Enter a list with `[…]`; declare an element of a sized collection and locate it by value, then chain `Rank`/`Next`.

<ClientOnly>
<enumeratio-notebook value='{"lines":[
  {"id":"e1","latex":"\\left\\lbrack3,1,4,2\\right\\rbrack"},
  {"id":"e2","latex":"p \\in Permutations(3)"},
  {"id":"e3","latex":"p = \\left\\lbrack3,1,2\\right\\rbrack"},
  {"id":"e4","latex":"Rank(p)"},
  {"id":"e5","latex":"Next(p)"}
]}'></enumeratio-notebook>
</ClientOnly>

## Lists, comprehensions & reductions

Build a list with a `for` comprehension over a literal domain, transform it, and reduce it —
the list ops (`join`, `sort`, `unique`) and reductions (`total`, `min`, `max`, `first`, `last`)
map onto compute-engine's own operators.

<ClientOnly>
<enumeratio-notebook value='{"lines":[
  {"id":"g1","latex":"[i^2 for i=[1,2,3,4,5]]"},
  {"id":"g2","latex":"sort([5,2,9,1])"},
  {"id":"g3","latex":"unique([3,1,1,2,3])"},
  {"id":"g4","latex":"total([2i for i=[1,2,3,4]])"},
  {"id":"g5","latex":"max(join([1,2],[9,3]))"}
]}'></enumeratio-notebook>
</ClientOnly>

## Sums & sets

A big **∑** sums its body over a literal range; **`total`** sums a list (Desmos's name for it). A
**set** `{…}` canonicalizes to its distinct elements.

<ClientOnly>
<enumeratio-notebook value='{"lines":[
  {"id":"s1","latex":"\\sum_{i=1}^{4}2i"},
  {"id":"s2","latex":"\\sum_{i=1}^{5}i^2"},
  {"id":"s3","latex":"total([1,2,3,4])"},
  {"id":"s4","latex":"\\left\\lbrace1,2,2,4\\right\\rbrace"},
  {"id":"s5","latex":"total(\\left\\lbrace1,2,2,4\\right\\rbrace)"}
]}'></enumeratio-notebook>
</ClientOnly>

## Actions & the ticker

An **action** `p → …` reassigns its target when triggered — click the **→** in its gutter to run it
once, or start the **ticker** (bottom toolbar) to fire it repeatedly. The whole ticker run is one undo
step; the seed button rerolls any randomness.

<ClientOnly>
<enumeratio-notebook value='{"lines":[
  {"id":"a1","latex":"p=0"},
  {"id":"a2","latex":"p \\to p+2"},
  {"id":"a3","latex":"2p+1"}
]}'></enumeratio-notebook>
</ClientOnly>

## Errors, gracefully

An unknown name errors *below* the field, in full, once the line settles — a blank or half-typed line never
flashes one.

<ClientOnly>
<enumeratio-notebook value='{"lines":[
  {"id":"f1","latex":"Nope(3)"},
  {"id":"f2","latex":"\\binom{6}{2}"},
  {"id":"f3","latex":""}
]}'></enumeratio-notebook>
</ClientOnly>
