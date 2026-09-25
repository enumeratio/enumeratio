import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { defineMessages, emit, integerAt, operandsOf, symbolNameOf } from "@enumeratio/boxed";

// Wolfram-frontier scoping/control heads: With, Module, Reap/Sow, Do, Switch, NestWhile(List),
// While, FixedPointList, Throw/Catch, Echo, AbsoluteTiming, Attributes/SetAttributes, AppendTo.
//
// None of these exist on compute-engine (probed via `ce.lookupDefinition` for every one) --
// they're declared fresh below. Compute-engine DOES already declare `Block` (a scoped,
// lazy `(unknown*) -> unknown`), `Loop`, `Assign`, `Declare`, `Function`, `If`, `Which`,
// `Break` and `Continue`, none of which are reused here: `Block`'s own scoping semantics
// aren't documented enough to trust for Module's "fresh local, no leak, no clobber"
// contract, and building directly on `ce.createScope`/`pushScope`/`popScope` (the same
// public API `Transcript` uses, in @enumeratio/notatio's `transcript.ts`) is both simpler
// and verified below to do exactly what's needed: a pre-boxed body expression's symbol
// references re-resolve against whatever scope is CURRENT at `.evaluate()` time, not at
// box time, so pushing a scope, declaring locals into it, evaluating the (already-boxed,
// held) body, and popping in a `finally` is sufficient -- no gensym hygiene required, since
// each call gets its own scope object.
//
// `Return` is undeclared on compute-engine (surprisingly, given `Break`/`Continue` exist) --
// not implemented here; nothing in this wave's heads needs it.
//
// Sequencing multiple statements for a test/example (Wolfram's `CompoundExpression`,
// `a; b; c`) is deliberately done with `[Last, [List, a, b, c]]`, never compute-engine's
// own `Block` -- `Block` turns out to give a bare symbol referenced inside it (e.g. a Sow
// tag) a DIFFERENT identity than the same symbol referenced outside it: two structurally
// identical `["Sow", 1, "a"]` / `Reap(..., "a")` calls stop agreeing on the tag (`isSame`
// returns false) as soon as the `Sow` is nested inside a `Block`, even though the exact
// same pair matches fine through `List`. Undocumented and not investigated further here
// (outside this task's scope) -- just avoided.
//
// Clear is SKIPPED: `ce.assign(name, undefined)` throws ("Invalid definition"), and there
// is no public API to unbind a symbol back to a free/symbolic state -- only `ce.assign`
// (which requires a value) and `ce.declare` (which throws redeclaring an existing symbol).
// A faithful Clear needs an engine-internal hook this package doesn't have.
//
// Binding-list shape for With/Module: our own `ce.parse("x = 1")` reads `=` as `Equal`, not
// as an `Assign` -- compute-engine's `Set` head is the SET data type (`{1, 2, 3}`), not
// assignment, and `Assign`'s call shape (`["Assign", "x", 1]`) is not what `x = 1` parses
// to. So a binding list is `[List, [Equal, "x", 1], [Equal, "y", 2], ...]`, matching
// Wolfram's own `{x = 1, y = 2}` (curly braces are `List` in Wolfram, an unrelated
// collision with LaTeX's `\{...\}`, which compute-engine's LaTeX parser reads as the SET
// head -- irrelevant here since every example below is raw MathJSON, never parsed text).

/** Call a (possibly `Function`-headed) expression as an operator over `args` -- same
 *  technique as `list-functional.ts`'s own `applyFn`, duplicated locally per house style
 *  (see `list-frontier-2.ts`'s `invoke`). */
const applyFn = (ce: ComputeEngine, fn: BoxedExpression, args: readonly BoxedExpression[]): BoxedExpression =>
  ce.function("Apply", [fn, ...args]).evaluate();

const isTrue = (expr: BoxedExpression): boolean => symbolNameOf(expr) === "True";

/** Iteration cap for `While`/`NestWhile`/`NestWhileList` -- unlike `Do` (whose count is
 *  given directly by the caller) these run until a test fails, which may never happen.
 *  Wolfram's own default is the much larger, configurable `$IterationLimit`; ours is a
 *  fixed 4096 with no override, past which the loop simply stops and the last value (or,
 *  for `While`, `Nothing`) is returned rather than looping forever. */
const MAX_ITERATIONS = 4096;

