import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAdeles } from "@enumeratio/adeles/src";
import type { PackageNotation } from "@enumeratio/boxes";
import { type Library } from "@enumeratio/manifest";
/** Every library we ship, in the order the reference tests declare them. */
export declare const DECLARATIONS: (typeof declareAdeles)[];
/**
 * The same libraries by package, for the resolver (`@enumeratio/manifest`'s `createResolver`),
 * in the same order. A package is one library: combinatorics brings its maps and its
 * carriers' plurals with it, where `LIBRARY_DECLARATIONS` declares those last.
 */
export declare const LIBRARIES: readonly Library<ComputeEngine>[];
/** Every package's notation entry, as the manifest lists them. Imported from here because this
 *  package depends on every library, so each specifier resolves. */
export declare const packageNotations: () => Promise<PackageNotation[]>;
export declare const declaredEngine: () => ComputeEngine;
/**
 * `configure(ce)` for `@enumeratio/evaluation/node`'s isolated evaluator (`evaluateIsolated`,
 * `openSession`, `runCases`'s `setup` option): declares every library the reference engine
 * declares, so a case evaluated in a worker means the same thing it would in-process. Not
 * `declaredEngine`'s `DECLARATIONS` verbatim — the worker's own engine already declares
 * `@enumeratio/evaluation` before running `setup` (see `worker.ts`/`session-worker.ts`).
 */
export declare function configure(ce: ComputeEngine): void;
