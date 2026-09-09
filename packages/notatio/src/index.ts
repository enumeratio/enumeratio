export type {
  Expression,
  MathJsonExpression,
  MathJsonSymbol,
  MathJsonNumberObject,
  MathJsonStringObject,
  MathJsonSymbolObject,
  MathJsonFunctionObject,
  MathJsonDictionaryObject,
  Span,
  Stmt,
  ParseError,
  SpanMap,
  NodePath,
  Parsed,
} from './ast.js'
export { mapExpr, spanAt, pathOf, walk } from './ast.js'

// The public AST accessors operate on the closed `Node` tree (what `Parsed.stmt` now carries).
export type { Node } from './node.js'
export {
  normalize, toExpression, symbolsIn,
  head, args, isSymbol, isConst, isNumber, symbolName, numberValue, mapNode, freeSymbols,
} from './node.js'

export type { CatalogNames, ExpressionParser, IdentifierDisplay } from './latex.js'
export { makeParser, catalogDictionary, reformatIdentifiers, identifierDisplay, pascalCase, serializeLatex } from './latex.js'

export { toLatex, toCalcText, toMathJsonString } from './format.js'

export type { OperatorBinding, BuiltinSymbolBinding } from './names.js'
export {
  OPERATORS, BUILTIN_SYMBOLS, CE_CONSTANTS, UNMAPPED_HEADS_NO_CURATED_ID,
  SESSION_SYSTEM, SESSION_VERSION, SESSION_VERSION_NUMBER,
} from './names.js'

export type {
  Type, CollectionInfo, FunctionInfo, StatInfo, MapInfo, TypeOpInfo, Catalog, ValueRef, Binding, Scope, TypeError_,
} from './types.js'
export { scalarType, elemType, handleType, fnType, UNKNOWN } from './types.js'

export type { TypedExpr, Bound } from './bind.js'
export { bind, betaReduce } from './bind.js'

export type { LowerResult } from './lower.js'
export { lower } from './lower.js'

export type { LineId, LineModel } from './graph.js'
export { LineGraph } from './graph.js'

export type { CompletionContext, Candidate, Completion } from './complete.js'
export { complete } from './complete.js'
