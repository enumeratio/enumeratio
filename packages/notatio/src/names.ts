// The ONE table mapping a CE/MathJSON operator name to our own vocabulary: a `base_operation` id (`op`), a
// curated `base_function` id (`fn`), or one of the small set of generic engine primitives every collection gets
// for free (`special` — `contains`/`element_at`/`cardinality`; the further primitives `next`/`prev`/`rank`/
// `locate`/`unrank`/`random_element` are handled directly by name in bind.ts/lower.ts instead, since they're
// dispatched on the ARGUMENT's type — elem(C) — not purely on the operator head; see bind.ts's `NEXT_PREV_RANK`).
//
// This is shared knowledge, not ce-latex-specific: the future Stage-C `ce.declare([...])` list (making compute-
// engine itself aware of collection/function symbols so its OWN simplifier can reason about them) should read off
// this same table rather than inventing a second one.
//
// Heads verified empirically against the installed compute-engine (0.125.0) — see the probing note by each
// non-obvious one; a CE canonical name is not always what you'd guess (`\gcd` → head `"GCD"`, not `"Gcd"`).

export type OperatorBinding = { op: string } | { fn: string } | { special: string } | { kernel: string; result?: 'numeric' | 'boolean' }

export const OPERATORS: Record<string, OperatorBinding> = {
  // ── base_operation (algebra.sql) — arithmetic, order, lattice ────────────────────────────────────────────────
  Add: { op: 'add' },
  Subtract: { op: 'sub' },
  Multiply: { op: 'mul' },
  Divide: { op: 'div' },
  Negate: { op: 'neg' },
  Power: { op: 'pow' },
  LessEqual: { op: 'le' },
  Less: { op: 'lt' },
  GreaterEqual: { op: 'ge' },
  Greater: { op: 'gt' },
  Equal: { op: 'eq' },
  NotEqual: { op: 'ne' },
  Union: { op: 'join' },
  Intersection: { op: 'meet' },
  Complement: { op: 'complement' },

  // ── curated base_function ids (identities.sql) — confirmed present ──────────────────────────────────────────
  Factorial: { fn: 'factorial' },
  Binomial: { fn: 'binomial' },
  GCD: { fn: 'gcd' },   // \gcd(4,6) parses to head "GCD" (both letters caps), NOT "Gcd" — checked live
  LCM: { fn: 'lcm' },   // same shape as GCD — checked live, head is "LCM"

  // ── CE-native math (evaluated by compute-engine, no curated pg twin). `{kernel}` = type numeric, evaluate via CE,
  // ts/pg decline. Rendered as a NUMERIC approximation for now (forced `N`); exact-symbolic display is the
  // follow-up. All heads confirmed against CE 0.125's evaluator. `Abs` is intentionally omitted — `|x|` is
  // handled separately so `|C|` can mean cardinality. `Mod` here is `\bmod`/`\operatorname{mod}` → head "Mod". ──
  Max: { kernel: 'Max' }, Min: { kernel: 'Min' },
  Supremum: { kernel: 'Supremum' }, Infimum: { kernel: 'Infimum' },   // \sup / \inf over a bounded set
  Floor: { kernel: 'Floor' }, Ceil: { kernel: 'Ceil' }, Round: { kernel: 'Round' }, Clamp: { kernel: 'Clamp' },
  Mod: { kernel: 'Mod' },
  // Sign/Heaviside route to CE like the trig family. They reach the parser through a BUILT-IN LatexSyntax trigger —
  // `\operatorname{sgn}(-5)` → head `Sign` → -1, and `\operatorname{Heaviside}(-2)` → 0 — so they need NO
  // `KERNEL_WORD_OPS` entry (registering the PascalCase `Sign`/`Heaviside` spelling as a parser function is exactly
  // what dup-warns against CE's existing dictionary entry; a trigger-only entry would be the clean way to add the
  // Pascal spelling — deferred). NB the CAPITAL `\operatorname{Sign}` does NOT application-parse under our
  // LatexSyntax build (only the lowercase `sgn` trigger does); `Heaviside` does. Both return integers → exact.
  Sign: { kernel: 'Sign' }, Heaviside: { kernel: 'Heaviside' },
  // `a \mid b` ("a divides b") parses to the CE `Divides` head (a glyph trigger, like the comparisons — no
  // `\operatorname{}` needed) and returns a BOOLEAN: `3 \mid 12` → true, `3 \mid 13` → false. `result: 'boolean'`
  // types it ∈ 𝔹 (the ce-engine already prints CE's True/False as true/false). Checked live on 0.125.
  Divides: { kernel: 'Divides', result: 'boolean' },
  NotDivides: { kernel: 'NotDivides', result: 'boolean' },   // `a \nmid b` — glyph trigger, boolean
  // Boolean logic over boolean-producing operands (comparisons, \mid, \in) — all glyph triggers, no `\operatorname{}`.
  // `(3<5) \land (2<4)` → true, `\lnot(3<5)` → false. Bare `\mathrm{True}`/`\mathrm{False}` LITERALS aren't bound yet
  // (they parse to unknown symbols) — logic is over predicates for now. Checked live on 0.125.
  And: { kernel: 'And', result: 'boolean' }, Or: { kernel: 'Or', result: 'boolean' }, Not: { kernel: 'Not', result: 'boolean' },
  Xor: { kernel: 'Xor', result: 'boolean' }, Nand: { kernel: 'Nand', result: 'boolean' }, Nor: { kernel: 'Nor', result: 'boolean' },
  Implies: { kernel: 'Implies', result: 'boolean' }, Equivalent: { kernel: 'Equivalent', result: 'boolean' },
  // base logs: `\log_2(x)` parses to the `Lb` head, `\lg` to `Lg` — both evaluate on 0.125 (`\log_2(8)` → 3,
  // `\lg(1000)` → 3). (`\log_{10}(x)` canonicalizes straight to `Log`, already curated.)
  // Set relations (`\subseteq`/`\subset`/…) are deliberately NOT here: our `\{…\}` binds as a LIST (integer[]), so
  // those route to the enumeration engine and yield no boolean — they need real set typing first.
  Lb: { kernel: 'Lb' }, Lg: { kernel: 'Lg' },
  Sqrt: { kernel: 'Sqrt' }, Root: { kernel: 'Root' },
  Exp: { kernel: 'Exp' }, Ln: { kernel: 'Ln' }, Log: { kernel: 'Log' },
  Sin: { kernel: 'Sin' }, Cos: { kernel: 'Cos' }, Tan: { kernel: 'Tan' },
  // the rest of the trig/hyperbolic/inverse family (each has its own `\`-command; all numeric via CE).
  Arcsin: { kernel: 'Arcsin' }, Arccos: { kernel: 'Arccos' }, Arctan: { kernel: 'Arctan' },
  Sec: { kernel: 'Sec' }, Csc: { kernel: 'Csc' }, Cot: { kernel: 'Cot' },
  Sinh: { kernel: 'Sinh' }, Cosh: { kernel: 'Cosh' }, Tanh: { kernel: 'Tanh' }, Coth: { kernel: 'Coth' },
  Gamma: { kernel: 'Gamma' }, Zeta: { kernel: 'Zeta' },
  Factorial2: { kernel: 'Factorial2' },   // `n!!` double factorial (postfix `!!`, parses without a word)
  // number-theory / combinatorial heads CE implements natively (integer-valued — confirmed on 0.125). One-arg
  // (Fibonacci/Lucas/Totient/NextPrime/CatalanNumber/BellNumber/NPartition/PrimePi), two-arg (Stirling/StirlingS1/
  // Eulerian/Choose), Multinomial variadic. (Divisors/PrimeFactors→list, IsPrime→bool need non-numeric typing — later.)
  Fibonacci: { kernel: 'Fibonacci' }, Lucas: { kernel: 'Lucas' }, Totient: { kernel: 'Totient' },
  NextPrime: { kernel: 'NextPrime' }, Multinomial: { kernel: 'Multinomial' },
  CatalanNumber: { kernel: 'CatalanNumber' }, BellNumber: { kernel: 'BellNumber' }, NPartition: { kernel: 'NPartition' },
  PrimePi: { kernel: 'PrimePi' }, Stirling: { kernel: 'Stirling' }, StirlingS1: { kernel: 'StirlingS1' },
  Eulerian: { kernel: 'Eulerian' }, Choose: { kernel: 'Choose' },

  // ── generic engine primitives, dispatched by head name alone (not argument-typed) ───────────────────────────
  Element: { special: 'contains' },     // `x \in C` as an EXPRESSION (not a declare) — boolean membership
  At: { special: 'element_at' },        // `L[i]` — index into a handle or array
  Count: { special: 'cardinality' },    // `|S|`/`\#S` — collection size
}

