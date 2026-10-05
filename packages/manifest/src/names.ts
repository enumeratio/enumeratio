// The names a MathJSON expression mentions. Imports nothing, so a build script can read it.

/** Every head and symbol a MathJSON expression names. Strings in quotes are text, not names. */
export function namesOf(json: unknown, into: Set<string> = new Set()): Set<string> {
  if (typeof json === "string") {
    if (!/^'.*'$/s.test(json) && /^[A-Za-z_]/.test(json)) into.add(json);
  } else if (Array.isArray(json)) {
    for (const item of json) namesOf(item, into);
  } else if (json !== null && typeof json === "object") {
    const { fn, sym, dict } = json as { fn?: unknown; sym?: unknown; dict?: unknown };
    if (typeof sym === "string") into.add(sym);
    if (fn !== undefined) namesOf(fn, into);
    if (dict !== null && typeof dict === "object") for (const value of Object.values(dict)) namesOf(value, into);
  }
  return into;
}
