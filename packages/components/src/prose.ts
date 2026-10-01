// The template a prose-mode `<notatio-manipulate>` renders its control paragraph from.
//
// A `prose` string is running text with HOLES: `{k}` is a declared parameter and
// becomes a knob, `{2 * _k + 1}` is anything else and becomes a readout, `$\sin(kx)$`
// is typeset. Options ride after a `|` inside a hole -- `{k | axis=y play}`,
// `{N(_r^_y) | digits=4}` -- so the range and step stay in `params`, where Wolfram
// keeps them, and the hole says only how the value is to be shown.
//
// Pure, so the splitting is testable without a browser; the component renders parts.

export type ProsePart =
  | { kind: "text"; text: string }
  | { kind: "tex"; latex: string }
  | { kind: "knob"; name: string; options: Record<string, string> }
  | { kind: "dynamic"; value: string; options: Record<string, string> };

/** `axis=y play` -> { axis: "y", play: "" }: a bare word is a boolean attribute. */
export function parseHoleOptions(raw: string): Record<string, string> {
  const options: Record<string, string> = {};
  for (const token of raw.trim().split(/\s+/)) {
    if (!token) continue;
    const eq = token.indexOf("=");
    if (eq < 0) options[token] = "";
    else options[token.slice(0, eq)] = token.slice(eq + 1);
  }
  return options;
}

/** The index just past the `}` that closes the `{` at `open`, or -1 if unbalanced. */
function closeBrace(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) return i + 1;
  }
  return -1;
}

/**
 * Split a prose template into its parts. `names` are the declared parameters: a hole
 * whose body (before any `|`) is exactly one of them is a knob, anything else in
 * braces is a readout. An unbalanced brace or an unclosed `$` is left as text rather
 * than swallowing the rest of the sentence.
 */
export function parseProse(template: string, names: ReadonlySet<string>): ProsePart[] {
  const parts: ProsePart[] = [];
  let text = "";
  const flush = (): void => {
    if (text) parts.push({ kind: "text", text });
    text = "";
  };
  let i = 0;
  while (i < template.length) {
    const c = template[i];
    if (c === "\\" && "{}$".includes(template[i + 1] ?? "")) {
      text += template[i + 1];
      i += 2;
      continue;
    }
    if (c === "{") {
      const end = closeBrace(template, i);
      if (end < 0) {
        text += c;
        i++;
        continue;
      }
      const body = template.slice(i + 1, end - 1);
      const bar = body.indexOf("|");
      const head = (bar < 0 ? body : body.slice(0, bar)).trim();
      const options = bar < 0 ? {} : parseHoleOptions(body.slice(bar + 1));
      flush();
      if (names.has(head)) parts.push({ kind: "knob", name: head, options });
      else parts.push({ kind: "dynamic", value: head, options });
      i = end;
      continue;
    }
    if (c === "$") {
      const end = template.indexOf("$", i + 1);
      if (end < 0) {
        text += c;
        i++;
        continue;
      }
      flush();
      parts.push({ kind: "tex", latex: template.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    text += c;
    i++;
  }
  flush();
  return parts;
}
