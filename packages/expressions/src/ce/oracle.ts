// THE ONLY module in this package that imports the FULL @cortex-js/compute-engine kernel (as opposed to
// ./latex.ts's latex-syntax-only import) — used exclusively as the ORACLE for selfcert-expressions.mts's
// differential, never on our own evaluation path. Findings this is built from: .scratch/ce-spike.md item 9
// (exact bigint/rational arithmetic at a raised `ce.precision`) plus a follow-up probe (not written up in the
// spike) into exactly what `BoxedExpression#toString()`/`numeratorDenominator` print for a big exact value —
// see the `normalizeBignumText` comment below for what that probe found.
import { ComputeEngine } from '@cortex-js/compute-engine'

export type OracleValue = { kind: 'int' | 'rational' | 'bool' | 'other'; text: string }

export type Oracle = { evaluate(latex: string): Promise<OracleValue> }

/** `BoxedExpression#toString()` on an exact big integer prints a SCALED mantissa, not plain digits — e.g. `25!`
 *  is `"15511210043330985984e+6"` (mantissa `15511210043330985984`, meaning ×10^6), not
 *  `"15511210043330985984000000"`. `numeratorDenominator`'s two components print the same way (e.g. a rational
 *  reduced from `1/300000000000000000000` gives denominator text `"3e+20"`). Anything without that suffix (small
 *  integers, and `toString()`'s own non-scientific range) passes through unchanged. This is the one normalization
 *  needed before a bignum's printed text can be compared, textually, to pg's own `::text` output (which never
 *  uses scientific notation for an exact integer). */
function normalizeBignumText(s: string): string {
  const m = /^(-?)(\d+)e\+(\d+)$/.exec(s)
  if (!m) return s
  const [, sign, mantissa, expStr] = m
  return sign + mantissa + '0'.repeat(Number(expStr))
}

/** Build the oracle. Lazy by design (this file is dynamically imported only from the selfcert script) — the
 *  full kernel is a sizable chunk nothing else in this package should pay to load. */
export async function makeOracle(): Promise<Oracle> {
  const ce = new ComputeEngine()
  // Headroom well past any exact value the corpus exercises (100! and 2^200 both fit comfortably) — see
  // ce-spike.md item 9 for the precision->exactness relationship this relies on.
  ce.precision = 300

  return {
    async evaluate(latex: string): Promise<OracleValue> {
      let result: unknown
      try {
        result = await ce.parse(latex).evaluateAsync()
      } catch (e) {
        return { kind: 'other', text: `ORACLE PARSE/EVAL ERROR: ${(e as Error).message}` }
      }
      const r = result as {
        symbol?: string
        isInteger?: boolean
        isRational?: boolean
        toString(): string
        numeratorDenominator?: [{ toString(): string }, { toString(): string }]
      }
      if (r.symbol === 'True' || r.symbol === 'False') {
        return { kind: 'bool', text: r.symbol === 'True' ? 'true' : 'false' }
      }
      // isInteger before isRational: every integer answers isRational too (its own doc comment), and the
      // integer path skips the p/q formatting a whole-number rational would otherwise need.
      if (r.isInteger) return { kind: 'int', text: normalizeBignumText(r.toString()) }
      if (r.isRational && r.numeratorDenominator) {
        const [num, den] = r.numeratorDenominator
        return { kind: 'rational', text: `${normalizeBignumText(num.toString())}/${normalizeBignumText(den.toString())}` }
      }
      return { kind: 'other', text: r.toString() }
    },
  }
}
