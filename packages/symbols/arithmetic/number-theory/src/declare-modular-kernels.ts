// `Mod(f(args), m)` computed modulo m for the heads that have a cheap modular kernel, through
// the registry in @enumeratio/engine (modular.ts: why the registry sits on the node, not on
// `Mod`). Tracked at https://github.com/enumeratio/enumeratio/issues/205.
import { type Engine, type ModularArity, type ModularKernel, registerModularKernel } from "@enumeratio/engine";
import { fibonacciMod, lucasLMod } from "./fast-recurrence.ts";
import {
  bellMod,
  binomialMod,
  catalanMod,
  factorialMod,
  multinomialMod,
  pochhammerMod,
  stirlingMod,
  subfactorialMod,
} from "./modular-kernels.ts";

/** Every registered kernel, by head: exported so a test can wrap each in a counter. `StirlingS2` is
 *  canonically `Stirling`. */
export const MODULAR_KERNELS: readonly (readonly [head: string, kernel: ModularKernel, arity?: ModularArity])[] = [
  ["Fibonacci", ([n], m) => fibonacciMod(n!, m)],
  ["LucasL", ([n], m) => lucasLMod(n!, m)],
  ["Factorial", ([n], m) => factorialMod(n!, m)],
  ["Binomial", ([n, k], m) => binomialMod(n!, k!, m), 2],
  ["CatalanNumber", ([n], m) => catalanMod(n!, m)],
  ["Multinomial", (parts, m) => multinomialMod(parts, m), "variadic"],
  ["Pochhammer", ([a, n], m) => pochhammerMod(a!, n!, m), 2],
  ["Subfactorial", ([n], m) => subfactorialMod(n!, m)],
  ["BellNumber", ([n], m) => bellMod(n!, m)],
  ["Stirling", ([n, k], m) => stirlingMod(n!, k!, m, 2), 2],
  ["StirlingS1", ([n, k], m) => stirlingMod(n!, k!, m, 1), 2],
];

export function declareModularKernels(ce: Engine): void {
  for (const [head, kernel, arity] of MODULAR_KERNELS) registerModularKernel(ce, head, kernel, arity);
}
