// Bound (typed) statement → the FROM-less `@enumeratio/client` IR — the one place this package builds a real
// `SelectExpr` tree. Every type decision was already made and validated by bind.ts; this file makes no new type
// judgements of its own, only PURE recomputations of what bind.ts already proved valid (see opTypeForLower) so it
// never needs a Catalog — same reasoning as the header note in types.ts.
import { args, head, isNumber, isSymbol, numberValue, symbolName, type Expression, type NodePath } from './ast.js'
import { betaReduce, isUserFnHead, NEXT_PREV_RANK, type Bound } from './bind.js'
import { OPERATORS } from './names.js'
import {
  ALGEBRA_ONLY_OPS, COMPARE_OPS, argPath, effectivePg, isNumericKind, numericResultPg, rootPrefix,
  type Scope, type Type, type ValueRef,
} from './types.js'
import { fnRef, type Expr, type SelectExpr } from '@enumeratio/client'

export type LowerResult = { expr?: Expr; wants: 'value' | 'locate' | 'none' }

export function lower(bound: Bound, scope: Scope): LowerResult {
  const { stmt, typed, type } = bound
  if (stmt.k === 'declare') return { wants: 'none' }              // nothing to run — scope already holds the elem type
  if (stmt.k === 'define' && stmt.params) return { wants: 'none' } // a fn define binds a Binding, doesn't evaluate

  const prefix = rootPrefix(stmt)

  // A define of a var already declared elem(C) — bind.ts kept elem(C) as this statement's own type in exactly
  // that case (see its comment) — needs LOCATING, not just evaluating: two columns, the rank and the carrier
  // value, so the caller can build the ValueRef{k:'elem', rank} this var's later re-embeddings need.
  if (stmt.k === 'define' && type.k === 'elem') {
    const handle: SelectExpr = { kind: 'handle', handle: type.handle }
    const value = lowerArg(typed.expr, prefix, scope, typed.types)
    const locateCall: SelectExpr = { kind: 'apply', fn: fnRef('locate'), args: [handle, value] }
    return {
      wants: 'locate',
      expr: { select: [
        { kind: 'apply', fn: fnRef('rank'), args: [locateCall] },
        { kind: 'cast', expr: locateCall, to: type.carrier },
      ] },
    }
  }

  return { wants: 'value', expr: { select: [lowerArg(typed.expr, prefix, scope, typed.types)] } }
}

// ── the recursive lowerer ────────────────────────────────────────────────────────────────────────────────────

/** Lower `e` at `path`, then coerce an `elem(C)` result down to its carrier VALUE (`cast(expr, carrier)`) — the
 *  right default for any position that consumes a plain scalar: an op's operands, a stat/map/generic-function's
 *  arguments, `locate`'s search value, a bare value-producing statement. The two positions that need the RAW
 *  located element instead (`next`/`prev`/`rank`'s argument, and a handle used as itself) call `lowerExpr`
 *  directly — see below. */
function lowerArg(e: Expression, path: NodePath, scope: Scope, types: Map<NodePath, Type>): SelectExpr {
  const t = types.get(path)
  if (!t) throw new Error(`lower: no type recorded at ${path}`)
  const v = lowerExpr(e, path, scope, types)
  return t.k === 'elem' ? { kind: 'cast', expr: v, to: t.carrier } : v
}

