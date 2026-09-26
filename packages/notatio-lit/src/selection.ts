// A document-level copy handler: when a selection spans notatio elements, put
// Markdown on the clipboard instead of the browser's mangled default. Inline
// math (`<notatio-out inline>`) becomes `$latex$`, a code box (`<notatio-code>`) becomes
// an inline code span or a fenced block, a notebook In or Out its InputForm, and the
// surrounding prose is kept. A selection inside one typeset Out copies that expression
// (see `clipboard.ts`). A no-op (default copy) for any selection that doesn't touch our
// elements.

import { writeExpression } from "./clipboard.ts";

let installed = false;

export function ensureCopyHandler(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("copy", onCopy);
}

function onCopy(event: ClipboardEvent): void {
  const selection = globalThis.getSelection?.();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  const out = typesetOutAround(range.commonAncestorContainer);
  if (out && event.clipboardData && (out.expression.inputForm || out.expression.latex)) {
    // Typeset glyphs copy as nonsense, and a part of them has no expression of its own:
    // the copy is the Out's whole expression.
    writeExpression(event.clipboardData, out.expression);
    event.preventDefault();
    return;
  }
  const fragment = range.cloneContents();
  // Only intervene when the selection actually contains one of our elements.
  if (!fragment.querySelector?.(`notatio-out[inline], notatio-out[display], notatio-code, ${WITH_INPUT_FORM}`)) return;
  const text = serialize(fragment)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  event.clipboardData?.setData("text/plain", text);
  event.preventDefault();
}

/** A notebook In or Out, which keeps its InputForm on an attribute for a copied clone. */
const WITH_INPUT_FORM = "notatio-out[input-form], notatio-in[input-form]";

interface TypesetOut extends Element {
  readonly expression: { inputForm: string; latex: string };
}

/** The Out whose typeset math `node` sits in -- not prose math, not a plain-text form. */
function typesetOutAround(node: Node): TypesetOut | undefined {
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const out = el?.closest(".notatio-render")?.closest("notatio-out");
  if (!out || out.hasAttribute("inline") || out.hasAttribute("display") || el?.closest("notatio-code"))
    return undefined;
  return "expression" in out ? (out as TypesetOut) : undefined;
}

// Chrome (menus, In/Out labels, diagnostics) that shouldn't end up in the copy.
const SKIP = "notatio-menu notatio-io-label notatio-assert-fail notatio-assert-diag notatio-code-lang";
const BLOCK = new Set(["P", "DIV", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "SECTION", "TR", "PRE"]);

function serialize(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return childText(node);

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  // Prose math (`inline` and `display` are reflected; `format` may be a property only).
  if (tag === "notatio-out" && (el.hasAttribute("inline") || el.hasAttribute("display"))) {
    const value = el.getAttribute("value") ?? "";
    if (!value) return "";
    return el.hasAttribute("display") ? `\n$$${value}$$\n` : `$${value}$`;
  }
  if (tag === "notatio-code") {
    const value = el.getAttribute("value") ?? "";
    if (!value) return "";
    const lang = el.getAttribute("language") ?? "";
    return value.includes("\n") ? `\n\`\`\`${lang}\n${value}\n\`\`\`\n` : `\`${value}\``;
  }
  if (el.matches(WITH_INPUT_FORM)) return `\n${el.getAttribute("input-form")}\n`;
  if (tag === "br") return "\n";
  if (SKIP.split(" ").some((c) => el.classList.contains(c))) return "";

  const inner = childText(el);
  return BLOCK.has(el.tagName) ? `\n${inner}\n` : inner;
}

function childText(node: Node): string {
  let out = "";
  node.childNodes.forEach((child) => {
    out += serialize(child);
  });
  return out;
}
