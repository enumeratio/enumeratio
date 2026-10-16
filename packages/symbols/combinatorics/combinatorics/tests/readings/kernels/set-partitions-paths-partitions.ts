// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.

export function isRestrictedGrowthStringOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e) || e.length !== n) return false;
  let mx = -1;
  for (const v of e) {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > mx + 1) return false;
    if (v > mx) mx = v;
  }
  return true;
}
