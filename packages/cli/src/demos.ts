// A corpus of terminal sessions. Each demo is a sequence of input lines that a
// fresh REPL evaluates in order. The corpus drives the golden snapshot tests
// (every line's styled output is captured) and the docs terminal (grouped by
// `category` into a dropdown). The default syntax is Epsil, rendered back as
// notatio (the restricted subset) — parens, `^`, `/`, capitalized heads, and `$…$`
// islands for LaTeX. Keep every
// line browser-safe — no :export / :import (those need the Node host).

export interface Demo {
  /** Stable id (snapshot key, docs anchor). */
  id: string;
  title: string;
  description?: string;
  /** Group label for the docs dropdown. */
  category: string;
  /** Input lines, fed to the REPL in order against one shared session. */
  lines: string[];
  tags?: readonly string[];
  /** Surface this demo as a featured example. */
  highlight?: boolean;
}

export const DEMOS: readonly Demo[] = [
  // --- Basics -------------------------------------------------------------
  {
    id: "arithmetic",
    title: "Arithmetic & exact values",
    description: "Epsil is the default; results stay exact.",
    category: "Basics",
    lines: ["2 + 2", "1/2 + 1/3", "2^10", "Sqrt(144)"],
    tags: ["basics"],
    highlight: true,
  },
  {
    id: "big-numbers",
    title: "Arbitrary precision",
    description: "Exact big integers and rationals — no float rounding.",
    category: "Basics",
    lines: ["3^40", "Factorial(25)", "22/7 - Pi"],
    tags: ["basics"],
  },
  {
    id: "constants",
    title: "Constants & identities",
    description: "Euler's identity, exact trig.",
    category: "Basics",
    lines: ["e^(i*Pi)", "Cos(Pi/3)", "Ln(e^2)"],
    tags: ["basics"],
  },
  {
    id: "symbolic",
    title: "Symbolic expressions",
    description: "Unbound symbols stay symbolic.",
    category: "Basics",
    lines: ["x^2 + 2x + 1", "Sin(x)^2 + Cos(x)^2", "(x + 1)*(x - 1)"],
    tags: ["basics", "symbolic"],
  },
  {
    id: "number-theory",
    title: "Number theory",
    description: "GCD, totient, modular arithmetic.",
    category: "Basics",
    lines: ["GCD(48, 60)", "Totient(36)", "Mod(2^10, 7)"],
    tags: ["basics", "number-theory"],
  },

  // --- Calculus (LaTeX islands) -------------------------------------------
  {
    id: "calculus",
    title: "Calculus via $…$ islands",
    description: "Wrap LaTeX in $…$ for derivatives, integrals, sums, limits.",
    category: "Calculus",
    lines: [
      "$\\frac{d}{dx}(x^3 + 2x)$",
      "$\\int_0^1 x^2 dx$",
      "$\\sum_{k=1}^{10} k^2$",
      "$\\lim_{x\\to 0} \\frac{\\sin x}{x}$",
    ],
    tags: ["calculus", "latex"],
    highlight: true,
  },

  // --- Combinatorics ------------------------------------------------------
  {
    id: "binomial",
    title: "Binomial coefficients",
    category: "Combinatorics",
    lines: ["Binomial(10, 3)", "Binomial(52, 5)", "$\\binom{10}{3}$"],
    tags: ["combinatorics"],
    highlight: true,
  },
  {
    id: "counting-sequences",
    title: "Counting sequences",
    description: "Fibonacci, Lucas, Catalan, Stirling.",
    category: "Combinatorics",
    lines: ["Fibonacci(20)", "LucasL(10)", "CatalanNumber(8)", "Stirling(6, 3)"],
    tags: ["combinatorics"],
    highlight: true,
  },
  {
    id: "multinomial",
    title: "Factorials & multinomials",
    category: "Combinatorics",
    lines: ["Factorial(8)", "Multinomial(2, 3, 4)"],
    tags: ["combinatorics"],
  },

  // --- Permutation statistics --------------------------------------------
  {
    id: "perm-stats",
    title: "Inversions, descents, major index",
    description: "The enumeratio permutation-statistic heads — lists are [ … ].",
    category: "Permutation statistics",
    lines: ["Inversions([3, 1, 2])", "Descents([2, 4, 1, 3])", "MajorIndex([2, 4, 1, 3])"],
    tags: ["combinatorics", "enumeratio"],
    highlight: true,
  },
  {
    id: "perm-stats-more",
    title: "Ascents, excedances, fixed points",
    category: "Permutation statistics",
    // Ascents compares entries with each other, so a bare list is a fair question. Excedances
    // and FixedPoints compare a value with its POSITION, so they need the permutation.
    lines: ["Ascents([1, 3, 2, 5, 4])", "Excedances(Permutations([3, 1, 2]))", "FixedPoints(Permutations([1, 3, 2]))"],
    tags: ["combinatorics", "enumeratio"],
  },

  // --- Input syntaxes -----------------------------------------------------
  {
    id: "syntaxes",
    title: "Epsil, LaTeX islands, and pragmas",
    description: "Epsil is the default; $…$ embeds LaTeX; :latex / :wolfram / :mathjson force a syntax.",
    category: "Syntaxes",
    lines: [
      "Binomial(10, 3)",
      "$\\binom{10}{3}$",
      ":latex \\binom{10}{3}",
      ":wolfram Binomial[10, 3]",
      ':mathjson ["Binomial", 10, 3]',
    ],
    tags: ["syntax"],
    highlight: true,
  },
  {
    id: "islands",
    title: "Mixing Epsil and LaTeX",
    description: "A $…$ island drops LaTeX into an otherwise-Epsil line.",
    category: "Syntaxes",
    lines: ["Binomial(10, 3) + $\\frac{1}{2}$", "2 * $\\sqrt{2}$"],
    tags: ["syntax", "latex"],
  },
  {
    id: "input-mode",
    title: "Switch the default syntax",
    description: ":in changes the default so a whole session can be LaTeX (or Wolfram).",
    category: "Syntaxes",
    lines: [":in latex", "\\binom{6}{2}", "\\frac{1}{2} + \\frac{1}{3}", ":in epsil", "Binomial(6, 2)"],
    tags: ["syntax"],
  },

  // --- Output forms -------------------------------------------------------
  {
    id: "forms",
    title: "Output forms",
    description: "The same expression as notatio (Epsil), TeX, Wolfram, NumPy, JS.",
    category: "Output forms",
    lines: [
      "x^2 + 1",
      ":form tex",
      "x^2 + 1",
      ":form wolfram",
      "x^2 + 1",
      ":form numpy",
      "x^2 + 1",
      ":form js",
      "x^2 + 1",
      ":form notatio",
    ],
    tags: ["forms"],
    highlight: true,
  },
  {
    id: "compile-targets",
    title: "Compile a function",
    description: "Numeric expressions compile to real source.",
    category: "Output forms",
    lines: [
      ":form numpy",
      "Sqrt(x^2 + 1)",
      ":form glsl",
      "Sin(x) * Cos(x)",
      ":form wgsl",
      "Sin(x) * Cos(x)",
      ":form notatio",
    ],
    tags: ["forms", "compile"],
  },

  // --- Session ------------------------------------------------------------
  {
    id: "history",
    title: "Result history with Out",
    description: "Out(-1) is the last result, Out(-2) the one before, Out(n) the n-th.",
    category: "Session",
    lines: ["1/2", "Out(-1) * 6", "Out(-1) + 1", "Out(1) + Out(2)"],
    tags: ["history"],
    highlight: true,
  },
  {
    id: "history-refs",
    title: "Reference earlier lines by number",
    description:
      "Out(n) is the n-th result and %n its shorthand; In(n) RE-EVALUATES the n-th input, as Wolfram's delayed In[n] does; InString(n) is the line as typed. A negative index counts back from the last.",
    category: "Session",
    lines: ["Binomial(10, 3)", "Out(1) + 1", "InString(1)", "In(1) / 2", "Out(-1)"],
    tags: ["history"],
  },
  {
    id: "variables",
    title: "Variables with let",
    description: "Bind a name; later lines resolve it; :vars lists them.",
    category: "Session",
    lines: ["let n = 5", "Factorial(n)", "let r = 2", "Binomial(n, r)", ":vars"],
    tags: ["variables"],
    highlight: true,
  },

  // --- Graphics -----------------------------------------------------------
  {
    id: "glyph-permutation",
    title: "Glyph: permutation matrix",
    category: "Graphics",
    lines: [":glyph permutation [3, 1, 4, 2]"],
    tags: ["graphics", "glyph"],
    highlight: true,
  },
  {
    id: "glyph-partition",
    title: "Glyph: Ferrers diagram",
    category: "Graphics",
    lines: [":glyph partition [5, 3, 3, 1]"],
    tags: ["graphics", "glyph"],
    highlight: true,
  },
  {
    id: "glyph-composition",
    title: "Glyph: composition",
    category: "Graphics",
    lines: [":glyph composition [2, 1, 3, 1]"],
    tags: ["graphics", "glyph"],
  },
  {
    id: "glyph-subset",
    title: "Glyph: subset",
    category: "Graphics",
    lines: [":glyph subset [1, 3, 4]"],
    tags: ["graphics", "glyph"],
  },
  {
    id: "glyph-dyck",
    title: "Glyph: Dyck path",
    category: "Graphics",
    lines: [":glyph dyck [1, 1, 0, 1, 0, 0]"],
    tags: ["graphics", "glyph"],
  },
  {
    id: "plot",
    title: "Plot a polynomial",
    description: "Sampled over x ∈ [-5, 5]; drawn below the terminal.",
    category: "Graphics",
    lines: [":plot x^2 - 3"],
    tags: ["graphics", "plot"],
    highlight: true,
  },
  {
    id: "plot-trig",
    title: "Plot trig & rational",
    category: "Graphics",
    lines: [":plot Sin(x)", ":plot 1/x"],
    tags: ["graphics", "plot"],
  },

  // --- Environments -------------------------------------------------------
  {
    id: "environment-pin",
    title: "A control with nothing to drive it",
    description:
      ":env says where the result is going. A pipe or a page cannot move a slider, so the control pins and its declaration becomes a caption.",
    category: "Environments",
    lines: [":env pipe", "Manipulate(a^2 + b, (a, 0, 1), ((b, 2), 0, 3))", ":env auto"],
    tags: ["environments"],
    highlight: true,
  },
  {
    id: "environment-sample",
    title: "A slider printed as small multiples",
    description:
      "Print samples the first control on its step grid instead of pinning it -- the page-native reading of a slider.",
    category: "Environments",
    lines: [
      ":env print",
      "Manipulate(a * x, (a, 1, 3, 1))",
      'Toggler(size, ["a few", "several", "many"])',
      ":env auto",
    ],
    tags: ["environments"],
  },
  {
    id: "environment-static-option",
    title: "The expression can say which reading it wants",
    description:
      'Static -> "Pin", "Sample", or a count of samples, as a trailing rule on the control or its Manipulate.',
    category: "Environments",
    lines: [
      ":env print",
      'Manipulate(a^2, (a, 0, 1), Static -> "Pin")',
      "Manipulate(a^2, (a, 0, 1), Static -> 3)",
      ":env auto",
    ],
    tags: ["environments"],
  },

  // --- Formats ------------------------------------------------------------
  {
    id: "formats-registry",
    title: "The format registry",
    description: ":formats lists every format; :mime is MIMETypeToFormatList.",
    category: "Formats",
    lines: [":formats", ":mime image/png", ":mime application/json"],
    tags: ["formats"],
  },

  // --- Errors -------------------------------------------------------------
  {
    id: "errors",
    title: "Errors are caught",
    description: "A bad line reports the error and the session continues.",
    category: "Errors",
    lines: ["1 +", "\\binom{10}{3}", "1 + 1"],
    tags: ["errors"],
  },
];

