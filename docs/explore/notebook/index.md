# Notebook

A worked [`<enumeratio-expression-set>`](/develop/packages/components/expression-set) — declare a symbol into a
collection, define it, reference it from later lines (`next`/`rank`/arithmetic), define a small function, and call
it. Edit any line: everything downstream of it recomputes.

<ClientOnly>
<enumeratio-assert expect='{"l1":"","l2":"10","l3":"15","l4":"4","l5":"11","l6":"5","l7":"","l8":"10"}' label="notebook seed evaluates as expected" reveal="always">
<enumeratio-expression-set value='{"lines":[
  {"id":"l1","latex":"x \\in \\operatorname{triangular\\_numbers}"},
  {"id":"l2","latex":"x = 10"},
  {"id":"l3","latex":"\\operatorname{next}(x)"},
  {"id":"l4","latex":"\\operatorname{rank}(x)"},
  {"id":"l5","latex":"x + 1"},
  {"id":"l6","latex":"\\binom{6}{2} - x"},
  {"id":"l7","latex":"f(n) = n^2 + 1"},
  {"id":"l8","latex":"f(3)"}
]}'></enumeratio-expression-set>
</enumeratio-assert>
</ClientOnly>

Reading the lines: `x` is declared a located element of `triangular_numbers`, then defined `10` (the 5th triangular
number, T₄ — 0-indexed rank 4 — since `0,1,3,6,10,…`; a value NOT in the collection here would error `not a member
of triangular_numbers` instead). `next(x)` is the next triangular number after it (`15`); `rank(x)` is its 0-based
position (`4`); `x + 1` is plain arithmetic (`11`); `\binom{6}{2} - x` mixes a curated identity with a re-embedded
scope value (`15 - 10 = 5`); `f(n) = n^2 + 1` defines a small function with no value of its own; `f(3)` calls it
(`10`).

Try it — edit `x = 10` to a non-triangular value (say `11`) and every line reading `x` shows an error instead of a
stale value; edit it back and they recover.
