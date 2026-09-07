// The corpus for selfcert-expressions.mts's differential: pure SCALAR LaTeX only (integer/rational arithmetic,
// comparisons, the curated identities compute-engine ships a builtin spelling for — !, \binom, \gcd, \lcm). No
// symbols, no floats, no trig/sums/collections — those either have no oracle-side meaning here or aren't part of
// our pipeline's scalar vocabulary yet (see names.ts's UNMAPPED_HEADS_NO_CURATED_ID for what's deliberately absent
// from the catalog side).
//
// `divergence` marks a case where OUR pipeline (bind/lower/engines — files outside this package's ownership) is
// known to disagree with the compute-engine oracle for a reason already understood and NOT this package's to fix;
// the differential still reports it but does not fail the exit code on it. A plain `note` is just commentary.
//
// A handful of cases (marked below) are transcribed from compute-engine's own test suite (mined via GitHub, not
// vendored locally — see AGENTS.md's oracle-corpus provenance ask): test/compute-engine/number-theory.test.ts
// (gcd/lcm identities) and test/compute-engine/arithmetic.test.ts (Binomial/Factorial rows).
// The differential's first run caught two real bugs, since fixed: a bare parenthesized operand (`Delimiter`)
// failed to bind, and an n-ary Multiply was evaluated as binary. Both cases stay in the corpus, gating.