/** The subset featured as quick examples (e.g. inline in the docs). */
export const HIGHLIGHTED: readonly Demo[] = DEMOS.filter((d) => d.highlight);

// A command-line demo is a sequence of `notatio` invocations — the args typed
// after a `$ notatio ` prompt. Same shape as Demo (`lines`) so one terminal can
// replay either corpus; each line here is the argv part, not the whole shell.
export const CLI_DEMOS: readonly Demo[] = [
  {
    id: "cli-evaluate",
    title: "Evaluate an expression",
    description: "Epsil in, exact result out.",
    category: "Evaluate",
    lines: ['"Binomial(10, 3)"', '"1/2 + 1/3"', '"Fibonacci(20)"'],
  },
  {
    id: "cli-environments",
    title: "Reduce for where it is going",
    description:
      "Text on stdout is a pipe: a control pins, with its range in the caption. --env print samples it into small multiples instead; --json keeps the expression whole.",
    category: "Environments",
    lines: [
      '"Manipulate(a^2 + b, (a, 0, 1), ((b, 2), 0, 3))"',
      '--env print "Manipulate(a * x, (a, 1, 3, 1))"',
      '--env web "Manipulate(a^2, (a, 0, 1))"',
    ],
  },
  {
    id: "cli-forms",
    title: "Pick an output form",
    description: "-f / --form compiles to a target language.",
    category: "Output forms",
    lines: ['-f wolfram "x^2 + 1"', '-f numpy "Sqrt(x^2 + 1)"', '-f js "Sin(x) + 1"', '-f glsl "Sin(x) * Cos(x)"'],
  },
  {
    id: "cli-wolfram-form-names",
    title: "Wolfram form names",
    description: "The *Form symbols resolve too, and -f repeats for several forms at once.",
    category: "Output forms",
    lines: ['-f TeXForm "1/2 + 1/3"', '-f FullForm "x^2 + 1"', '-f InputForm -f tex -f wolfram "Sqrt(2)"'],
  },
  {
    id: "cli-json",
    title: "Structured output",
    description: "--json prints { ok, input, syntax, form, result, forms } for scripts to parse.",
    category: "Output forms",
    lines: ['--json "Binomial(10, 3)"', '--json -f tex "1/3"', '--json "1 +"'],
  },
  {
    id: "cli-convert",
    title: "Convert without evaluating",
    description: "convert re-renders the expression as written.",
    category: "Subcommands",
    lines: [
      'convert -i wolfram -f tex "Binomial[10, 3]"',
      'convert -f wolfram "Binomial(10, 3) + 1"',
      'eval -f wolfram "Binomial(10, 3) + 1"',
    ],
  },
  {
    id: "cli-numeric",
    title: "Numeric approximation",
    description: "-N asks for a number; -p sets the working precision.",
    category: "Subcommands",
    lines: ['-N "Pi + Sqrt(2)"', '-N -p 8 "Pi"', '"Pi + Sqrt(2)"'],
  },
  {
    id: "cli-lists",
    title: "Forms and formats",
    description: "forms lists the output forms; formats the registry (--json for data).",
    category: "Subcommands",
    lines: ["forms", "forms --json", "completion zsh"],
  },
  {
    id: "cli-syntaxes",
    title: "Choose the input syntax",
    description: "-i / --in sets the input syntax; Epsil is the default.",
    category: "Input syntaxes",
    lines: ['-i latex "\\binom{10}{3}"', '-i wolfram "Inversions[List[3,1,2]]"'],
  },
  {
    id: "cli-errors",
    title: "Errors exit non-zero",
    description: "A bad expression prints to stderr and exits 1.",
    category: "Errors",
    lines: ['"1 +"'],
  },
  {
    id: "cli-help",
    title: "Help & version",
    category: "Help",
    lines: ["--help", "--version"],
  },
];

function groupByCategory(demos: readonly Demo[]): { category: string; demos: Demo[] }[] {
  const groups: { category: string; demos: Demo[] }[] = [];
  for (const demo of demos) {
    let group = groups.find((g) => g.category === demo.category);
    if (!group) {
      group = { category: demo.category, demos: [] };
      groups.push(group);
    }
    group.demos.push(demo);
  }
  return groups;
}

/** REPL demos grouped by category, preserving first-seen order — for a dropdown. */
export function demosByCategory(): { category: string; demos: Demo[] }[] {
  return groupByCategory(DEMOS);
}

/** Command-line demos grouped by category. */
export function cliDemosByCategory(): { category: string; demos: Demo[] }[] {
  return groupByCategory(CLI_DEMOS);
}
