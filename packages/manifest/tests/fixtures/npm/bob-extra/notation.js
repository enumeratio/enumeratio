// A notation entry in JavaScript, the fallback for what data can't say. It can only name heads as
// written, not the pinned heads a library's symbols are declared as.
export const notation = {
  latex: [{ name: "Zh", latexTrigger: "\\zh", kind: "function" }],
  traditional: { Zh: () => undefined },
};
