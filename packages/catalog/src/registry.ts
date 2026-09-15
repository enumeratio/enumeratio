// The context registry and its search path — the part that makes 280 collections cost
// nothing until asked for, and lets a name move toward the global table by evidence.
//
// Three rungs (design/namespaces.md §4):
//   namespaced  registered in a context, reachable only fully qualified
//   blessed     its context is on the search path, so the bare name resolves
//   promoted    it has a real head, and compute-engine answers it directly
//
// Promotion is a PATH change, never a rename: `enumeratio`Subsets` keeps resolving after
// `Subsets` becomes global, so nothing written down earlier breaks.

import { type Resource, unqualify } from "./types.ts";

export class ResourceRegistry {
  readonly #contexts = new Map<string, Map<string, Resource>>();
  #searchPath: string[] = [];

  /** Register a resource into its own context. Idempotent per (context, name). */
  add(resource: Resource): this {
    let ctx = this.#contexts.get(resource.context);
    if (!ctx) this.#contexts.set(resource.context, (ctx = new Map()));
    ctx.set(resource.name, resource);
    return this;
  }

  addAll(resources: Iterable<Resource>): this {
    for (const r of resources) this.add(r);
    return this;
  }

  get contexts(): readonly string[] {
    return [...this.#contexts.keys()].sort();
  }

  get searchPath(): readonly string[] {
    return this.#searchPath;
  }

  /** Bless a context — put it on the search path so its names resolve unqualified.
   *  Later entries lose to earlier ones, so ordering is the precedence rule. */
  bless(...contexts: string[]): this {
    for (const c of contexts) if (!this.#searchPath.includes(c)) this.#searchPath.push(c);
    return this;
  }

  unbless(context: string): this {
    this.#searchPath = this.#searchPath.filter((c) => c !== context);
    return this;
  }

  /** Resolve a spelling. Qualified spellings ignore the search path entirely — that is
   *  what keeps a fully-qualified reference stable across every later blessing. */
  resolve(spelling: string): Resource | undefined {
    const { context, name } = unqualify(spelling);
    if (context !== undefined) return this.#contexts.get(context)?.get(name);
    for (const c of this.#searchPath) {
      const hit = this.#contexts.get(c)?.get(name);
      if (hit) return hit;
    }
    return undefined;
  }

  /** Every context holding this bare name — the shadowing report. With more than one
   *  entry, the search path is deciding something a reader cannot see, so callers that
   *  care (docs, linting) should say so rather than silently taking the winner. */
  candidates(name: string): readonly Resource[] {
    const out: Resource[] = [];
    for (const [, names] of this.#contexts) {
      const hit = names.get(name);
      if (hit) out.push(hit);
    }
    return out;
  }

  all(context?: string): readonly Resource[] {
    if (context !== undefined) return [...(this.#contexts.get(context)?.values() ?? [])];
    return [...this.#contexts.values()].flatMap((m) => [...m.values()]);
  }
}
