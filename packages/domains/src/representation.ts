// Representations: how an element is WRITTEN, not what it is.
//
// This layer is modelled on enumeratio's `base_repr`, and reading that settled a question
// this project had got wrong. An earlier version of design/domains.md argued that one-line
// and cycle notation are two DOMAINS — different structures, related by a bijection.
// enumeratio says otherwise, and it is right:
//
//   ('permutations','oneline','one_line','One-line notation',        true,  'perm_from_oneline')
//   ('permutations','cycle',  'perm_cycles','Cycle notation',        false, 'perm_from_cycles')
//   ('permutations','dense',  'perm_oneline_dense','Dense base-36 …',false, 'perm_from_oneline_dense')
//
// One carrier, several representations, each a render function with a parse inverse, exactly
// one marked canonical. The VALUE is the same permutation either way; only the text differs.
//
// That distinction matters because enumeratio has a separate mechanism for the case where the
// structure really does differ — a SIBLING COLLECTION over its own carrier, related by an
// order isomorphism. Cycle notation is not that. Conflating the two would have produced a
// second permutation domain that nothing needs, and every permutation statistic would have
// had to be declared twice.
//
// Render and parse are TypeScript, not expressions, and deliberately so: this is presentation,
// not mathematics. enumeratio makes the same call — `render_fn` is a plpgsql function, not
// data — and the definitions-as-data argument (namespaces.md §6) is about mathematical
// content. Formatting a list as `(1 2 3)(4 5)` has no theorem in it.

/** Which writing system a representation targets. */
export type Medium = "unicode" | "latex" | "ascii";

export interface Representation {
  /**
   * Whether `parse(render(x))` recovers `x` when the text stands ALONE, with no surrounding
   * declaration of what it should be.
   *
   * Almost no conventional notation does. Measured, not assumed:
   *
   *   2\,3\,1        parses as the NUMBER 231
   *   (1\,2\,3)      parses as 123 — LaTeX parentheses are grouping, not cycle structure
   *   \perm(2, 3, 1)  parses as the permutation
   *
   * So reading notation and round-tripping notation are different goals. A representation is
   * for a person; recovering the value needs either a trigger or a typed context that says
   * what to expect. `ParseAs` supplies that context explicitly, which is why the ascii
   * representations round-trip through it even though they would not stand alone.
   */
  readonly roundTripsAlone?: boolean;
  /** The carrier type this writes — `permutation`, `integer_partition`, … */
  readonly on: string;
  /** The representation's name, unique per (carrier, medium). */
  readonly name: string;
  readonly medium: Medium;
  /** Exactly one representation per (carrier, medium) is canonical. */
  readonly canonical?: boolean;
  readonly title: string;
  /** Element contents to text. */
  readonly render: (contents: readonly number[]) => string;
  /** Text back to element contents. Omitted when the representation is lossy — and a
   *  representation WITHOUT a parse is worth noticing, since it cannot be round-tripped. */
  readonly parse?: (text: string) => number[] | undefined;
}

/** Cycles of a permutation, each starting at its least element, in order of least element —
 *  including fixed points, which is what makes the notation reversible without knowing n. */
function cyclesOf(image: readonly number[]): number[][] {
  const seen = Array.from({ length: image.length }, (): boolean => false);
  const cycles: number[][] = [];
  for (let start = 0; start < image.length; start++) {
    if (seen[start]) continue;
    const cycle: number[] = [];
    let at = start;
    do {
      seen[at] = true;
      cycle.push(at + 1);
      at = image[at]! - 1;
    } while (at !== start);
    cycles.push(cycle);
  }
  return cycles;
}

const BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";

