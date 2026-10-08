// The engine an OWN_ENGINE package's heads are evaluated in, for the oracle scan's "ours" side.
// The reference engine doesn't load these packages, so a pinned value that needs one of their
// heads to evaluate would read as symbolic. Each engine is built as its package's own tests build
// theirs: its `enumeratio.declare` list over a bare compute-engine.

import { box, type Engine, type Json } from "@enumeratio/engine";
import { type Declare, createEngine } from "@enumeratio/engine/testing";
import type { MathJSON } from "@enumeratio/oracle";
import {
  declareDistributions,
  declareDistributions2,
  declareDistributions3,
  declareDistributions4,
  declareDistributions5,
  declareDistributions6,
  declareProcesses,
} from "@enumeratio/statistics";

/** Keyed by package name, as `ownEngineOf` in src/node.ts names it. */
const DECLARES: Readonly<Record<string, readonly Declare[]>> = {
  statistics: [
    declareDistributions,
    declareDistributions2,
    declareDistributions3,
    declareDistributions4,
    declareDistributions5,
    declareDistributions6,
    declareProcesses,
  ],
};

const engines = new Map<string, Engine>();

/** `configure(ce)` for `runCases`'s `setup`: declares every own-engine package's libraries into
 * the worker's engine. One engine serves them all, so the packages' heads must not overlap;
 * with one own-engine package that holds trivially. */
export function configure(ce: Engine): void {
  for (const declares of Object.values(DECLARES)) for (const declare of declares) declare(ce);
}

/** `expr` evaluated in `pkg`'s own engine, which is built on first use. An `Error` (the package
 * doesn't take the call) leaves `expr` as it is. */
export function evaluateOwn(pkg: string, expr: MathJSON): MathJSON {
  let engine = engines.get(pkg);
  if (engine === undefined) {
    const declares = DECLARES[pkg];
    if (declares === undefined) throw new Error(`no own engine for package ${pkg}`);
    engine = createEngine(...declares);
    engines.set(pkg, engine);
  }
  const value = box(engine, expr as Json).evaluate().json as MathJSON;
  return Array.isArray(value) && value[0] === "Error" ? expr : value;
}
