# @enumeratio/notatio

**Notatio** is the notebook's expression language. You write LaTeX; it parses to a small closed AST, binds and
types it against the catalog, lowers it to the engine IR, and evaluates it. The parser is
[MathLive / Compute Engine](https://mathlive.io/compute-engine/guides/latex-syntax/)'s own `latex-syntax` module,
so *what you can type* is the LaTeX MathLive accepts — but *what Notatio does* with each construct is its own story:
some LaTeX **evaluates**, some **parses but has no meaning here**, and some **does not parse at all**.

The rest of this page is a **LaTeX-syntax coverage reference**: it walks the LaTeX feature categories from
[MathLive's command reference](https://mathlive.io/mathfield/reference/commands/) and, for each, says exactly what
Notatio does. It is the *feature* view; its companion, the [Compute Engine dictionary](/develop/reference/ce-dictionary),
is the *head* view — every MathJSON operator, whether we route it, and where the gaps are. Read them together: a gap
here is an item there.

> [!NOTE] How results are produced
> Every "→ result" below is real. The section demos are **read-only [`<enumeratio-expressions>`](/develop/packages/components/expression-set)**
> (the notebook's evaluation core, non-editable), each line carrying an `expect` so it self-checks — a green ✓ next
> to a value means the live pipeline agrees with what this page claims. They run the same `makeParser` → `bind` →
> `lower` → `ts + ce + ce-enum` path the notebook uses (no pglite). Three substrates answer: **ts** = our exact
> `@enumeratio/math` twins (exact bigints), **ce** = the Compute Engine kernel (trig, roots, ζ, constants —
> numeric or exact-symbolic), **ce-enum** = the enumeration library (collections, sums, ranges, comprehensions).

## Try it

An editable notebook — everything below it is the same engine, shown read-only.

<ClientOnly>
<enumeratio-notebook value='{"lines":[
  {"id":"t1","latex":"\\frac{1}{2}+\\frac{1}{3}"},
  {"id":"t2","latex":"\\binom{6}{2}"},
  {"id":"t3","latex":"\\sqrt{2}"},
  {"id":"t4","latex":"\\zeta(2)"},
  {"id":"t5","latex":"\\sum_{i=1}^{4} i"}
]}'></enumeratio-notebook>
</ClientOnly>

Edit any line and press Enter for a new one. Fractions reduce, `\sqrt{2}` and `\zeta(2)` stay **exact-symbolic**
(rendered back as LaTeX, not a decimal), and the sum enumerates.

## Numbers & literals

| You type | Notatio | Example → result |
|---|---|---|
| plain integer | evaluates (exact bigint) | `1000` → `1000` |
| decimal | evaluates | `0.5` → `0.5` |
| thin-space thousands | evaluates (separator dropped) | `1\,000` → `1000` |
| comma thousands | evaluates | `1{,}000` → `1000` |
| scientific | evaluates | `1.5\times10^{3}` → `1500` |
| repeating decimal | **does not parse** | `0.\overline{3}` → parse error (the repeating-decimal MathJSON node has no Notatio AST) |

Integers are exact to any size (`5!` → `120`, `\gcd`/`\binom` stay in bigint); an operation that can only be
approximated (an irrational, a power past float range) falls to the CE kernel or a decimal.

## Arithmetic & precedence

| You type | Notatio | Example → result |
|---|---|---|
| `+` `-` `\times` `\cdot` `\div` | evaluates | `3\cdot4` → `12`, `6\div2` → `3` |
| unary minus | evaluates (looser than power) | `-2^{2}` → `-4` |
| `( )` and `\left(…\right)` | evaluates | `\left(3+4\right)\times2` → `14` |
| `\pm` (plus-minus) | **parses, not supported** | `3\pm2` → head `Measurement`, unmapped |
| `\oplus` `\otimes` `\odot` | **parses, not supported** | → `CirclePlus` / `CircleTimes` / `HadamardProduct`, unmapped |

Division of two integers yields an **exact rational** ∈ ℚ (`\frac{22}{7}` → `22/7`), not a float — the notebook has
no pg to be bit-identical to, so it keeps the exact value.

## Fractions, powers, roots

| You type | Notatio | Example → result |
|---|---|---|
| `\frac` `\dfrac` `\tfrac` `\cfrac` | evaluates (all four are the same division) | `\dfrac{3}{4}` → `3/4` |
| `\binom{n}{k}` | evaluates (exact) | `\binom{6}{2}` → `15` |
| `x^{n}` (power) | evaluates | `2^{10}` → `1024` |
| `\sqrt{x}` | evaluates (exact-symbolic when irrational) | `\sqrt{9}` → `3`, `\sqrt{2}` → `\sqrt{2}` |
| `\sqrt[n]{x}` | evaluates | `\sqrt[3]{27}` → `3` |
| `x_2` (subscript) | **parses as one symbol**, unknown unless in scope | `x_2` → `unknown symbol "x_2"` (subscripts name a variable, they aren't indexing) |

<ClientOnly>
<enumeratio-expressions readonly value='{"lines":[
  {"latex":"\\binom{6}{2}","expect":"15"},
  {"latex":"\\sqrt{9}","expect":"3"},
  {"latex":"\\sqrt{2}"},
  {"latex":"\\frac{22}{7}","expect":"22/7"}
]}'></enumeratio-expressions>
</ClientOnly>

