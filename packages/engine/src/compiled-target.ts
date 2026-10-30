// The JavaScript target the double-precision compiled path uses: compute-engine's own, with the
// lowerings we can make cheaper where the types prove them safe. Everything else stays its.

import type { Expression } from "@cortex-js/compute-engine";
import { JavaScriptTarget } from "@cortex-js/compute-engine/compile";

// A compiled operand that is names, member reads, numbers and + - * with grouping parentheses, and no
// call: evaluating it twice costs next to nothing and has no effect.
const PURE = /^[\w$.\s+*()-]+$/;
const pure = (code: string): boolean => PURE.test(code) && !/[\w$]\s*\(/.test(code);

type Compile = (e: Expression) => string;
type Lowering = (args: readonly Expression[], compile: Compile, target: unknown) => unknown;

/** `At` of a list of numbers at an integer index in 1..length is `list[i - 1]`. The stock helper
 *  (`_SYS.atNumeric`) also counts a negative index from the end and answers NaN out of range, so
 *  anything outside 1..length still goes to it. Only its own lowering is touched; other `At`s stay stock. */
function fastAt(stock: Lowering): Lowering {
  return (args, compile, target) => {
    const lowered = stock(args, compile, target);
    if (typeof lowered !== "string" || !lowered.startsWith("_SYS.atNumeric(") || args.length !== 2) return lowered;
    const [list, index] = args as [Expression, Expression];
    if (!list.type.matches("list<number>") || !index.type.matches("integer")) return lowered;
    const a = compile(list);
    const i = compile(index);
    if (!pure(a) || !pure(i)) return lowered;
    const type = /, ("(?:[^"\\]|\\.)*")\)$/.exec(lowered)?.[1];
    if (type === undefined) return lowered;
    return `((${i}) >= 1 && (${i}) <= ${a}.length ? ${a}[(${i}) - 1] : _SYS.atNumeric(${a}, ${i}, ${type}))`;
  };
}

export class FastTarget extends JavaScriptTarget {
  override createTarget(options?: unknown): ReturnType<JavaScriptTarget["createTarget"]> {
    const base = super.createTarget(options as never);
    const lookup = base.functions as (id: string) => unknown;
    return {
      ...base,
      functions: ((id: string) => {
        const found = lookup(id);
        return id === "At" && typeof found === "function" ? fastAt(found as Lowering) : found;
      }) as never,
    };
  }
}
