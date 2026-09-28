// Minimal, dependency-free syntax highlighting for the code boxes. A single-pass
// tokenizer -- good enough for the small, uniform expressions we emit (function
// calls, numbers, strings, brackets, operators) across wolfram / python / glsl /
// wgsl / json / javascript -- not a real grammar. Input is HTML-escaped; the
// result is safe to inject. `lang` is accepted for future per-language tuning.

const ESCAPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const escape = (s: string): string => s.replace(/[&<>]/g, (c) => ESCAPE[c]);

// Order within the alternation is the precedence: string, number, a
// function/head name (identifier before `[` or `(`), a bare identifier, an
// operator run, then punctuation. A dotted name (np.sin) is one identifier.
const TOKEN =
  /(?<str>"(?:[^"\\]|\\.)*")|(?<num>\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(?<fn>[A-Za-z_$][\w$.]*)(?=\s*[[(])|(?<id>[A-Za-z_$][\w$.]*)|(?<op>[-+*/^=<>!&|%~]+)|(?<punct>[[\](){},;:])/g;

export function highlightCode(code: string, _lang: string): string {
  let out = "";
  let last = 0;
  for (const m of code.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    out += escape(code.slice(last, i));
    const g = m.groups ?? {};
    const cls = g.str ? "str" : g.num ? "num" : g.fn ? "fn" : g.op ? "op" : g.punct ? "punct" : "";
    out += cls ? `<span class="tok-${cls}">${escape(m[0])}</span>` : escape(m[0]);
    last = i + m[0].length;
  }
  out += escape(code.slice(last));
  return out;
}
