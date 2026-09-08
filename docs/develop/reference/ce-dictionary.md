# Compute-engine dictionary

An inventory of `@cortex-js/compute-engine`'s node dictionary — what it parses, what it actually *computes*, and
where its canonicalization silently rewrites what you typed into something else. Written so the notebook
(`packages/expressions/src/ce/latex.ts`, `packages/client/src/ce-engine.ts`) can work *with* CE's own vocabulary
instead of around it, and so gaps here become a concrete to-do list rather than a recurring surprise.

**Pinned version: `@cortex-js/compute-engine@0.125.0`.** Everything below was produced by instantiating a live
`ComputeEngine` from that exact build (`dist/esm-min/compute-engine.js`) and calling `ce.parse(latex)`, `.json`,
`.evaluate()`, `.N()`, `.latex`, plus its introspection surface — `ce.operatorInfo()`, `ce.symbolInfo()`,
`ce.lookupDefinition()`, `ce.searchDefinitions()`, `ce.suggestOperatorName()`, and
`ce.latexSyntax.getNamedTriggers()`. Nothing here is asserted from documentation or training-data memory alone —
CE has shipped behavior changes across minor versions before, so treat every row as **version-specific** and
re-probe before relying on this against a different pin. The probe scripts themselves are throwaway (per this
repo's own-scripts convention) and were not committed; reconstructing them is a few dozen lines against the
introspection calls named above.

`getNamedTriggers()` alone enumerates **365** distinct named LaTeX-dictionary entries (macros/operators with a
dedicated parse trigger, e.g. `\max`, `\gcd`, `\cup`) in this build. Most combinatorial *functions* — Binomial
aside — have **no dedicated backslash macro** and are reachable only through the generic
`\operatorname{Name}(...)` catch-all. That distinction matters: the named-trigger path is closed (CE either knows
the macro or the parser errors), but the generic `\operatorname{}` path resolves an arbitrary identifier at parse
time against CE's whole symbol table — and that resolution has several silent failure modes documented in
[Footguns](#footguns-parse-time-surprises) below.

## How CE resolves `\operatorname{Name}(args)`

This is the single most important thing to internalize before reading the tables — four different outcomes for
what looks like the same syntax:

1. **`Name` is a registered operator** → a real function-call node; may or may not have a working `evaluate`/`N`
   handler (see the *evaluates?* column throughout).
2. **`Name` is a registered *value* symbol** (kind `variable`/`constant`, not an operator) → parses as
   **multiplication** of the symbol and the parenthesized argument, e.g. `\operatorname{PartitionCount}(5)` →
   `5 * PartitionCount`. Silent, never errors, structurally looks fine.
3. **`Name` is entirely unknown to CE** → auto-declares `Name` as a fresh, permanently inert function-typed
   placeholder. No error, ever — it just echoes back symbolically forever. Confirmed for `Tuples` and `Subsets`
   in this build.
4. **`Name` is mis-cased or misspelled but happens to fuzzy/substring-match something else** → CE can silently
   substitute a *different, unrelated* operator. Confirmed: `\operatorname{shuffle}` (lowercase) resolves to
   `RandomShuffle`, not to the separately-real, separately-inert `Shuffle` placeholder from outcome 3.

"It parsed without error" is therefore not evidence a feature exists. Every entry below was checked against
*both* `operatorInfo()`/`lookupDefinition()` (does CE know this operator ahead of time) *and* an actual
`.evaluate()`/`.N()` call — that double-check is what caught outcomes 2–4.

## Arithmetic & algebra

| CE head | LaTeX trigger(s) | Canonicalizes from / aliases | Signature | Evaluates? | Example | Notes |
|---|---|---|---|---|---|---|
| `Add` | `+` | | `(value+) -> value` | exact | `2+3` → `5` | we curate this (`op: add`) |
| `Subtract` | `-` (infix) | pre-folded to `Add`/`Negate` at parse time | `(number+) -> number` | **opaque, never** (`canEvaluate:false`) | `2-3` parses straight to literal `-1`, never a `Subtract` node | we curate this (`op: sub`); CE itself never actually computes *through* a `Subtract` node |
| `Multiply` | `\times`, `\cdot`, juxtaposition | | `(number*) -> number` | exact | `2\times 3` → `6` | curated (`op: mul`) |
| `Divide` | `\frac{}{}` | non-integer division canonicalizes to a `Rational` node, not a `Divide` echo | `(complex\|infinity, ...) -> number` | exact/rational | `2/3` → `Rational(2,3)`, `N` → `0.666…` | curated (`op: div`) |
| `Negate` | `-` (prefix) | | `(complex\|infinity) -> number` | exact | `-5` → `-5` | curated (`op: neg`) |
| `Power` | `^` | `Exp`/`\exp` and `Square` canonicalize here | `(complex\|infinity, complex\|signed_infinity) -> number` | exact | `2^{10}` → `1024` | curated (`op: pow`) |
| `Sqrt` | `\sqrt{}` | | `(complex\|infinity) -> complex\|infinity` | exact for perfect squares, else stays symbolic | `\sqrt{16}` → `4` | **not curated** — `UNMAPPED_HEADS_NO_CURATED_ID` — gap, tier 1 |
| `Root` | `\sqrt[n]{}` | | `(complex\|infinity, complex\|infinity) -> number` | exact for perfect roots | `\sqrt[3]{27}` → `3` | not curated — gap |
| `Abs` | `\|x\|` | | `(complex\|infinity) -> number` | exact | `\|-5\|` → `5` | not curated — `UNMAPPED_HEADS_NO_CURATED_ID` — gap, tier 1 |
| `Rational` | (produced by `Divide` canonicalization, not its own trigger) | | `(integer,integer)->rational \| (real)->rational` | exact | `2/3` → `["Rational",2,3]` | CE's own canonical fraction representation |

## Rounding & modular

| CE head | LaTeX trigger(s) | Canonicalizes from / aliases | Signature | Evaluates? | Example | Notes |
|---|---|---|---|---|---|---|
| `Floor` | `\lfloor x \rfloor` | | `(real\|signed_infinity) -> integer\|signed_infinity` | exact | `\lfloor 3.7\rfloor` → `3` | not curated — gap, tier 1 |
| `Ceil` | `\lceil x \rceil` | | same shape | exact | `\lceil 3.2\rceil` → `4` | not curated — gap, tier 1 |
| `Round` | named trigger `round` (bare word, no backslash macro) | | `(real\|signed_infinity, integer?) -> real\|signed_infinity` | exact | `round(3.456,2)` → `Rational(173,50)` | rounds to the nearest value but returns an **exact rational**, not a decimal — `3.46` is stored as `173/50` |
| `Mod` | `\bmod`, `\mod(a,b)` | `\bmod` triggers head `Mod` (not `Modulo`) | `(real,real) -> real` | exact | `7 \bmod 3` → `1` | not curated — gap, tier 1 |
| `Clamp` | `\operatorname{Clamp}(x,lo,hi)` | | `(real, real, real) -> real` | exact | `Clamp(15,0,10)` → `10` | not curated — cheap gap |

## Extrema & aggregates

| CE head | LaTeX trigger(s) | Canonicalizes from / aliases | Signature | Evaluates? | Example | Notes |
|---|---|---|---|---|---|---|
| `Max` | `\max` | | `(value*) -> number` | exact, over bare args or a `Set`/`List` arg | `\max(3,7,2)` → `7` | not curated — gap, tier 1, high traffic |
| `Min` | `\min` | | `(value+) -> number` | exact | `\min(3,7,2)` → `2` | not curated — gap, tier 1 |
| `Sum` (indexed) | `\sum_{i=a}^{b} expr` | | | exact | `\sum_{i=1}^{5} i` → `15` | |
| `Sum` (list) | `\operatorname{Sum}(\{...\})` | | `(any, tuple*) -> number` | exact | `\sum(\{1,2,3\})` → `6` | both call shapes work |
| `Product` (indexed) | `\prod_{i=a}^{b} expr` | | | exact | `\prod_{i=1}^{5} i` → `120` | |
| `Product` (list) | `\prod(\{1,2,3,4\})` | **desugars to `Reduce(list, Multiply, 1)` at parse time**, not a literal `Product` node | | exact | → `24` | the indexed form keeps a `Sum`/`Product` head; the list form does not — asymmetric |
| `Total` | named trigger only (no backslash macro) | **not** an alias of `Sum` — a separate, dead head | registered (`lookupDefinition` true) but `operatorInfo`/`symbolInfo` both **undefined** | **never** — stays symbolic through both `evaluate()` and `N()` | `\operatorname{Total}([1,2,3,4])` never reduces | footgun — see below; use `Sum`, not `Total` |

## Number theory

| CE head | LaTeX trigger(s) | Canonicalizes from / aliases | Signature | Evaluates? | Example | Notes |
|---|---|---|---|---|---|---|
| `GCD` | `\gcd` | curated already (`fn: gcd`) | `(any*) -> number` | exact | `\gcd(12,18)` → `6` | bare `gcd(12,18)` (no backslash/`\operatorname`) misparses as `c*g*d(12,18)` — see footguns |
| `LCM` | `\lcm` | curated already (`fn: lcm`) | `(any*) -> number` | exact | `\lcm(4,6)` → `12` | same bare-word trap as GCD |
| `Factorial` | `!` (postfix) | curated (`fn: factorial`) | | exact | `5!` → `120` | |
| `Factorial2` | `!!` (postfix, double factorial) | not curated | | exact | `5!!` → `15` | cheap gap, same shape as `Factorial` |
| `Binomial` | `\binom{n}{k}` | curated (`fn: binomial`) | | exact | `\binom{5}{2}` → `10` | |
| `Choose` | `\operatorname{Choose}(n,k)` | numerically identical to `Binomial` but a **separate, non-canonicalizing** head | `(n: complex\|infinity, m: complex\|infinity) -> number` | exact | `Choose(5,2)` → `10` | duplicate of `Binomial` — decide whether to alias both into our `binomial` fn |
| `Gamma` | `\Gamma(x)` | | `(complex\|infinity, ...) -> number` | `evaluate()` stays symbolic; `N()` computes | `\Gamma(5)` evaluate → unchanged, `N` → `24` | eval/N split |
| `Zeta` | `\zeta(s)` | | `(complex\|infinity) -> number` | `evaluate()` finds closed forms; `N()` gives decimal | `\zeta(2)` evaluate → `(1/6)\pi^2`, `N` → `1.6449…` | genuine symbolic math, not just numerics |
| `Divisors` | `\operatorname{Divisors}(n)` | | `(integer) -> list<integer>` | exact | `Divisors(12)` → `[1,2,3,4,6,12]` | not curated — gap, tier 2 |
| `Totient` | `\operatorname{Totient}(n)` | | `(integer) -> integer` | exact | `Totient(12)` → `4` | gap, tier 2 |
| `IsPrime` | `\operatorname{IsPrime}(n)` | | `(number) -> boolean` | exact | `IsPrime(7)` → `True` | gap, tier 2 |
| `NextPrime` | `\operatorname{NextPrime}(n[,k])` | | `(integer, integer?) -> integer` | exact | `NextPrime(10)` → `11` | gap, tier 2 |
| `PrimePi` | `\operatorname{PrimePi}(x)` | | `(real) -> integer` | exact | `PrimePi(10)` → `4` | gap, tier 2 — π(x), directly relevant to our number-theory carriers |
| `PrimeFactors` | `\operatorname{PrimeFactors}(n)` | | `(integer) -> list<integer>` | exact (signature-confirmed) | | gap, tier 2 |
| `Fibonacci` | `\operatorname{Fibonacci}(n)` | | `(integer) -> integer` | exact | `Fibonacci(10)` → `55` | gap, tier 2 — already flagged as a "one-line addition" in `ce-engine.ts`'s own `CE_OPERATORS` comment |
| `CatalanNumber` | `\operatorname{CatalanNumber}(n)` | | `(integer) -> integer` | exact | `CatalanNumber(5)` → `42` | gap, tier 2 — we have a `catalan_number` collection to cross-check against |
| `BellNumber` | `\operatorname{BellNumber}(n)` | | `(integer) -> integer` | exact | `BellNumber(5)` → `52` | gap, tier 2 — we have a `bell` collection |
| `Stirling` (2nd kind) | `\operatorname{Stirling}(n,k)` | | `(integer,integer) -> integer` | exact | `Stirling(5,2)` → `15` | gap, tier 2 |
| `StirlingS1` (1st kind, signed) | `\operatorname{StirlingS1}(n,k)` | | `(integer,integer) -> integer` | exact | `StirlingS1(5,2)` → `-50` | gap, tier 2 — **signed**, not the unsigned `\|s(n,k)\|` convention |
| `Eulerian` | `\operatorname{Eulerian}(n,k)` | | `(integer,integer) -> integer` | exact | `Eulerian(5,2)` → `66` | gap, tier 2 |
| `NPartition` | `\operatorname{NPartition}(n)` | number of integer partitions, p(n) | `(integer) -> integer` | exact | `NPartition(5)` → `7` | gap, tier 2 — **not** `PartitionCount` (dead placeholder, see footguns) and **not** `Partition` (a different, collection-chunking op) |
| `Multinomial` | `\operatorname{Multinomial}(k1,...,kn)` | | `(integer+) -> integer` | exact | `Multinomial(1,2,3)` → `60` | gap, tier 2 |

## Transcendental & constants

| CE head | LaTeX trigger(s) | Canonicalizes from / aliases | Signature | Evaluates? | Example | Notes |
|---|---|---|---|---|---|---|
| `Power` | `\exp(x)` | `Exp` **canonicalizes to `Power(ExponentialE, x)` at parse time** — no literal `Exp` head is ever produced | | exact/symbolic hybrid | `\exp(2)` → `Power(ExponentialE,2)`, `N` → `7.389…` | matches CE's documented "reduces only through canonical rewrite" family alongside `Square`, `Complex` |
| `Ln` | `\ln(x)` | | | exact for `e^k` args | `\ln(e)` → `1` | |
| `Log` | `\log(x)`, `\log_b(x)` | | | exact for perfect powers | `\log(100)` → `2`, `\log_2(8)` → `3` | |
| `Sin`/`Cos`/`Tan`/`Arcsin`/`Sinh`/… | `\sin`, `\cos`, `\tan`, `\arcsin`, `\sinh`, … | | | exact at "nice" angles (0, π-multiples), else symbolic | `\sin(\pi)` → `0`, `\arcsin(1)` → `(1/2)\pi` (symbolic), `N` → `1.5708…` | |
| `Pi` | `\pi` | bare symbol, not a 0-ary function | | `N()` only — `evaluate()` keeps it symbolic | `\pi` evaluate → `"Pi"` (unchanged), `N` → `3.14159…` | marked `k: 'unsupported'` in our own `BUILTIN_SYMBOLS` — no catalog binding yet |
| `ExponentialE` | `e` | | | `N()` only | evaluate → `"ExponentialE"`, `N` → `2.71828…` | also marked unsupported in our table |
| `GoldenRatio` | `\varphi` | | | `N()` only | evaluate → `"GoldenRatio"`, `N` → `1.61803…` | not in our `BUILTIN_SYMBOLS` at all yet |

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
| `Element` | `\in` | curated (`special: contains`) | `(any, any, boolean?) -> boolean` | exact when decidable | `3\in\{1,2,3\}` → `True` | |
| `Range` | `1..5` | | `(number, number?, step?) -> indexed_collection` | `evaluate()` stays lazy (`Range(1,5)`); `N()` materializes | `N` → `[1,2,3,4,5]` | never eagerly expands via `evaluate()` |
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
| `Length` | `\operatorname{Length}(x)` | | `(any) -> infinity\|integer` | exact | `Length([1,2,3])` → `3` | |
| `Zip` | `\operatorname{Zip}(a,b,...)` | | `(indexed_collection+) -> list` | `N()` only | `Zip([1,2,3],[4,5,6])` `N` → `[(1,4),(2,5),(3,6)]` | |
| `Permutations` | `\operatorname{Permutations}(coll[,k])` | | `((S,k?)->list<string> str) & (collection,k?)->list<list>` | `N()` only | `Permutations(\{1,2,3\})` `N` → all 6 | |
| `Combinations` | `\operatorname{Combinations}(coll,k)` | | same shape as `Permutations` | `N()` only | `Combinations(\{1,2,3\},2)` `N` → 3 pairs | |
| `Tuples` | `\operatorname{Tuples}(coll,k)` | **not actually registered** — `lookupDefinition` is `false` until parsed once, then it auto-declares an inert placeholder | none (fake) | **never**, no error either | `Tuples([1,2],2)` stays symbolic forever | footgun — looks like a real feature, isn't |
| `Subsets` | `\operatorname{Subsets}(coll)` | same as `Tuples` — auto-declared inert placeholder | none (fake) | never | `Subsets([1,2,3])` stays symbolic | footgun — same as `Tuples` |
| `RandomShuffle` | `\operatorname{RandomShuffle}(coll)`, also reached via lowercase `\operatorname{shuffle}(coll)` | see [canonicalization aliases](#canonicalization-aliases) | `((T)random->T str) & ((indexed_collection<T>)random->list<T>)` | **exact (random) — genuinely works** | `RandomShuffle([1,2,3,4,5])` → a random permutation | see the correction below — this is *not* the "unimplemented" head our own code comment describes |
| `RandomChoice` | `\operatorname{RandomChoice}(coll,n)` | | `(collection\|set<real>, number) random -> list` | exact (random) | 1-arg call throws `"missing"` — **requires 2 args** | |
| `RandomSample` | `\operatorname{RandomSample}(coll,n)` | | | exact (random) | `RandomSample([1,2,3,4,5],2)` → e.g. `[5,3]` | |
| `RandomPrime` | `\operatorname{RandomPrime}(lo,hi)` | | `(integer, integer?) random -> integer` | exact (random) | `RandomPrime(10,100)` → e.g. `11` | |
| `Random` | `\operatorname{Random}([coll])` | | `((collection\|set)?) random -> any` | exact (random) | `Random()` → uniform float in `[0,1)` | |
| `WithRandomSeed` | `\operatorname{WithRandomSeed}(seed, expr)` | | `(real\|string, any) -> expression` | exact | `WithRandomSeed(42, RandomShuffle([1,2,3]))` → deterministic given the seed | CE's own reproducible-randomness primitive — worth comparing against our notebook's existing seeded-randomness design |

**Correcting an in-repo assumption about `Shuffle`/`RandomShuffle`.** `packages/compute-engine/src/library.ts:342-343`
binds our own `Scramble(list)` op with the comment *"NOT named `Shuffle`: CE reserves that head (it canonicalizes
to an unimplemented `RandomShuffle`), so we bind our own."* Probing this build shows a more precise (and less
alarming) picture:
- `Shuffle` and `RandomShuffle` are **two distinct, unrelated heads** — boxing `['Shuffle', ...]` directly never
  canonicalizes to `RandomShuffle`; `Shuffle` is its own separate, pre-declared inert placeholder
  (`symbolInfo` → `{kind:'variable', type:'function'}`), the same category of dead-on-arrival symbol as `Total`.
- `RandomShuffle` **is fully implemented** and evaluates correctly — `RandomShuffle([1,2,3,4,5])` genuinely
  returns a random permutation. It is not "unimplemented."
- The failure that likely produced the original comment: `RandomShuffle` requires an `indexed_collection`
  (`List`/`Tuple`); calling it on a `Set` throws `incompatible-type`, which reads like "doesn't work" if the
  probe that produced the comment happened to pass a `Set`.
- Separately, `\operatorname{shuffle}` (lowercase, specifically) *does* resolve to `RandomShuffle` at LaTeX
  parse time via the fuzzy-match mechanism in [footgun 4](#footguns-parse-time-surprises) — a real but narrower
  and differently-shaped hazard than "the head canonicalizes."

Keeping our own `Scramble` is still reasonable (it's O(n) and generic over any of our collection views, where
`RandomShuffle` materializes a `List` first) — but the comment's justification is worth a follow-up fix, since
"unimplemented" is not accurate and could mislead the next person who reads it into avoiding `RandomShuffle`
entirely rather than just feeding it a `List`.

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
| `Greater` | `\gt` — CE's parser **never actually emits this head** | opaque (`canEvaluate:false`) | | never (opaque) | only reachable via a manual `ce.box(['Greater', ...])` | we map `Greater`→`op: gt` in our own dictionary — harmless as long as *we* are the one producing the head, not CE's LaTeX parser |
| `GreaterEqual` | `\ge`/`\geq` — same swap-to-`LessEqual` treatment | opaque (`canEvaluate:false`) | | never (opaque) | | same caveat as `Greater` |
| `And`/`Or`/`Not` | `\land`, `\lor`, `\lnot` | | `(boolean+)->boolean` / `(boolean)->boolean` | exact | `\mathrm{True}\land\mathrm{False}` → `False` | |

## Canonicalization aliases

The LaTeX spelling you type is frequently *not* the MathJSON head produced. Confirmed in this build:

| You type | Canonical head | Notes |
|---|---|---|
| `\max` | `Max` | |
| `\min` | `Min` | |
| `\gcd` | `GCD` | all-caps, not `Gcd` |
| `\lcm` | `LCM` | all-caps, not `Lcm` |
| `\bmod` | `Mod` | not `Modulo` |
| `>` (and `\gt`) | `Less` | **operands swapped**: `3>2` → `Less(2,3)` |
| `\ge`/`\geq` | `LessEqual` | same swap |
| `\exp(x)` | `Power(ExponentialE, x)` | no literal `Exp` head ever appears |
| `\operatorname{shuffle}` (lowercase) | `RandomShuffle` | an **explicit dictionary entry** (`{latexTrigger:"\operatorname{shuffle}", parse:"RandomShuffle"}` in CE's own bundle — *not* runtime fuzzy resolution, correcting an earlier guess). `\operatorname{Shuffle}` (capitalized) has **no** such entry, so it auto-declares a distinct inert placeholder — the two are unrelated, not a redirect pair. See [Word-name redirects](#word-name-redirects) for the full set. |

Also present as pure syntax sugar (own dedicated LaTeX trigger, not reached via `\operatorname{}`): `\lfloor…\rfloor`
→ `Floor`, `\lceil…\rceil` → `Ceil`, `!`/`!!` → `Factorial`/`Factorial2`, `\binom{}{}`→ `Binomial`, `|x|` → `Abs`,
`\frac{}{}` → `Divide`/`Rational`. The full named-trigger dictionary (≈739 raw trigger rows in 0.125.0) also covers
Greek letters and variant symbols, geometry (`Triangle`, `Polygon`, `Angle`, …), colors (`rgb`/`hsv`/`oklab`/…),
physics constants, and calculus/linear-algebra notation (`\int`, `\det`, `\dim`, `\ker`, …) — out of scope for this
reference beyond noting they exist.

## Word-name redirects

`\operatorname{Shuffle}`→`RandomShuffle` is not a one-off. Extracting every `\operatorname{word}` trigger whose
target head differs from the word itself (CE's own bundle, 0.125.0) yields **25 lowercase word-name aliases** — a
short verb/noun points at a differently-named canonical head. These are explicit dictionary entries, so they are
stable within a version (unlike case-insensitive fuzz). The ones that intersect enumeratio's vocabulary:

| You type | Canonical head | Note |
|---|---|---|
| `\operatorname{shuffle}` | `RandomShuffle` | the case study above |
| `\operatorname{random}` | `Random` | |
| `\operatorname{total}` | `Sum` | matches our own `total`→`Sum` binder alias; distinct from the dead capital-`Total` operator (footgun #5) |
| `\operatorname{count}` | `Length` | |
| `\operatorname{length}` | `Length` | |
| `\operatorname{sort}` | `Sort` | |
| `\operatorname{reverse}` | `Reverse` | |
| `\operatorname{unique}` | `Unique` | |
| `\operatorname{join}` | `Join` | |
| `\operatorname{repeat}` | `Repeat` | |
| `\operatorname{range}` | `Range` | |
| `\operatorname{mod}` | `Mod` | |
| `\operatorname{nCr}` | `Choose` | binomial coefficient |
| `\operatorname{and}` / `\operatorname{or}` | `And` / `Or` | |

Remaining entries are statistics heads (`cdf`→`CDF`, `pdf`→`PDF`, `corr`→`Correlation`, `cov`→`Covariance`,
`var`→`Variance`, `histogram`→`Histogram`), plus symbol shorthands (`e`→`ExponentialE`, `i`→`ImaginaryUnit`,
`True`/`False`).

### Notating the random family

The random operators have no bespoke LaTeX glyph — each is written `\operatorname{Name}(...)`, PascalCase, and
parses straight to that head:

| Written | Head | Notes |
|---|---|---|
| `\operatorname{RandomShuffle}([1,2,3])` | `RandomShuffle` | permutes a List/Tuple/String, **and any indexed collection view** (e.g. `RandomShuffle(SymmetricGroup(4))` shuffles all 24 elements through our CollectionHandlers). Throws `incompatible-type` on a `Set` (unordered). |
| `\operatorname{WithRandomSeed}(42, expr)` | `WithRandomSeed` | CE's determinism wrapper — pins the RNG for `expr`. `WithRandomSeed(42, RandomShuffle([1,2,3,4,5]))` is reproducible. This is CE's native seeding seam (see RandomShuffle's own doc string). |
| `\operatorname{Random}()` / `\operatorname{Random}(n)` | `Random` | uniform real in [0,1) / integer draw. |

## Footguns (parse-time surprises)

1. **A bare multi-letter word with no `\operatorname{}` wrapper and no backslash macro is always implicit
   multiplication of single-character symbols, never a function call.** `gcd(12,18)` → `c*g*d(12,18)`;
   `lcm(4,6)` → `c*l*m(4,6)`; `max(1,2)` → `a*m*x(1,2)`. Any multi-letter function name a user types plainly
   *must* be wrapped in `\operatorname{}` (or given a backslash macro / a `catalogDictionary` entry per our own
   `latex.ts` pattern) or it silently misparses into nonsense instead of erroring.
2. **`\operatorname{Name}(...)` for a `Name` that is a real CE *value* symbol (not an operator) parses as
   multiplication, not a function call.** `\operatorname{PartitionCount}(5)` → `5 * PartitionCount`, symbolic,
   never errors, silently wrong. Any of our own catalog ids risks the same trap if it happens to collide with an
   existing CE value symbol.
3. **`\operatorname{Name}(...)` for an entirely unknown `Name` auto-declares a permanently inert placeholder** —
   no error, ever; it echoes back symbolically forever. Confirmed for `Tuples` and `Subsets`. "It parsed without
   error" is not evidence a CE feature exists.
4. **A lowercase `\operatorname{}` word can resolve to a differently-named canonical head** via an explicit
   dictionary alias — e.g. `\operatorname{shuffle}` → `RandomShuffle`, `\operatorname{count}` → `Length`. These
   are real bundle entries (stable within a version), *not* case-insensitive fuzz — but the aliased word and the
   capitalized head are unrelated symbols, so `\operatorname{Shuffle}` (capital) does **not** reach `RandomShuffle`;
   it auto-declares an inert placeholder. See [Word-name redirects](#word-name-redirects) for the full set.
5. **`Total` is pre-registered (`lookupDefinition` true before any use) yet never reduces**, through either
   `evaluate()` or `N()`, in 0.125.0 — a dead operator. `Sum` covers both call shapes (indexed `\sum_{}^{}` and
   bare `Sum(list)`) and works; use it instead of `Total`.
6. **`Map(collection, fn)` throws** — CE's canonical order is `Map(fn, collection+)`, function first
   (Mathematica convention). **`Filter(collection, predicate)`** is the *opposite* order, collection first.
   Swapping them produces an `incompatible-type` error that reads like a missing feature, not an argument-order
   bug.
7. **Many list ops require an `indexed_collection` and throw on a `Set`** — see the ordered-vs-unordered trap
   called out at the end of [Sets & lists](#sets--lists).
8. **A large family of operators only compute through `.N()`, never `.evaluate()`** — see the note at the top of
   [Sets & lists](#sets--lists). Worth checking whether `packages/client/src/ce-engine.ts`'s `evaluateAsync` path
   also falls back to `.N()`, or only calls `.evaluate()`.

## Gaps worth implementing in our library / proposing upstream

**Tier 1 — cheap, high-traffic, CE already computes these natively with clean signatures.** Currently rejected
outright by our binder via `UNMAPPED_HEADS_NO_CURATED_ID` (`packages/expressions/src/names.ts`): `Sqrt`, `Root`,
`Floor`, `Ceil`, `Abs`, `Mod`, `Min`, `Max`. A user typing `\max`, `\sqrt`, or `\lfloor…\rfloor` today gets
"unknown operator" instead of a computed answer — this is the single highest-value fix in this document.

**Tier 2 — number theory / combinatorics CE already has fully working, that map directly onto catalog
concepts we don't curate at all:** `Divisors`, `Totient`, `IsPrime`, `NextPrime`, `PrimePi`, `PrimeFactors`,
`Fibonacci`, `CatalanNumber`, `BellNumber`, `Stirling`/`StirlingS1`, `Eulerian`, `NPartition`, `Multinomial`,
`Factorial2`, `Choose` (likely an alias into our existing `binomial` fn), `Round`, `Clamp`. Several of these
(`CatalanNumber`, `BellNumber`, `Fibonacci`, `NPartition`) have a same-named collection in our own catalog
already — wiring these through lets a notebook expression like `\operatorname{CatalanNumber}(5)` validate against
`catalan_number`'s own cardinality function for free.

**Tier 3 — reusable list/collection vocabulary, once our binder emits `List` (not `Set`) for ordered carriers:**
`Sort`, `First`, `Last`, `Take`, `Drop`, `Reverse`, `Zip`, `Tally`, `Length`, `Unique`, `Join`, `Permutations`,
`Combinations`, `RandomShuffle`/`RandomSample`/`RandomChoice`/`RandomPrime`/`WithRandomSeed` — the last group is
worth comparing directly against our own seeded-randomness design in the CE-library work (#332).

**Propose upstream** (real gaps in CE itself, not just our binder coverage):
- `Total` never reduces despite being pre-registered — looks like a genuine bug, not missing coverage. Worth
  filing on `cortex-js/compute-engine` on its own, separate from everything else here.
- `Tuples`/`Subsets` parse cleanly and read as real features but have zero backing implementation — either
  implement them for real or have the parser refuse them the way genuinely-unknown identifiers do elsewhere;
  right now they're indistinguishable from a working feature until you actually call `.N()`.
