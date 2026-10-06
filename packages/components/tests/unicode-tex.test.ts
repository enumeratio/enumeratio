import { ComputeEngine, LATEX_DICTIONARY, LatexSyntax } from "@cortex-js/compute-engine";
import {
  commandTeX,
  katexStrict,
  unicodeSymbols,
  UNICODE_TEX,
  unicodeTeX,
  type UnicodeSymbol,
} from "@enumeratio/boxes/render";
import { conventionalLatexDictionary, probeLanded } from "@enumeratio/frontend/conventional-latex";
import { displayLatexSyntax } from "@enumeratio/frontend/display";
import katex from "katex";
import { convertLatexToMathMl } from "mathlive/ssr";
import { expect, test } from "vite-plus/test";

// The Unicode list (`UNICODE_TEX`): each symbol is written as itself and every input reads it
// as its command: compute-engine's parser, KaTeX (strict, as the site sets it) and MathLive.

probeLanded();

const display = displayLatexSyntax(LATEX_DICTIONARY);
// The same dictionary written without the Unicode pass, for what the command form does.
const commandForm = new LatexSyntax({ dictionary: conventionalLatexDictionary() as never[] });

/** A line of LaTeX that holds the symbol in its usual place. */
const template = (s: UnicodeSymbol, x: string): string => {
  if (s.char === "ζ") return `${x}(s)`;
  if ("∀∃".includes(s.char)) return `${x} x, x > 0`;
  if (s.char === "¬" || s.char === "∂") return `${x} f`;
  if ("≤≥≠≈≡∈∉∼≅⊂⊆⊃⊇∋→↔⇒⇔↦×±∓⊗⊕∪∩÷∘∖∧∨".includes(s.char)) return `a ${x} b`;
  if (s.command.startsWith("\\mathbb")) return `a \\in ${x}`;
  return x;
};

const read = (syntax: LatexSyntax, tex: string): string => JSON.stringify(syntax.parse(tex));
const symbols = unicodeSymbols();

test("the list is not empty and has no repeats", () => {
  expect(symbols.length).toBeGreaterThan(50);
  expect(new Set(UNICODE_TEX.map((s) => s.char)).size).toBe(UNICODE_TEX.length);
});

test("compute-engine reads each as its command", () => {
  const bad = symbols.filter((s) => read(display, template(s, s.char)) !== read(display, template(s, s.command)));
  expect(bad.map((s) => s.char)).toEqual([]);
});

test("a letter reads as its command with a subscript, a power and a factor", () => {
  const letters = symbols.filter((s) => /^\p{Script=Greek}$/u.test(s.char));
  const bad = letters.filter((s) =>
    ["X_1", "X^2", "2X x", "X_{n+1}"].some(
      (t) => read(display, t.replace("X", s.char)) !== read(display, t.replace("X", s.command)),
    ),
  );
  expect(bad.map((s) => s.char)).toEqual([]);
});

test("each is written as itself, and reads back to what was written", () => {
  const unwritten: string[] = [];
  const lost: string[] = [];
  for (const s of symbols) {
    const written = display.parse(template(s, s.command));
    if (written === null) continue;
    const tex = display.serialize(written);
    const plain = commandForm.serialize(written);
    // Where the command form uses the command, the Unicode form uses the character.
    if (plain.includes(s.command) && !tex.includes(s.char)) unwritten.push(`${s.char}: ${tex}`);
    // And wherever the command form reads back to what was written, so does this.
    if (read(commandForm, plain) === JSON.stringify(written) && read(display, tex) !== JSON.stringify(written)) {
      lost.push(`${s.char}: ${tex}`);
    }
  }
  expect(unwritten).toEqual([]);
  expect(lost).toEqual([]);
});

test("KaTeX typesets each, in strict mode", () => {
  const bad: string[] = [];
  for (const s of symbols) {
    const tex = display.serialize(display.parse(template(s, s.command))!);
    try {
      katex.renderToString(tex, { throwOnError: true, strict: katexStrict("error") });
    } catch (e) {
      bad.push(`${s.char}: ${(e as Error).message}`);
    }
  }
  expect(bad).toEqual([]);
});

test("MathLive reads each as its command", () => {
  const bad = symbols.filter(
    (s) => convertLatexToMathMl(template(s, s.char)) !== convertLatexToMathMl(template(s, s.command)),
  );
  expect(bad.map((s) => s.char)).toEqual([]);
});

test("the shared routes write them: an expression's latex and a symbol's name", () => {
  const ce = new ComputeEngine({ latexSyntax: display });
  expect(ce.box(["Add", "omega", "alpha"]).latex).not.toMatch(/\\(omega|alpha)/);
  expect(ce.box(["LessEqual", "x", "y"]).latex).toBe("x≤y");
  expect(ce.parse("ω ≤ ∞").json).toEqual(ce.parse("\\omega \\le \\infty").json);
});

test("text is left as written", () => {
  expect(unicodeTeX("\\text{a $\\pi$}\\pi")).toBe("\\text{a $\\pi$}π");
  expect(commandTeX("\\text{α ≤ β}+α")).toBe("\\text{α ≤ β}+\\alpha ");
  expect(unicodeTeX("\\\\omega \\omega x")).toBe("\\\\omega ωx");
  expect(unicodeTeX("\\log\\Gamma(x)\\alpha\\beta")).toBe("\\log Γ(x)αβ");
});

test("a blackboard set is written as Unicode only once compute-engine reads it", () => {
  const plain = new LatexSyntax();
  const landed = read(plain, "x\\in ℝ") === read(plain, "x\\in \\mathbb{R}");
  expect(symbols.some((s) => s.char === "ℝ")).toBe(landed);
});