// --- With / Module -------------------------------------------------------------------------

/** Read a `[List, [Equal, sym, val]?, ...]` binding list. `requireValue` rejects a bare
 *  symbol with no `= val` (With requires one; Module allows an uninitialized local). */
function readBindings(
  bindings: BoxedExpression,
  requireValue: boolean,
): readonly { readonly name: string; readonly value: BoxedExpression | undefined }[] | undefined {
  if (bindings.operator !== "List") return undefined;
  const result: { readonly name: string; readonly value: BoxedExpression | undefined }[] = [];
  for (const b of operandsOf(bindings)) {
    if (b.operator === "Equal") {
      const [sym, val] = operandsOf(b);
      const name = sym !== undefined ? symbolNameOf(sym) : undefined;
      if (name === undefined || val === undefined) return undefined;
      result.push({ name, value: val });
    } else {
      if (requireValue) return undefined;
      const name = symbolNameOf(b);
      if (name === undefined) return undefined;
      result.push({ name, value: undefined });
    }
  }
  return result;
}

/** `With({x = 1, y = 2}, body)`: substitute VALUES into the held `body`, then evaluate --
 *  no fresh scope, since nothing is declared as a variable at all. Bindings are
 *  simultaneous (each value is computed against the outer context, none can see another
 *  binding in the same list), matching Wolfram. */
function declareWith(ce: ComputeEngine): void {
  ce.declare("With", {
    signature: "(any, any) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [bindingsExpr, body] = ops;
      if (bindingsExpr === undefined || body === undefined) return undefined;
      const bindings = readBindings(bindingsExpr, true);
      if (bindings === undefined) return undefined;
      const subs: Record<string, BoxedExpression> = {};
      for (const { name, value } of bindings) subs[name] = value!.evaluate();
      return body.subs(subs).evaluate();
    },
  });
}

/** `Module({x, y = 2}, body)`: a fresh scope per call, holding one local per binding
 *  (declared, then assigned when the binding gave a value) -- popped in a `finally` so a
 *  thrown error (including our own `Throw`, below) still unwinds the scope. */
function declareModule(ce: ComputeEngine): void {
  ce.declare("Module", {
    signature: "(any, any) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [bindingsExpr, body] = ops;
      if (bindingsExpr === undefined || body === undefined) return undefined;
      const bindings = readBindings(bindingsExpr, false);
      if (bindings === undefined) return undefined;
      // Values are computed in the OUTER context, like With, before any local shadows them.
      const inits = bindings.map(({ name, value }) => ({ name, value: value?.evaluate() }));
      const scope = ce.createScope({});
      ce.pushScope(scope, "Module");
      try {
        for (const { name, value } of inits) {
          ce.declare(name, "any", scope);
          if (value !== undefined) ce.assign(name, value);
        }
        return body.evaluate();
      } finally {
        ce.popScope();
      }
    },
  });
}

// --- Reap / Sow ------------------------------------------------------------------------------

/** One `Sow`-ed group: everything sown under the same tag (or, for `DEFAULT_TAG`, sown
 *  with no tag at all), in first-sown order. */
interface SowGroup {
  readonly tag: BoxedExpression | typeof DEFAULT_TAG;
  readonly values: BoxedExpression[];
}
const DEFAULT_TAG = Symbol("control.ts default Sow tag");

/** Per-engine stack of open `Reap` frames -- `Sow` always feeds the INNERMOST one (Wolfram:
 *  a `Sow` inside a nested `Reap` is consumed there, and does not also reach an outer
 *  `Reap` unless re-sown). A `WeakMap` keyed by the engine, so two engines never share
 *  state and nothing leaks once an engine is collected. */
const reapStacks = new WeakMap<ComputeEngine, SowGroup[][]>();

function reapStack(ce: ComputeEngine): SowGroup[][] {
  let stack = reapStacks.get(ce);
  if (stack === undefined) {
    stack = [];
    reapStacks.set(ce, stack);
  }
  return stack;
}

const tagsMatch = (a: BoxedExpression | typeof DEFAULT_TAG, b: BoxedExpression | typeof DEFAULT_TAG): boolean =>
  a === DEFAULT_TAG || b === DEFAULT_TAG ? a === b : a.isSame(b);

