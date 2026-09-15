# InputForm

**InputForm** is an expression printed as notatio you could have typed. It is what the
components put on the clipboard, what the REPL prints, and what the `InputForm`
entry in any Out menu shows.

The name is Wolfram's, and so is the idea. `InputForm` there is a _printer_, not a hold:
it renders whatever expression it is handed, in a linear syntax you can type back in.
Evaluation is a separate question — `HoldForm[1 - 2x]` prints `1 - 2*x` while
`InputForm[E^(I Pi) + 1]` prints `0`, because the second one evaluated before InputForm
ever saw it. Ours works the same way: hand it what you typed and it prints what you
typed; hand it a result and it prints the result.

## It is notatio, not LaTeX

The rule is the one the [components](/reference/components/) already follow:
the syntax is notatio, and LaTeX appears only inside a `$…$` island. InputForm never
emits an island — a test asserts it — so what comes out is always something the notatio
parser reads on its own.

<Story title="Out as InputForm">
<template #description><code>box</code> holds the expression instead of evaluating it, so the Out is the integral itself, spelled as notatio. Switch the Out menu to compare it with MathJSON or TeXForm.</template>
<notatio-cell value="Integrate(x ^ 2, (x, 0, 1))" out-form="input" box />
<notatio-cell value="Sum(n ^ 2, (n, 1, 10))" out-form="input" box />
<notatio-cell value="(x + 1) / (y - 2)" out-form="input" box />
<notatio-cell value="Limit(Sin(x) / x, 0)" out-form="input" box />
</Story>

Drop the `box` and the same cells evaluate first — which is the Wolfram behaviour above,
not a different format. `InputForm` prints what it is handed.

<Story title="The same cells, evaluated">
<notatio-cell value="Integrate(x ^ 2, (x, 0, 1))" out-form="input" />
<notatio-cell value="Sum(n ^ 2, (n, 1, 10))" out-form="input" />
<notatio-cell value="e ^ (i * Pi) + 1" out-form="input" />
</Story>

## What it prints

Both columns below are InputForm. They differ because they are printing two different
expressions: the one you typed, and the one compute-engine canonicalized it into.

| Typed                                  | As typed                      | Canonicalized                 |
| -------------------------------------- | ----------------------------- | ----------------------------- |
| `\frac{x+1}{y-2}`                      | `(x + 1) / (y - 2)`           | `(x + 1) / (y - 2)`           |
| `1 - 2x`                               | `1 - 2x`                      | `-2 * x + 1`                  |
| `a - (b - c)`                          | `a - (b - c)`                 | `a - b + c`                   |
| `x \ge 3`                              | `x >= 3`                      | `3 <= x`                      |
| `\int_0^1 x^2 dx`                      | `Integrate(x ^ 2, (x, 0, 1))` | `Integrate(x ^ 2, (x, 0, 1))` |
| `\lim_{x\to 0}\frac{\sin x}{x}`        | `Limit(Sin(x) / x, 0)`        | `Limit(Sin(x) / x, 0)`        |
| `e^{i\pi}+1`                           | `e ^ (i * Pi) + 1`            | `1 + ExponentialE ^ (i * Pi)` |
| `\log_2(8)`                            | `Lb(8)`                       | `Log(8, 2)`                   |
| `\begin{pmatrix}1&2\\3&4\end{pmatrix}` | `Matrix([[1, 2], [3, 4]])`    | `Matrix([[1, 2], [3, 4]])`    |

Copying out of a `<notatio-in>` gives you the first column: the field knows the LaTeX
you typed, so it prints from that rather than from a canonicalized rewrite of it. An Out
renders whatever the cell computed, which is usually the second.

## The normalization rules

`serializeEpsil` alone prints both trees badly, each in its own way, so InputForm
rewrites a handful of shapes first. None of them changes what the expression means.

| Shape                                | Prints as         | Why it is there                                           |
| ------------------------------------ | ----------------- | --------------------------------------------------------- |
| `InvisibleOperator(2, x)`            | `2x`              | the as-typed parse of juxtaposition                       |
| `Add(x, -2)`                         | `x - 2`           | canonicalization turns subtraction into a negative addend |
| `Multiply(-1, x)`                    | `-x`              | and negation into a coefficient                           |
| `Function(do {f}, x)` in `Integrate` | `Integrate(f, …)` | canonicalization wraps a body in a lambda                 |
| `Limits(x, 0, 1)`                    | `(x, 0, 1)`       | and its bounds in a head                                  |
| `Delimiter(e)`                       | `e`               | the as-typed parse keeps the parentheses you wrote        |
| `Complex(0, 1)`                      | `i`               | what a person types                                       |

## It round-trips

The point of the format is that what it prints, you can type back in. Every expression
in the test corpus is printed from both trees and parsed back, and both must give the
same canonical expression the original LaTeX means. A rule that changed the meaning
would fail there rather than merely looking prettier.

That is also why the rules stop where they do. Reordering `-2 * x + 1` into `1 - 2 * x`
would read better, but it is the canonical expression saying what it is; InputForm
prints expressions, it does not rewrite them.

## Elsewhere

- **Clipboard** — copying from a `<notatio-in>` yields InputForm rather than LaTeX,
  for the selected range or the whole field.
- **Out menu** — any `<notatio-out>` offers `InputForm` alongside StandardForm,
  MathJSON and the code forms.
- **CLI** — `InputForm` is the display form the REPL prints, and
  `notatio -f inputform` exports it. `notatio`, `text` and the old `Notatio` still
  resolve to it.
- **API** — `toInputForm(json)` and `normalizeInputForm(json)` from
  `@enumeratio/formats`.