/** CE heads with no curated `base_function` id AND no `{kernel}` binding — a bind() encountering one reports "unknown
 *  operator" naming the head. Now EMPTY: the scalar math heads route to CE via `{kernel}` (see OPERATORS), and `Abs`
 *  is the one head handled OUTSIDE OPERATORS — `|C|` over a handle is cardinality, scalar `|x|` is CE's Abs (both
 *  special-cased in bind.ts/lower.ts so the `|` overload can mean either). Kept as a deliberate-omission marker. */
export const UNMAPPED_HEADS_NO_CURATED_ID = [] as const

// ── builtin symbols: bare CE symbols that denote a catalog SET rather than a scope variable ─────────────────────
export type BuiltinSymbolBinding =
  | { k: 'collection'; coll: string }     // resolved further through catalog.collection(coll) — carries no carrier itself
  | { k: 'unsupported'; reason: string }  // parses, but bind() reports a typed error rather than guessing a type

export const BUILTIN_SYMBOLS: Record<string, BuiltinSymbolBinding> = {
  natural_numbers: { k: 'collection', coll: 'natural_numbers' },
  integer_numbers: { k: 'collection', coll: 'integer_numbers' },
  rational_numbers: { k: 'collection', coll: 'rational_numbers' },
  // CE's own DOMAIN symbols (what `\mathbb{…}` canonicalizes to, and their word forms) mapped onto our number
  // collections, so `x \in \mathbb{Z}` and `x \in Integers` both resolve. `k:'collection'` still passes through
  // `catalog.collection(coll)`, so an absent collection degrades to a typed error rather than a bad binding.
  Integers: { k: 'collection', coll: 'integer_numbers' },
  NonNegativeIntegers: { k: 'collection', coll: 'natural_numbers' },
  RationalNumbers: { k: 'collection', coll: 'rational_numbers' },
  RealNumbers: { k: 'unsupported', reason: '"RealNumbers" (ℝ) has no catalog collection yet' },
  ComplexNumbers: { k: 'unsupported', reason: '"ComplexNumbers" (ℂ) has no catalog collection yet' },
  ImaginaryUnit: { k: 'unsupported', reason: '"ImaginaryUnit" has no catalog binding yet — gaussian_integer has no unit constant registered' },
}

/** Bare CE symbols that denote a numeric mathematical CONSTANT (not a scope variable, not a collection). Reachable
 *  by an UNAMBIGUOUS trigger only: `\pi`→Pi, `\varphi`→GoldenRatio, and the word `CatalanConstant`. bind types
 *  these numeric; lower emits an IR `const` node; ce-engine boxes the symbol so it renders exactly (π, φ) and folds
 *  under `.N()`. Scope wins first, so a user's `\pi = 3` (or a var named after one) still shadows the constant.
 *  `ExponentialE` is intentionally ABSENT — bare `e` parses to the plain symbol `"e"`, so binding it would hijack
 *  every variable `e`; it needs its own unambiguous trigger first. */
export const CE_CONSTANTS = new Set(['Pi', 'GoldenRatio', 'CatalanConstant'])