/** `Sow(e)` / `Sow(e, tag)`: record `e`'s value into the nearest enclosing `Reap`'s
 *  current tag group (creating it on first use), and return `e`. Outside any `Reap`,
 *  it's a no-op that still returns `e` -- Wolfram's own behavior. */
function declareSow(ce: ComputeEngine): void {
  ce.declare("Sow", {
    signature: "(any, any?) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const valueExpr = ops[0];
      if (valueExpr === undefined) return undefined;
      const value = valueExpr.evaluate();
      const stack = reapStack(ce);
      const frame = stack[stack.length - 1];
      if (frame !== undefined) {
        const tag = ops[1] !== undefined ? ops[1].evaluate() : DEFAULT_TAG;
        let group = frame.find((g) => tagsMatch(g.tag, tag));
        if (group === undefined) {
          group = { tag, values: [] };
          frame.push(group);
        }
        group.values.push(value);
      }
      return value;
    },
  });
}

/** `Reap(expr)`: `{value(expr), {{sown...}, ...}}`, one inner list per distinct tag
 *  `Sow` used (untagged sows share one group), in first-appearance order; `{}` if nothing
 *  was sown. `Reap(expr, tag)` / `Reap(expr, {tag1, tag2, ...})`: only the group(s) whose
 *  tag matches exactly (Wolfram's fuller pattern-matching form isn't -- exact tag equality
 *  only, documented per the task's "at least exact-tag matching"); a requested tag nothing
 *  was sown under comes back as `{}` in its position. */
function declareReap(ce: ComputeEngine): void {
  ce.declare("Reap", {
    signature: "(any, any?) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const body = ops[0];
      if (body === undefined) return undefined;
      const stack = reapStack(ce);
      const frame: SowGroup[] = [];
      stack.push(frame);
      let value: BoxedExpression;
      try {
        value = body.evaluate();
      } finally {
        stack.pop();
      }

      const form = ops[1];
      if (form === undefined) {
        const groups = frame.map((g) => ce.box(["List", ...g.values]));
        return ce.box(["List", value, ce.box(["List", ...groups])]);
      }
      const formValue = form.evaluate();
      const requestedTags = formValue.operator === "List" ? operandsOf(formValue) : [formValue];
      const groups = requestedTags.map((tag) => {
        const found = frame.find((g) => g.tag !== DEFAULT_TAG && (g.tag as BoxedExpression).isSame(tag));
        return ce.box(["List", ...(found?.values ?? [])]);
      });
      return ce.box(["List", value, ce.box(["List", ...groups])]);
    },
  });
}

// --- Throw / Catch -----------------------------------------------------------------------

/** A thrown value in flight, as a plain JS exception -- compute-engine has no non-local
 *  control flow of its own, so `Throw` unwinds the JS call stack directly and `Catch`
 *  intercepts it. `tag` is `undefined` for a plain `Throw(value)`. */
class ThrowSignal {
  readonly value: BoxedExpression;
  readonly tag: BoxedExpression | undefined;
  constructor(value: BoxedExpression, tag: BoxedExpression | undefined) {
    this.value = value;
    this.tag = tag;
  }
}

function declareThrow(ce: ComputeEngine): void {
  ce.declare("Throw", {
    signature: "(any, any?) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const valueExpr = ops[0];
      if (valueExpr === undefined) return undefined;
      const tagExpr = ops[1];
      throw new ThrowSignal(valueExpr.evaluate(), tagExpr?.evaluate());
    },
  });
}

/** `Catch(expr)`: catches any `Throw`, whatever its tag, and returns the thrown value.
 *  `Catch(expr, tag)`: only catches a `Throw` whose tag matches EXACTLY (same limitation
 *  as `Reap`'s tag form, not Wolfram's fuller pattern matching) -- an untagged `Throw` or
 *  one with a different tag propagates past this `Catch` to the next enclosing one (or out
 *  of the whole evaluation, same as Wolfram). A non-`Throw` error is never ours to catch. */
function declareCatch(ce: ComputeEngine): void {
  ce.declare("Catch", {
    signature: "(any, any?) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const body = ops[0];
      if (body === undefined) return undefined;
      const form = ops[1];
      try {
        return body.evaluate();
      } catch (err) {
        if (!(err instanceof ThrowSignal)) throw err;
        if (form === undefined) return err.value;
        if (err.tag !== undefined && err.tag.isSame(form.evaluate())) return err.value;
        throw err;
      }
    },
  });
}

