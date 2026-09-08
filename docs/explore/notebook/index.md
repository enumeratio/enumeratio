# Notebook

A bare [`<enumeratio-notebook>`](/develop/packages/components/expression-set) — a stack of MathLive lines that
compute **purely through [`@enumeratio/compute-engine`](/develop/packages/components/)**: counting sequences and
arithmetic evaluate on the compute-engine (exact, arbitrary-precision), and a random element is drawn by the
library's own O(1) handlers. Nothing round-trips to SQL. Edit any line — everything downstream of it recomputes.

<ClientOnly>
<enumeratio-notebook storage-key="docs-notebook-demo" value='{"lines":[
  {"id":"l1","latex":"\\binom{6}{2}"},
  {"id":"l2","latex":"\\operatorname{bell}(4)"},
  {"id":"l3","latex":"\\operatorname{catalan\\_number}(5)"},
  {"id":"l4","latex":"\\operatorname{partition\\_number}(10)"},
  {"id":"l5","latex":"5!"},
  {"id":"l6","latex":"\\operatorname{random\\_element}(\\operatorname{permutations}(4))"},
  {"id":"l7","latex":"f(n) = n^2 + 1"},
  {"id":"l8","latex":"f(3)"}
]}'></enumeratio-notebook>
</ClientOnly>

Reading the lines: `\binom{6}{2}` = 15 and `5!` = 120 are plain arithmetic; `bell(4)` = 15, `catalan_number(5)` =
42 and `partition_number(10)` = 42 are counting sequences the compute-engine evaluates exactly;
`random_element(permutations(4))` draws a uniform permutation of `[4]` through the library's O(1) `at` (a fresh
one each time you edit above it); `f(n) = n^2 + 1` defines a small function of its own and `f(3)` = 10 calls it.

Every result here comes from `@enumeratio/compute-engine` — the notebook's engine is the pure `ts + ce + ce-enum`
stack, with no pglite in the evaluation path.
