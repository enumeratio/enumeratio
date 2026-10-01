// Axis scaling functions (Wolfram's ScalingFunctions): a monotonic forward map
// applied before a coordinate is placed on an axis, with its inverse for reading
// tick values back. `fwd` returns NaN where the value is out of the scale's
// domain (log of a non-positive number), which the plotters treat as a gap.

export type ScaleName = "linear" | "log" | "log10" | "log2" | "sqrt";

interface Scale {
  fwd: (v: number) => number;
  inv: (v: number) => number;
}

const SCALES: Record<ScaleName, Scale> = {
  linear: { fwd: (v) => v, inv: (v) => v },
  log: { fwd: (v) => (v > 0 ? Math.log(v) : Number.NaN), inv: (v) => Math.exp(v) },
  log10: { fwd: (v) => (v > 0 ? Math.log10(v) : Number.NaN), inv: (v) => 10 ** v },
  log2: { fwd: (v) => (v > 0 ? Math.log2(v) : Number.NaN), inv: (v) => 2 ** v },
  sqrt: { fwd: (v) => (v >= 0 ? Math.sqrt(v) : Number.NaN), inv: (v) => v * v },
};

/** Resolve a scale by name; unknown names (and undefined) fall back to linear. */
export function scale(name?: string): Scale {
  return SCALES[name as ScaleName] ?? SCALES.linear;
}

/** Whether a scale leaves coordinates unwarped (so a zero-axis is meaningful). */
export function isLinear(name?: string): boolean {
  return !name || name === "linear";
}
