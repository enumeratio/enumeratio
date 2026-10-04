import { ComputeEngine } from "@cortex-js/compute-engine";
import type { Engine } from "./facade.ts";

/** A step that declares heads on an engine, e.g. a library's `declareX`. */
export type Declare = (ce: Engine) => void;

/** A fresh engine with `declares` applied in order. */
export const createEngine = (...declares: readonly Declare[]): Engine => {
  const ce = bareEngine();
  for (const declare of declares) declare(ce);
  return ce;
};

/** A fresh engine with nothing declared: compute-engine's own library only. */
export const bareEngine = (): Engine => new ComputeEngine();