The third line shows the exact-symbolic render (`√2` stays `√2`, not a decimal); the rest self-check.

## Absolute value, floor, ceiling

| You type | Notatio | Example → result |
|---|---|---|
| `\lvert x\rvert` / `\|x\|` (scalar) | evaluates (absolute value) | `\|{-5}\|` → `5` |
| `\|C\|` (a collection handle) | evaluates (**cardinality**) | `\|\operatorname{SymmetricGroup}(4)\|` → `24` |
| `\lfloor x\rfloor` | evaluates | `\lfloor 3.7\rfloor` → `3` |
| `\lceil x\rceil` | evaluates | `\lceil 3.2\rceil` → `4` |

`|…|` is deliberately overloaded: over a scalar it is `Abs`, over a collection it is the size. This is why `Abs`
is the one CE head we *don't* curate generically — the bar has to be free to mean cardinality.

<ClientOnly>
<enumeratio-expressions readonly value='{"lines":[
  {"latex":"|{-5}|","expect":"5"},
  {"latex":"\\lfloor 3.7\\rfloor","expect":"3"},
  {"latex":"\\lceil 3.2\\rceil","expect":"4"}
]}'></enumeratio-expressions>
</ClientOnly>

## Functions

| You type | Notatio | Example → result |
|---|---|---|
| `\sin` `\cos` `\tan` … | evaluates (exact at nice angles, else symbolic/numeric) | `\sin(\frac{\pi}{2})` → `1`, `\cos(0)` → `1` |
| `\arcsin` `\arctan` … + hyperbolics | evaluates | `\arctan(1)` → `\frac{\pi}{4}` |
| `\ln` `\log` | evaluates for numeric args | `\ln(1)` → `0`, `\log(100)` → `2` |
| `\log_b(x)` (base subscript) | **parses, not supported** | `\log_2(8)` → head `Lb`, unmapped (use `\frac{\log(8)}{\log(2)}`) |
| `\exp(x)` / bare `e` | **not supported** | `e` → `unknown symbol "e"` — `ExponentialE` has no Notatio binding yet |
| `\Gamma` `\zeta` | evaluates (exact-symbolic) | `\zeta(2)` → `\frac{\pi^2}{6}` |
| `\operatorname{sgn}(x)` | evaluates (**Sign**, integer) | `\operatorname{sgn}(-5)` → `-1` |
| `\operatorname{Heaviside}(x)` | evaluates (0/1, ½ at 0) | `\operatorname{Heaviside}(-2)` → `0`, `\operatorname{Heaviside}(0)` → `1/2` |

