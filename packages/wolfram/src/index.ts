export { fromWolfram } from "./from-wolfram.ts";
// The head and symbol maps are the package's useful DATA, not just its plumbing: anything
// that wants to know what a compute-engine head means in Wolfram can read them here rather
// than write the correspondence out a second time.
export { CONTEXT, FOREIGN, HEADS, isWolframHead, STRUCTURAL, SYMBOLS, toWolfram } from "./to-wolfram.ts";
export { isSystemName, SYSTEM_NAMES } from "./system-names.ts";
export { fromWolframTeX, type TeXOptions, toWolframTeX } from "./tex.ts";
