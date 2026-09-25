import type { MathJSON, ReferenceEntry } from "../types.ts";

const DOMAIN = "Path algebras";
const A4: MathJSON = ["LinearQuiver", 4];
const P = (start: number, ...arrows: number[]): MathJSON => [
  "QuiverPath",
  start,
  ["List", ...arrows],
];

export const quiverAlgebras: readonly ReferenceEntry[] = [
  {
    name: "QuiverPath",
    domain: DOMAIN,
    signature: "QuiverPath(start, arrows)",
    summary:
      "A directed path in a quiver: where it starts, and the arrow indices it follows. The basis of the path algebra $kQ$, with one trivial path per vertex.",
    signatures: [
      {
        call: "QuiverPath(v, [])",
        description: "the trivial path at vertex $v$ — a local identity",
        library: "enumeratio-quiver",
      },
      {
        call: "QuiverPath(v, [i, j, …])",
        description: "the path from $v$ along arrows $i$, $j$, …",
        library: "enumeratio-quiver",
      },
    ],
    details: [
      "Arrows are indexed by position in the quiver's arrow list, so PARALLEL arrows are distinct basis elements",
      "Composition is [[QuiverCompose]], which needs the quiver: a path alone does not know which quiver it belongs to",
      "The trivial paths are local identities: $e_{\\text{start}}p = p = pe_{\\text{end}}$",
      "Quivers: `LinearQuiver(n)` ($A_n$), `JordanQuiver` (one loop), `KroneckerQuiver`, or `Quiver(n, [[from,to],…])`",
    ],
    examples: [
      {
        id: "from-vertex-1-along-two-arrows",
        expr: ["QuiverPathEnd", A4, P(1, 0, 1)],
        expected: 3,
        caption: "from vertex 1 along two arrows",
      },
      {
        id: "arrow-1-starts-at-vertex-2-so-this-is-not-a-path",
        expr: ["Element", P(1, 1), ["PathAlgebra", A4]],
        expected: "False",
        caption: "arrow 1 starts at vertex 2, so this is not a path",
        category: "Possible issues",
      },
      {
        id: "the-kronecker-quiver-two-trivial-paths-and-two",
        expr: [
          "AlgebraDimension",
          ["PathAlgebra", ["Quiver", 2, ["List", ["List", 1, 2], ["List", 1, 2]]]],
        ],
        expected: 4,
        caption: "the Kronecker quiver: two trivial paths and two distinct arrows",
        category: "Scope",
      },
    ],
    seeAlso: ["QuiverCompose", "QuiverIsAcyclic", "Basis"],
  },
  {
    name: "QuiverCompose",
    domain: DOMAIN,
    signature: "QuiverCompose(quiver, p, q)",
    summary:
      "Concatenate two paths — or zero, when $q$ does not start where $p$ ends. Most products in a path algebra are zero, and that is the structure rather than a failure.",
    signatures: [
      {
        call: "QuiverCompose(quiver, p, q)",
        description: "$p$ then $q$, or 0",
        library: "enumeratio-quiver",
      },
    ],
    details: [
      "Associative, and the trivial paths act as local identities",
      "Zero is an honest answer here — it is returned as 0, not left symbolic",
      "The quiver is an argument because a path carries no reference to its own quiver",
    ],
    examples: [
      {
        id: "1-to-2-then-2-to-3",
        expr: ["QuiverCompose", A4, P(1, 0), P(2, 1)],
        expected: P(1, 0, 1),
        caption: "$1\\to2$ then $2\\to3$",
      },
      {
        id: "the-ends-do-not-meet",
        expr: ["QuiverCompose", A4, P(2, 1), P(1, 0)],
        expected: 0,
        caption: "the ends do not meet",
        category: "Properties",
      },
      {
        id: "a-trivial-path-is-a-local-identity",
        expr: ["QuiverCompose", A4, P(1), P(1, 0)],
        expected: P(1, 0),
        caption: "a trivial path is a local identity",
        category: "Properties",
      },
    ],
    seeAlso: ["QuiverPath", "QuiverIsAcyclic"],
  },
  {
    name: "QuiverIsAcyclic",
    domain: DOMAIN,
    signature: "QuiverIsAcyclic(quiver)",
    summary:
      "Whether the quiver has no directed cycle — equivalently, whether its path algebra is finite-dimensional at all.",
    signatures: [
      {
        call: "QuiverIsAcyclic(quiver)",
        description: "true when $kQ$ has a finite basis",
        library: "enumeratio-quiver",
      },
    ],
    details: [
      "$kQ$ is finite-dimensional exactly when $Q$ is acyclic; one loop gives the paths $e, a, a^2, \\dots$ and the Jordan quiver's path algebra is $k[x]$",
      "For a cyclic quiver, `Basis` and `AlgebraDimension` have no answer and leave the call standing rather than enumerating forever",
      "$kA_n$ is the incidence algebra of a chain: its paths are the pairs $i \\le j$, so both have dimension $\\binom{n+1}{2}$",
    ],
    examples: [
      {
        id: "quiverisacyclic-linearquiver-4",
        expr: ["QuiverIsAcyclic", A4],
        expected: "True",
      },
      {
        id: "a-loop-is-a-cycle",
        expr: ["QuiverIsAcyclic", "JordanQuiver"],
        expected: "False",
        caption: "a loop is a cycle",
        category: "Properties",
      },
      {
        id: "binom-7-2-the-same-as-incidencealgebra-chain-6",
        expr: ["AlgebraDimension", ["PathAlgebra", ["LinearQuiver", 6]]],
        expected: 21,
        caption: "$\\binom{7}{2}$ — the same as `IncidenceAlgebra(Chain(6))`",
        category: "Properties",
      },
    ],
    seeAlso: ["QuiverPath", "QuiverCompose", "MoebiusFunction"],
  },
];