> [!WARNING] The `\operatorname{}` capitalisation trap
> `Sign` reaches the evaluator only through the built-in lowercase trigger `\operatorname{sgn}` — the capital
> `\operatorname{Sign}(-5)` does **not** application-parse under our LaTeX build (it becomes `Sign × (-5)`). The
> trig family is the same: `\sin` works because it has a backslash macro, not because `\operatorname{Sin}` parses.
> Catalog heads (`Fibonacci`, `bell`, …) get their PascalCase trigger explicitly registered (see
> [Widening a head](#widening-a-head)); the CE-native ones reuse whatever built-in trigger CE already ships.

<ClientOnly>
<enumeratio-expressions readonly value='{"lines":[
  {"latex":"\\sin(\\frac{\\pi}{2})","expect":"1"},
  {"latex":"\\log(100)","expect":"2"},
  {"latex":"\\operatorname{sgn}(-5)","expect":"-1"},
  {"latex":"\\operatorname{Heaviside}(0)","expect":"1/2"}
]}'></enumeratio-expressions>
</ClientOnly>

## Bounds, extrema & number theory

| You type | Notatio | Example → result |
|---|---|---|
| `\max` `\min` | evaluates (variadic) | `\max(1,7,3)` → `7` |
| `\sup` `\inf` | evaluates over a finite set | `\sup\{1,2,3\}` → `3` |
| `\gcd` `\lcm` | evaluates (variadic, exact) | `\gcd(12,18,8)` → `2` |
| `\bmod` | evaluates | `17\bmod5` → `2` |
| catalog counting heads | evaluate (exact, via ts twins) | `\binom{6}{2}`, `5!`, `\operatorname{bell}(4)`, `CatalanNumber(5)`, `Fibonacci(10)` |

The counting sequences (`bell`, `catalan_number`, `partition_number`, `fibonacci`, …) resolve against the catalog,
so they cross-check against the same collections the atlas enumerates. See the
[Compute Engine dictionary](/develop/reference/ce-dictionary#number-theory) for the full head list and typing.

## Big operators

| You type | Notatio | Example → result |
|---|---|---|
| `\sum_{i=a}^{b}` | evaluates (unrolls the range) | `\sum_{i=1}^{4} i` → `10` |
| `\prod_{i=a}^{b}` | evaluates | `\prod_{i=1}^{4} i` → `24` |
| `\int_a^b … dx` | **not supported** | `\int_0^1 x^2 dx` → `Integrate` unmapped (no symbolic-calculus binder) |
| `\bigcup` `\bigcap` | **not supported** | indexed set-builders don't lower yet |

<ClientOnly>
<enumeratio-expressions readonly value='{"lines":[
  {"latex":"\\sum_{i=1}^{10} i^2","expect":"385"},
  {"latex":"\\prod_{k=1}^{5} k","expect":"120"}
]}'></enumeratio-expressions>
</ClientOnly>

## Greek letters & constants

| You type | Notatio | Example → result |
|---|---|---|
| `\pi` | evaluates (constant; folds under `N`) | `\pi` → `3.14159…` |
| `\varphi` | evaluates (golden ratio) | `\varphi` → `1.61803…` |
| `CatalanConstant` | evaluates | numeric |
| `\alpha` `\beta` … (lowercase) | **a free variable** | `\alpha` → `unknown symbol "alpha"` until bound/declared |
| `\Gamma(x)` (uppercase word) | evaluates **only** via the `\Gamma` macro | `\Gamma(3)` parses to the Gamma function; `\operatorname{Gamma}(3)` does not (capitalisation trap) |

Constants are reached by an *unambiguous* trigger only, and scope wins first — so `\pi = 3` on an earlier line
shadows the constant, and a variable named `\varphi` is yours.

## Sets, lists & ranges

