import type { ComputeEngine } from "@cortex-js/compute-engine";

// A patch: something we offered compute-engine upstream, applied locally until it lands.
// See design/upstreaming.md §10 -- one folder per candidate under src/, each with a
// patch.ts naming the issue and PR and saying where the code goes in compute-engine.

export interface Patch {
  /** The folder under `src/` this patch lives in. */
  readonly id: string;
  /** The compute-engine issue this was reported as, as a full GitHub URL. */
  readonly issue: string;
  /** The compute-engine pull request offering the fix, once one exists. */
  readonly pr?: string;
  /** Where the code goes in compute-engine, once it lands. */
  readonly lands: string;
  /**
   * Does a fresh engine already answer correctly, without this patch? Runs the issue's
   * own repro. `true` means compute-engine has shipped the fix — the patch (and this
   * function) are dead weight, and `tests/landed.test.ts` will say so.
   */
  fixed(ce: ComputeEngine): boolean;
  /** Apply the patch to `ce`, in place. Only ever called when `fixed(ce)` is false. */
  apply(ce: ComputeEngine): void;
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