function lowerExpr(e: Expression, path: NodePath, scope: Scope, types: Map<NodePath, Type>): SelectExpr {
  if (isSymbol(e)) return lowerSymbol(symbolName(e), path, scope, types)
  if (isNumber(e)) { const n = numberValue(e); return Number.isInteger(n) ? { kind: 'lit', value: n } : { kind: 'lit', value: n, type: 'numeric' } }
  if (!Array.isArray(e)) throw new Error('lower: unsupported literal node (a raw num/str wrapper reached lowering)')

  const h = head(e)!
  const a = args(e)
  const opBinding = OPERATORS[h]
  if (opBinding) {
    if ('op' in opBinding) return lowerOp(opBinding.op, a, path, scope, types)
    if ('fn' in opBinding) return lowerCall(opBinding.fn, a, path, scope, types)
    if (opBinding.special === 'contains') return lowerContains(a, path, scope, types)
    if (opBinding.special === 'element_at') return lowerBaseIndexed('element_at', a, path, scope, types)
    return lowerBaseIndexed('cardinality', a.slice(0, 1), path, scope, types)   // 'cardinality' — Count takes one arg
  }

  if (h === 'InvisibleOperator' && a.length === 2 && isSymbol(a[0]) && head(a[1]) === 'Delimiter') {
    const fname = symbolName(a[0])
    if (isUserFnHead(fname, scope)) {
      const inner = args(a[1])[0]
      const argExprs = head(inner) === 'Sequence' ? args(inner) : [inner]
      return lowerUserCall(fname, argExprs, path, scope, types)
    }
    // Mirrors bind.ts's construction-vs-multiply call: no Catalog here, so trust the Type bind.ts already
    // recorded at this node rather than re-deriving the decision (same trick lowerGenericApply/lowerSymbol use).
    const nodeType = types.get(path)
    if (nodeType?.k === 'handle') return { kind: 'handle', handle: nodeType.handle }
    return lowerOp('mul', a, path, scope, types)
  }
  if (h === 'InvisibleOperator') return lowerOp('mul', a, path, scope, types)
  if (h === 'Delimiter') return lowerExpr(a[0], argPath(path, 0), scope, types)   // transparent, as in bind.ts

  if (NEXT_PREV_RANK.has(h) && a.length === 1) return { kind: 'apply', fn: fnRef(h), args: [lowerExpr(a[0], argPath(path, 0), scope, types)] }

  return lowerGenericApply(h, a, path, scope, types)
}

/** A scope var's bare-symbol reference re-embeds its ALREADY-COMPUTED value (a previous line's result); a
 *  collection name (scope-bound or a catalog/builtin id — either way bind.ts recorded it as `handle` in `types`)
 *  becomes a handle VALUE. */
function lowerSymbol(name: string, path: NodePath, scope: Scope, types: Map<NodePath, Type>): SelectExpr {
  const t = types.get(path)
  if (!t) throw new Error(`lower: no type recorded for symbol "${name}"`)
  if (t.k === 'handle') return { kind: 'handle', handle: t.handle }
  if (t.k === 'fn') throw new Error(`lower: "${name}" is a function, not a value`)
  if (t.k === 'unknown') throw new Error(`lower: "${name}" could not be typed`)
  const b = scope.get(name)
  if (!b || b.k !== 'var' || b.value === undefined) throw new Error(`lower: "${name}" has no value — its definition did not evaluate`)
  return valueRefToSelect(b.value)
}

function valueRefToSelect(v: ValueRef): SelectExpr {
  if (v.k === 'elem') {
    return { kind: 'apply', fn: fnRef('unrank'), args: [{ kind: 'handle', handle: v.handle }, { kind: 'lit', value: v.rank }] }
  }
  // scalar: an integer-kind pg whose text is a bare integer prints as a plain (untyped) number literal, same as
  // any other numeric literal in the tree — otherwise it carries its pg forward explicitly (`type`) so the printer
  // knows how to spell it (a non-integer numeric, or a registered algebra type's own notation).
  if (v.k === 'scalar' && isNumericKind(v.pg) && /^-?\d+$/.test(v.text)) return { kind: 'lit', value: Number(v.text) }
  return { kind: 'lit', value: v.text, type: v.pg }
}

/** The SAME numeric-tower / same-type-algebra decision typeOp (bind.ts) makes — recomputed here purely from the
 *  arg `Type`s already validated there, so this file never needs the Catalog those decisions were checked
 *  against. Comparison ops carry their OPERAND type here (not `boolean` — that's the node's overall Type, tracked
 *  separately in `types`, not what the IR's `op.type` field means). */
function opTypeForLower(op: string, argTypes: Type[]): string {
  const strs = argTypes.map((t) => effectivePg(t)!)
  if (op === 'neg') return isNumericKind(strs[0]) ? (strs[0] === 'natural_number' ? 'integer_number' : strs[0]) : strs[0]
  if (COMPARE_OPS.has(op)) return strs.every(isNumericKind) ? numericResultPg('add', strs)! : strs[0]
  if (ALGEBRA_ONLY_OPS.has(op)) return strs[0]
  return strs.every(isNumericKind) ? numericResultPg(op, strs)! : strs[0]
}

