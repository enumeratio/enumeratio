# Compute-engine dictionary

An inventory of `@cortex-js/compute-engine`'s node dictionary — what it parses, what it actually *computes*, and
where its canonicalization silently rewrites what you typed into something else. Written so the notebook
(`packages/notatio/src/ce/latex.ts`, `packages/client/src/ce-engine.ts`) can work *with* CE's own vocabulary
instead of around it, and so gaps here become a concrete to-do list rather than a recurring surprise.

**Pinned version: `@cortex-js/compute-engine@0.125.0`.** Everything below was produced by instantiating a live
`ComputeEngine` from that exact build (`dist/esm-min/compute-engine.js`) and calling `ce.parse(latex)`, `.json`,
`.evaluate()`, `.N()`, `.latex`, `expr.toLatex(opts)`, plus its introspection surface — `ce.operatorInfo()`,
`ce.symbolInfo()`, `ce.lookupDefinition()`, and `ce.latexSyntax.getNamedTriggers()`. Nothing here is asserted from
documentation or training-data memory alone — CE has shipped behavior changes across minor versions before, and
this pass already caught two places where 0.125's behavior diverges from the upstream docs (dot-notation
serialization and the `Total` framing, both below). Treat every row as **version-specific** and re-probe before
relying on this against a different pin. The probe scripts themselves are throwaway (per this repo's own-scripts
convention) and were not committed; reconstructing them is a few dozen lines against the introspection calls named
above.

`getNamedTriggers()` enumerates **365** distinct named LaTeX-dictionary entries in this build (each a
`{name, triggers[]}` — a target head plus one or more parse triggers, e.g. `{name:"Max", triggers:["\max"]}`).
Enriching every one with `operatorInfo()` buckets them:

- **151 evaluable functions** (`kind:"function"`, `canEvaluate:true`) — `Max`, `Gcd`, `Determinant`, `Mean`, …
- **37 opaque operators** (`kind:"opaque"`, `canEvaluate:false`) — registered heads that parse but never reduce:
  `Subtract`, `Greater`, `GreaterEqual`, `Prime`, `Lg`, `Lb`, the geometry/`color` constructors, the negated
  relations (`NotLess`, `NotDivides`, …). Some of these are *canonicalized away* before evaluation and so still
  produce answers (see `Lg`/`Lb`, `Subtract`); others genuinely never compute (see `Prime`).
- **177 value symbols** (no `operatorInfo`) — Greek letters, constants (`\pi`, `\varphi`→`GoldenRatio`), and the
  single-letter special-function triggers.