| You type | Notatio | Example → result |
|---|---|---|
| `\{1,2,3\}` | evaluates (an ordered list) | `\{1,2,3\}` → `[1,2,3]` |
| `[1..5]` (range) | evaluates | `[1..5]` → `[1,2,3,4,5]` |
| `[e \text{ for } i=…]` (comprehension) | evaluates | `[i^2 \text{ for } i=[1,2,3]]` → `[1,4,9]` |
| `[1,3..9]` (stepped range) | **not supported yet** | list literals must be plain numbers |
| `\cup` `\cap` | **not supported over list literals** | `join`/`meet` are lattice ops, not defined on `integer[]` |
| `\setminus` | **not supported** | → `SetMinus`, unmapped |
| `x \in \{…\}` | **not supported over a literal** | a set literal types as a value, not a collection — `\in` needs a catalog collection on the right |
| `x \in \mathbb{Z}` | evaluates (membership) | `\mathbb{N}` / `\mathbb{Z}` / `\mathbb{Q}` map to our number collections |
| `\{x \mid P\}` (restriction) | **parses, not supported** | → `Condition`, no set-builder binder |

<ClientOnly>
<enumeratio-expressions readonly value='{"lines":[
  {"latex":"[i^2 \\text{ for } i=[1,2,3,4]]","expect":"[1, 4, 9, 16]"},
  {"latex":"[2..8]","expect":"[2, 3, 4, 5, 6, 7, 8]"}
]}'></enumeratio-expressions>
</ClientOnly>

## Comparisons & logic

| You type | Notatio | Example → result |
|---|---|---|
| `\le` `<` `\ge` `>` `=` `\ne` | evaluates (boolean) | `3\le5` → `true`, `3\ne4` → `true` |
| `x \in C` (as an expression) | evaluates (membership boolean) | over a catalog collection |
| `\land` `\lor` `\lnot` | **not supported** | `And`/`Or`/`Not` need a boolean-typed binder |
| `\forall` `\exists` `\implies` `\iff` | **not supported** | quantifiers/implication don't bind |
| `\mid` (divides) | **not supported** | `3\mid12` → `Divides`, unmapped (boolean return) |

Comparisons swap operands the way CE does (`3>5` parses to `Less(5,3)`); the result is always a boolean over pure
scalars. The logic family is a known gap — it waits on non-scalar (boolean) return typing in the binder.

<ClientOnly>
<enumeratio-expressions readonly value='{"lines":[
  {"latex":"3\\le5","expect":"true"},
  {"latex":"5\\ge3","expect":"true"},
  {"latex":"3\\ne4","expect":"true"}
]}'></enumeratio-expressions>
</ClientOnly>

## Matrices & environments

