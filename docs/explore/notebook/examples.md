# Notebook examples

A spread of [`<enumeratio-notebook>`](/develop/packages/components/expression-set)s exercising different cases —
all computed through [`@enumeratio/compute-engine`](/develop/packages/components/) (the pure `ts + ce + ce-enum`
stack, no pglite). Each is live: edit any line and everything downstream recomputes.

## Counting sequences

Closed-form counts, evaluated exactly on the compute-engine.

<ClientOnly>
<enumeratio-notebook value='{"lines":[
  {"id":"a1","latex":"\\binom{10}{3}"},
  {"id":"a2","latex":"\\operatorname{bell}(6)"},
  {"id":"a3","latex":"\\operatorname{catalan\\_number}(7)"},
  {"id":"a4","latex":"\\operatorname{fubini}(5)"},
  {"id":"a5","latex":"\\operatorname{partition\\_number}(12)"},
  {"id":"a6","latex":"7!"}
]}'></enumeratio-notebook>
</ClientOnly>

## Arithmetic & fractions

Exact integer arithmetic; a genuine fraction currently renders as its decimal (a place we want to let you cycle
the presentation later).

<ClientOnly>
<enumeratio-notebook value='{"lines":[
  {"id":"b1","latex":"2^{10}"},
  {"id":"b2","latex":"3 \\cdot 4 + 5"},
  {"id":"b3","latex":"\\frac{22}{7}"},
  {"id":"b4","latex":"\\binom{20}{10} - 1"}
]}'></enumeratio-notebook>
</ClientOnly>

## Define & apply functions

A function defines with no value of its own (`f: (n) ↦` in the meta line); calling it, or referencing a
previously-defined symbol, recomputes down the dependency graph.

<ClientOnly>
<enumeratio-notebook value='{"lines":[
  {"id":"c1","latex":"g(x) = x^3 - x"},
  {"id":"c2","latex":"g(5)"},
  {"id":"c3","latex":"h(n) = g(n) + 1"},
  {"id":"c4","latex":"h(2)"}
]}'></enumeratio-notebook>
</ClientOnly>

## Random enumeration

`random_element` draws a uniform element of a collection through the library's O(1) `at` — a fresh one whenever a
line above it changes.

<ClientOnly>
<enumeratio-notebook value='{"lines":[
  {"id":"d1","latex":"\\operatorname{random\\_element}(\\operatorname{permutations}(5))"},
  {"id":"d2","latex":"\\operatorname{random\\_element}(\\operatorname{subsets}(4))"},
  {"id":"d3","latex":"\\operatorname{random\\_element}(\\operatorname{dyck\\_paths}(4))"}
]}'></enumeratio-notebook>
</ClientOnly>

## Errors, gracefully

An unknown function errors *below* the field, in full, once the line settles — a blank or half-typed line never
flashes one.

<ClientOnly>
<enumeratio-notebook value='{"lines":[
  {"id":"e1","latex":"\\operatorname{not\\_a\\_function}(3)"},
  {"id":"e2","latex":"\\binom{6}{2}"},
  {"id":"e3","latex":""}
]}'></enumeratio-notebook>
</ClientOnly>