// --- Do / Switch / While ------------------------------------------------------------------

/** `Do`'s iterator spec: a bare count, `{n}` (both "repeat n times", no loop variable), or
 *  `{i, n}` / `{i, a, b}` / `{i, a, b, step}` (a named loop variable). Integer bounds only --
 *  Wolfram allows real/step-fractional iterators; not supported here. */
function readDoSpec(
  spec: BoxedExpression,
):
  | { readonly name: string | undefined; readonly start: number; readonly end: number; readonly step: number }
  | undefined {
  const bare = integerAt(spec);
  if (bare !== undefined) return { name: undefined, start: 1, end: bare, step: 1 };
  if (spec.operator !== "List") return undefined;
  const parts = operandsOf(spec);
  if (parts.length === 1) {
    const n = integerAt(parts[0]);
    return n === undefined ? undefined : { name: undefined, start: 1, end: n, step: 1 };
  }
  const name = symbolNameOf(parts[0]!);
  if (name === undefined) return undefined;
  if (parts.length === 2) {
    const n = integerAt(parts[1]);
    return n === undefined ? undefined : { name, start: 1, end: n, step: 1 };
  }
  if (parts.length === 3) {
    const a = integerAt(parts[1]);
    const b = integerAt(parts[2]);
    return a === undefined || b === undefined ? undefined : { name, start: a, end: b, step: 1 };
  }
  if (parts.length === 4) {
    const a = integerAt(parts[1]);
    const b = integerAt(parts[2]);
    const step = integerAt(parts[3]);
    return a === undefined || b === undefined || step === undefined || step === 0
      ? undefined
      : { name, start: a, end: b, step };
  }
  return undefined;
}

/** `Do(body, n)` / `Do(body, {n})` / `Do(body, {i, n})` / `Do(body, {i, a, b})` /
 *  `Do(body, {i, a, b, step})`: evaluate the held `body` once per iteration (a loop
 *  variable, when named, lives in one fresh scope for the whole call, reassigned each
 *  step). Always returns `Nothing` -- our stand-in for Wolfram's `Null`, per the existing
 *  `Nothing: Null` entry in `@enumeratio/wolfram`'s `SYMBOLS` map. */
function declareDo(ce: ComputeEngine): void {
  ce.declare("Do", {
    signature: "(any, any) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [body, specExpr] = ops;
      if (body === undefined || specExpr === undefined) return undefined;
      const spec = readDoSpec(specExpr);
      if (spec === undefined) return undefined;
      const { name, start, end, step } = spec;
      const scope = ce.createScope({});
      ce.pushScope(scope, "Do");
      try {
        if (name !== undefined) ce.declare(name, "any", scope);
        if (step > 0) {
          for (let i = start; i <= end; i += step) {
            if (name !== undefined) ce.assign(name, ce.number(i));
            body.evaluate();
          }
        } else {
          for (let i = start; i >= end; i += step) {
            if (name !== undefined) ce.assign(name, ce.number(i));
            body.evaluate();
          }
        }
      } finally {
        ce.popScope();
      }
      return ce.Nothing;
    },
  });
}

/** `Switch(expr, form1, val1, form2, val2, ...)`: the first `form` that `expr` (evaluated)
 *  matches wins -- structural equality only, plus a bare `_` (`Blank`) as an always-match
 *  fallback, not Wolfram's fuller pattern language. Stays unevaluated when nothing
 *  matches, same as an unmatched Wolfram `Switch`. */
function declareSwitch(ce: ComputeEngine): void {
  ce.declare("Switch", {
    signature: "(any, any*) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      if (ops.length < 3 || (ops.length - 1) % 2 !== 0) return undefined;
      const value = ops[0]!.evaluate();
      for (let i = 1; i < ops.length; i += 2) {
        const form = ops[i]!;
        if (symbolNameOf(form) === "_" || value.isSame(form.evaluate())) return ops[i + 1]!.evaluate();
      }
      return undefined;
    },
  });
}

/** `While(test)` / `While(test, body)`: re-evaluates the held `test` (and `body`, if
 *  given) until `test` reads other than `True`, or `MAX_ITERATIONS` is reached. Always
 *  returns `Nothing`, like `Do`. */
