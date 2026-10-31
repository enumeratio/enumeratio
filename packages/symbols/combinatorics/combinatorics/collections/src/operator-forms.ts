import {
  applyFunction,
  capturesArguments,
  type Engine,
  type Expr,
  operandsOf,
  symbolNameOf,
  widenSignature,
  wrapOperator,
} from "@enumeratio/engine";

// Wolfram's operator forms: `Map[f][xs]` is `Map[f, xs]`. compute-engine boxes `Map(f)` with its
// collection `missing`, so `Map(f)(xs)` evaluates to that error unless `Map(f)` is a valid call.

/** The heads with an operator form, and whether the argument it is applied to comes before the
 *  held operand (`Select[crit][xs]` is `Select[xs, crit]`, our `Filter(xs, crit)`) or after. */
const FORMS: Readonly<Record<string, "start" | "end">> = { Map: "end", Fold: "end", Filter: "start" };

/** Heads whose value is arithmetic, never a function. */
const ARITHMETIC = new Set(["Add", "Multiply", "Subtract", "Divide", "Power", "Negate", "Sqrt"]);

const hasSlot = (expr: Expr): boolean => (symbolNameOf(expr) ?? "").startsWith("_") || operandsOf(expr).some(hasSlot);

/** `Map(f)(xs)`, `Fold(f)(xs)` and `Filter(pred)(xs)`. Only the form holding one operand:
 *  `Fold(f, x)` is our unseeded `Fold(f, xs)`, so Wolfram's seeded operator form can't be told
 *  from it. */
export function declareOperatorForms(ce: Engine): void {
  // The one-operand callee is a valid call, not a missing operand: compute-engine boxes the
  // callee of `Apply` before our hook runs, and flags the absent collection as `missing`.
  for (const head of Object.keys(FORMS)) {
    widenSignature(ce, head, "(any) -> any");
    wrapOperator(
      ce,
      [head],
      () => true,
      () => () => undefined,
      1,
    );
  }
  // A sum, product or power is no function, so `(f + g)[x]` stays a call, as in Wolfram;
  // compute-engine reads it as a function of its free symbols (`(f + 1)(2)` is 3,
  // cortex-js/compute-engine#426). A slot (`_1`) in the callee makes it a pure function body,
  // which compute-engine's `Apply` reads.
  wrapOperator(
    ce,
    ["Apply"],
    ([callee, ...args]) => args.length > 0 && ARITHMETIC.has(callee!.operator) && !hasSlot(callee!),
    () => () => undefined,
  );
  // A `Function` literal that would capture an argument (`Function(y, Function(x, y^x))` called on
  // `x`, which compute-engine reads as `x^x`) binds by renaming instead. Any other call stays
  // compute-engine's: it binds a value once, which `bind` relies on to share a sub-term.
  wrapOperator(
    ce,
    ["Apply"],
    ([f, ...args]) => f!.operator === "Function" && capturesArguments(f!, args),
    () =>
      ([f, ...args]) =>
        applyFunction(ce, f as Expr, args as Expr[]),
  );
  wrapOperator(
    ce,
    ["Apply"],
    ([form, ...args]) => args.length === 1 && Object.hasOwn(FORMS, form!.operator) && operandsOf(form!).length === 1,
    () =>
      ([form, arg]) => {
        const held = operandsOf(form as Expr)[0] as Expr;
        const call = FORMS[form!.operator] === "start" ? [arg, held] : [held, arg];
        return ce.function(form!.operator, call as Expr[]).evaluate();
      },
  );
}
