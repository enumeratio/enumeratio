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

export type OperatorBinding = { op: string } | { fn: string } | { special: string } | { ce: string }

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

  // ── CE-native math (evaluated by compute-engine, no curated pg twin). `{ce}` = type numeric, evaluate via CE,
  // ts/pg decline. Rendered as a NUMERIC approximation for now (forced `N`); exact-symbolic display is the
  // follow-up. All heads confirmed against CE 0.125's evaluator. `Abs` is intentionally omitted — `|x|` is
  // handled separately so `|C|` can mean cardinality. `Mod` here is `\bmod`/`\operatorname{mod}` → head "Mod". ──
  Max: { ce: 'Max' }, Min: { ce: 'Min' },
  Supremum: { ce: 'Supremum' }, Infimum: { ce: 'Infimum' },   // \sup / \inf over a bounded set
  Floor: { ce: 'Floor' }, Ceil: { ce: 'Ceil' }, Round: { ce: 'Round' }, Clamp: { ce: 'Clamp' },
  Mod: { ce: 'Mod' },
  // (Sign/Heaviside deferred — their CE names collide with existing LatexSyntax dictionary entries, so a plain
  // function registration dup-warns; they need a trigger-only entry — a later pass.)
  Sqrt: { ce: 'Sqrt' }, Root: { ce: 'Root' },
  Exp: { ce: 'Exp' }, Ln: { ce: 'Ln' }, Log: { ce: 'Log' },
  Sin: { ce: 'Sin' }, Cos: { ce: 'Cos' }, Tan: { ce: 'Tan' },
  // the rest of the trig/hyperbolic/inverse family (each has its own `\`-command; all numeric via CE).
  Arcsin: { ce: 'Arcsin' }, Arccos: { ce: 'Arccos' }, Arctan: { ce: 'Arctan' },
  Sec: { ce: 'Sec' }, Csc: { ce: 'Csc' }, Cot: { ce: 'Cot' },
  Sinh: { ce: 'Sinh' }, Cosh: { ce: 'Cosh' }, Tanh: { ce: 'Tanh' }, Coth: { ce: 'Coth' },
  Gamma: { ce: 'Gamma' }, Zeta: { ce: 'Zeta' },
  Factorial2: { ce: 'Factorial2' },   // `n!!` double factorial (postfix `!!`, parses without a word)
  // number-theory / combinatorial heads CE implements natively (integer-valued — confirmed on 0.125). One-arg
  // (Fibonacci/Lucas/Totient/NextPrime/CatalanNumber/BellNumber/NPartition/PrimePi), two-arg (Stirling/StirlingS1/
  // Eulerian/Choose), Multinomial variadic. (Divisors/PrimeFactors→list, IsPrime→bool need non-numeric typing — later.)
  Fibonacci: { ce: 'Fibonacci' }, Lucas: { ce: 'Lucas' }, Totient: { ce: 'Totient' },
  NextPrime: { ce: 'NextPrime' }, Multinomial: { ce: 'Multinomial' },
  CatalanNumber: { ce: 'CatalanNumber' }, BellNumber: { ce: 'BellNumber' }, NPartition: { ce: 'NPartition' },
  PrimePi: { ce: 'PrimePi' }, Stirling: { ce: 'Stirling' }, StirlingS1: { ce: 'StirlingS1' },
  Eulerian: { ce: 'Eulerian' }, Choose: { ce: 'Choose' },

  // ── generic engine primitives, dispatched by head name alone (not argument-typed) ───────────────────────────
  Element: { special: 'contains' },     // `x \in C` as an EXPRESSION (not a declare) — boolean membership
  At: { special: 'element_at' },        // `L[i]` — index into a handle or array
  Count: { special: 'cardinality' },    // `|S|`/`\#S` — collection size
}

/** CE heads with no curated `base_function` id AND no `{ce}` binding — a bind() encountering one reports "unknown
 *  operator" naming the head. Now EMPTY: the scalar math heads route to CE via `{ce}` (see OPERATORS), and `Abs`
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
  ImaginaryUnit: { k: 'unsupported', reason: '"ImaginaryUnit" has no catalog binding yet — gaussian_integer has no unit constant registered' },
}

/** Bare CE symbols that denote a numeric mathematical CONSTANT (not a scope variable, not a collection). Reachable
 *  by an UNAMBIGUOUS trigger only: `\pi`→Pi, `\varphi`→GoldenRatio, and the word `CatalanConstant`. bind types
 *  these numeric; lower emits an IR `const` node; ce-engine boxes the symbol so it renders exactly (π, φ) and folds
 *  under `.N()`. Scope wins first, so a user's `\pi = 3` (or a var named after one) still shadows the constant.
 *  `ExponentialE` is intentionally ABSENT — bare `e` parses to the plain symbol `"e"`, so binding it would hijack
 *  every variable `e`; it needs its own unambiguous trigger first. */
export const CE_CONSTANTS = new Set(['Pi', 'GoldenRatio', 'CatalanConstant'])
