// Pure helpers for the in-page snapshot assertions. The same expected data is
// asserted node-side by the reference package's tests; this mirrors that check
// live in the browser.

/** Structural equality for MathJSON values (numbers, strings, arrays, objects). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return (
      ka.length === kb.length &&
      ka.every((k) =>
        deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
      )
    );
  }
  return false;
}

const unquote = (s: unknown): string =>
  typeof s === "string" ? s.replace(/^'|'$/g, "") : JSON.stringify(s);

/** Turn an `["Error", …]` atom into a readable one-line message. */
export function formatError(atom: unknown): string {
  if (!Array.isArray(atom) || atom[0] !== "Error") return String(atom);
  const code = atom[1];
  if (Array.isArray(code) && code[0] === "ErrorCode") {
    const name = unquote(code[1]);
    const args = code.slice(2).map(unquote);
    if (name === "incompatible-type" && args.length >= 2) {
      return `type mismatch: expected ${args[0]}, got ${args[1]}`;
    }
    return args.length > 0 ? `${name}: ${args.join(", ")}` : name;
  }
  return unquote(code);
}

/** Collect readable messages for any `["Error", …]` subexpressions a result carries. */
export function collectErrors(node: unknown, acc: string[] = []): string[] {
  if (Array.isArray(node)) {
    if (node[0] === "Error") acc.push(formatError(node));
    else for (const child of node) collectErrors(child, acc);
  }
  return acc;
}
