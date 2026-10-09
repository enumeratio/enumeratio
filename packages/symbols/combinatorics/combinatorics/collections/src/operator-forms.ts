import { type Engine, type Expr, operandsOf, wrapOperator } from "@enumeratio/engine";

// Wolfram's operator forms: `Map[f][xs]` is `Map[f, xs]`. Calling `Map(f)` on `xs` reaches
// compute-engine's `Apply`, which reads a compound callee as a lambda over its free symbols:
// it binds `f` to `xs` (`Map(xs)`), or with none free (`Filter(IsEven)`) drops `xs`.

/** The heads with an operator form, and whether the argument it is applied to comes before the
 *  held operand (`Select[crit][xs]` is `Select[xs, crit]`, our `Filter(xs, crit)`) or after. */
const FORMS: Readonly<Record<string, "start" | "end">> = { Map: "end", Fold: "end", Filter: "start" };

/** `Map(f)(xs)`, `Fold(f)(xs)` and `Filter(pred)(xs)`. Only the form holding one operand:
 *  `Fold(f, x)` is our unseeded `Fold(f, xs)`, so Wolfram's seeded operator form can't be told
 *  from it. */
export function declareOperatorForms(ce: Engine): void {
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