function lowerOp(op: string, argExprs: Expression[], path: NodePath, scope: Scope, types: Map<NodePath, Type>): SelectExpr {
  const lowered = argExprs.map((ae, i) => lowerArg(ae, argPath(path, i), scope, types))
  const argTypes = argExprs.map((_, i) => types.get(argPath(path, i))!)
  const type = opTypeForLower(op, argTypes)
  // MathJSON's Add/Multiply are n-ary; an IR `op` is unary or binary (the engines refuse anything else), so an
  // n-ary node folds left: ((a op b) op c). The join type is the same at every level.
  if (lowered.length > 2) return lowered.slice(1).reduce<SelectExpr>((acc, r) => ({ kind: 'op', op, type, args: [acc, r] }), lowered[0])
  return { kind: 'op', op, type, args: lowered }
}

/** A curated `base_function` id reached via an OPERATORS `{fn}` entry (`Factorial` → `factorial`, …). */
function lowerCall(fnId: string, argExprs: Expression[], path: NodePath, scope: Scope, types: Map<NodePath, Type>): SelectExpr {
  return { kind: 'apply', fn: fnRef(fnId), args: argExprs.map((ae, i) => lowerArg(ae, argPath(path, i), scope, types)) }
}

/** `x \in C` → `contains(handle(C), value)` — the domain must have typed to `handle` (bind.ts already checked
 *  this; a mismatch here means bind() reported an error and this tree should never have reached lowering). */
function lowerContains(a: Expression[], path: NodePath, scope: Scope, types: Map<NodePath, Type>): SelectExpr {
  const domainType = types.get(argPath(path, 1))
  if (domainType?.k !== 'handle') throw new Error("lower: Element's right-hand side did not type as a collection")
  const handle: SelectExpr = { kind: 'handle', handle: domainType.handle }
  const value = lowerArg(a[0], argPath(path, 0), scope, types)
  return { kind: 'apply', fn: fnRef('contains'), args: [handle, value] }
}

/** `At`/`Count` (`element_at`/`cardinality`): the base stays a raw handle when it typed as one (never coerced —
 *  `cardinality`/`element_at` take the HANDLE itself, not a scalar), otherwise lowers plainly. */
function lowerBaseIndexed(fnId: string, a: Expression[], path: NodePath, scope: Scope, types: Map<NodePath, Type>): SelectExpr {
  const baseType = types.get(argPath(path, 0))
  const base = baseType?.k === 'handle' ? { kind: 'handle' as const, handle: baseType.handle } : lowerExpr(a[0], argPath(path, 0), scope, types)
  const rest = a.slice(1).map((ae, i) => lowerArg(ae, argPath(path, i + 1), scope, types))
  return { kind: 'apply', fn: fnRef(fnId), args: [base, ...rest] }
}

/** `f(3)` where `f` is a user-defined function: rebuild the IDENTICAL substituted tree + synthetic path prefix
 *  bind.ts's typeUserCall built (betaReduce is pure — same inputs, same output), so `types` already has every
 *  entry this needs. */
function lowerUserCall(name: string, argExprs: Expression[], path: NodePath, scope: Scope, types: Map<NodePath, Type>): SelectExpr {
  const binding = scope.get(name)
  if (binding?.k !== 'fn') throw new Error(`lower: "${name}" is not a function`)
  const { expr: substituted, prefix } = betaReduce(binding.params, binding.body, argExprs, path)
  return lowerExpr(substituted, prefix, scope, types)
}

/** A plain `[head, ...args]` call the parser already recognized as a catalog id. bind.ts recorded whether this
 *  particular node is a parameterized COLLECTION CONSTRUCTION (`type.k === 'handle'`) or an ordinary function/
 *  stat/map application — reusing that recorded Type instead of re-deriving it (which would need the Catalog
 *  this file doesn't have) is exactly why `types` carries an entry for every node bind() visited, not just leaves. */
function lowerGenericApply(h: string, a: Expression[], path: NodePath, scope: Scope, types: Map<NodePath, Type>): SelectExpr {
  const nodeType = types.get(path)
  // bind.ts's typeGenericApply already built (and validated) this construction's HandleExpr — reuse it rather
  // than re-deriving positional/named args from `a` here, so the two files can never disagree on the handle a
  // construction like `permutations(4)` carries.
  if (nodeType?.k === 'handle') return { kind: 'handle', handle: nodeType.handle }
  return { kind: 'apply', fn: fnRef(h), args: a.map((ae, i) => lowerArg(ae, argPath(path, i), scope, types)) }
}