function declareWhile(ce: ComputeEngine): void {
  ce.declare("While", {
    signature: "(any, any?) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [test, body] = ops;
      if (test === undefined) return undefined;
      for (let i = 0; i < MAX_ITERATIONS && isTrue(test.evaluate()); i++) {
        if (body !== undefined) body.evaluate();
      }
      return ce.Nothing;
    },
  });
}

// --- NestWhile / NestWhileList / FixedPointList -------------------------------------------

/** The last (up to) `m` values of `history`, oldest first -- `NestWhile`'s `test` is
 *  called over exactly these, positionally, for `m > 1`. */
const window = (history: readonly BoxedExpression[], m: number): readonly BoxedExpression[] =>
  history.slice(Math.max(0, history.length - m));

/** `NestWhile(f, x, test)`: applies `f` to `x` repeatedly while `test` of the CURRENT
 *  value reads `True`, and returns the first value where it doesn't.
 *  `NestWhile(f, x, test, m)`: `test` is called on the last `m` values as `m` separate
 *  arguments, instead of the bare current value.
 *  `NestWhile(f, x, test, m, max)`: additionally caps the number of `f`-applications at
 *  `max` (on top of the unconditional `MAX_ITERATIONS`). */
function declareNestWhile(ce: ComputeEngine): void {
  ce.declare("NestWhile", {
    signature: "(any, any, any, integer?, integer?) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [fn, x0, test, mExpr, maxExpr] = ops;
      if (fn === undefined || x0 === undefined || test === undefined) return undefined;
      const m = mExpr !== undefined ? integerAt(mExpr.evaluate()) : 1;
      if (m === undefined || m < 1) return undefined;
      let maxSteps = MAX_ITERATIONS;
      if (maxExpr !== undefined) {
        const requested = integerAt(maxExpr.evaluate());
        if (requested === undefined || requested < 0) return undefined;
        maxSteps = Math.min(maxSteps, requested);
      }
      const history: BoxedExpression[] = [x0.evaluate()];
      for (let steps = 0; steps < maxSteps; steps++) {
        const testArgs = window(history, m);
        if (!isTrue(applyFn(ce, test, testArgs))) break;
        history.push(applyFn(ce, fn, [history[history.length - 1]!]));
      }
      return history[history.length - 1]!;
    },
  });
}

/** `NestWhileList(f, x, test)`: like `NestWhile`, but returns every intermediate value
 *  from `x` up to (and including) the first one where `test` fails. */
function declareNestWhileList(ce: ComputeEngine): void {
  ce.declare("NestWhileList", {
    signature: "(any, any, any) -> list<any>",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [fn, x0, test] = ops;
      if (fn === undefined || x0 === undefined || test === undefined) return undefined;
      const history: BoxedExpression[] = [x0.evaluate()];
      for (let steps = 0; steps < MAX_ITERATIONS; steps++) {
        if (!isTrue(applyFn(ce, test, [history[history.length - 1]!]))) break;
        history.push(applyFn(ce, fn, [history[history.length - 1]!]));
      }
      return ce.box(["List", ...history]);
    },
  });
}

/** `FixedPointList(f, x)`: `{x, f(x), f(f(x)), ...}`, stopping once two consecutive
 *  values are structurally the same (`SameQ` -- exact, not the numeric-precision fuzz
 *  `list-functional.ts`'s `FixedPoint` uses; adequate for the exact/rational values this
 *  head's examples use, so that refinement isn't duplicated here). The repeated value
 *  ends the list once, like Wolfram's own. */
function declareFixedPointList(ce: ComputeEngine): void {
  ce.declare("FixedPointList", {
    signature: "(any, any) -> list<any>",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [fn, x0] = ops;
      if (fn === undefined || x0 === undefined) return undefined;
      let current = x0.evaluate();
      const history: BoxedExpression[] = [current];
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const next = applyFn(ce, fn, [current]);
        history.push(next);
        if (next.isSame(current)) break;
        current = next;
      }
      return ce.box(["List", ...history]);
    },
  });
}

// --- Echo / AbsoluteTiming -----------------------------------------------------------------

/** `Echo::printed` / `Echo::labeled` templates are per-engine (see `@enumeratio/boxed`'s
 *  `messages.ts`); this set tracks which engines already have them, so re-declaring the
 *  control heads on the same engine doesn't redefine the templates twice. */
