// The component summaries are JSDoc prose — paragraphs with `backticks` and **bold**.
// Rendering them needs an escape and two replacements, not a second markdown pipeline
// on the client.

const escape = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One paragraph of JSDoc prose as inline HTML. */
export const inline = (s: string): string =>
  escape(s.replace(/\s*\n\s*/g, " "))
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

/** A JSDoc block split into paragraphs, each rendered inline. */
export const paragraphs = (doc: string): string[] =>
  doc
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map(inline);
