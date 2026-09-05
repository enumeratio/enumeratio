// Coerce a numeric prop to a real number at the point of use. Needed because Vue sets a numeric prop on an
// ALREADY-DEFINED custom element as a raw string PROPERTY (`el.n = "3"`), which bypasses Lit's `type: Number`
// attribute converter (converters only run attribute→property). So an authored `n="3"` arrives as the number 3 on a
// full page load (the element is still undefined when Vue renders → attribute path → converter runs) but as the string
// "3" on first SPA navigation (the element is already defined → property path → no conversion). Coercing here makes
// both paths agree. See issue #257.
export const num = (v: unknown): number => Number(v)
