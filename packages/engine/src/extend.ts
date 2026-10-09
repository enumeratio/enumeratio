import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import type { CompileHandler } from "./facade.ts";
import { addHeadOverload } from "./overloads.ts";

type OperatorDefinition = NonNullable<BoxedExpression["operatorDefinition"]>;

/**
 * How a head compiles once a package has replaced its `evaluate` or `canonical`.
 *
 * compute-engine lowers a head by name (`Sin` to `Math.sin`) only while the definition keeps the
 * library's own handlers. A replaced `evaluate` makes an extension "a user definition that
 * shadows the library operator", on purpose: the interpreter may compute something the built-in
 * lowering doesn't, so compile fails closed. A package says what it means instead:
 *
 * - `"builtin"`: compile as the target's built-in lowering would. Only where every case the
 *   package adds is an identity, or fires on operands compiled real-number code never holds
 *   (symbolic, exact, complex, past a double).
 * - `{ upTo: n }`: the same for calls of at most `n` operands; a wider call (a signature the
 *   package widened) fails to compile.
 * - a handler: a lowering of our own semantics (`undefined` from it falls back to the built-in).
 *
 * A replacement that states nothing keeps compute-engine's default: an extension shadows, and
 * fails to compile. One unstated replacement closes the head for good, whatever else states
 * `"builtin"`.
 */
export type CompileStance = "builtin" | { readonly upTo: number } | CompileHandler;

/** What a package may change on a head another package (or compute-engine) declared. */
export interface HeadPatch {
  evaluate?: OperatorDefinition["evaluate"];
  /** A call shape of its own: the head's signature becomes `old & this`, as an overload. */
  addSignature?: string;
  collection?: OperatorDefinition["collection"];
  broadcastable?: boolean;
  canonical?: OperatorDefinition["canonical"];
  /** How the head compiles, for a patch that replaces `evaluate` or `canonical`: see `CompileStance`. */
  compile?: CompileStance;
}

/** What every package's stance for one head on one engine adds up to. */
interface Stance {
  /** Some replacement stated nothing. */
  closed: boolean;
  /** The most operands a call may have and still compile. */
  upTo: number;
  handler?: CompileHandler;
  /** The one handler installed on the head, reading this record. */
  readonly compile: CompileHandler;
}

const stances = new WeakMap<object, Map<string, Stance>>();

function stanceOf(ce: ComputeEngine, name: string): Stance {
  let byHead = stances.get(ce);
  if (byHead === undefined) stances.set(ce, (byHead = new Map()));
  let stance = byHead.get(name);
  if (stance === undefined) {
    const record: Stance = {
      closed: false,
      upTo: Infinity,
      compile: (args, compile, context) => {
        if (args.length > record.upTo) {
          throw new Error(`${name} has no ${context.language} lowering for what a package changed about it`);
        }
        return record.handler?.(args, compile, context);
      },
    };
    byHead.set(name, (stance = record));
  }
  return stance;
}

/** The parts of a definition that make an extension "a user definition" to compute-engine's compiler. */
const KEPT = ["evaluate", "canonical", "derivative", "lazy", "broadcastable", "evaluateAsync"] as const;
type Operator = { compile?: CompileHandler } & { [K in (typeof KEPT)[number]]?: unknown };

/** The operator the standard library declared `name` with: the one in the outermost scope. */
function libraryOperator(ce: ComputeEngine, name: string): Operator | undefined {
  type Scope = { parent?: Scope; bindings: { get(name: string): unknown } };
  let scope = (ce as unknown as { context: { lexicalScope: Scope } }).context.lexicalScope;
  while (scope.parent !== undefined) scope = scope.parent;
  const definition = scope.bindings.get(name);
  return typeof definition === "object" && definition !== null && "operator" in definition
    ? (definition.operator as Operator)
    : undefined;
}

