import type { ComputeEngine } from "@cortex-js/compute-engine";

// A patch: something we offered compute-engine upstream, applied locally until it lands.
// See https://github.com/enumeratio/enumeratio/wiki/Upstreaming §10 -- laid out like compute-engine itself (numerics/, library/,
// compilation/ under src/compute-engine/), with one manifest per future PR under
// src/patches/, naming the issue and PR, the files it would carry, and the library record
// it declares.

/** One head's definition, in the shape `ce.declare` and compute-engine's own
 * `SymbolDefinitions` take: an operator (a signature, evaluate, compile, …) or a constant. */
export type LibraryRecord = Record<string, unknown>;

export interface Patch {
  /** The slug this patch's manifest lives under, `src/patches/<id>.ts`. */
  readonly id: string;
  /** The compute-engine issue this was reported as, as a full GitHub URL, once one exists. */
  readonly issue?: string;
  /** The compute-engine pull request offering the fix, once one exists. */
  readonly pr?: string;
  /** Where the code goes in compute-engine, once it lands. */
  readonly lands: string;
  /** The `src/compute-engine/...` paths a pull request for this patch would carry.
   * `tests/manifest-files.test.ts` checks every one exists. */
  readonly files: readonly string[];
  /**
   * The library record this patch declares: a plain `SymbolDefinitions`-shaped object for a
   * brand-new head, or a function of the engine when the definition captures a native
   * handler -- upstream that becomes an edit to the native definition, not a new file (see
   * each patch's own comment). `apply` declares every key `library` has, whichever form it
   * takes. Absent for a patch that wraps a native head in place (`apply` changes the
   * native definition's `evaluate`, keeping the rest of it), which states `heads` instead.
   */
  readonly library?: LibraryRecord | ((ce: ComputeEngine) => LibraryRecord);
  /**
   * Every head `library` declares, or that `apply` wraps in place. Set where `library` is a
   * function or absent -- its keys
   * aren't known without an engine, so `patchSymbols` reads this instead of calling it;
   * `tests/symbols.test.ts` checks it against what the function actually returns.
   */
  readonly heads?: readonly string[];
  /**
   * Does a fresh engine already answer correctly, without this patch? Runs the issue's
   * own repro. `true` means compute-engine has shipped the fix — the patch (and this
   * function) are dead weight, and `tests/landed.test.ts` will say so.
   */
  fixed(ce: ComputeEngine): boolean;
  /** Apply the patch to `ce`, in place. Only ever called when `fixed(ce)` is false. */
  apply(ce: ComputeEngine): void;
}

/** Declare every key of a plain-object `library` record on `ce` -- the common case; a
 * function-form `library` (see `Patch.library`) is resolved by the caller first. */
export function declareLibrary(ce: ComputeEngine, library: LibraryRecord): void {
  for (const [name, definition] of Object.entries(library)) ce.declare(name, definition as never);
}

/** The heads `patch` declares, without constructing an engine where possible. */
export function patchSymbols(patch: Patch): readonly string[] {
  return patch.heads ?? Object.keys(patch.library as LibraryRecord);
}

/** Every head any patch declares, deduplicated. */
export function symbols(patches: readonly Patch[]): readonly string[] {
  return [...new Set(patches.flatMap(patchSymbols))];
}

/**
 * Which patches have already run on which engines, so `applyPatch`/`applyPatches` are
 * idempotent per engine regardless of how many packages call them (a package's own
 * `declare` may call one directly; another library sharing the same engine may call
 * `applyPatches` again later).
 */
const appliedTo = new WeakMap<ComputeEngine, Set<string>>();

/** Apply one patch to `ce`, unless it has already landed upstream or already run here. */
export function applyPatch(ce: ComputeEngine, patch: Patch): void {
  const applied = appliedTo.get(ce) ?? new Set<string>();
  appliedTo.set(ce, applied);
  if (applied.has(patch.id) || patch.fixed(ce)) return;
  patch.apply(ce);
  applied.add(patch.id);
}

/** Apply every patch in `patches` that has not already landed upstream (or already run). */
export function applyPatches(ce: ComputeEngine, patches: readonly Patch[]): void {
  for (const patch of patches) applyPatch(ce, patch);
}
