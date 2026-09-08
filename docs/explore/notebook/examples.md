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

## Arithmetic & fractions

Exact integer arithmetic; a genuine fraction currently renders as its decimal.

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

`RandomElement`/`RandomSample` draw through the library's O(1) `at`; `Shuffle` permutes a list. The **reshuffle**
button (bottom-right) rerolls them all; it is disabled when a notebook has no randomness.

<ClientOnly>
<enumeratio-notebook value='{"lines":[
  {"id":"d1","latex":"RandomElement(Permutations(5))"},
  {"id":"d2","latex":"RandomSample(Subsets(4), 3)"},
  {"id":"d3","latex":"Shuffle(\\left\\lbrack1,2,3,4,5\\right\\rbrack)"}
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
the list ops (`join`, `sort`, `unique`) and reductions (`sum`, `min`, `max`, `first`, `last`)
map onto compute-engine's own operators.

<ClientOnly>
<enumeratio-notebook value='{"lines":[
  {"id":"g1","latex":"[i^2 \\operatorname{for} i=[1,2,3,4,5]]"},
  {"id":"g2","latex":"\\operatorname{sort}(\\left\\lbrack5,2,9,1\\right\\rbrack)"},
  {"id":"g3","latex":"\\operatorname{unique}(\\left\\lbrack3,1,1,2,3\\right\\rbrack)"},
  {"id":"g4","latex":"\\operatorname{sum}([2i \\operatorname{for} i=[1,2,3,4]])"},
  {"id":"g5","latex":"\\operatorname{max}(\\operatorname{join}(\\left\\lbrack1,2\\right\\rbrack,\\left\\lbrack9,3\\right\\rbrack))"}
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