`\begin{pmatrix}…\end{pmatrix}`, `\begin{bmatrix}`, `\begin{cases}`, `\begin{align}` and the other AMS environments
**do not parse** in Notatio today — the parser reports an error rather than a `Matrix` node. Linear algebra (`\det`,
`\operatorname{Transpose}`, `\operatorname{Trace}`) therefore has nothing to operate on. This is the single largest
unimplemented LaTeX area; the CE kernel itself supports it (see
[the dictionary's linear-algebra section](/develop/reference/ce-dictionary#linear-algebra)), so wiring it is a
matter of admitting the environment through our parser and lowering `Matrix`.

## Accents & decorations

Accents **parse** (MathLive maps each to a MathJSON head) but Notatio has no meaning for them — and a couple are
outright footguns, so avoid them on anything you want evaluated:

| You type | Parses to | Note |
|---|---|---|
| `\hat{x}` `\vec{x}` `\tilde{x}` | `OverHat` / `OverVector` / `OverTilde` | unmapped |
| `\overline{x}` | `OverBar` | unmapped |
| `\bar{x}` | **`Mean`** | footgun — `\bar` is CE's mean, not a decorative bar |
| `\dot{x}` | **`D`** (derivative) | footgun — parses as a derivative |
| `\cancel{x}` | `x` | the decoration is dropped |

## Delimiters, spacing, text & style

| You type | Notatio | Note |
|---|---|---|
| `\left…\right` | evaluates | auto-sized delimiters are transparent |
| `\,` `\;` `\quad` (spacing) | evaluates (ignored) | `3\,+\,4` → `7` |
| `\langle…\rangle` | **not supported** | → `AngleBracket`, unmapped |
| `\text{…}` | **not an expression** | a text-only line is treated as a comment/label, not lowered |
| `\textcolor{…}{…}`, `\displaystyle`, size commands | **do not parse to a value** | pure-style wrappers produce a style node with no AST meaning |
| `\mathbf{3}` | **mangles the symbol** | the bold styling folds into the identifier (`three_bold`) — don't style operands |

Notation you *display* (bold, color, sizing) is separate from notation you *compute*. Keep operands unstyled.

## Compute-Engine natural-parser extras

MathLive's parser recognises a lot of "natural" notation. Most of it parses in Notatio but has no evaluation
meaning yet:

| You type | Parses to | Notatio |
|---|---|---|
| `AB \parallel CD` | `Parallel` | geometry — not supported |
| `x'` (primed) | `Prime` | not supported |
| `1^{st}` (ordinal superscript) | recovered as a scripted symbol | not supported |
| `1,2,\ldots,5` (ellipsis) | an elliptical sequence | doesn't bind |
| `p.x` (dot access) | rewritten by our own pre-pass | `.count`/`.rank`/`.at` on a handle — see below |

## Parse & serialize options

Notatio configures the CE `LatexSyntax` deliberately; the settings and why:

- **`preserveLatex: true`** — every parsed node keeps its source LaTeX, which is how spans (for error underlining)
  are recovered. Used.
- **`skipSpace: false`** — *unusable for us.* We set `mathModeSpace: '\ '` so a typed space is meaningful, and
  `skipSpace` would eat it.
- **`parseNumbers: false`** — *errors* on this build; left at default. Numbers parse normally.
- **`dotNotation`** — **serialize-only.** CE renders a few arity-1 heads as `p.count` but does **not** *parse* dot
  notation (`ce.parse('p.first')` errors). So we keep our own `rewriteDotMethods` pre-pass, which rewrites
  *enumeratio* dot methods (`p.rank`, `p.at`, …) to function calls before CE ever sees them. See the
  [dictionary's dot-notation note](/develop/reference/ce-dictionary#dot-notation-serialization-dotnotation-option).
- **Identifiers spell `\operatorname{}`, never `\mathrm{}`.** Both render upright, but `\mathrm{cd}`/`\mathrm{bar}`/
  `\mathrm{deg}` unit-parse to candela/pressure/degree — so every catalog id and plain variable uses
  `\operatorname{}` to stay clear of CE's unit lookup.

## Widening a head

A CE-native scalar head becomes evaluable in three coordinated edits (only the first two if the head already
application-parses through a built-in trigger, as `sgn`/`Heaviside` do):

1. **`packages/notatio/src/names.ts`** — add `Head: { kernel: 'Head' }` to `OPERATORS` (the `{kernel}` branch is
   arity-agnostic; the result types `numeric`).
2. **`packages/client/src/ce-engine.ts`** — add the head to `KERNEL_OPS` and `KERNEL_HEADS` so the engine accepts
   and evaluates it.
3. **`packages/components/src/notebook-catalog.ts`** — add it to `KERNEL_WORD_OPS` **only if** its PascalCase word
   form does not application-parse on its own. Registering a head whose name already exists in CE's dictionary
   (`Sign`, `Beta`, `LambertW`) emits a duplicate-definition warning — those need a *trigger-only* dictionary entry
   instead, which is a follow-up.

Always probe the real behaviour first — `new ComputeEngine().parse(x).evaluate()` shows what CE computes, but the
notebook parser is `LatexSyntax + LATEX_DICTIONARY` only (a narrower dictionary than the full engine), so a head
that parses in one may not in the other. The [dictionary's gaps section](/develop/reference/ce-dictionary#gaps-worth-implementing-in-our-library--proposing-upstream)
is the running to-do.
