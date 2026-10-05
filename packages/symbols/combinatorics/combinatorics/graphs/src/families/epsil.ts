// Graph-area families defined in Epsil. The edges of K_n are numbered 1..C(n, 2) in lex order of
// their pairs (u < v); a graph or orientation is then a number read off that index space. Their TS
// kernels (core.ts) stay exported: the independent reading the agreement tests check these against,
// and the `fast` path where wired.
import type { EpsilFamily } from "../../../collections/src/families/epsil.ts";
import {
  add,
  all,
  and,
  at,
  cell,
  choose,
  colexDigits,
  equal,
  fold,
  iff,
  len,
  less,
  lets,
  map,
  pascalTable,
  quotient,
  sub,
  upTo,
} from "../../../collections/src/families/tables.ts";

type MathJSON = unknown;

const list = (...xs: MathJSON[]): MathJSON => ["List", ...xs];
const pow = (a: MathJSON, b: MathJSON): MathJSON => ["Power", a, b];

/** C(n, 2): the edges of K_n. */
const edges: MathJSON = choose("_n", 2);

/** The index of the first edge whose smaller vertex is u: the edges of the rows before it. */
const rowStart = (u: MathJSON): MathJSON => sub(edges, choose(add(sub("_n", u), 1), 2));

/** The index of the edge {a, b}, a < b. */
const edgeIndex = (a: MathJSON, b: MathJSON): MathJSON => add(rowStart(a), sub(b, a));

/** Entry j of `_x` as a pair [a, b], read as the edge {min, max}. */
const pairA = (j: MathJSON): MathJSON => at(at("_x", j), 1);
const pairB = (j: MathJSON): MathJSON => at(at("_x", j), 2);
const indexOfPair = (j: MathJSON): MathJSON => edgeIndex(["Min", pairA(j), pairB(j)], ["Max", pairA(j), pairB(j)]);

/** The smaller vertex of each edge in index order, as a list: row u of K_n repeats u, n − u times.
 *  Edge k is then [u, u + (k − rowStart(u))]. */
const firstVertices: MathJSON = fold(
  ["Join", "et", map("eu", "ez", upTo(1, sub("_n", "eu")))],
  "et",
  "eu",
  list(),
  upTo(1, sub("_n", 1)),
);

/** The pair of edge `k` (any expression), reversed when `flip` holds. */
const pairAt = (tag: string, k: MathJSON, flip: MathJSON = "False"): MathJSON => {
  const [edge, u, v] = [`${tag}_k`, `${tag}_u`, `${tag}_v`];
  return lets(
    [
      [edge, k, "integer"],
      [u, at("_tables", edge), "integer"],
      [v, add(sub(edge, rowStart(u)), u), "integer"],
    ],
    iff(flip, list(v, u), list(u, v)),
  );
};

/** Whether `_x` lists pairs of distinct vertices of 1..n, no edge twice (in any order), `size` of them when given. */
const edgeList = (...size: MathJSON[]): MathJSON =>
  iff(
    and(
      ...size.map((count) => equal(len, count)),
      all((j) => equal(["Length", at("_x", j)], 2), upTo(1, len), "wp"),
    ),
    and(
      all(
        (j) =>
          and(
            ["LessEqual", 1, pairA(j)],
            ["LessEqual", pairA(j), "_n"],
            ["LessEqual", 1, pairB(j)],
            ["LessEqual", pairB(j), "_n"],
            ["NotEqual", pairA(j), pairB(j)],
          ),
        upTo(1, len),
        "wb",
      ),
      all(
        (j) => all((i) => ["NotEqual", indexOfPair(i), indexOfPair(j)], upTo(1, sub(j, 1)), "wi"),
        upTo(1, len),
        "wj",
      ),
    ),
    "False",
  );

// ─── Tournaments(n): an orientation of each edge, the edges' bits read as a binary number with
// edge 1 most significant; a 1 reverses the edge to [larger, smaller]. ─────────────────────────────
export const tournaments: EpsilFamily = {
  head: "Tournaments",
  carrier: "Tournament",
  carrierParams: 1,
  paramCount: 1,
  kind: "blocks",
  params: ["_n"],
  epsil: {
    tables: firstVertices,
    count: pow(2, edges),
    unrank: map(
      pairAt("tu", "tk", equal(["Mod", quotient("_r", pow(2, sub(edges, "tk"))), 2], 1)),
      "tk",
      upTo(1, edges),
    ),
    rank: fold(
      add("ra", iff(less(pairB("rj"), pairA("rj")), pow(2, sub(edges, indexOfPair("rj"))), 0)),
      "ra",
      "rj",
      0,
      upTo(1, len),
    ),
    valid: edgeList(edges),
  },
};

// ─── LabeledGraphs(n): the edges present, ascending; edge k is present iff bit k − 1 of the rank is set. ─
export const labeledGraphs: EpsilFamily = {
  head: "LabeledGraphs",
  carrier: "LabeledGraph",
  carrierParams: 1,
  paramCount: 1,
  kind: "blocks",
  params: ["_n"],
  epsil: {
    tables: firstVertices,
    count: pow(2, edges),
    unrank: map(pairAt("gu", "gk"), "gk", [
      "Filter",
      upTo(1, edges),
      ["Function", equal(["Mod", quotient("_r", pow(2, sub("gb", 1))), 2], 1), "gb"],
    ]),
    rank: fold(add("ga", pow(2, sub(indexOfPair("gj"), 1))), "ga", "gj", 0, upTo(1, len)),
    valid: edgeList(),
  },
};

// ─── LabeledGraphsByEdges(n, m): the m present edges, ascending, in colex order of their indices
// (the combinatorial number system: rank = Σ C(index_i − 1, i)). The binomials are one table of
// Pascal's triangle after the edge map, since C(c, i) runs past 2^53 for m near C(n, 2) while the
// count stays small. ───────────────────────────────────────────────────────────────────────────────
const pascalWidth = add(["Max", 0, ["Min", "_m", edges]], 1);
const pascal = cell("_tables", pascalWidth, edges);

export const labeledGraphsByEdges: EpsilFamily = {
  head: "LabeledGraphsByEdges",
  carrier: "LabeledGraph",
  carrierParams: 1,
  paramCount: 2,
  kind: "blocks",
  params: ["_n", "_m"],
  epsil: {
    tables: ["Join", firstVertices, pascalTable("bp", ["Max", edges, 1], pascalWidth)],
    count: choose(edges, "_m"),
    unrank: lets(
      [["bd", colexDigits("bd", "_m", edges, pascal), "list<integer>"]],
      map(pairAt("bu", add(at("bd", add("bi", 1)), 1)), "bi", upTo(1, "_m")),
    ),
    rank: lets(
      [["bx", ["Sort", map(indexOfPair("bj"), "bj", upTo(1, len))], "list<integer>"]],
      fold(add("br", pascal(sub(at("bx", "bi"), 1), "bi")), "br", "bi", 0, upTo(1, len)),
    ),
    valid: edgeList("_m"),
  },
};