export const CORPUS: { latex: string; note?: string; divergence?: string }[] = [
  // ── integer arithmetic: precedence, parens, negatives ──────────────────────────────────────────────────────
  { latex: '3+4' },
  { latex: '3-4' },
  { latex: '3\\times4' },
  { latex: '3+4\\times2' },
  { latex: '(3+4)\\times2' },
  { latex: '2\\times3+4' },
  { latex: '2\\times(3+4)' },
  { latex: '10-3-2' },
  { latex: '10-(3-2)' },
  { latex: '2+3\\times4-5' },
  { latex: '-5' },
  { latex: '-5+3' },
  { latex: '3+-5' },
  { latex: '-(3+4)' },
  { latex: '-3\\times4' },
  { latex: '-3\\times-4' },
  { latex: '-(-5)' },
  { latex: '0-0' },
  { latex: '0\\times5' },
  { latex: '1\\times1\\times1' },
  { latex: '100-99' },
  { latex: '(2+3)\\times(4+5)' },
  { latex: '((2+3))\\times4' },
  { latex: '2\\times2\\times2\\times2' },
  { latex: '7-7' },
  { latex: '-1-1-1' },

  // ── \frac: rational arithmetic ──────────────────────────────────────────────────────────────────────────────
  { latex: '\\frac{1}{2}' },
  { latex: '\\frac{1}{3}' },
  { latex: '\\frac{2}{4}' },
  { latex: '\\frac{6}{3}' },
  { latex: '\\frac{-1}{3}' },
  { latex: '-\\frac{1}{3}' },
  { latex: '\\frac{1}{2}+\\frac{1}{3}' },
  { latex: '\\frac{1}{2}+\\frac{1}{2}' },
  { latex: '\\frac{1}{3}+\\frac{1}{6}' },
  { latex: '\\frac{1}{2}\\times\\frac{2}{3}' },
  { latex: '\\frac{1}{2}-\\frac{1}{4}' },
  { latex: '\\frac{22}{7}' },
  { latex: '\\frac{1}{7}' },
  { latex: '\\frac{355}{113}' },
  { latex: '\\frac{100!}{99!}', note: 'exact rational that reduces to an integer (100)' },

  // ── \binom (Binomial) ────────────────────────────────────────────────────────────────────────────────────────
  { latex: '\\binom{6}{2}' },
  { latex: '\\binom{5}{0}' },
  { latex: '\\binom{5}{5}' },
  { latex: '\\binom{10}{3}' },
  { latex: '\\binom{20}{10}' },
  { latex: '\\binom{35}{7}', note: 'mined: arithmetic.test.ts Binomial row' },
  { latex: '\\binom{28}{7}', note: 'mined: arithmetic.test.ts Binomial row' },
  { latex: '\\binom{21}{7}', note: 'mined: arithmetic.test.ts Binomial row' },
  { latex: '\\binom{14}{7}', note: 'mined: arithmetic.test.ts Binomial row' },
  { latex: '\\binom{7}{7}', note: 'mined: arithmetic.test.ts Binomial row' },
  { latex: '\\binom{60}{30}', note: 'big value — past float64 exactness' },

  // ── ! (Factorial) ────────────────────────────────────────────────────────────────────────────────────────────
  { latex: '0!' },
  { latex: '1!' },
  { latex: '5!' },
  { latex: '10!' },
  { latex: '20!' },
  { latex: '35!', note: 'mined: arithmetic.test.ts Factorial row' },
  { latex: '25!', note: 'big value — past float64 exactness' },
  { latex: '30!', note: 'big value — past float64 exactness' },
  { latex: '(3+2)!' },
  { latex: '3!+2!' },
  { latex: '3!\\times2!' },

  // ── \gcd / \lcm ──────────────────────────────────────────────────────────────────────────────────────────────
  { latex: '\\gcd(4,6)', note: 'mined: number-theory.test.ts — gcd(4,6)=2' },
  { latex: '\\gcd(12,18)', note: 'mined: number-theory.test.ts — gcd(12,18)=6' },
  { latex: '\\lcm(4,6)', note: 'mined: number-theory.test.ts — lcm(4,6)=12' },
  { latex: '\\gcd(0,5)' },
  { latex: '\\gcd(7,13)' },
  { latex: '\\lcm(7,13)' },
  { latex: '\\gcd(100,75)' },
  { latex: '\\lcm(21,6)' },

  // ── ^ (Power) ────────────────────────────────────────────────────────────────────────────────────────────────
  { latex: '2^{10}' },
  { latex: '2^{0}' },
  { latex: '0^{5}' },
  { latex: '1^{100}' },
  { latex: '3^{4}' },
  { latex: '(-2)^{3}' },
  { latex: '(-2)^{4}' },
  { latex: '2^{3}\\times2^{2}' },
  { latex: '(2^{3})^{2}' },
  { latex: '2^{100}', note: 'big value — past float64 exactness' },
  { latex: '2^{200}', note: 'big value — past float64 exactness' },

  // ── comparisons — always reduce to a boolean over pure scalars here ────────────────────────────────────────────
  { latex: '3\\le5' },
  { latex: '5\\le3' },
  { latex: '3\\le3' },
  { latex: '3<5' },
  { latex: '5<3' },
  { latex: '3\\ge5' },
  { latex: '5\\ge3' },
  { latex: '3>5' },
  { latex: '3=3' },
  { latex: '3=4' },
  { latex: '2^{10}=1024' },
  { latex: '\\binom{6}{2}=15' },
  { latex: '5!\\le120' },
  { latex: '\\frac{1}{2}<\\frac{2}{3}' },
  { latex: '\\gcd(12,18)=6' },

  // ── mixed compound expressions ───────────────────────────────────────────────────────────────────────────────
  { latex: '2+3\\times\\binom{4}{2}' },
  { latex: '\\frac{1}{2}+3' },
  { latex: '3+\\frac{1}{2}' },
  { latex: '2\\times\\frac{3}{4}' },
  { latex: '\\frac{3}{4}\\times2' },
  { latex: '(2+3)^{2}' },
  { latex: '2^{2}+3^{2}' },
  { latex: '\\gcd(4,6)+\\lcm(4,6)' },
  { latex: '5!-4!' },
  { latex: '\\binom{10}{3}-\\binom{9}{2}' },
  { latex: '-2^{2}', note: 'unary negate binds looser than power in CE\'s own grammar: -(2^2) = -4, not (-2)^2' },
  { latex: '2-3\\times4' },
  { latex: '(2-3)\\times4' },
  { latex: '\\frac{2+4}{3}' },
  { latex: '\\frac{2}{3+3}' },
]
