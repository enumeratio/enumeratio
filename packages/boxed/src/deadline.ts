// A cooperative deadline any long-running loop can check, independent of compute-engine's
// own `withTimeLimit` — a bigint kernel (Pollard rho, baby-step giant-step) has no boxed
// expressions to canonicalize through, so it never passes through the engine's deadline
// frame. `withDeadline` arms a stack-scoped budget; `checkpoint()` throws once the
// innermost one has passed. Nesting only shortens the effective deadline, matching
// `ce.withTimeLimit`'s own rule.

/** Thrown by `checkpoint()` once the innermost `withDeadline` span has expired. */
export class DeadlineExceededError extends Error {
  constructor(message = "deadline exceeded") {
    super(message);
    this.name = "DeadlineExceededError";
  }
}

// Absolute deadlines (ms epoch), innermost last. A child deadline only shortens the
// effective one: pushing a looser one still leaves the tighter ancestor in force.
const stack: number[] = [];

/** Run `fn` with **at most** `ms` milliseconds visible to `checkpoint()`. Sync only. */
export function withDeadline<T>(ms: number, fn: () => T): T {
  const parent = stack[stack.length - 1];
  const at = Date.now() + ms;
  stack.push(parent === undefined ? at : Math.min(parent, at));
  try {
    return fn();
  } finally {
    stack.pop();
  }
}

/** Throw `DeadlineExceededError` if the innermost `withDeadline` span has passed. */
export function checkpoint(): void {
  const at = stack[stack.length - 1];
  if (at !== undefined && Date.now() > at) throw new DeadlineExceededError();
}
