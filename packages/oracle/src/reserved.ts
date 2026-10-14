// Names that already mean something in a Python lane's evaluation namespace: a bare identifier we
// write there is captured by them. The sets are the lanes' own (reserved-names-data.ts, from
// scripts/collect-reserved-names.ts), so a library release that adds a name shows up as drift.
//
// Wolfram's globals are `@enumeratio/wolfram`'s `isSystemName`; Julia, Lean and Rust emit no
// variable names (a free symbol is `missing`, and no template there binds an operand's name).

import { RESERVED_NAMES_DATA } from "./reserved-names-data.ts";
import type { System } from "./systems.ts";

const words = (text: string): ReadonlySet<string> => new Set(text.split(/\s+/).filter(Boolean));

/** Keywords and builtins, which every Python lane sees. */
export const PYTHON_NAMES = words(RESERVED_NAMES_DATA.python);

const LANES: Partial<Record<System, ReadonlySet<string>>> = {
  sympy: new Set([...PYTHON_NAMES, ...words(RESERVED_NAMES_DATA.sympy)]),
  mpmath: new Set([...PYTHON_NAMES, ...words(RESERVED_NAMES_DATA.mpmath)]),
  sage: new Set([...PYTHON_NAMES, ...words(RESERVED_NAMES_DATA.sage)]),
};

/** Every name `system`'s namespace holds, where it has a set. */
export const reservedNames = (system: System): ReadonlySet<string> | undefined => LANES[system];

/** Whether `name` is one of `system`'s globals. */
export const isReserved = (system: System, name: string): boolean => LANES[system]?.has(name) === true;

/** `name` with underscores appended until `system` doesn't know it and `taken` doesn't hold it. */
export function spareName(system: System, name: string, taken: ReadonlySet<string>): string {
  let spare = `${name}_`;
  while (taken.has(spare) || isReserved(system, spare)) spare += "_";
  return spare;
}

/** What Sage's `SR.var` refuses as a name: Python's keywords, and `exec` and `print` (tests/foreign-names.test.ts checks the list). */
export const SAGE_UNBINDABLE: ReadonlySet<string> = words(
  `False None True and as assert async await break class continue def del elif else except finally for from
  global if import in is lambda nonlocal not or pass raise return try while with yield exec print`,
);

/** `text` with each name in `renamed` (name → spelling, `Emitted.renamed`) written as its name again. */
export function restoreNames(text: string, renamed: Readonly<Record<string, string>> | undefined): string {
  const names = new Map(Object.entries(renamed ?? {}).map(([name, spelling]) => [spelling, name]));
  return names.size === 0 ? text : text.replace(/[A-Za-z_]\w*/g, (word) => names.get(word) ?? word);
}

/** The runtime versions the sets were generated from (checked by tests/reserved-names.test.ts). */
export const RESERVED_RUNTIMES = RESERVED_NAMES_DATA.runtimes;
