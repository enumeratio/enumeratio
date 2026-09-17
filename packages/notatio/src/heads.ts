// Wrapper heads -- `N(x)`, `FullForm(x)`, `TraditionalForm(x)` -- as source. A head
// written around an expression is how the reader asks for something other than the
// default: a number instead of the exact form, the AST instead of the rendering.
// compute-engine evaluates `N` itself; the *Form heads are ours, and whoever consumes
// the value reads the head off and honours it (see `formOfHead`).

/** How the wrapper is spelled: LaTeX (a math field) or notatio (Epsil source). */
export type NumericForm = "latex" | "notatio";

/**
 * A head that may be written around an input. `form` names the `<notatio-out>`
 * representation the head asks for; a head without one (`N`) is a real compute-engine
 * head and stays in the expression handed to the engine.
 */
export interface WrapperHead {
  head: string;
  label: string;
  title: string;
  form?: string;
}

/** The heads offered, in menu order. `N` leads: it is the one the engine acts on. */
export const WRAPPER_HEADS: readonly WrapperHead[] = [
  { head: "N", label: "N", title: "evaluate numerically" },
  {
    head: "TraditionalForm",
    label: "Traditional",
    title: "render in traditional notation",
    form: "traditional",
  },
  { head: "InputForm", label: "Input", title: "show as notatio you could retype", form: "input" },
  { head: "FullForm", label: "Full", title: "show the MathJSON AST", form: "full" },
  { head: "TreeForm", label: "Tree", title: "show the expression tree", form: "tree" },
  { head: "TeXForm", label: "TeX", title: "show the LaTeX source", form: "tex" },
];

const BY_HEAD = new Map(WRAPPER_HEADS.map((h) => [h.head, h]));

/** The head whose name this is, or undefined if it is not one we offer. */
export const wrapperHead = (head: string): WrapperHead | undefined => BY_HEAD.get(head);

/**
 * The output representation a head asks for, or undefined when the head belongs to the
 * expression itself -- the signal to leave it in place rather than strip it.
 */
export const formOfHead = (head: string): string | undefined => BY_HEAD.get(head)?.form;

/** The spellings a head may be written in, most specific first. */
const spellings = (head: string): string[] => [
  `\\operatorname{${head}}`,
  `\\mathrm{${head}}`,
  head,
];

/** A `$…$` island can only occur in notatio, so it settles which form a source is. */
const ISLAND = /\$[^$]*\$/;

const formOf = (src: string): NumericForm => (ISLAND.test(src) ? "notatio" : "latex");

/** Past `\left(` / `\right)` as well as bare parens, so LaTeX sizing is not a barrier. */
function closingIndex(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length;) {
    if (src.startsWith("\\left(", i)) {
      depth++;
      i += 6;
    } else if (src.startsWith("\\right)", i)) {
      i += 7;
      if (--depth === 0) return i;
    } else if (src[i] === "(") {
      depth++;
      i++;
    } else if (src[i] === ")") {
      i++;
      if (--depth === 0) return i;
    } else i++;
  }
  return -1;
}

/** The head written around the whole source, and what it wraps. */
export interface SplitHead {
  /** The head's name, or `""` when the source carries none. */
  head: string;
  /** The expression inside the wrapper, or the whole source when there is none. */
  body: string;
}

/**
 * Read the wrapper head off a source. Only a head around the *whole* expression counts:
 * `N(x) + 1` is an expression that happens to start with one, not a numeric request.
 */
export function splitHead(src: string): SplitHead {
  const s = src.trim();
  for (const { head } of WRAPPER_HEADS) {
    for (const spelling of spellings(head)) {
      if (!s.startsWith(spelling)) continue;
      const rest = s.slice(spelling.length).trimStart();
      // A bare name needs its delimiter right after it, or `Norm(x)` reads as `N`.
      if (!rest.startsWith("(") && !rest.startsWith("\\left(")) continue;
      const open = s.length - rest.length;
      const close = closingIndex(s, open);
      if (close !== s.length) continue; // wraps only part of the source
      const inner = s.slice(open, close);
      const body = inner.startsWith("\\left(") ? inner.slice(6, -7) : inner.slice(1, -1);
      return { head, body: body.trim() };
    }
  }
  return { head: "", body: s };
}

/** Drop the wrapper head, if the whole source is one. Idempotent. */
export const stripHead = (src: string): string => splitHead(src).body;

/**
 * Write `head` around `src`. Replaces any head already there rather than nesting, so
 * the result is idempotent and never `N(N(x))`. Empty in, empty out. The spelling is
 * inferred from the source (a `$…$` island means notatio) unless one is given.
 */
export function wrapHead(src: string, head: string, form: NumericForm = formOf(src)): string {
  const body = stripHead(src);
  if (!body || !wrapperHead(head)) return body;
  const name = form === "latex" ? `\\operatorname{${head}}` : head;
  return `${name}(${body})`;
}
