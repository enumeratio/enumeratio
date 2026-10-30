// The declarations a control's inference reads: those of the enclosing notebook's transcript
// scope when there is one, else the engine's own.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { TranscriptHost } from "./notatio-out.ts";
import { loadBareEngine, loadEngine } from "./mathlive.ts";

const hostOf = (el: Element): TranscriptHost | undefined => {
  const host = el.closest("dynamic-module-box");
  return host && typeof (host as Partial<TranscriptHost>).transcriptFor === "function"
    ? (host as TranscriptHost)
    : undefined;
};

/**
 * The engine to infer against, and a runner that makes the enclosing module's scope current
 * around a synchronous `fn`. A module's transcript lives on the shared engine, so inside one
 * that engine is used (the bare one may be a separate instance); a worker-evaluated module
 * keeps its bindings elsewhere and is left alone.
 */
export async function inferenceScope(el: Element): Promise<{ engine: ComputeEngine; run: <T>(fn: () => T) => T }> {
  const host = hostOf(el);
  if (host === undefined || host.evaluatorKind === "Worker") {
    return { engine: await loadBareEngine(), run: (fn) => fn() };
  }
  const engine = await loadEngine();
  const transcript = host.transcriptFor(engine);
  return { engine, run: (fn) => transcript.run(fn) };
}
