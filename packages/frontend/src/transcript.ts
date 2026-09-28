import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";

// `createScope`'s return type rather than importing `Scope` directly -- both name the same
// thing, but this stays correct across a version bump that renames or narrows the export.
type Scope = ReturnType<ComputeEngine["createScope"]>;

// A `DynamicModule([Cell(...), Cell(...), ...])` (or its alias `Notebook`) is Wolfram's
// $Line transcript: cells share one binding scope and evaluate in document order, and
// `Out(n)` / `In(n)` / `InString(n)` read back a history
// keyed by EVALUATION COUNT, not cell position -- re-evaluating cell 2 gives it a new,
// higher line number rather than overwriting its old one.
//
// This is the base-package half: pure engine bookkeeping, no DOM. The element side
// (`notatio-dynamic-module`) owns one `Transcript` per instance and hands it to whichever
// `notatio-out` inside it asks (see that package for how a cell finds its transcript, the
// way a Cell already finds a forced `env`).
//
// It is deliberately the same shape as the CLI's own history (`packages/cli/src/engine.ts`
// `declareHistory`) -- re-declared here rather than shared because the CLI's
// lives on its `Session` and reads plain-text input, while this lives on a scope and reads
// LaTeX; the Wolfram semantics (`Out` re-reads a value, `In` re-evaluates, `InString` is the
// literal text) are the same in both.

export interface TranscriptEntry {
  /** The 1-based `In[n]` / `Out[n]` line number -- Wolfram's `$Line` at that evaluation. */
  readonly n: number;
  /** The cell's source, as authored (for `InString(n)`). */
  readonly input: string;
  /** Parsed but not evaluated (for `In(n)`, which Wolfram gives a delayed value). */
  readonly raw: BoxedExpression;
  /** Evaluated (for `Out(n)`). */
  readonly value: BoxedExpression;
}

/** `new Transcript(engine, options)`'s options. */
export interface TranscriptOptions {
  /**
   * `Out`/`In`/`InString` and `In[n]`/`Out[n]` line numbers -- on by default. A
   * reactive `DynamicModule` (`TrackedSymbols` set) turns this off: cells can be
   * understood in any order there, so a position-keyed history would be misleading, and
   * `tracked-symbols.ts`'s own schedule already rejects an ordinal reference outright.
   * `record` becomes a no-op (returns `undefined`, so a caller's line-number label stays
   * unset) and `Out`/`In`/`InString` are never declared -- referencing one is simply an
   * undefined symbol, consistent with the rejection.
   */
  readonly history?: boolean;
}

/**
 * One transcript's shared scope and history. `Out`, `In` and `InString` are declared into
 * the scope itself, so they read this instance's history for as long as the scope is
 * current -- and nowhere else, the way a reorderable notebook or worksheet has no ordinals
 * to reference at all (`referencesOrdinal` in `reactive.ts`). Cell-number references are a
 * capability a transcript turns on, not a global rule.
 */
export class Transcript {
  readonly history: TranscriptEntry[] = [];
  readonly #engine: ComputeEngine;
  readonly #scope: Scope;
  readonly #history: boolean;

  constructor(engine: ComputeEngine, options: TranscriptOptions = {}) {
    this.#engine = engine;
    this.#history = options.history ?? true;
    this.#scope = engine.createScope({});
    if (this.#history) this.run(() => this.#declareHistory());
  }

  #declareHistory(): void {
    const at = (ops: readonly BoxedExpression[], what: string): TranscriptEntry => {
      const n = ops[0]?.re;
      if (n === undefined || !Number.isInteger(n) || n === 0) {
        throw new Error(`${what} takes a line number`);
      }
      const entry = n > 0 ? this.history[n - 1] : this.history.at(n);
      if (!entry) throw new Error(`no line ${n}`);
      return entry;
    };
    this.#engine.declare("Out", {
      signature: "(number) -> any",
      evaluate: (ops) => at(ops, "Out").value,
    });
    this.#engine.declare("In", {
      signature: "(number) -> any",
      evaluate: (ops) => at(ops, "In").raw.evaluate(),
    });
    this.#engine.declare("InString", {
      signature: "(number) -> string",
      evaluate: (ops) => this.#engine.string(at(ops, "InString").input),
    });
  }

  /**
   * Run `fn` with this transcript's scope current, so a parse or evaluate inside it sees
   * its bindings and its `Out`/`In`/`InString`. Synchronous by construction (like
   * `runPass`'s push/eval/pop): the engine is shared with the rest of the page, so a
   * scope left current across an `await` could catch someone else's evaluation.
   */
  run<T>(fn: () => T): T {
    this.#engine.pushScope(this.#scope);
    try {
      return fn();
    } finally {
      this.#engine.popScope();
    }
  }

  /**
   * Record an evaluated cell as the next `In[n]` / `Out[n]`, and return its line number
   * -- or `undefined`, doing nothing, when this transcript was built with `history: false`.
   */
  record(input: string, raw: BoxedExpression, value: BoxedExpression): number | undefined {
    if (!this.#history) return undefined;
    const n = this.history.length + 1;
    this.history.push({ n, input, raw, value });
    return n;
  }
}