Most combinatorial *functions* — Binomial aside — have **no dedicated backslash macro** and are reachable only
through the generic `\operatorname{Name}(...)` catch-all. That distinction matters: the named-trigger path is
closed (CE either knows the macro or the parser errors), but the generic `\operatorname{}` path resolves an
arbitrary identifier at parse time against CE's whole symbol table — and that resolution has several silent
failure modes documented in [Footguns](#footguns-parse-time-surprises) below.

## How CE resolves `\operatorname{Name}(args)`

This is the single most important thing to internalize before reading the tables — four different outcomes for
what looks like the same syntax:

1. **`Name` is a registered operator** → a real function-call node; may or may not have a working `evaluate`/`N`
   handler (see the *evaluates?* column throughout).
2. **`Name` is a registered *value* symbol** (kind `variable`/`constant`, not an operator) → parses as
   **multiplication** of the symbol and the parenthesized argument, e.g. `\operatorname{PartitionCount}(5)` →
   `5 * PartitionCount`. Silent, never errors, structurally looks fine.
3. **`Name` is entirely unknown to CE** → auto-declares `Name` as a fresh, permanently inert function-typed
   placeholder. No error, ever — it just echoes back symbolically forever. Confirmed for `Total`, `Tuples`,
   `Subsets`, `Shuffle` in this build (all four are auto-declared on first use, **not** pre-registered — see the
   `Total` correction under [Extrema](#extrema--aggregates)).
4. **`Name` is mis-cased or misspelled but happens to match a dictionary alias** → CE can silently substitute a
   *different, unrelated* operator. Confirmed: `\operatorname{shuffle}` (lowercase) resolves to `RandomShuffle`
   via an explicit alias entry; `\operatorname{stddev}` resolves to a *misspelled dead head* `StandarDeviation`
   rather than the real `StandardDeviation` (an upstream typo — see [Gaps](#gaps-worth-implementing-in-our-library--proposing-upstream)).

"It parsed without error" is therefore not evidence a feature exists. Every entry below was checked against
*both* `operatorInfo()`/`lookupDefinition()` (does CE know this operator ahead of time) *and* an actual
`.evaluate()`/`.N()` call — that double-check is what caught outcomes 2–4.

## Arithmetic & algebra

| CE head | LaTeX trigger(s) | Canonicalizes from / aliases | Signature | Evaluates? | Example | Notes |
|---|---|---|---|---|---|---|
| `Add` | `+` | | `(value+) -> value` | exact | `2+3` → `5` | we curate this (`op: add`) |
| `Subtract` | `-` (infix) | pre-folded to `Add`/`Negate` at parse time | `(number+) -> number` | **opaque, never** (`canEvaluate:false`) | `2-3` parses straight to literal `-1`, never a `Subtract` node | we curate this (`op: sub`); CE itself never actually computes *through* a `Subtract` node |
| `Multiply` | `\times`, `\cdot`, juxtaposition | | `(number*) -> number` | exact | `2\times 3` → `6` | curated (`op: mul`). `\times` between two `Set`s is **still `Multiply`**, not `CartesianProduct` — it throws `incompatible-type` |
| `Divide` | `\frac{}{}` | non-integer division canonicalizes to a `Rational` node, not a `Divide` echo | `(complex\|infinity, ...) -> number` | exact/rational | `2/3` → `Rational(2,3)`, `N` → `0.666…` | curated (`op: div`) |
| `Negate` | `-` (prefix) | | `(complex\|infinity) -> number` | exact | `-5` → `-5` | curated (`op: neg`) |
| `Power` | `^` | `Exp`/`\exp` and `Square` canonicalize here | `(complex\|infinity, complex\|signed_infinity) -> number` | exact | `2^{10}` → `1024` | curated (`op: pow`) |
| `Sqrt` | `\sqrt{}` | | `(complex\|infinity) -> complex\|infinity` | exact for perfect squares, else stays symbolic | `\sqrt{16}` → `4` | curated (`{ce: Sqrt}`) |
| `Root` | `\sqrt[n]{}` | | `(complex\|infinity, complex\|infinity) -> number` | exact for perfect roots | `\sqrt[3]{27}` → `3` | curated (`{ce: Root}`) |
| `Abs` | `\|x\|` | | `(complex\|infinity) -> number` | exact | `\|-5\|` → `5` | **the one head deliberately left unmapped** (`UNMAPPED_HEADS_NO_CURATED_ID`) — `\|x\|` is handled separately so `\|C\|` can mean *cardinality* |
| `Rational` | (produced by `Divide` canonicalization, not its own trigger) | | `(integer,integer)->rational \| (real)->rational` | exact | `2/3` → `["Rational",2,3]` | CE's own canonical fraction representation |

## Rounding, sign & modular

| CE head | LaTeX trigger(s) | Canonicalizes from / aliases | Signature | Evaluates? | Example | Notes |
|---|---|---|---|---|---|---|
| `Floor` | `\lfloor x \rfloor` | | `(real\|signed_infinity) -> integer\|signed_infinity` | exact | `\lfloor 3.7\rfloor` → `3` | curated (`{ce: Floor}`) |
| `Ceil` | `\lceil x \rceil` | | same shape | exact | `\lceil 3.2\rceil` → `4` | curated (`{ce: Ceil}`) |
| `Round` | `round` (bare word trigger, no backslash) | `\operatorname{round}` (lowercase) also lands here | `(real, integer?) -> real` | exact | `round(3.456)` → `3` | curated (`{ce: Round}`). A 2-arg `Round(3.456,2)` rounds to a place and returns an **exact rational** (`173/50`), not `3.46` |
| `Sign` | `sgn` (bare word) | `\operatorname{sgn}` | `(number) -> integer` | exact | `\operatorname{sgn}(-5)` → `-1` | not curated — cheap gap |
| `Chop` | `chop` (bare word) | | `(number, tolerance?) -> number` | exact, tolerance-gated | `\operatorname{Chop}(10^{-8})` → `10^{-8}` (default tol ~`10^{-10}`, so unchanged) | zeroes near-zero values; useful after numeric noise |
| `Heaviside` | `Heaviside` (bare word) | | `(real) -> integer` | exact | `\operatorname{Heaviside}(-2)` → `0` | step function |
| `Mod` | `\bmod`, `\operatorname{mod}` | `\bmod` triggers head `Mod` (not `Modulo`) | `(real,real) -> real` | exact | `7 \bmod 3` → `1` | curated (`{ce: Mod}`) |
| `Clamp` | `\operatorname{Clamp}(x,lo,hi)` | | `(real, real, real) -> real` | exact | `Clamp(15,0,10)` → `10` | not curated — cheap gap |

## Extrema & aggregates

| CE head | LaTeX trigger(s) | Canonicalizes from / aliases | Signature | Evaluates? | Example | Notes |
|---|---|---|---|---|---|---|
| `Max` | `\max` | | `(value*) -> number` | exact, over bare args or a `Set`/`List` arg | `\max(3,7,2)` → `7` | curated (`{ce: Max}`) |
| `Min` | `\min` | | `(value+) -> number` | exact | `\min(3,7,2)` → `2` | curated (`{ce: Min}`) |
| `Supremum`/`Infimum` | `\sup`/`\inf` | | `(collection) -> number` | exact on a bounded set | `\sup\{1,2,3\}` → `3` | not curated |
| `Sum` (indexed) | `\sum_{i=a}^{b} expr` | | | exact | `\sum_{i=1}^{5} i` → `15` | |
| `Sum` (list) | `\operatorname{Sum}(\{...\})` | `\operatorname{total}` (lowercase) also → `Sum` | `(any, tuple*) -> number` | exact | `\sum(\{1,2,3\})` → `6` | both call shapes work |
| `Product` (indexed) | `\prod_{i=a}^{b} expr` | | | exact | `\prod_{i=1}^{5} i` → `120` | |
| `Product` (list) | `\prod(\{1,2,3,4\})` | **desugars to `Reduce(list, Multiply, 1)` at parse time**, not a literal `Product` node | | exact | → `24` | the indexed form keeps a `Sum`/`Product` head; the list form does not — asymmetric |
| `Total` | `\operatorname{Total}(...)` (capital) | **auto-declared placeholder** — *not* pre-registered, *not* an alias of `Sum` | none (fake) — `operatorInfo` **none** on a fresh engine | **never** — echoes through both `evaluate()` and `N()` | `\operatorname{Total}([1,2,3,4])` stays symbolic forever | **correction to a prior note:** on 0.125 `Total` is outcome-3 (auto-declared inert placeholder, same as `Tuples`/`Subsets`), *not* a registered-but-dead operator. Lowercase `\operatorname{total}` is a *different* thing entirely — it aliases to `Sum` and works. Use `Sum` |

## Number theory

| CE head | LaTeX trigger(s) | Canonicalizes from / aliases | Signature | Evaluates? | Example | Notes |
|---|---|---|---|---|---|---|
| `GCD` | `\gcd` | curated (`fn: gcd`) | `(any*) -> number` | exact | `\gcd(12,18)` → `6` | bare `gcd(12,18)` (no backslash/`\operatorname`) misparses as `c*g*d(12,18)` — see footguns |
| `LCM` | `\lcm` | curated (`fn: lcm`) | `(any*) -> number` | exact | `\lcm(4,6)` → `12` | same bare-word trap as GCD |
| `Factorial` | `!` (postfix) | curated (`fn: factorial`) | | exact | `5!` → `120` | |
| `Factorial2` | `!!` (postfix, double factorial) | not curated | | exact | `5!!` → `15` | cheap gap, same shape as `Factorial` |
| `Binomial` | `\binom{n}{k}` | curated (`fn: binomial`) | | exact | `\binom{5}{2}` → `10` | |
| `Choose` | `\operatorname{Choose}(n,k)`, `\operatorname{nCr}(n,k)` | numerically identical to `Binomial` but a **separate, non-canonicalizing** head | `(complex\|infinity, complex\|infinity) -> number` | exact | `Choose(5,2)` → `10` | duplicate of `Binomial`; `nCr` is a word alias into it — decide whether to alias both into our `binomial` fn |
| `Gamma` | `\Gamma(x)` | curated (`{ce: Gamma}`) | `(complex\|infinity, ...) -> number` | `evaluate()` stays symbolic; `N()` computes | `\Gamma(5)` evaluate → unchanged, `N` → `24` | eval/N split |
| `Zeta` | `\zeta(s)` | curated (`{ce: Zeta}`) | `(complex\|infinity) -> number` | `evaluate()` finds closed forms; `N()` gives decimal | `\zeta(2)` evaluate → `(1/6)\pi^2`, `N` → `1.6449…` | genuine symbolic math, not just numerics |
| `Divisors` | `\operatorname{Divisors}(n)` | | `(integer) -> list<integer>` | exact | `Divisors(12)` → `[1,2,3,4,6,12]` | gap — list return needs non-numeric typing before our binder can carry it |
| `Totient` | `\operatorname{Totient}(n)` | | `(integer) -> integer` | exact | `Totient(12)` → `4` | integer-valued; trivial `{ce}` add (peer branch wiring it) |
| `IsPrime` | `\operatorname{IsPrime}(n)` | | `(number) -> boolean` | exact | `IsPrime(7)` → `True` | gap — boolean return needs non-numeric typing |
| `NextPrime` | `\operatorname{NextPrime}(n[,k])` | | `(integer, integer?) -> integer` | exact | `NextPrime(10)` → `11` | integer-valued; trivial `{ce}` add |
| `Prime` | `x^\prime` (also `\operatorname{Prime}(n)`) | | `(T, integer?) -> T` | **opaque, never** (`canEvaluate:false`) | `\operatorname{Prime}(5)` → stays `Prime(5)`, never `11` | the nth-prime function is *registered but unimplemented* — a genuine dead head (unlike `Total`, which isn't registered at all). Upstream candidate |
| `PrimePi` | `\operatorname{PrimePi}(x)` | | `(real) -> integer` | exact | `PrimePi(10)` → `4` | gap — π(x), directly relevant to our number-theory carriers |
| `PrimeFactors` | `\operatorname{PrimeFactors}(n)` | | `(integer) -> list<integer>` | exact | `PrimeFactors(12)` → `[2,3]` | returns the **distinct** primes (the radical), *not* the multiset with multiplicity (`[2,2,3]`). Gap |
| `Fibonacci` | `\operatorname{Fibonacci}(n)` | | `(integer) -> integer` | exact | `Fibonacci(10)` → `55` | integer-valued; trivial `{ce}` add (peer branch wiring it) |
| `Lucas` | `\operatorname{Lucas}(n)` | **canonicalizes to head `LucasL`** | `(integer) -> integer` | exact | `Lucas(10)` → `123` | binding `{ce: Lucas}` still works — CE rewrites `Lucas`→`LucasL` and evaluates |
| `CatalanNumber` | `\operatorname{CatalanNumber}(n)` | | `(integer) -> integer` | exact | `CatalanNumber(5)` → `42` | gap — we have a `catalan_number` collection to cross-check against |
| `BellNumber` | `\operatorname{BellNumber}(n)` | | `(integer) -> integer` | exact | `BellNumber(5)` → `52` | gap — we have a `bell` collection |
| `Stirling` (2nd kind) | `\operatorname{Stirling}(n,k)` | | `(integer,integer) -> integer` | exact | `Stirling(5,2)` → `15` | gap |
| `StirlingS1` (1st kind, signed) | `\operatorname{StirlingS1}(n,k)` | | `(integer,integer) -> integer` | exact | `StirlingS1(5,2)` → `-50` | gap — **signed**, not the unsigned `\|s(n,k)\|` convention |
| `Eulerian` | `\operatorname{Eulerian}(n,k)` | | `(integer,integer) -> integer` | exact | `Eulerian(5,2)` → `66` | gap |
| `NPartition` | `\operatorname{NPartition}(n)` | number of integer partitions, p(n) | `(integer) -> integer` | exact | `NPartition(5)` → `7` | gap — **not** `PartitionCount` (dead placeholder) and **not** `Partition` (collection-chunking op) |
| `Multinomial` | `\operatorname{Multinomial}(k1,...,kn)` | | `(integer+) -> integer` | exact | `Multinomial(1,2,3)` → `60` | variadic; trivial `{ce}` add (peer branch wiring it) |

## Transcendental & constants

| CE head | LaTeX trigger(s) | Canonicalizes from / aliases | Signature | Evaluates? | Example | Notes |
|---|---|---|---|---|---|---|
| `Power` | `\exp(x)` | `Exp` **canonicalizes to `Power(ExponentialE, x)` at parse time** — no literal `Exp` head is ever produced | | exact/symbolic hybrid | `\exp(2)` → `Power(ExponentialE,2)`, `N` → `7.389…` | curated (`{ce: Exp}`); matches CE's "reduces only through canonical rewrite" family |
| `Ln` | `\ln(x)` | curated (`{ce: Ln}`) | | exact for `e^k` args | `\ln(e)` → `1` | |
| `Log` | `\log(x)`, `\log_b(x)` | curated (`{ce: Log}`). `\lg`→`Log(x,10)`, `\lb`→`Log(x,2)` | | exact for perfect powers | `\log(100)` → `2`, `\log_2(8)` → `3` | `Lg`/`Lb` show as `opaque` in `operatorInfo` but **canonicalize to `Log` and do compute** (`\lg(1000)`→`3`) — the opaque head is never emitted |
| `Sin`/`Cos`/`Tan`/`Arcsin`/`Sinh`/… | `\sin`, `\cos`, `\tan`, `\arcsin`, `\sinh`, … | curated (`{ce: Sin/Cos/Tan}`); the ~30 remaining trig/hyperbolic + inverse heads are not | | exact at "nice" angles (0, π-multiples), else symbolic | `\sin(\pi)` → `0`, `\arcsin(1)` → `(1/2)\pi` (symbolic), `N` → `1.5708…` | |
| `Pi` | `\pi` | bare symbol, not a 0-ary function | | `N()` only — `evaluate()` keeps it symbolic | `\pi` evaluate → `"Pi"` (unchanged), `N` → `3.14159…` | marked `k: 'unsupported'` in our own `BUILTIN_SYMBOLS` — no catalog binding yet |
| `ExponentialE` | `e` | | | `N()` only | evaluate → `"ExponentialE"`, `N` → `2.71828…` | also marked unsupported in our table |
| `GoldenRatio` | `\varphi` | | | `N()` only | evaluate → `"GoldenRatio"`, `N` → `1.61803…` | not in our `BUILTIN_SYMBOLS` yet |
| `CatalanConstant` | `\operatorname{G}` (single-letter word trigger) | | | `N()` only | evaluate → `"CatalanConstant"`, `N` → `0.91596…` | see the single-letter footgun |

## Special functions

CE ships a broad special-function library. Most compute only through `.N()`; several stay symbolic even under `N`.
Their LaTeX triggers include a set of **single-capital-letter** `\operatorname{}` words — a real footgun (below).

| CE head | LaTeX trigger(s) | Signature | Evaluates? | Example | Notes |
|---|---|---|---|---|---|
| `Beta` | `\Beta`, `\operatorname{Beta}` | `(number,number)->number` | `evaluate()` finds exact rational; `N()` decimal | `Beta(2,3)` evaluate → `1/12` | Euler beta |
| `LambertW` | `\operatorname{W}` | `(number)->number` | `evaluate()` symbolic; `N()` computes | `W(1)` `N` → `0.5671…` (Ω constant) | |
| `BesselJ`/`BesselY`/`BesselI`/`BesselK` | `\operatorname{J}`/`\operatorname{Y}`/`\operatorname{I}`/`\operatorname{K}` | `(order, x)->number` | `N()` only, and stays symbolic for many arg shapes | `BesselI(0,1)` → symbolic echo | **single-letter triggers** |
| `AiryAi`/`AiryBi` | `\operatorname{Ai}`/`\operatorname{Bi}` | `(x)->number` | `N()` only | | |
| `PolyLog` | `\operatorname{Li}` | `(s,z)->number` | **never reduces in 0.125** — `Li(2,0.5)` stays symbolic even under `N()` | `PolyLog(2,0.5)` → echo | possible upstream gap |
| `LogIntegral` | `\operatorname{li}` (lowercase) | `(x)->number` | `N()` only | | distinct from `PolyLog`'s `Li` |
| `FresnelS`/`FresnelC` | `FresnelS`/`FresnelC` (bare words) | `(x)->number` | `N()` only | | |

## Sets & lists

**Read this table's *evaluates?* column carefully — it is the least intuitive part of this whole inventory.**
Several operators only ever compute through `.N()` (numeric evaluation), never through `.evaluate()`
(symbolic/exact simplification): `Join`, `Sort`, `Take`, `Drop`, `Map`, `Reverse`, `Zip`, `Permutations`,
`Combinations`, `Range` all fall in this bucket. If a caller only calls `.evaluate()` and treats a same-shape
echo as "stayed symbolic, give up," it will silently under-deliver on all of these.

| CE head | LaTeX trigger(s) | Canonicalizes from / aliases | Signature | Evaluates? | Example | Notes |
|---|---|---|---|---|---|---|
| `Set` | `\{a,b,c\}` | | `(any*) -> set` | exact (structural echo) | `\{1,2,3\}` → `Set(1,2,3)` | **unordered** — see the ordered-collection trap below |
| `List` | `[a,b,c]` | | `(any*) -> list` | exact | `[1,2,3]` → `List(1,2,3)` | **ordered** / an `indexed_collection` — use this, not `Set`, for anything positional |
| `Union` | `\cup` | curated (`op: join`) | `(any+) -> set` | exact | `\{1,2\}\cup\{2,3\}` → `\{1,2,3\}` | |
| `Intersection` | `\cap` | curated (`op: meet`) | `(any+) -> set` | exact | `\{1,2\}\cap\{2,3\}` → `\{2\}` | |
| `SetMinus` | `\setminus` | | `(set,set)->set` | exact | `\{1,2,3\}\setminus\{2\}` → `\{1,3\}` | not curated |
| `SymmetricDifference` | `\triangle` | | `(set,set)->set` | exact | `\{1,2\}\triangle\{2,3\}` → `\{1,3\}` | not curated |
| `Complement` | `^{\complement}` | curated (`op: complement`) | | | | |
| `Subset`/`SubsetEqual`/`Superset`/`SupersetEqual` | `\subset`/`\subseteq`/`\supset`/`\supseteq` | | `(set,set)->boolean` | exact when decidable | `\{1,2\}\subseteq\{1,2,3\}` → `True` | not curated |
| `Divides` | `\mid` | | `(integer,integer)->boolean` | exact | `3\mid 12` → `True` | not curated — cheap number-theory gap |
| `Element` | `\in` | curated (`special: contains`) | `(any, any, boolean?) -> boolean` | exact when decidable | `3\in\{1,2,3\}` → `True` | |
| `NotElement` | `\notin` | | `(any,any)->boolean` | exact when decidable | | |
| `Count` | `\operatorname{Count}(coll)` | | `(collection)->integer` | exact | `Count([1,2,3])` → `3` | curated (`special: cardinality`); CE's own `Count` equals `Length` here |
| `Length` | `\operatorname{Length}(x)` | | `(any) -> infinity\|integer` | exact | `Length([1,2,3])` → `3` | |
| `Range` | `1..5` | | `(number, number?, step?) -> indexed_collection` | `evaluate()` stays lazy (`Range(1,5)`); `N()` materializes | `N` → `[1,2,3,4,5]` | CE parses `..` for us — the notebook leans on this for `[1..4]`/`[1,3..9]` |
| `At` | `L[i]` | curated (`special: element_at`) | `(any, index+) -> unknown` | exact **on a `List`**; **throws on a `Set`** | `[1,2,3,4][1]` works, `\{1,2,3,4\}[1]` throws `incompatible-type` | ordered-collection trap (see below) |
| `Join` | `\operatorname{Join}(a,b,...)` | | `((T+)->T str) & (collection*->collection)` | `N()` only | `Join(\{1,2\},\{3,4\})` `N` → `\{1,2,3,4\}` | |
| `Sort` | `\operatorname{Sort}(list[,cmp])` | | | `N()` only, **`List`/`Tuple` only** | `Sort([3,1,2])` `N` → `[1,2,3]`; `Sort(\{3,1,2\})` throws | ordered-collection trap |
| `Unique` | `\operatorname{Unique}(coll)` | | `((T)->T str) & (collection<T>->list<T>)` | `evaluate()` reduces (unlike `Sort`/`Join`) | `Unique(\{1,1,2,3,3\})` evaluate → `[1,2,3]` | |
| `First`/`Last` | `\operatorname{First}`/`\operatorname{Last}(list)` | | `(indexed_collection) -> any` | `evaluate()` reduces on a `List`; throws on a `Set` | `First([1,2,3])` → `1` | ordered-collection trap |
| `Take`/`Drop` | `\operatorname{Take}`/`\operatorname{Drop}(list,n)` | | `((T,n)->T str) & (indexed_collection<T>,n)->list<T>` | `N()` only | `Take([1,2,3,4],2)` `N` → `[1,2]` | |
| `Map` | `\operatorname{Map}(f, coll)` | **argument order: function FIRST, collection second** — `(coll, fn)` throws `incompatible-type` | `(mapping, collection<T>+) -> indexed_collection` | `N()` only | `Map(x\mapsto x^2, [1,2,3])` `N` → `[1,4,9]` | footgun — see below |
| `Filter` | `\operatorname{Filter}(coll, pred)` | **collection FIRST, predicate second** — opposite order from `Map` | `(collection<T>, predicate) -> collection` | `evaluate()` *and* `N()` both reduce | `Filter([1,2,3,4], x>2)` → `[3,4]` | footgun — argument order is inconsistent with `Map` |
| `Reduce` | `\operatorname{Reduce}(coll, fn, init)` | `fn` must be a real function reference (`\operatorname{Add}`); a bare unwrapped word misparses | `(collection<T>, reducer, initial?) -> value` | exact | `Reduce([1,2,3,4], \operatorname{Add}, 0)` → `10` | |
| `Reverse` | `\operatorname{Reverse}(list)` | | | `N()` only | `Reverse([1,2,3])` `N` → `[3,2,1]` | |
| `Tally` | `\operatorname{Tally}(list)` | | `(collection<T>) -> tuple<list<T>, list<integer>>` | exact | `Tally([1,1,2,3,3,3])` → `([1,2,3],[2,1,3])` | value/count pairing |
| `Zip` | `\operatorname{Zip}(a,b,...)` | | `(indexed_collection+) -> list` | `N()` only | `Zip([1,2,3],[4,5,6])` `N` → `[(1,4),(2,5),(3,6)]` | |
| `Permutations` | `\operatorname{Permutations}(coll[,k])` | | `((S,k?)->list<string> str) & (collection,k?)->list<list>` | `N()` only | `Permutations(\{1,2,3\})` `N` → all 6 | |
| `Combinations` | `\operatorname{Combinations}(coll,k)` | | same shape as `Permutations` | `N()` only | `Combinations(\{1,2,3\},2)` `N` → 3 pairs | |
| `Tuples` | `\operatorname{Tuples}(coll,k)` | **auto-declared inert placeholder** (outcome 3) — `operatorInfo` none on a fresh engine | none (fake) | **never**, no error either | `Tuples([1,2],2)` stays symbolic forever | footgun — looks like a real feature, isn't |
| `Subsets` | `\operatorname{Subsets}(coll)` | same as `Tuples` | none (fake) | never | `Subsets([1,2,3])` stays symbolic | footgun — same as `Tuples` |
| `RandomShuffle` | `\operatorname{RandomShuffle}(coll)`, also via lowercase `\operatorname{shuffle}(coll)` | see [aliases](#canonicalization-aliases) | `((T)random->T str) & ((indexed_collection<T>)random->list<T>)` | **exact (random) — genuinely works** | `RandomShuffle([1,2,3,4,5])` → a random permutation | *not* the "unimplemented" head our own code comment describes — see the correction below |
| `RandomChoice` | `\operatorname{RandomChoice}(coll,n)` | | `(collection\|set<real>, number) random -> list` | exact (random) | 1-arg call throws `"missing"` — **requires 2 args** | |
| `RandomSample` | `\operatorname{RandomSample}(coll,n)` | | | exact (random) | `RandomSample([1,2,3,4,5],2)` → e.g. `[5,3]` | |
| `RandomPrime` | `\operatorname{RandomPrime}(lo,hi)` | | `(integer, integer?) random -> integer` | exact (random) | `RandomPrime(10,100)` → e.g. `11` | |
| `Random` | `\operatorname{Random}([coll])` | | `((collection\|set)?) random -> any` | exact (random) | `Random()` → uniform float in `[0,1)` | |
| `WithRandomSeed` | `\operatorname{WithRandomSeed}(seed, expr)` | | `(real\|string, any) -> expression` | exact | `WithRandomSeed(42, RandomShuffle([1,2,3]))` → deterministic given the seed | CE's own reproducible-randomness primitive — worth comparing against our notebook's seeded-randomness design |

**Correcting an in-repo assumption about `Shuffle`/`RandomShuffle`.** `packages/compute-engine/src/library.ts`
binds our own `Scramble(list)` op with a comment claiming CE's `RandomShuffle` is "unimplemented." Probing this
build shows a more precise picture:
- `Shuffle` and `RandomShuffle` are **two distinct, unrelated heads** — `Shuffle` is its own auto-declared inert
  placeholder (outcome 3), never a redirect to `RandomShuffle`.
- `RandomShuffle` **is fully implemented** and evaluates correctly. It is not "unimplemented."
- The likely source of the original comment: `RandomShuffle` requires an `indexed_collection` (`List`/`Tuple`);
  calling it on a `Set` throws `incompatible-type`, which reads like "doesn't work" if the probe passed a `Set`.
- Separately, `\operatorname{shuffle}` (lowercase) *does* resolve to `RandomShuffle` via an explicit dictionary
  alias — a real but narrower hazard than "the head canonicalizes."

Keeping our own `Scramble` is still reasonable (it's O(n) and generic over any of our collection views, where
`RandomShuffle` materializes a `List` first) — but the comment's "unimplemented" justification is inaccurate and
worth a follow-up fix.

**The ordered-vs-unordered trap, called out once for all the rows above that hit it:** `Sort`, `First`, `Last`,
`Take`, `Drop`, `At`, and `RandomShuffle` all require an `indexed_collection` (`List`/`Tuple`) and throw
`incompatible-type` on a `Set` — sets are unordered in CE's type system, so "first element of a set" is a real
type error, not a bug. Any bridge from our own carriers (already totally ordered) into CE must land on `List`,
never `Set`, wherever a positional op might apply downstream.

## Logic & relations

| CE head | LaTeX trigger(s) | Canonicalizes from / aliases | Signature | Evaluates? | Example | Notes |
|---|---|---|---|---|---|---|
| `Equal` | `=` | curated (`op: eq`) | `(any, any) -> boolean` | exact | `2=2` → `True` | |
| `Less` | `<` — **also receives swapped args from `>` and `\ge`/`\gt`** | curated (`op: lt`) | `(any, any*) -> boolean` | exact | `3>2` parses directly to `Less(2,3)` → `True` | see canonicalization below |
| `Greater` | `\gt` — CE's parser **never actually emits this head** | opaque (`canEvaluate:false`) | | never (opaque) | only reachable via a manual `ce.box(['Greater', ...])` | we map `Greater`→`op: gt` in our own dictionary — harmless as long as *we* produce the head, not CE's LaTeX parser |
| `GreaterEqual` | `\ge`/`\geq` — same swap-to-`LessEqual` treatment | opaque (`canEvaluate:false`) | | never (opaque) | | same caveat as `Greater` |
| `And`/`Or`/`Not` | `\land`, `\lor`, `\lnot` | | `(boolean+)->boolean` / `(boolean)->boolean` | exact | `\mathrm{True}\land\mathrm{False}` → `False` | |
| `Xor`/`Nand`/`Nor` | `\veebar`/`\barwedge`/`⊽` | | `(boolean+)->boolean` | exact | `\mathrm{True}\veebar\mathrm{False}` → `True` | full boolean set present |
| `Implies`/`Equivalent` | `\implies`/`\iff` | | `(boolean,boolean)->boolean` | exact | `\mathrm{True}\implies\mathrm{False}` → `False` | `\iff` over two equal literals folds at parse time (`True\iff True` → `True`) |
| `ForAll`/`Exists`/`ExistsUnique` | `\forall`/`\exists`/`\exists!` | | | exact when decidable | `\forall x (x=x)` → `True` | quantifiers |

## Statistics

| CE head | LaTeX trigger(s) | Signature | Evaluates? | Example | Notes |
|---|---|---|---|---|---|
| `Mean` | `mean` (bare word), `\operatorname{Mean}` | `(collection)->number` | `evaluate()` exact rational; `N()` decimal | `Mean([1,2,3,4])` → `5/2`, `N` → `2.5` | |
| `Median` | `median` (bare word) | `(collection)->number` | exact | `Median([1,2,3,4,5])` → `3` | |
| `Variance` | `\operatorname{Variance}` | `(collection)->number` | exact rational; `N()` decimal | `Variance([1,2,3,4])` → `5/3` | |
| `StandardDeviation` | `\operatorname{StandardDeviation}` | `(collection)->number` | exact; `N()` decimal | `StandardDeviation([1,2,3,4])` → `\sqrt{15}/3` | ⚠ the *word trigger* `stddev` points at a **misspelled** head `StandarDeviation` (dead placeholder), NOT this one — upstream bug (below) |

## Calculus

| CE head | LaTeX trigger(s) | Signature | Evaluates? | Example | Notes |
|---|---|---|---|---|---|
| `Integrate` | `\int_a^b expr \, dx` | `(function, limits+)->number` | exact | `\int_0^1 x^2 dx` → `1/3` (`N` wraps in `Measurement`) | definite integral computes symbolically |
| `D` | `\frac{d}{dx}(expr)` | `(expr, var+)->expr` | exact | `\frac{d}{dx}(x^2)` → `2x` | symbolic derivative |
| `Limit` | `\lim_{x\to a} expr` | `(function, approach)->number` | exact for standard limits | `\lim_{x\to 0}\frac{\sin x}{x}` → `1` | |
| `CircularIntegrate` | `\oint` | `(function, limits+)->number` | opaque (`canEvaluate:false`) | | contour integral — registered, doesn't compute |

## Linear algebra

Matrices parse from `\begin{pmatrix}…\end{pmatrix}` to a `Matrix` node; these ops evaluate over it.

| CE head | LaTeX trigger(s) | Signature | Evaluates? | Example | Notes |
|---|---|---|---|---|---|
| `Determinant` | `\det` | `(matrix)->number` | exact | `\det\begin{pmatrix}1&2\\3&4\end{pmatrix}` → `-2` | |
| `Transpose` | `M^T` | `(matrix)->matrix` | exact | → `[[1,3],[2,4]]` | |
| `Trace` | `\tr` | `(matrix)->number` | exact | → `5` | |
| `Kernel`/`Dimension`/`Rank` | `\ker`/`\dim`/`\operatorname{Rank}` | | mostly opaque/symbolic in 0.125 | | present as triggers; verify before relying |
| `HadamardProduct` | `\odot` | | | | elementwise product |

## Dot-notation serialization (`dotNotation` option)

CE has a `dotNotation` serialize option that renders certain arity-1 calls in receiver-dot-method form
(`p.count`) instead of the default function-call form. Probing 0.125 pins down its exact, **narrower-than-the-docs**
behavior — this bears directly on our own `rewriteDotMethods` pre-pass in `packages/notatio/src/ce/latex.ts`.

**It is a serialize-only option.** Pass it to the serializer:

```js
ce.box(['Length', 'p']).toLatex({ dotNotation: true })  // → "p.\operatorname{count}"
ce.box(['Length', 'p']).toLatex()                        // → "\mathrm{Length}(p)"  (default; dotNotation defaults false)
```

Confirmed facts on this build:

- **Default is `false`** — the function-call form (`\mathrm{Length}(p)`) is what you get unless you opt in.
- **Only a *small registered set* of heads convert**, each keyed to that head's lowercase word-alias — not a
  general "any arity-1 call becomes a dot" rewrite. The full converting set found by surveying arity-1 heads:
  `Length` → `p.\operatorname{count}`, `Real` → `p.\operatorname{real}`, `Imaginary` → `p.\operatorname{imag}`.
  **`First`, `Last`, `Reverse`, `Sort` do *not* convert** — they stay `\mathrm{First}(p)` even with the option on.
  (The upstream mathlive.io example showing `First` → `p.first` does **not** hold in 0.125 — re-verify per pin.)
- **Multi-operand forms never dot** — `Sum` with an index range and any arity-2+ call serialize normally.
- **CE does *not* parse dot notation.** `ce.parse('p.first')` errors `unexpected-operator` on `.`, and passing
  `{ dotNotation: true }` (or `{ canonical: false }`) to `parse` changes nothing — the option has no parse side.
  So `dotNotation` round-trips *serialize → your string*, not *your string → parse*.

**Implication for us:** we cannot lean on CE to parse `p.count` / `p.rank`. Our `rewriteDotMethods` pre-pass stays
necessary — and it targets *enumeratio* vocabulary (`.count`, `.rank`, `.at`, our collection methods) that CE's
serializer wouldn't emit or resolve anyway. The one small overlap is `.count` (CE's dot form for `Length`), which
our pre-pass already rewrites to a function-call before CE ever sees it.

## Canonicalization aliases

The LaTeX spelling you type is frequently *not* the MathJSON head produced. Two distinct alias mechanisms exist.

**(a) Named-trigger canonicalization** — dedicated parse triggers whose target head differs from the glyph:

| You type | Canonical head | Notes |
|---|---|---|
| `\max` / `\min` | `Max` / `Min` | |
| `\gcd` / `\lcm` | `GCD` / `LCM` | all-caps, not `Gcd`/`Lcm` |
| `\bmod` | `Mod` | not `Modulo` |
| `>` (and `\gt`) | `Less` | **operands swapped**: `3>2` → `Less(2,3)` |
| `\ge`/`\geq` | `LessEqual` | same swap |
| `\exp(x)` | `Power(ExponentialE, x)` | no literal `Exp` head ever appears |
| `\lg` / `\lb` | `Log(x,10)` / `Log(x,2)` | opaque heads canonicalized to `Log` |
| `sgn` / `round` / `chop` / `mean` / `median` | `Sign` / `Round` / `Chop` / `Mean` / `Median` | bare-word triggers |
| `\Gamma` / `\zeta` / `\Beta` | `Gamma` / `Zeta` / `Beta` | |
| `\lim` / `\int` / `\det` / `\tr` | `Limit` / `Integrate` / `Determinant` / `Trace` | |

**(b) `\operatorname{}` identifier aliases** — the generic catch-all resolves a *word* to a differently-named head
via CE's operator dictionary (a separate table from named triggers). See [Word-name redirects](#word-name-redirects).

Also present as pure syntax sugar (own dedicated LaTeX trigger): `\lfloor…\rfloor` → `Floor`, `\lceil…\rceil` →
`Ceil`, `!`/`!!` → `Factorial`/`Factorial2`, `\binom{}{}`→ `Binomial`, `|x|` → `Abs`, `\frac{}{}` →
`Divide`/`Rational`, `\setminus` → `SetMinus`, `\triangle` → `SymmetricDifference`, `\mid` → `Divides`.

## Word-name redirects

The generic `\operatorname{word}` path resolves an identifier against CE's operator dictionary; a short verb/noun
frequently points at a differently-named canonical head. These are explicit dictionary entries, stable within a
version (unlike case-insensitive fuzz — the aliased word and any capitalized head are *unrelated* symbols, so
`\operatorname{Shuffle}` (capital) does **not** reach `RandomShuffle`; it auto-declares an inert placeholder). The
ones that intersect enumeratio's vocabulary:

| You type | Canonical head | Note |
|---|---|---|
| `\operatorname{shuffle}` | `RandomShuffle` | the case study above |
| `\operatorname{random}` | `Random` | |
| `\operatorname{total}` | `Sum` | matches our own `total`→`Sum` binder alias; distinct from the dead capital-`Total` placeholder (footgun #5) |
| `\operatorname{count}` / `\operatorname{length}` | `Length` | |
| `\operatorname{sort}` / `\operatorname{reverse}` / `\operatorname{unique}` / `\operatorname{join}` | `Sort` / `Reverse` / `Unique` / `Join` | |
| `\operatorname{repeat}` / `\operatorname{range}` / `\operatorname{mod}` | `Repeat` / `Range` / `Mod` | |
| `\operatorname{nCr}` | `Choose` | binomial coefficient |
| `\operatorname{and}` / `\operatorname{or}` | `And` / `Or` | |

Remaining entries are statistics heads (`cdf`→`CDF`, `pdf`→`PDF`, `corr`→`Correlation`, `cov`→`Covariance`,
`var`→`Variance`, `histogram`→`Histogram`, and the buggy `stddev`→`StandarDeviation`), plus symbol shorthands
(`e`→`ExponentialE`, `i`→`ImaginaryUnit`, `True`/`False`).

**Single-capital-letter special-function triggers.** A distinct hazard: several `\operatorname{}` *single capital
letters* resolve to special functions — `\operatorname{W}`→`LambertW`, `\operatorname{I}`→`BesselI`,
`\operatorname{J}`→`BesselJ`, `\operatorname{K}`→`BesselK`, `\operatorname{Y}`→`BesselY`, `\operatorname{G}`→
`CatalanConstant`, `\operatorname{Ai}`/`\operatorname{Bi}`→Airy, `\operatorname{Li}`→`PolyLog`. A bare capital
letter a user means as a variable or index can silently become a Bessel call. Keep our own single-letter carrier
ids out of `\operatorname{}` where they'd collide.

### Notating the random family

The random operators have no bespoke LaTeX glyph — each is written `\operatorname{Name}(...)`, PascalCase, and
parses straight to that head:

| Written | Head | Notes |
|---|---|---|
| `\operatorname{RandomShuffle}([1,2,3])` | `RandomShuffle` | permutes a List/Tuple/String, **and any indexed collection view** (e.g. `RandomShuffle(SymmetricGroup(4))` shuffles all 24 elements through our CollectionHandlers). Throws `incompatible-type` on a `Set` (unordered). |
| `\operatorname{WithRandomSeed}(42, expr)` | `WithRandomSeed` | CE's determinism wrapper — pins the RNG for `expr`. This is CE's native seeding seam. |
| `\operatorname{Random}()` / `\operatorname{Random}(n)` | `Random` | uniform real in [0,1) / integer draw. |

## Footguns (parse-time surprises)

1. **A bare multi-letter word with no `\operatorname{}` wrapper and no backslash macro is always implicit
   multiplication of single-character symbols, never a function call.** `gcd(12,18)` → `c*g*d(12,18)`;
   `lcm(4,6)` → `c*l*m(4,6)`; `max(1,2)` → `a*m*x(1,2)`. Any multi-letter function name a user types plainly
   *must* be wrapped in `\operatorname{}` (or given a backslash macro / a `catalogDictionary` entry per our own
   `latex.ts` pattern) or it silently misparses into nonsense instead of erroring.
2. **`\operatorname{Name}(...)` for a `Name` that is a real CE *value* symbol (not an operator) parses as
   multiplication, not a function call.** `\operatorname{PartitionCount}(5)` → `5 * PartitionCount`, symbolic,
   never errors, silently wrong. Any of our own catalog ids risks the same trap if it collides with an existing
   CE value symbol.
3. **`\operatorname{Name}(...)` for an entirely unknown `Name` auto-declares a permanently inert placeholder** —
   no error, ever; it echoes back symbolically forever. Confirmed for `Total`, `Tuples`, `Subsets`, `Shuffle`.
   "It parsed without error" is not evidence a CE feature exists.
4. **A lowercase `\operatorname{}` word can resolve to a differently-named canonical head** via an explicit
   dictionary alias — e.g. `\operatorname{shuffle}` → `RandomShuffle`, `\operatorname{count}` → `Length`. Stable
   within a version, *not* case-insensitive fuzz — the aliased word and the capitalized head are unrelated, so
   `\operatorname{Shuffle}` (capital) auto-declares an inert placeholder instead. See [Word-name
   redirects](#word-name-redirects).
5. **`Total` (capital) never reduces — but it is an *auto-declared placeholder*, not a registered dead operator.**
   On a fresh engine `operatorInfo("Total")` is `none`; the first `\operatorname{Total}(...)` auto-declares it
   inert (outcome 3). Lowercase `\operatorname{total}` is unrelated and aliases to `Sum`, which works. Use `Sum`.
   (The genuinely-registered-but-dead heads are the *opaque* family — `Prime`, `Subtract`, `Greater` — which have
   `operatorInfo` but `canEvaluate:false`.)
6. **`Map(collection, fn)` throws** — CE's canonical order is `Map(fn, collection+)`, function first (Mathematica
   convention). **`Filter(collection, predicate)`** is the *opposite* order, collection first. Swapping them
   produces an `incompatible-type` error that reads like a missing feature, not an argument-order bug.
7. **Many list ops require an `indexed_collection` and throw on a `Set`** — see the ordered-vs-unordered trap at
   the end of [Sets & lists](#sets--lists).
8. **A large family of operators only compute through `.N()`, never `.evaluate()`** — see the note at the top of
   [Sets & lists](#sets--lists). Worth checking whether `packages/client/src/ce-engine.ts`'s `evaluateAsync` path
   also falls back to `.N()`, or only calls `.evaluate()`.
9. **A single capital letter inside `\operatorname{}` can be a special function** — `\operatorname{I}`→`BesselI`,
   `\operatorname{W}`→`LambertW`, `\operatorname{G}`→`CatalanConstant`. See [Word-name
   redirects](#word-name-redirects).
10. **`\times` between two sets is `Multiply`, not `CartesianProduct`** — it throws `incompatible-type`. CE has a
    `CartesianProduct` head, but no `\times` trigger routes to it for set operands.

## Gaps worth implementing in our library / proposing upstream

*Status reflects `packages/notatio/src/names.ts` on `main`. Most Tier-1 heads the earlier draft flagged are
now curated via `{ce}` bindings; this section is the refreshed to-do.*

**Now curated (`{ce}` in `OPERATORS`) — no longer gaps.** `Max`, `Min`, `Floor`, `Ceil`, `Round`, `Mod`, `Sqrt`,
`Root`, `Exp`, `Ln`, `Log`, `Sin`, `Cos`, `Tan`, `Gamma`, `Zeta`. `Abs` is the *one* head still in
`UNMAPPED_HEADS_NO_CURATED_ID`, and deliberately so — `|x|` is reserved to mean *cardinality* over our collections.

**Tier A — integer-valued number-theory heads CE computes; trivial `{ce}` additions** (a peer branch is already
wiring several): `Fibonacci`, `Lucas` (→`LucasL`), `Totient`, `NextPrime`, `Multinomial`, plus `CatalanNumber`,
`BellNumber`, `Stirling`, `StirlingS1`, `Eulerian`, `NPartition`, `Choose` (likely an alias into our existing
`binomial` fn), `Factorial2`, `Clamp`, `Sign`. Several (`CatalanNumber`, `BellNumber`, `Fibonacci`, `NPartition`)
have a same-named collection in our catalog — wiring them lets `\operatorname{CatalanNumber}(5)` validate against
`catalan_number`'s own cardinality function for free.

**Tier B — CE computes, but the return type isn't a scalar, so our binder needs non-numeric typing first:**
`Divisors`, `PrimeFactors` (distinct primes), `PrimePi` → integer/list; `IsPrime` → boolean; the statistics heads
`Mean`, `Median`, `Variance`, `StandardDeviation`. `names.ts` already flags `Divisors`/`IsPrime` as blocked on
this.

**Tier C — reusable list/collection vocabulary, once our binder emits `List` (not `Set`) for ordered carriers:**
`Sort`, `First`, `Last`, `Take`, `Drop`, `Reverse`, `Zip`, `Tally`, `Length`, `Unique`, `Join`, `Permutations`,
`Combinations`, `RandomShuffle`/`RandomSample`/`RandomChoice`/`RandomPrime`/`WithRandomSeed` — the last group is
worth comparing directly against our own seeded-randomness design in the CE-library work (#332).

**Propose upstream** (real gaps in CE itself, not our binder coverage) — all re-verified on 0.125.0:

- **`stddev` word trigger points at a misspelled dead head.** `\operatorname{stddev}(...)` parses to
  `StandarDeviation` (missing a `d`), an auto-declared inert placeholder — while `\operatorname{StandardDeviation}`
  is the real, evaluating head. A user typing the documented short form gets silence. This is a one-character typo
  in CE's named-trigger table — the cleanest, most concrete upstream fix here.
- **`Prime(n)` (nth prime) is registered but never evaluates** — `operatorInfo` shows `kind:"opaque"`,
  `canEvaluate:false`. Unlike `Total`, this one *is* declared, so it reads as a real feature. Either implement or
  document as unimplemented.
- **`PolyLog`/`Li` never reduces even under `.N()`** for numeric args (`Li(2,0.5)` stays symbolic). Possible
  numeric-evaluation gap.
- **`Tuples`/`Subsets` parse cleanly and read as real features but have zero backing implementation** — same
  auto-declare behavior as any unknown identifier. Either implement them or have the parser refuse unknown
  `\operatorname{}` identifiers instead of silently auto-declaring (this last is the general fix that also covers
  the `Total` and `stddev` surprises).
