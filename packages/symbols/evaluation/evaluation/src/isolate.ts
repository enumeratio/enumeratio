// Keeps one evaluation's inferred free-symbol types from reaching the next one on the same
// engine. Shared by the pooled worker (./worker.ts) and `@enumeratio/reference`'s provenance
// sweep, which both run many unrelated expressions through one engine.

import type { Engine } from "@enumeratio/engine";

type Scope = Engine["context"]["lexicalScope"];

/** The names an engine already defines as an untyped free symbol, with the scope-chain size
 * they were found at (a library declared later changes the size, and so the answer). */
const openSymbols = new WeakMap<Engine, { readonly size: number; readonly names: readonly string[] }>();

/**
 * Every symbol the engine ALREADY defines as an untyped, inferrable value: compute-engine's
 * unit symbols (`m`, `s`, `A`, `J`, `C`, `K`, `F`, `kg`, `W`) are the ones it ships. They read
 * as free symbols until something types them, and then they stay typed for good.
 */
function openSymbolsOf(ce: Engine): readonly string[] {
  const scopes: Scope[] = [];
  for (let scope: Scope | null = ce.context.lexicalScope; scope; scope = scope.parent) scopes.push(scope);
  const size = scopes.reduce((total, scope) => total + scope.bindings.size, 0);
  const cached = openSymbols.get(ce);
  if (cached?.size === size) return cached.names;
  const names: string[] = [];
  for (const scope of scopes) {
    for (const name of scope.bindings.keys()) {
      const def = ce.lookupDefinition(name);
      if (def !== undefined && "value" in def && def.value.inferredType && def.value.type.toString() === "unknown") {
        names.push(name);
      }
    }
  }
  openSymbols.set(ce, { size, names });
  return names;
}

/**
 * Run `body()` in a scope where nothing it does to a FREE symbol can reach the next
 * expression. Boxing alone types a bare `x` in `Sqrt(x^2)` as `number`, and a later,
 * unrelated expression that mentions `x` then answers differently depending on what touched
 * this engine before it: `Or(x, True, z)` short-circuits to `True` while `x` is untyped, but
 * throws an incompatible-type error once something else has typed it, and `Transpose(m)`
 * holds until `m + 1` types `m` a number and it collapses to `m`.
 *
 * `pushScope()`/`popScope()` already discards a symbol compute-engine declares for a free
 * name, since it declares it in the scope that is current. It cannot discard a type
 * inferred onto a definition that was there BEFORE the scope was pushed. The only such
 * definitions that read as free are the open symbols above, so each is re-declared inside
 * the scope, shadowing the shared one: inferred, so it types the way a fresh one would, and
 * gone when the scope is. (`ce.forget()` doesn't touch a type, and a `declare` on the shared
 * definition would change what that name means for every case after it.)
 */
export function isolateFreeSymbols<T>(ce: Engine, body: () => T): T {
  const open = openSymbolsOf(ce);
  ce.pushScope();
  try {
    for (const name of open) ce.declare(name, { type: "unknown", inferred: true });
    return body();
  } finally {
    ce.popScope();
  }
}
