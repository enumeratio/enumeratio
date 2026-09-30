// InputForm -- an expression printed as Epsil you could have typed. Wolfram's
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

/**
 * Negate a node `negativeLiteral` found negative, without narrowing a
 * high-precision `{num: "-3.14159…"}` string through a JS double — `-negative`
 * would round it to ~17 digits. A SHORT `num` string (an ordinary
 * compute-engine-internal number, not a many-digit literal) round-trips
 * exactly through a double either way, so it negates as a plain number,
 * matching how it has always printed: `serializeEpsil` writes an
 * integer-valued `{num: "1056.0…"}` string (any bignum result, exact or not)
 * with a trailing `.0` it would never add to the JS number `1056`.
 */
const SAFE_DOUBLE_DIGITS = 15;

function negateLiteral(node: unknown): MathJsonExpression {
  if (typeof node === "number") return -node as MathJsonExpression;
  const s = (node as { num: string }).num;
  if (s.replace(/[^0-9]/g, "").length <= SAFE_DOUBLE_DIGITS) return -Number(s) as MathJsonExpression;
  return (s.startsWith("-") ? { num: s.slice(1) } : { num: `-${s}` }) as MathJsonExpression;
}

/** The term a trailing `Add` operand subtracts, or undefined if it adds. */
function subtracted(node: unknown): MathJsonExpression | undefined {
  const negative = negativeLiteral(node);
  if (negative !== undefined) return negateLiteral(node);
  if (headOf(node) === "Negate") return opsOf(node)[0] as MathJsonExpression;
  // A product with a negative leading coefficient subtracts the rest of the product.
  if (headOf(node) === "Multiply") {
    const [first, ...rest] = opsOf(node);
    const negative = negativeLiteral(first);
    if (negative === undefined || rest.length === 0) return undefined;
    return (
      negative === -1 && rest.length === 1 ? rest[0] : ["Multiply", negateLiteral(first), ...rest]
    ) as MathJsonExpression;
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

/**
 * This bridges a compute-engine bug (upstreamed as a fix to
 * `epsil/formatter.ts`'s `FormattingBlock`s, not yet released): its Epsil
 * formatter rebuilds each operand's line-vs-wrap layout from scratch on every
 * `serialize`/`nextCol`/`cost` call instead of caching it once per node, so
 * printing time multiplies roughly 5-10x per extra level of operator nesting
 * -- a chain of nested `Add`/`Multiply`/`Power`/… only 10-12 deep (a closed
 * form out of `FunctionExpand`, say) never returns. Retire `renderSafely`
 * once compute-engine ships the fix.
 *
 * It keeps every `serializeEpsil` call shallow: a subtree past `SAFE_DEPTH` is
 * printed on its own, recursively, and spliced back in as a placeholder
 * symbol, parenthesized by `needsParens` exactly where a person would write
 * the parens themselves.
 *
 * `SAFE_DEPTH` is measured, not guessed: a synthetic tree alternating
 * `Add`/`Multiply`/`Power`/`Negate`, branching 2 wide, costs ~40ms/call at
 * depth 9 and ~390ms/call at depth 10 (`serializeEpsil` calls, this package's
 * `vp node` harness) -- 9 is the deepest still comfortably under a 50ms
 * per-call budget.
 */
const SAFE_DEPTH = 9;

function nodeDepth(node: unknown): number {
  const ops = opsOf(node);
  return ops.length === 0 ? 1 : 1 + Math.max(...ops.map(nodeDepth));
}

/**
 * Precedence for the heads this printer folds into infix/prefix notation --
 * low binds loose (`Add`/`Subtract`), high binds tight (`Power`). A head left
 * out (a function call, an atom) is never parenthesized as someone else's
 * operand: its own syntax (`f(…)`) already delimits it.
 */
const PRECEDENCE: Record<string, number> = {
  Add: 1,
  Subtract: 1,
  Multiply: 2,
  Divide: 2,
  Negate: 3,
  Power: 4,
};

/**
 * For a binary parent, the operand side where an EQUAL-precedence child of
 * the same shape folds in bare, matching ordinary left-to-right reading (or,
 * for `Power`, right-to-left): `a - b - c` needs no parens, `a - (b - c)`
 * does. A parent left out (`Negate`, or anything not in `PRECEDENCE`) always
 * parenthesizes an equal-precedence child -- the conservative default.
 */
const SAFE_EQUAL_PRECEDENCE_SIDE: Record<string, "left" | "right" | "both"> = {
  Add: "both",
  Multiply: "both",
  Subtract: "left",
  Divide: "left",
  Power: "right",
};

/** Whether `child`, spliced in as operand `index` of `parentHead`'s `argCount` operands, needs parens. */
function needsParens(child: unknown, parentHead: string, index: number, argCount: number): boolean {
  const childPrecedence = PRECEDENCE[headOf(child) as string];
  if (childPrecedence === undefined) return false; // an atom or a function call: always safe bare
  const parentPrecedence = PRECEDENCE[parentHead];
  if (parentPrecedence === undefined || childPrecedence > parentPrecedence) return false;
  if (childPrecedence < parentPrecedence) return true;
  const safeSide = SAFE_EQUAL_PRECEDENCE_SIDE[parentHead];
  if (safeSide === "both") return false;
  if (safeSide === "left") return index !== 0;
  if (safeSide === "right") return index !== argCount - 1;
  return true;
}

function renderSafely(node: MathJsonExpression): string {
  if (nodeDepth(node) <= SAFE_DEPTH) return serializeEpsil(node);

  // Depth > 1 here always means a headed (array/`fn`) node -- `nodeDepth` is 1
  // for anything `opsOf` can't descend into.
  const head = headOf(node)!;
  const ops = opsOf(node);
  const placeholders: { name: string; text: string }[] = [];
  const shallowOps = ops.map((op, index) => {
    if (nodeDepth(op) <= SAFE_DEPTH - 1) return op;
    const rendered = renderSafely(op as MathJsonExpression);
    const name = `InputFormPlaceholder${placeholders.length}`;
    const wrapped = needsParens(op, head, index, ops.length) ? `(${rendered})` : rendered;
    placeholders.push({ name, text: wrapped });
    return name;
  });

  let text = serializeEpsil([head, ...shallowOps] as MathJsonExpression);
  for (const { name, text: sub } of placeholders) text = text.split(name).join(sub);
  return text;
}

/** Print `json` as InputForm: Epsil you could type back in. */
export function toInputForm(json: MathJsonExpression): string {
  return renderSafely(normalizeInputForm(json));
}

/** `BINDERS` is exported for the tests, which assert the unwrapping round-trips. */
export { BINDERS as INPUT_FORM_BINDERS };
