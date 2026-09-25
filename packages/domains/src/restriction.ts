// Restrictions — as SETS, and anonymous by default.
//
// A derangement is a permutation with no fixed points. The instinct is a subtype, and
// compute-engine cannot express one between minted types (design/domains.md §1.1). But the
// instinct is worth questioning anyway: a subtype SPLITS the carrier, so a derangement would
// stop being a permutation and every permutation statistic would need re-declaring. A set
// KEEPS the carrier, and everything already written keeps working.
//
// The mechanism turns out to exist already. `Filter` over a lazy collection stays lazy:
//
//   Count(Filter(Permutations(4), p -> FixedPoints(p) = 0))   9
//
// So `Restricted` adds no machinery. What it adds is (a) a name that says this is a
// restriction rather than an arbitrary filter, and (b) the predicate kept as DATA, so a
// restriction can be introspected, documented, and — the case named heads cannot serve —
// PARAMETERISED.
//
// That last point is the argument for having it at all. `Derangements` can be a head.
// "Partitions whose largest part is at most k" cannot be, not for every k; enumeratio models
// those as constructor parameters for exactly this reason.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";

/** A named restriction: a base collection plus the predicate that selects from it. */
export interface Restriction {
  /** The restricted family's name — plural, since it names a set. */
  readonly name: string;
  /** The collection head it restricts. */
  readonly base: string;
  /** The type its members inhabit — unchanged by the restriction, which is the point. */
  readonly on: string;
  /** The predicate, over `_x` (the constructed element). */
  readonly predicate: unknown;
  readonly summary: string;
}

export const RESTRICTIONS: readonly Restriction[] = [
  {
    name: "Derangements",
    base: "SymmetricGroup",
    on: "permutation",
    predicate: ["Equal", ["FixedPoints", "_x"], 0],
    summary: "Permutations with no fixed point.",
  },
  {
    name: "CyclicPermutations",
    base: "SymmetricGroup",
    on: "permutation",
    predicate: ["Equal", ["CycleCount", "_x"], 1],
    summary: "Permutations consisting of a single cycle.",
  },
  {
    name: "DistinctPartitions",
    base: "IntegerPartitions",
    on: "integer_partition",
    predicate: ["Equal", ["DistinctParts", "_x"], ["Length", "_raw"]],
    summary: "Partitions with no repeated part.",
  },
  {
    name: "SelfConjugatePartitions",
    base: "IntegerPartitions",
    on: "integer_partition",
    predicate: ["Equal", ["IsSelfConjugate", "_x"], 1],
    summary: "Partitions equal to their own conjugate.",
  },

  // ── compositions — a Composition is a plain list<integer>, so its predicates are ordinary
  // list operations over `_raw` (no custom statistics declared for this carrier). Each `All`
  // closes over a one-part predicate; the last three (Carlitz/Palindromic/Zigzag) instead
  // compare a part against its neighbor, via `Partition(_raw, k, 1)` sliding windows.
  {
    name: "OddCompositions",
    base: "IntegerCompositions",
    on: "composition",
    predicate: ["All", "_raw", ["Function", ["Equal", ["Mod", "_", 2], 1], "_"]],
    summary: "Compositions into odd parts.",
  },
  {
    name: "ProperCompositions",
    base: "IntegerCompositions",
    on: "composition",
    predicate: ["All", "_raw", ["Function", ["GreaterEqual", "_", 2], "_"]],
    summary: "Compositions into parts ≥ 2.",
  },
  {
    name: "DyadicCompositions",
    base: "IntegerCompositions",
    on: "composition",
    predicate: [
      "All",
      "_raw",
      ["Function", ["Equal", ["Log2", "_"], ["Floor", ["Log2", "_"]]], "_"],
    ],
    summary: "Compositions into powers of two.",
  },
  {
    name: "FibonacciCompositions",
    base: "IntegerCompositions",
    on: "composition",
    predicate: ["All", "_raw", ["Function", ["Or", ["Equal", "_", 1], ["Equal", "_", 2]], "_"]],
    summary: "Compositions into parts 1 and 2.",
  },
  {
    name: "TriCompositions",
    base: "IntegerCompositions",
    on: "composition",
    predicate: ["All", "_raw", ["Function", ["LessEqual", "_", 3], "_"]],
    summary: "Compositions into parts 1, 2, 3.",
  },
  {
    name: "TetraCompositions",
    base: "IntegerCompositions",
    on: "composition",
    predicate: ["All", "_raw", ["Function", ["LessEqual", "_", 4], "_"]],
    summary: "Compositions into parts 1, 2, 3, 4.",
  },
  {
    name: "TriangularComposition",
    base: "IntegerCompositions",
    on: "composition",
    predicate: [
      "All",
      "_raw",
      [
        "Function",
        [
          "Equal",
          ["Sqrt", ["Add", ["Multiply", 8, "_"], 1]],
          ["Floor", ["Sqrt", ["Add", ["Multiply", 8, "_"], 1]]],
        ],
        "_",
      ],
    ],
    // 8s+1 is always odd, so an integer square root is automatically odd too — no extra check.
    summary: "Compositions into triangular parts {1,3,6,10,…}.",
  },
  {
    name: "PrimeCompositions",
    base: "IntegerCompositions",
    on: "composition",
    predicate: ["All", "_raw", ["Function", ["IsPrime", "_"], "_"]],
    summary: "Compositions into prime parts.",
  },
  {
    name: "CarlitzCompositions",
    base: "IntegerCompositions",
    on: "composition",
    predicate: [
      "All",
      ["Partition", "_raw", 2, 1],
      ["Function", ["Not", ["Equal", ["At", "_", 1], ["At", "_", 2]]], "_"],
    ],
    summary: "Compositions with no two equal adjacent parts.",
  },
  {
    name: "PalindromicCompositions",
    base: "IntegerCompositions",
    on: "composition",
    predicate: ["Equal", "_raw", ["Reverse", "_raw"]],
    summary: "Compositions that read the same reversed.",
  },
  {
    name: "ZigzagComposition",
    base: "IntegerCompositions",
    on: "composition",
    predicate: [
      "And",
      [
        "All",
        ["Partition", "_raw", 2, 1],
        ["Function", ["Not", ["Equal", ["At", "_", 1], ["At", "_", 2]]], "_"],
      ],
      [
        "All",
        ["Partition", "_raw", 3, 1],
        [
          "Function",
          [
            "Less",
            [
              "Multiply",
              ["Subtract", ["At", "_", 2], ["At", "_", 1]],
              ["Subtract", ["At", "_", 3], ["At", "_", 2]],
            ],
            0,
          ],
          "_",
        ],
      ],
    ],
    summary: "Alternating compositions (parts go up-down-up…).",
  },
  // KBoundedCompositions(n, k) is skipped — a Restriction is `(integer) -> collection`, one
  // size parameter; k isn't expressible in that shape.

  // ── partitions — an IntegerPartition is also a plain list<integer>, so the same per-part
  // predicates over `_raw` apply directly. LargestPartPartitions(n, m) is skipped for the same
  // reason as KBoundedCompositions: m isn't expressible as a Restriction's single size parameter.
  {
    name: "OddPartitions",
    base: "IntegerPartitions",
    on: "integer_partition",
    predicate: ["All", "_raw", ["Function", ["Equal", ["Mod", "_", 2], 1], "_"]],
    summary: "Partitions into odd parts.",
  },
  {
    name: "PrimePartition",
    base: "IntegerPartitions",
    on: "integer_partition",
    predicate: ["All", "_raw", ["Function", ["IsPrime", "_"], "_"]],
    summary: "Partitions into prime parts.",
  },
  {
    name: "SquarePartitions",
    base: "IntegerPartitions",
    on: "integer_partition",
    predicate: [
      "All",
      "_raw",
      ["Function", ["Equal", ["Sqrt", "_"], ["Floor", ["Sqrt", "_"]]], "_"],
    ],
    summary: "Partitions into perfect-square parts.",
  },
  {
    name: "TriangularPartitions",
    base: "IntegerPartitions",
    on: "integer_partition",
    predicate: [
      "All",
      "_raw",
      [
        "Function",
        [
          "Equal",
          ["Sqrt", ["Add", ["Multiply", 8, "_"], 1]],
          ["Floor", ["Sqrt", ["Add", ["Multiply", 8, "_"], 1]]],
        ],
        "_",
      ],
    ],
    // 8s+1 is always odd, so an integer square root is automatically odd too — no extra check.
    summary: "Partitions into triangular-number parts {1,3,6,10,…}.",
  },
];

