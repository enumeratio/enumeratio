import { expect, test } from "vite-plus/test";
import { evaluateCommand, runCommand } from "../src/browser.ts";

const run = (argv: string[], stdin?: string) => runCommand(argv, stdin);

test("evaluates an Epsil expression by default", () => {
  expect(run(["Binomial(10, 3)"])).toEqual({ stdout: "120\n", stderr: "", code: 0 });
  expect(run(["1/2 + 1/3"]).stdout).toBe("5 / 6\n");
});

test("$…$ islands and :latex reach LaTeX; bare LaTeX is rejected", () => {
  expect(run(["$\\binom{10}{3}$"]).stdout).toBe("120\n");
  expect(run(["-i", "latex", "\\binom{10}{3}"]).stdout).toBe("120\n");
  expect(run(["\\binom{10}{3}"]).code).toBe(1); // bare LaTeX in Epsil
});

test("--form selects the output form (unambiguous prefix ok)", () => {
  expect(run(["--form", "wolfram", "x^2 + 1"]).stdout).toBe("Plus[Power[x, 2], 1]\n");
  expect(run(["-f", "numpy", "Sin(x)"]).stdout).toBe("np.sin(x)\n");
  expect(run(["-f", "wolf", "x^2 + 1"]).stdout).toBe("Plus[Power[x, 2], 1]\n");
});

test("--in selects the input syntax", () => {
  expect(run(["--in", "wolfram", "Binomial[10, 3]"]).stdout).toBe("120\n");
  expect(run(["-i", "epsil", "3 * 4 + 1"]).stdout).toBe("13\n");
});

test("reads the expression from stdin", () => {
  expect(run([], "2 + 40").stdout).toBe("42\n");
});

test("-c passes the expression explicitly", () => {
  expect(run(["-c", ":wl Inversions[List[3, 1, 2]]"]).stdout).toBe("2\n");
});

test("a bad expression exits non-zero with a message on stderr", () => {
  const r = run([":wl 1 +"]);
  expect(r.code).toBe(1);
  expect(r.stdout).toBe("");
  expect(r.stderr).toMatch(/error/);
});

test("unknown options and forms exit with code 2", () => {
  expect(run(["--form", "nope", "1"]).code).toBe(2);
  expect(run(["--bogus"]).code).toBe(2);
});

test("--help and --version", () => {
  const h = run(["--help"]);
  expect(h.code).toBe(0);
  expect(h.stdout).toMatch(/Usage:/);
  expect(run(["-V"]).stdout).toBe("0.0.0\n");
});

test("Wolfram *Form names resolve to forms", () => {
  expect(run(["-f", "TeXForm", "1/2 + 1/3"]).stdout).toBe("\\frac{5}{6}\n");
  expect(run(["-f", "FullForm", "x^2 + 1"]).stdout).toBe("Plus[Power[x, 2], 1]\n");
  expect(run(["-f", "InputForm", "x^2 + 1"]).stdout).toBe("x ^ 2 + 1\n");
  expect(run(["--form=StandardForm", "x^2 + 1"]).stdout).toBe("x ^ 2 + 1\n");
});

test("-f repeats: one line per form, in order", () => {
  expect(run(["-f", "tex", "-f", "wolfram", "Sqrt(2)"]).stdout).toBe("\\sqrt{2}\nSqrt[2]\n");
});

test("--json prints a structured reply on stdout, errors included", () => {
  const r = run(["--json", "Binomial(10, 3)"]);
  expect(r.code).toBe(0);
  expect(JSON.parse(r.stdout)).toEqual({
    ok: true,
    input: "Binomial(10, 3)",
    syntax: "epsil",
    form: "notatio",
    result: "120",
    forms: { notatio: "120", tex: "120", mathjson: 120, wolfram: "120" },
  });
  // named forms narrow the reply; mathjson is carried as JSON
  expect(JSON.parse(run(["--json", "-f", "mathjson", "1/3"]).stdout).forms).toEqual({
    mathjson: ["Rational", 1, 3],
  });
  const bad = run(["--json", "1 +"]);
  expect(bad.code).toBe(1);
  expect(bad.stderr).toBe("");
  expect(JSON.parse(bad.stdout)).toMatchObject({ ok: false, input: "1 +" });
});

test("stdin: implicit when no expression, explicit with -", () => {
  expect(run(["-f", "wolfram"], "x^2 + 1\n").stdout).toBe("Plus[Power[x, 2], 1]\n");
  expect(run(["-", "-f", "tex"], "1/3").stdout).toBe("\\frac{1}{3}\n");
  expect(run(["-"]).code).toBe(2); // - with nothing piped is a usage error
});

test("convert re-renders without evaluating; eval is the explicit default", () => {
  expect(run(["convert", "-i", "wolfram", "-f", "tex", "Binomial[10, 3]"]).stdout).toBe("\\binom{10}{3}\n");
  expect(run(["eval", "-i", "wolfram", "Binomial[10, 3]"]).stdout).toBe("120\n");
});

test("-N / --precision approximate numerically", () => {
  expect(run(["-N", "1/3"]).stdout).toMatch(/^0\.333/);
  expect(run(["--numeric", "--precision=8", "Pi"]).stdout).toMatch(/^3\.141_59/);
  expect(run(["-p", "zero", "1"]).code).toBe(2);
});

test("host defaults apply under the flags", () => {
  expect(runCommand(["x^2 + 1"], undefined, { form: "wolfram" }).stdout).toBe("Plus[Power[x, 2], 1]\n");
  expect(runCommand(["-f", "tex", "x^2 + 1"], undefined, { form: "wolfram" }).stdout).toBe("x^2+1\n");
  expect(runCommand(["Binomial[10, 3]"], undefined, { syntax: "wolfram" }).stdout).toBe("120\n");
});

test("forms / formats / completion subcommands", () => {
  expect(run(["forms"]).stdout).toMatch(/\* notatio/);
  expect(JSON.parse(run(["forms", "--json"]).stdout).map((f: { name: string }) => f.name)).toContain("wolfram");
  expect(JSON.parse(run(["formats", "--json"]).stdout).some((f: { name: string }) => f.name === "WL")).toBe(true);
  expect(run(["formats"]).stdout).toMatch(/WL/);
  for (const shell of ["bash", "zsh", "fish"]) {
    const r = run(["completion", shell]);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/wolfram/);
  }
  expect(run(["completion", "powershell"]).code).toBe(2);
});

test("evaluateCommand is the structured seam shared with serve", () => {
  const r = evaluateCommand({ input: "x^2 + 1", forms: ["wolfram", "js"] });
  expect(r.ok && r.result).toBe("Plus[Power[x, 2], 1]");
  expect(r.ok && r.forms.js).toMatch(/x/);
  // a secondary form that cannot render is left out, not fatal
  const s = evaluateCommand({ input: "Rule(x, 1)", forms: ["notatio", "glsl"] });
  expect(s.ok && Object.keys(s.forms)).toEqual(["notatio"]);
  expect(evaluateCommand({ input: "1 +" })).toMatchObject({ ok: false });
});
