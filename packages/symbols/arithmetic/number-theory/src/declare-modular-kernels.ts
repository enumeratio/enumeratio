// `Mod(f(args), m)` computed modulo m for the heads that have a cheap modular kernel, through
// the registry in @enumeratio/engine (modular.ts: why the registry sits on the node, not on
// `Mod`). Tracked at https://github.com/enumeratio/enumeratio/issues/205.
import { type Engine, registerModularKernel } from "@enumeratio/engine";
import { fibonacciMod, lucasLMod } from "./fast-recurrence.ts";
import { binomialMod, catalanMod, factorialMod } from "./modular-kernels.ts";

export function declareModularKernels(ce: Engine): void {
  registerModularKernel(ce, "Fibonacci", ([n], m) => fibonacciMod(n!, m));
  registerModularKernel(ce, "LucasL", ([n], m) => lucasLMod(n!, m));
  registerModularKernel(ce, "Factorial", ([n], m) => factorialMod(n!, m));
  registerModularKernel(ce, "Binomial", ([n, k], m) => binomialMod(n!, k!, m), 2);
  registerModularKernel(ce, "CatalanNumber", ([n], m) => catalanMod(n!, m));
}