const echoMessagesDefined = new WeakSet<ComputeEngine>();
function defineEchoMessagesOnce(ce: ComputeEngine): void {
  if (echoMessagesDefined.has(ce)) return;
  echoMessagesDefined.add(ce);
  defineMessages(ce, "Echo", {
    printed: "`1`",
    labeled: "`1`: `2`",
  });
}

/** `Echo(expr)` / `Echo(expr, label)` / `Echo(expr, label, f)`: prints `f(expr)` (or
 *  `expr` itself, with no `f`) -- prefixed by `label` when given -- and returns `expr`
 *  UNCHANGED. Printing is a side-effect this engine has no console for, so it's routed
 *  through `@enumeratio/boxed`'s message channel instead (`Echo::printed` / `Echo::labeled`,
 *  collectible with `collectMessages`) rather than skipped outright -- a caller that wants
 *  the printed text can `collectMessages(ce, () => expr.evaluate())` and read it from
 *  there, same as any other head's declined-call message. */
function declareEcho(ce: ComputeEngine): void {
  defineEchoMessagesOnce(ce);
  ce.declare("Echo", {
    signature: "(any, any?, ((any) -> any)?) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const value = ops[0];
      if (value === undefined) return undefined;
      const label = ops[1];
      const f = ops[2];
      const printed = f !== undefined ? applyFn(ce, f, [value]) : value;
      if (label !== undefined) emit(ce, "Echo", "labeled", [label, printed]);
      else emit(ce, "Echo", "printed", [printed]);
      return value;
    },
  });
}

/** `AbsoluteTiming(expr)`: `{seconds, value(expr)}` -- wall-clock seconds spent evaluating
 *  the held `expr`, as a `Real`, and its value. `seconds` is inherently nondeterministic;
 *  reference examples must assert only the `value` half (e.g. via `At(result, 2)`), never
 *  pin the timing. */
function declareAbsoluteTiming(ce: ComputeEngine): void {
  ce.declare("AbsoluteTiming", {
    signature: "(any) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const expr = ops[0];
      if (expr === undefined) return undefined;
      const start = performance.now();
      const value = expr.evaluate();
      const seconds = (performance.now() - start) / 1000;
      return ce.box(["List", ce.number(seconds), value]);
    },
  });
}

// --- Attributes / SetAttributes -------------------------------------------------------------

/**
 * Compute-engine's operator flags this package chooses to expose as Wolfram attributes,
 * mapped to the closest genuine Wolfram attribute name -- and no further. `ce`'s
 * `idempotent` and `involution` flags are DELIBERATELY excluded: they're real algebraic
 * properties compute-engine tracks for pattern matching, but Wolfram has no `Attributes`
 * entry named either one (Wolfram's own idempotence/involution, where it cares, is
 * expressed through rules, not an attribute) -- reporting them under invented names would
 * claim a Wolfram fact that doesn't exist. `HoldAll` for `lazy` is an approximation in the
 * other direction: compute-engine's `lazy` means "operands arrive unevaluated," which is
 * the effect of Wolfram's `HoldAll` but doesn't distinguish it from `HoldFirst`/`HoldRest`/
 * `HoldAllComplete` -- the closest of the four, not a perfect match.
 */
const ATTRIBUTE_NAMES = ["Flat", "HoldAll", "Listable", "Orderless"] as const;
type AttributeName = (typeof ATTRIBUTE_NAMES)[number];

interface FlaggedOperator {
  associative: boolean;
  lazy: boolean;
  broadcastable: boolean;
  commutative: boolean;
}

function operatorFlagsOf(ce: ComputeEngine, name: string): FlaggedOperator | undefined {
  const def = ce.lookupDefinition(name);
  return def !== undefined && "operator" in def ? (def.operator as unknown as FlaggedOperator) : undefined;
}

const readAttribute = (op: FlaggedOperator, attr: AttributeName): boolean => {
  switch (attr) {
    case "Flat":
      return op.associative === true;
    case "HoldAll":
      return op.lazy === true;
    case "Listable":
      return op.broadcastable === true;
    case "Orderless":
      return op.commutative === true;
  }
};

const writeAttribute = (op: FlaggedOperator, attr: AttributeName): void => {
  switch (attr) {
    case "Flat":
      op.associative = true;
      break;
    case "HoldAll":
      op.lazy = true;
      break;
    case "Listable":
      op.broadcastable = true;
      break;
    case "Orderless":
      op.commutative = true;
      break;
  }
};

