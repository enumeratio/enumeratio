// A notation entry, as our packages write theirs: LaTeX the engine reads, and TraditionalForm rules.
export const notation = {
  latex: [{ name: "Scaled", latexTrigger: "\\scaled", kind: "function" }],
  traditional: { Scaled: () => undefined },
};