/** Fill a predicate's wildcards BEFORE boxing.
 *
 *  `.subs()` is too late: boxing `Equal(FixedPoints(_x), 0)` type-checks `FixedPoints`
 *  against an untyped wildcard, fails against a domain-typed signature, and bakes an error
 *  into the tree that substitution cannot repair. Same lesson as design/namespaces.md §3.2 —
 *  the check happens on the way in.
 *
 *  Two wildcards, because a constructed value is opaque to generic heads (§1.5): `_x` is the
 *  constructed element, `_raw` its contents. */
export function fillPredicate(node: unknown, subject: unknown, contents: unknown): unknown {
  if (node === "_x") return subject;
  if (node === "_raw") return contents;
  return Array.isArray(node)
    ? node.map((operand) => fillPredicate(operand, subject, contents))
    : node;
}

/**
 * Declare `Restricted(collection, predicate)` — a restriction with no name.
 *
 * Delegates to `Filter`, which is what makes it free: the base stays lazy, so `Count` and
 * `At` over a restriction do not materialise it.
 */
export function declareRestricted(ce: ComputeEngine): void {
  ce.declare("Restricted", {
    signature: "(collection, function) -> collection",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [base, predicate] = ops;
      if (base === undefined || predicate === undefined) return undefined;
      return ce.function("Filter", [base, predicate]).evaluate();
    },
  });
}

/**
 * Declare each named restriction as a COLLECTION — `Derangements(4)` is the derangements of
 * 4, and membership is the ordinary `Element(p, Derangements(4))`.
 *
 * A named restriction is an anonymous one that has earned a name; both go through `Filter`,
 * so there is one mechanism rather than two.
 *
 * Several of these names ALREADY exist as fast collections in `@enumeratio/collections`, with
 * hand-written count and unrank kernels. That is not a conflict to resolve — it is the
 * reference/accelerated pairing from design/namespaces.md §6 arriving somewhere new. The
 * restriction is the SPECIFICATION ("permutations with no fixed point"); the kernel is the
 * implementation; and a differential test holds them together. Pass `skipDeclared` to let the
 * kernel win at runtime while keeping the specification as data.
 */
export function declareRestrictions(
  ce: ComputeEngine,
  restrictions: readonly Restriction[] = RESTRICTIONS,
  options: { readonly skipDeclared?: boolean } = {},
): void {
  for (const restriction of restrictions) {
    if (options.skipDeclared === true && ce.lookupDefinition(restriction.name)) continue;
    ce.declare(restriction.name, {
      signature: "(integer) -> collection",
      evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
        const size = ops[0];
        if (size === undefined) return undefined;
        return ce
          .function("Filter", [
            ce.function(restriction.base, [size]),
            ce.function("Function", [
              ce.box(fillPredicate(restriction.predicate, "_e", "_e") as never),
              ce.symbol("_e"),
            ]),
          ])
          .evaluate();
      },
    });
  }
}
