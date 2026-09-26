// InputForm -- an expression printed as notatio you could have typed. Wolfram's
// `InputForm` is a printer, not a hold: it renders whatever tree it is handed, so a
// held expression prints as written and an evaluated one prints as evaluated. This is
// the same deal, over `serializeEpsil`.
//
// What it adds is a normalization pass, because the two trees compute-engine hands us
// each print badly in their own way. A non-canonical parse keeps `x - 2` and
// `(x, 0, 1)` but leaves `InvisibleOperator` in the tree; a canonical one resolves the
// operators but turns subtraction into `x + -2` and an integrand into
// `Function(do {…}, x)`. Every rule below rewrites one of those into the spelling a
// person would type, and none of them changes what the expression means: the
// `inputform.test.ts` corpus asserts that parsing the output back gives the same
// canonical expression.

import { type MathJsonExpression, serializeEpsil } from "@cortex-js/compute-engine/epsil";

/** Heads whose first argument is a body over a bound variable, not a lambda to keep. */
const BINDERS = new Set(["Integrate", "Sum", "Product", "Limit"]);

const headOf = (node: unknown): string | undefined => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) && typeof fn[0] === "string" ? fn[0] : undefined;
};

const opsOf = (node: unknown): unknown[] => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) ? fn.slice(1) : [];
};

/** A negative literal, as a number — `-2`, `{num: "-2"}` — else undefined. */
function negativeLiteral(node: unknown): number | undefined {
  const value = typeof node === "number" ? node : Number((node as { num?: string })?.num ?? Number.NaN);
  return Number.isFinite(value) && value < 0 ? value : undefined;
}

/** The term a trailing `Add` operand subtracts, or undefined if it adds. */
function subtracted(node: unknown): MathJsonExpression | undefined {
  const negative = negativeLiteral(node);
  if (negative !== undefined) return -negative as MathJsonExpression;
  if (headOf(node) === "Negate") return opsOf(node)[0] as MathJsonExpression;
  // A product with a negative leading coefficient subtracts the rest of the product.
  if (headOf(node) === "Multiply") {
    const [first, ...rest] = opsOf(node);
    const negative = negativeLiteral(first);
    if (negative === undefined || rest.length === 0) return undefined;
    return (negative === -1 && rest.length === 1 ? rest[0] : ["Multiply", -negative, ...rest]) as MathJsonExpression;
  }
  return undefined;
}

/** `Add(a, -b, …)` prints as `a - b - …`; anything that still adds stays in the `Add`. */
function foldSubtraction(ops: MathJsonExpression[]): MathJsonExpression {
  let left = ops[0];
  for (const op of ops.slice(1)) {
    const term = subtracted(op);
    left = term === undefined ? ["Add", left, op] : ["Subtract", left, term];
  }
  return left;
}

/**
 * compute-engine's `serializeEpsil` drops a mantissa of exactly 1, so `1e-16` prints as
 * `e-16` -- Euler's e minus 16 when read back. It prints any other mantissa as given, so
 * the same value spelled `10e-17` survives the trip. Only a number that would print that
 * way is respelled; the rest keep the serializer's own choice.
 */
function unitMantissa(node: unknown): MathJsonExpression | undefined {
  if (typeof node !== "number" && typeof (node as { num?: unknown })?.num !== "string") return undefined;
  const match = /^(-?)e([+-]?\d+)$/.exec(serializeEpsil(node as MathJsonExpression));
  return match ? { num: `${match[1]}10e${Number(match[2]) - 1}` } : undefined;
}

function rewrite(node: unknown): MathJsonExpression {
  const head = headOf(node);
  if (head === undefined) return unitMantissa(node) ?? (node as MathJsonExpression);
  const ops = opsOf(node).map(rewrite);

  switch (head) {
    // `2x` in a non-canonical parse. Whatever it multiplies, it multiplies.
    case "InvisibleOperator":
      return rewrite(["Multiply", ...ops]);

    // `do { … }` around a single statement is the serializer showing us a block that
    // was never a block. A single-operand `Delimiter` is the parse holding on to the
    // parentheses it was written with; the serializer puts back the ones it needs.
    case "Block":
    case "Delimiter":
      return ops.length === 1 ? ops[0] : [head, ...ops];

    // Canonicalization wraps an integrand in a lambda and its bounds in `Limits`;
    // `Integrate(x ^ 2, (x, 0, 1))` parses back to exactly the same thing.
    case "Integrate":
    case "Sum":
    case "Product":
    case "Limit": {
      const [first, ...rest] = ops;
      const body = headOf(first) === "Function" ? rewrite(opsOf(first)[0]) : first;
      const bounds = rest.map((r) => (headOf(r) === "Limits" ? (["Tuple", ...opsOf(r)] as MathJsonExpression) : r));
      return [head, body, ...bounds];
    }

    case "Add":
      return foldSubtraction(ops);

    // `-1 * x` is how a canonical tree spells a negation.
    case "Multiply": {
      const [first, ...rest] = ops;
      if (negativeLiteral(first) === -1 && rest.length > 0) {
        return ["Negate", rest.length === 1 ? rest[0] : ["Multiply", ...rest]];
      }
      return ["Multiply", ...ops];
    }

    // `i` and `e` both parse back to these, and both are what a person types.
    case "Complex": {
      const [re, im] = ops;
      const zero = (v: unknown) => Number((v as { num?: string })?.num ?? v) === 0;
      const one = (v: unknown) => Number((v as { num?: string })?.num ?? v) === 1;
      if (zero(re) && one(im)) return "i" as MathJsonExpression;
      // Through the rules again, so a negative imaginary part subtracts: `1 - i`, not `1 + -1 * i`.
      if (zero(re)) return rewrite(["Multiply", im, "i"]);
      return rewrite(one(im) ? ["Add", re, "i"] : ["Add", re, ["Multiply", im, "i"]]);
    }

    default:
      return [head, ...ops];
  }
}

/** Rewrite `json` into the shape a person would type, without changing its meaning. */
export function normalizeInputForm(json: MathJsonExpression): MathJsonExpression {
  return rewrite(json);
}

/** Print `json` as InputForm: notatio you could type back in. */
export function toInputForm(json: MathJsonExpression): string {
  return serializeEpsil(normalizeInputForm(json));
}

/** `BINDERS` is exported for the tests, which assert the unwrapping round-trips. */
export { BINDERS as INPUT_FORM_BINDERS };
