import type { ComputeEngine } from "@cortex-js/compute-engine";
import { KHINCHIN_VALUE } from "./const-khinchin.ts";

// Khinchin — Khinchin's constant, a new symbol (nothing in compute-engine declares it).
// `holdUntil: "N"` matches `ConstGlaisher`/`EulerGamma`: the symbol prints as itself under
// plain `evaluate` and only resolves to a decimal under `N()`.

export function declareKhinchin(ce: ComputeEngine): void {
  ce.declare("Khinchin", {
    type: "real",
    isConstant: true,
    holdUntil: "N",
    value: ce.number(KHINCHIN_VALUE),
  });
}