export const REPRESENTATIONS: readonly Representation[] = [
  {
    on: "permutation",
    name: "oneline",
    medium: "ascii",
    canonical: true,
    title: "One-line notation",
    render: (image) => image.join(" "),
    parse: (text) => {
      const trimmed = text.trim();
      if (trimmed === "") return [];
      const parts = trimmed.split(/\s+/).map(Number);
      return parts.every((v) => Number.isInteger(v) && v >= 1) ? parts : undefined;
    },
  },
  {
    on: "permutation",
    name: "cycle",
    medium: "ascii",
    title: "Cycle notation",
    render: (image) =>
      cyclesOf(image)
        .map((cycle) => `(${cycle.join(" ")})`)
        .join(""),
    parse: (text) => {
      const groups = [...text.matchAll(/\(([^)]*)\)/g)].map((match) =>
        match[1]!.trim() === "" ? [] : match[1]!.trim().split(/\s+/).map(Number),
      );
      if (groups.length === 0) return text.trim() === "" ? [] : undefined;
      const size = Math.max(...groups.flat());
      const image = Array.from({ length: size }, (): number => 0);
      for (const cycle of groups)
        for (const [index, entry] of cycle.entries())
          image[entry - 1] = cycle[(index + 1) % cycle.length]!;
      return image.every((v) => v >= 1) ? image : undefined;
    },
  },
  {
    on: "permutation",
    name: "dense",
    medium: "ascii",
    title: "Dense base-36 one-line notation",
    render: (image) => image.map((v) => BASE36[v] ?? "?").join(""),
    // Reversible only up to 35 entries, which is the point of the name.
    parse: (text) => {
      const digits = Array.from(text.trim(), (ch) => BASE36.indexOf(ch));
      return digits.every((v) => v >= 1) ? digits : undefined;
    },
  },
  {
    on: "integer_partition",
    name: "parts",
    medium: "ascii",
    canonical: true,
    title: "Parts, largest first",
    render: (parts) => parts.join(" + "),
    parse: (text) => (text.trim() === "" ? [] : text.split("+").map((part) => Number(part.trim()))),
  },
  {
    on: "integer_partition",
    name: "exponential",
    medium: "ascii",
    title: "Exponential notation, e.g. 3^2 1",
    render: (parts) => {
      const runs: [number, number][] = [];
      for (const part of parts) {
        const last = runs.at(-1);
        if (last && last[0] === part) last[1]++;
        else runs.push([part, 1]);
      }
      return runs.map(([part, count]) => (count === 1 ? `${part}` : `${part}^${count}`)).join(" ");
    },
    parse: (text) => {
      if (text.trim() === "") return [];
      const parts: number[] = [];
      for (const token of text.trim().split(/\s+/)) {
        const [part, count = "1"] = token.split("^");
        for (let i = 0; i < Number(count); i++) parts.push(Number(part));
      }
      return parts;
    },
  },
  {
    on: "dyck_path",
    name: "parens",
    medium: "ascii",
    canonical: true,
    title: "Balanced parentheses",
    render: (steps) => steps.map((step) => (step === 1 ? "(" : ")")).join(""),
    parse: (text) => Array.from(text.trim(), (ch) => (ch === "(" ? 1 : 0)),
  },
];

/** Index by carrier and name — the lookup `Render` and `ParseAs` do. */
export function representationsFor(
  carrier: string,
  representations: readonly Representation[] = ALL_REPRESENTATIONS,
): Representation[] {
  return representations.filter((representation) => representation.on === carrier);
}

/** The canonical representation of a carrier in a medium, if one is declared. */
export const canonicalFor = (
  carrier: string,
  medium: Medium = "ascii",
  representations: readonly Representation[] = ALL_REPRESENTATIONS,
): Representation | undefined =>
  representations.find((r) => r.on === carrier && r.medium === medium && r.canonical === true);

// ── LaTeX ────────────────────────────────────────────────────────────────────────────────
//
// The same values, written for a reader. None of these round-trip alone (see
// `roundTripsAlone`), which is exactly why the engine's own serialisation uses a triggered
// form instead — see `latex.ts`.

const TIMES = "\\,";

/** LaTeX representations, added to the registry above. */
export const LATEX_REPRESENTATIONS: readonly Representation[] = [
  {
    on: "permutation",
    name: "oneline",
    medium: "latex",
    canonical: true,
    title: "One-line notation",
    render: (image) => image.join(TIMES),
  },
  {
    on: "permutation",
    name: "cycle",
    medium: "latex",
    title: "Cycle notation",
    render: (image) =>
      cyclesOf(image)
        .map((cycle) => `(${cycle.join(TIMES)})`)
        .join(""),
  },
  {
    on: "integer_partition",
    name: "parts",
    medium: "latex",
    canonical: true,
    title: "Parts, largest first",
    render: (parts) => parts.join(" + "),
  },
  {
    on: "integer_partition",
    name: "exponential",
    medium: "latex",
    title: "Exponential notation",
    render: (parts) => {
      const runs: [number, number][] = [];
      for (const part of parts) {
        const last = runs.at(-1);
        if (last && last[0] === part) last[1]++;
        else runs.push([part, 1]);
      }
      return runs
        .map(([part, count]) => (count === 1 ? `${part}` : `${part}^{${count}}`))
        .join(TIMES);
    },
  },
  {
    on: "integer_partition",
    name: "young",
    medium: "latex",
    title: "Young diagram row lengths",
    render: (parts) => `\\lambda = (${parts.join(", ")})`,
  },
  {
    on: "dyck_path",
    name: "parens",
    medium: "latex",
    canonical: true,
    title: "Balanced parentheses",
    render: (steps) => `\\mathtt{${steps.map((step) => (step === 1 ? "(" : ")")).join("")}}`,
  },
];

/** Every representation, ascii and latex. */
export const ALL_REPRESENTATIONS: readonly Representation[] = [
  ...REPRESENTATIONS,
  ...LATEX_REPRESENTATIONS,
];
