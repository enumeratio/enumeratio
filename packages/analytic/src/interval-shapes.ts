// What an exact interval image needs to know about a function: where it turns around. Over an
// interval, a continuous function takes its extreme values at the endpoints or at an interior
// critical point, so a head whose critical points are KNOWN -- none at all, or one at an exact
// point -- has an image that is exact whenever its endpoints are: evaluate at the endpoints
// (and the critical point, if it lies inside), take the least and the greatest. No sampling, so
// nothing between samples can be missed. That is the whole of this table's claim, and why it
// only lists heads whose shape is a textbook fact rather than something observed numerically.
//
// A critical point need not be exact to be KNOWN: Γ's only one on (0, ∞) is its minimum at
// x₀ = 1.46163214496836…, a constant known to any precision. Evaluating Γ at the nearest double
// to x₀ lands above the true minimum by about Γ''(x₀)·(10⁻¹⁶)²/2 ≈ 10⁻³², far inside the ulp an
// inexact bound is rounded outward by (interval-bounds.ts), so the image is still rigorous.
//
// Periodic heads (Sin … Csc) are not here: their critical points and poles recur, so
// interval.ts enumerates them per period instead. Heads with neither fall back to sampling --
// see interval.ts for the order these are tried in.

/** Where a head is real (and finite inside): `[from, to]`, or `(from, to]` when `open`, for a
 * head with a pole at `from` (Γ at 0). An interval reaching past it is declined -- the image
 * would not be a real interval. */
export interface Domain {
  readonly from: number;
  readonly to: number;
  readonly open?: boolean;
}

/** A head's shape on its real domain. */
export type Shape =
  /** Increasing throughout. */
  | { readonly kind: "increasing"; readonly domain?: Domain }
  /** Decreasing throughout. */
  | { readonly kind: "decreasing"; readonly domain?: Domain }
  /** Decreasing up to `at`, increasing after it: `at` is the minimum. */
  | { readonly kind: "valley"; readonly at: number; readonly domain?: Domain };

/** Γ's minimum on the positive reals -- the zero of ψ there -- to double precision. */
const GAMMA_MINIMUM = 1.4616321449683622;

const unitInterval: Domain = { from: -1, to: 1 };
const nonNegative: Domain = { from: 0, to: Infinity };
const positive: Domain = { from: 0, to: Infinity, open: true };

/** Unary heads whose shape is known. Γ, ln Γ and ψ only on the positive reals: between Γ's
 * poles on the negative axis each has another critical point, which this table doesn't hold,
 * so a negative interval is declined. */
export const SHAPES: Readonly<Record<string, Shape>> = {
  Arcsin: { kind: "increasing", domain: unitInterval },
  Arccos: { kind: "decreasing", domain: unitInterval },
  Arctan: { kind: "increasing" },
  Sinh: { kind: "increasing" },
  Cosh: { kind: "valley", at: 0 },
  Tanh: { kind: "increasing" },
  Ln: { kind: "increasing", domain: nonNegative },
  Sqrt: { kind: "increasing", domain: nonNegative },
  Erf: { kind: "increasing" },
  Erfc: { kind: "decreasing" },
  ErfInv: { kind: "increasing", domain: unitInterval },
  Gamma: { kind: "valley", at: GAMMA_MINIMUM, domain: positive },
  GammaLn: { kind: "valley", at: GAMMA_MINIMUM, domain: positive },
  LogGamma: { kind: "valley", at: GAMMA_MINIMUM, domain: positive },
  // ψ' = Σ 1/(x+k)² > 0: increasing on the whole positive axis.
  Digamma: { kind: "increasing", domain: positive },
};

/** `Log(x, b)`'s shape in `x`: increasing for a base above 1, decreasing for a base in (0, 1),
 * and undefined for any other base. `Log(x)` alone is base 10. */
export function logShape(base: number): Shape | undefined {
  if (base > 1) return { kind: "increasing", domain: nonNegative };
  if (base > 0 && base < 1) return { kind: "decreasing", domain: nonNegative };
  return undefined;
}
