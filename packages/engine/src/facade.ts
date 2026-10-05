// The nucleus facade's main-entry types and constructors. Aliases of compute-engine's own
// types for now: they let a library name an engine, an expression and MathJSON without
// importing compute-engine, and leave every member reachable. Narrowing them to the members
// libraries use is a later step.
import type {
  BoxedExpression,
  ComputeEngine,
  MathJsonExpression,
  OperatorDefinition,
  Type as CeType,
} from "@cortex-js/compute-engine";

/** A compute-engine instance. */
export type Engine = ComputeEngine;
/** An expression boxed by an `Engine`. */
export type Expr = BoxedExpression;
/** MathJSON: what `box` takes and `.json` gives back. */
export type Json = MathJsonExpression;
/** A head's definition, as `ce.declare` takes it. */
export type HeadDefinition = OperatorDefinition;
/** A head's `compile` field: how it lowers to a target (`ctx.language`), or `undefined` to leave it to the default. */
export type CompileHandler = NonNullable<HeadDefinition["compile"]>;
/** compute-engine's type language (`"integer"`, `"(number) -> number"`, ...). */
export type Type = CeType;

export { isNumber, isSymbol } from "@cortex-js/compute-engine";

/** Box MathJSON. Typed over `Json` so a call site builds its array literal as `Json`, not `as never`. */
export const box = (ce: Engine, json: Json): Expr => ce.box(json);