/** `Attributes(f)`: the subset of `ATTRIBUTE_NAMES` `f`'s operator definition carries,
 *  alphabetically (Wolfram's own print order). An undeclared or non-operator `f` reads as
 *  no attributes, same as a plain symbol in Wolfram. */
function declareAttributes(ce: ComputeEngine): void {
  ce.declare("Attributes", {
    signature: "(symbol) -> list<symbol>",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const name = ops[0] !== undefined ? symbolNameOf(ops[0]) : undefined;
      if (name === undefined) return undefined;
      const op = operatorFlagsOf(ce, name);
      const present = op === undefined ? [] : ATTRIBUTE_NAMES.filter((a) => readAttribute(op, a));
      return ce.box(["List", ...present.map((a) => ce.symbol(a))]);
    },
  });
}

/** `SetAttributes(f, attr)` / `SetAttributes(f, {attr1, attr2, ...})`: flips the matching
 *  operator flag(s) ON, in place -- `ce`'s flags are plain mutable fields on the shared
 *  definition object, the same mechanism `wrapOperator`'s callers rely on. Declines
 *  (stays unevaluated) for an undeclared `f`, or any attribute name outside
 *  `ATTRIBUTE_NAMES` -- silently accepting an attribute we can't actually represent would
 *  claim a change that didn't happen. Returns `Nothing`, like Wolfram's own `Null`. */
function declareSetAttributes(ce: ComputeEngine): void {
  ce.declare("SetAttributes", {
    signature: "(symbol, any) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const name = ops[0] !== undefined ? symbolNameOf(ops[0]) : undefined;
      const attrsExpr = ops[1];
      if (name === undefined || attrsExpr === undefined) return undefined;
      const op = operatorFlagsOf(ce, name);
      if (op === undefined) return undefined;
      const requested = attrsExpr.operator === "List" ? operandsOf(attrsExpr) : [attrsExpr];
      const names = requested.map((r) => symbolNameOf(r));
      if (names.some((n): n is undefined => n === undefined || !(ATTRIBUTE_NAMES as readonly string[]).includes(n)))
        return undefined;
      for (const n of names) writeAttribute(op, n as AttributeName);
      return ce.Nothing;
    },
  });
}

// --- AppendTo --------------------------------------------------------------------------------

/** `AppendTo(s, elem)`: reads `s`'s current value, appends `elem`, reassigns `s` to the
 *  result, and returns it -- Wolfram's own in-place update. `s` is held (its NAME, not its
 *  value, is the first operand) so it can be reassigned; works for any symbol already
 *  carrying a value via `ce.assign`, including a `Module` local (assignment into a bound
 *  variable was checked to work across a scope boundary the same way `Module` itself does). */
function declareAppendTo(ce: ComputeEngine): void {
  ce.declare("AppendTo", {
    signature: "(symbol, any) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const symExpr = ops[0];
      const elemExpr = ops[1];
      const name = symExpr !== undefined ? symbolNameOf(symExpr) : undefined;
      if (name === undefined || elemExpr === undefined) return undefined;
      const current = ce.box(name).evaluate();
      const appended = ce.function("Append", [current, elemExpr.evaluate()]).evaluate();
      ce.assign(name, appended);
      return appended;
    },
  });
}

/** Declare the Wolfram-frontier scoping/control heads: `With`, `Module`, `Reap`/`Sow`,
 *  `Do`, `Switch`, `While`, `NestWhile`/`NestWhileList`, `FixedPointList`, `Throw`/`Catch`,
 *  `Echo`, `AbsoluteTiming`, `Attributes`/`SetAttributes`, `AppendTo`. `Clear`,
 *  `Attributes`' `idempotent`/`involution` flags, and `Return` are deliberately left out --
 *  see the module doc and `declareAttributes`'s own comment for why. */
export function declareControl(ce: ComputeEngine): void {
  declareWith(ce);
  declareModule(ce);
  declareSow(ce);
  declareReap(ce);
  declareThrow(ce);
  declareCatch(ce);
  declareDo(ce);
  declareSwitch(ce);
  declareWhile(ce);
  declareNestWhile(ce);
  declareNestWhileList(ce);
  declareFixedPointList(ce);
  declareEcho(ce);
  declareAbsoluteTiming(ce);
  declareAttributes(ce);
  declareSetAttributes(ce);
  declareAppendTo(ce);
}
