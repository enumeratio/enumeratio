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

export type OperatorBinding = { op: string } | { fn: string } | { special: string }

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

  // ── generic engine primitives, dispatched by head name alone (not argument-typed) ───────────────────────────
  Element: { special: 'contains' },     // `x \in C` as an EXPRESSION (not a declare) — boolean membership
  At: { special: 'element_at' },        // `L[i]` — index into a handle or array
  Count: { special: 'cardinality' },    // `|S|`/`\#S` — collection size
}

/** CE heads probed and found to have NO curated `base_function` id — `identities.sql`/`function_impls.sql` only
 *  ever register `factorial`/`binomial`/`gcd`/`lcm` among the "named identity" functions this table draws from.
 *  Deliberately OMITTED from OPERATORS rather than guessed at: binding e.g. `Sqrt` to a made-up id would silently
 *  print a function pg-engine can never resolve. A bind() encountering one of these heads reports "unknown
 *  operator" naming the head, same as any other unmapped one — flagged here so the omission reads as deliberate,
 *  not missed. (main thread: if any of these should route to a pg builtin directly rather than a curated
 *  identity, that's a distinct engine-level decision, not a naming-table one.)
 *  Sqrt, Root, Floor, Ceil, Abs, Mod, Min, Max
 */
export const UNMAPPED_HEADS_NO_CURATED_ID = ['Sqrt', 'Root', 'Floor', 'Ceil', 'Abs', 'Mod', 'Min', 'Max'] as const

// ── builtin symbols: bare CE symbols that denote a catalog SET rather than a scope variable ─────────────────────
export type BuiltinSymbolBinding =
  | { k: 'collection'; coll: string }     // resolved further through catalog.collection(coll) — carries no carrier itself
  | { k: 'unsupported'; reason: string }  // parses, but bind() reports a typed error rather than guessing a type

export const BUILTIN_SYMBOLS: Record<string, BuiltinSymbolBinding> = {
  natural_numbers: { k: 'collection', coll: 'natural_numbers' },
  integer_numbers: { k: 'collection', coll: 'integer_numbers' },
  rational_numbers: { k: 'collection', coll: 'rational_numbers' },
  Pi: { k: 'unsupported', reason: '"Pi" has no catalog binding yet — no collection or scalar type denotes it' },
  ExponentialE: { k: 'unsupported', reason: '"ExponentialE" has no catalog binding yet' },
  ImaginaryUnit: { k: 'unsupported', reason: '"ImaginaryUnit" has no catalog binding yet — gaussian_integer has no unit constant registered' },
}
