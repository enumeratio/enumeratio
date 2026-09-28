import { SYMBOLS } from "./generated/symbols.ts";
import type { SymbolInfo } from "./types.ts";

export type { DeclaredSymbol, Overload, SymbolAttribute, SymbolInfo } from "./types.ts";

/** Every head we know, by name. */
export { SYMBOLS };

/** The head called `name`, or undefined. */
export const symbolInfo = (name: string): SymbolInfo | undefined =>
  Object.hasOwn(SYMBOLS, name) ? SYMBOLS[name] : undefined;
