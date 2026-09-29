// Recursion in Epsil without a global name: the function is handed itself as its first
// argument, so a map's body stays one closed expression. A fold can't build a nested value;
// this can. Calls are written as heads, not `Apply`: `Apply` threads over a list argument. Compare
// with `Equal`, which compares lists whole; `Same` doesn't see a bound variable's value.

type MathJSON = unknown;

/** `self(arg…)` inside a recursive body: call the function being defined. */
export const self = (...args: readonly MathJSON[]): MathJSON => ["self", "self", ...args];

/** Apply the recursive function whose body is `body` (over `self` and `params`) to `args`. */
export function recurse(body: MathJSON, params: readonly string[], ...args: readonly MathJSON[]): MathJSON {
  const fn = ["Function", body, "self", ...params];
  return [fn, fn, ...args];
}

/** A binary tree's leaf: the integer 0, as against a node `[L, R]`. `Equal` would thread. */
export const isLeaf = (tree: MathJSON): MathJSON => ["Element", tree, "Integers"];
