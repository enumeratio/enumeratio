// @enumeratio/components — every enumeratio Lit web component, in two tiers:
//   • pure FIGURES (./figures) — framework-agnostic data→visual leaves (`*-glyph`, `*-figure`); no client, no db.
//   • client-backed COMPONENTS (this dir, `enumeratio-*`) — talk to @enumeratio/client; a Db must be provided once
//     via the client's provideDb() (the docs do this globally).
// Importing this module REGISTERS every element (both tiers) as a side effect. Figures are also reachable on their
// own via the `./figures` subpath, for consumers that want the pure tier without pulling in the client.
import './figures'
import './enumeratio-expression'
import './enumeratio-notation'
import './enumeratio-figure'
import './enumeratio-assert'
import './enumeratio-assert-summary'
import './enumeratio-math-input'

export * from './figures'
export { EnumeratioExpression } from './enumeratio-expression'
export { EnumeratioNotation } from './enumeratio-notation'
export { EnumeratioFigure } from './enumeratio-figure'
export { EnumeratioAssert, type AssertStatus } from './enumeratio-assert'
export { EnumeratioAssertSummary } from './enumeratio-assert-summary'
export { EnumeratioMathInput, type CompletionCandidate, type Completer } from './enumeratio-math-input'
export type { MathInputAdapter, AdapterFactory } from './math-input-adapter'
export { mathliveAdapter, configureMathlive } from './mathlive-adapter'
