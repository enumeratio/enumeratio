// Example ids (design/examples-as-data.md §3). An id is data: assigned once, from the
// caption, and kept when the caption or `expr` changes. These helpers pick a fresh one.

export const EXAMPLE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const EXAMPLE_ID_MAX = 48;

const GREEK: Readonly<Record<string, string>> = {
  α: "alpha",
  β: "beta",
  γ: "gamma",
  δ: "delta",
  ε: "epsilon",
  ζ: "zeta",
  η: "eta",
  θ: "theta",
  ι: "iota",
  κ: "kappa",
  λ: "lambda",
  μ: "mu",
  ν: "nu",
  ξ: "xi",
  π: "pi",
  ρ: "rho",
  σ: "sigma",
  τ: "tau",
  φ: "phi",
  χ: "chi",
  ψ: "psi",
  ω: "omega",
  Γ: "gamma",
  Δ: "delta",
  Θ: "theta",
  Λ: "lambda",
  Π: "pi",
  Σ: "sigma",
  Φ: "phi",
  Ψ: "psi",
  Ω: "omega",
  ℤ: "z",
  ℚ: "q",
  ℝ: "r",
  ℂ: "c",
  ℕ: "n",
  "∞": "infinity",
  "√": "sqrt",
  "∑": "sum",
};

// TeX commands that only style what follows; any other keeps its name (`\sqrt` → sqrt).
const STYLING =
  /\\(operatorname|mathrm|mathbf|mathbb|mathcal|mathit|text|textrm|left|right|displaystyle|[lc]?dots|quad|qquad|[,;:!])(?![a-zA-Z])/g;

/** Words, lowercase, dash-joined, cut at a word boundary to `EXAMPLE_ID_MAX`. */
export const slugId = (text: string): string => {
  const words = Array.from(text.normalize("NFKD"), (c) => GREEK[c] ?? c)
    .join("")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let out = "";
  for (const w of words) {
    const next = out === "" ? w : `${out}-${w}`;
    if (next.length > EXAMPLE_ID_MAX) return out === "" ? w.slice(0, EXAMPLE_ID_MAX) : out;
    out = next;
  }
  return out;
};

/** A caption's id: its prose and the names in its TeX, `[[Links]]` unwrapped. */
export const captionId = (caption: string): string =>
  slugId(
    caption
      .replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, "$1")
      .replace(STYLING, " ")
      .replace(/\\[td]frac(?![a-zA-Z])/g, " frac ")
      .replace(/\\([a-zA-Z]+)/g, " $1 "),
  );

/** `base`, or `base-2`, `base-3`… — whichever `taken` hasn't got; records the pick. */
export const dedupeId = (base: string, taken: Set<string>): string => {
  let id = base;
  for (let n = 2; taken.has(id); n++) {
    const suffix = `-${n}`;
    id = `${base.slice(0, EXAMPLE_ID_MAX - suffix.length).replace(/-+$/, "")}${suffix}`;
  }
  taken.add(id);
  return id;
};