/**
 * Put the head's stance on its visible definition: its handler, or none when the head is closed.
 * A plain "builtin" goes on only where compute-engine would otherwise shadow the library head, so a head
 * that still holds the library's handlers keeps compiling without a handler of ours in the way
 * (compute-engine cannot share a subexpression under a handler it did not install). A restriction
 * (an operand limit, a lowering of our own) always goes on.
 */
function install(ce: ComputeEngine, name: string, stance: Stance): void {
  const definition = ce.lookupDefinition(name);
  if (definition === undefined || !("operator" in definition)) return;
  const operator = definition.operator as Operator;
  if (stance.closed) {
    if (operator.compile === stance.compile) delete operator.compile;
    return;
  }
  const library = libraryOperator(ce, name);
  const shadows = library !== undefined && operator !== library && KEPT.some((key) => operator[key] !== library[key]);
  const restricts = stance.upTo !== Infinity || stance.handler !== undefined;
  if (restricts || shadows) operator.compile = stance.compile;
}

/**
 * Record how `name` compiles, for a handler a package attached in place (`operator.evaluate =`,
 * `operator.canonical =`) rather than through `extendHead`, which calls this itself. `stated` is
 * `undefined` for a replacement that states nothing.
 */
export function declareCompile(ce: ComputeEngine, name: string, stated: CompileStance | undefined): void {
  const stance = stanceOf(ce, name);
  if (stated === undefined) stance.closed = true;
  else if (typeof stated === "object") stance.upTo = Math.min(stance.upTo, stated.upTo);
  else if (stated !== "builtin") {
    const before = stance.handler;
    stance.handler = before === undefined ? stated : (a, c, x) => stated(a, c, x) ?? before(a, c, x);
  }
  install(ce, name, stance);
}

/**
 * Patch a head the engine already defines, keeping every field the patch doesn't name: a
 * thin layer over `ce.declare(name, patch, { extend: true })`, which builds a new definition
 * from the visible one rather than redeclaring the head. Returns false when the engine has no
 * operator by that name.
 *
 * `evaluate` is the exception: it is set on the visible definition, not passed to `extend`.
 * Extending with a handler makes compute-engine treat the head as a user definition, and
 * `Add` (or any head a package wraps) then stops compiling. The patch's other fields go
 * through `extend`, which is what keeps a library head a library head. A handler named here
 * replaces the earlier one, so callers that mean to layer capture the current one first
 * (`wrapOperator`). `addSignature` goes through the head's table (`addHeadOverload`), so
 * signatures from different packages join in one canonical order whoever arrives first.
 *
 * A patch that replaces `evaluate` or `canonical` also states how the head compiles (`compile`,
 * see `CompileStance`).
 */
const extensions = new WeakSet<object>();

/** Whether `definition` is one `extendHead` built from an earlier one, not a declaration of its own. */
export const isExtension = (definition: unknown): boolean =>
  typeof definition === "object" && definition !== null && extensions.has(definition);

export function extendHead(ce: ComputeEngine, name: string, patch: HeadPatch & { signature?: string }): boolean {
  const definition = ce.lookupDefinition(name);
  if (definition === undefined || !("operator" in definition)) return false;
  const { addSignature, evaluate, compile, ...rest } = patch;
  if (evaluate !== undefined) (definition.operator as { evaluate?: unknown }).evaluate = evaluate;
  if (addSignature !== undefined && !addHeadOverload(ce, name, addSignature)) return false;
  if (Object.keys(rest).length > 0) {
    try {
      ce.declare(name, rest as never, { extend: true } as never);
      extensions.add(ce.lookupDefinition(name) as object);
    } catch {
      // A collection-backed head that carries a carrier arm (`(permutation) -> permutation`) fails
      // `extend`'s check that its result is a collection; the fields are set on the definition.
      Object.assign(definition.operator as object, rest);
    }
  }
  if (evaluate !== undefined || rest.canonical !== undefined) declareCompile(ce, name, compile);
  else if (stances.get(ce)?.has(name)) install(ce, name, stanceOf(ce, name));
  return true;
}
