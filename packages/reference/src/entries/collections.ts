import type { ReferenceEntry } from "../types.ts";

export const collections: readonly ReferenceEntry[] = [
  {
    name: "Union",
    domain: "Collections",
    signature: "Union(a, b, …)",
    summary: "The set union of the argument collections, de-duplicated.",
    signatures: [
      {
        call: "Union(a, b, …)",
        description: "the de-duplicated union of the collections, as a $Set$.",
      },
    ],
    details: [
      "Duplicates within and across all the argument collections are removed; the result is returned as a $Set$.",
      "Commutative and idempotent: $A \\cup A = A$, and argument order doesn't affect the result.",
      "Inclusion-exclusion: $|A \\cup B| = |A| + |B| - |A \\cap B|$. See [[Intersection]] and [[Length]].",
      "compute-engine's Union preserves the order elements were first encountered in.",
    ],
    examples: [
      {
        expr: ["Union", ["List", 1, 2, 3], ["List", 3, 4]],
        expected: ["Set", 1, 2, 3, 4],
      },
      {
        expr: ["Union", ["List", 1, 2], ["List", 2, 3], ["List", 3, 4]],
        expected: ["Set", 1, 2, 3, 4],
      },
      {
        expr: [
          "Equal",
          ["Union", ["List", 1, 2, 3], ["List", 2, 3, 4]],
          ["Union", ["List", 2, 3, 4], ["List", 1, 2, 3]],
        ],
        expected: "True",
        category: "Properties",
        caption: "$Union$ is commutative: argument order doesn't matter",
      },
      {
        expr: [
          "Equal",
          ["Length", ["Union", ["List", 1, 2, 3], ["List", 2, 3, 4]]],
          [
            "Subtract",
            ["Add", ["Length", ["List", 1, 2, 3]], ["Length", ["List", 2, 3, 4]]],
            ["Length", ["Intersection", ["List", 1, 2, 3], ["List", 2, 3, 4]]],
          ],
        ],
        expected: "True",
        category: "Properties",
        caption:
          "Inclusion-exclusion: $|A \\cup B| = |A| + |B| - |A \\cap B|$. See [[Length]] and [[Intersection]]",
      },
      {
        expr: ["Union", ["Divisors", 10], ["Divisors", 15]],
        expected: ["Set", 1, 2, 5, 10, 3, 15],
        category: "Applications",
        caption: "Combining the divisors of 10 and 15 into one set",
      },
      {
        expr: ["Union", ["Divisors", 10], ["Divisors", 12], ["Divisors", 20]],
        expected: ["Set", 1, 2, 3, 4, 5, 6, 10, 12, 20],
        aspirational: true,
        category: "Possible issues",
        caption:
          "compute-engine's Union preserves the order in which elements were first encountered instead",
      },
    ],
    seeAlso: ["Intersection", "SetMinus"],
  },
  {
    name: "Intersection",
    domain: "Collections",
    signature: "Intersection(a, b, …)",
    summary: "The elements common to all the argument collections.",
    signatures: [
      {
        call: "Intersection(a, b, …)",
        description: "the elements common to every collection, as a $Set$.",
      },
    ],
    details: [
      "Idempotent: $A \\cap A = A$.",
      "Disjoint collections intersect to the symbol $EmptySet$, not an empty $Set$.",
      "With three or more collections, only elements present in all of them survive.",
      "Same counting identity as [[Union]], rearranged: $|A| + |B| = |A \\cup B| + |A \\cap B|$.",
    ],
    examples: [
      {
        expr: ["Intersection", ["List", 1, 2, 3], ["List", 2, 3, 4]],
        expected: ["Set", 2, 3],
      },
      {
        expr: ["Intersection", ["List", 1, 2, 3, 4], ["List", 2, 3, 4, 5]],
        expected: ["Set", 2, 3, 4],
      },
      {
        expr: ["Intersection", ["List", 1, 2, 3], ["List", 2, 3, 4], ["List", 2, 3, 5]],
        expected: ["Set", 2, 3],
        caption: "With three or more collections, only elements common to all of them survive",
      },
      {
        expr: ["Equal", ["Intersection", ["Set", 1, 2, 3], ["Set", 1, 2, 3]], ["Set", 1, 2, 3]],
        expected: "True",
        category: "Properties",
        caption: "$Intersection$ is idempotent: $A \\cap A = A$",
      },
      {
        expr: [
          "Equal",
          ["Add", ["Length", ["List", 1, 2, 3]], ["Length", ["List", 2, 3, 4]]],
          [
            "Add",
            ["Length", ["Union", ["List", 1, 2, 3], ["List", 2, 3, 4]]],
            ["Length", ["Intersection", ["List", 1, 2, 3], ["List", 2, 3, 4]]],
          ],
        ],
        expected: "True",
        category: "Properties",
        caption:
          "The same inclusion-exclusion count, rearranged: $|A| + |B| = |A \\cup B| + |A \\cap B|$. See [[Union]]",
      },
      {
        expr: ["Intersection", ["List", 1, 2], ["List", 3, 4]],
        expected: "EmptySet",
        category: "Possible issues",
        caption:
          "Disjoint collections intersect to the special symbol $EmptySet$, not an empty $Set$",
        divergence: {
          wolfram: "An empty result is the symbol EmptySet here and the empty list {} in Wolfram.",
        },
      },
      {
        expr: ["Intersection", ["Divisors", 45], ["Divisors", 78]],
        expected: ["Set", 1, 3],
        category: "Applications",
        caption: "The divisors common to 45 and 78",
      },
    ],
    seeAlso: ["Union", "SetMinus"],
  },
  {
    name: "SetMinus",
    domain: "Collections",
    signature: "SetMinus(a, b)",
    summary: "The elements of set a that are not also in set b.",
    signatures: [
      { call: "SetMinus(a, b)", description: "the elements of `a` that are not also in `b`." },
    ],
    details: [
      "Not commutative: $A \\setminus B$ generally differs from $B \\setminus A$.",
      "Removing elements that aren't present in `a` leaves it unchanged.",
      "Identity: $A \\setminus (A \\setminus B) = A \\cap B$. See [[Intersection]].",
      "Subtracting a superset of `a` collapses the result to $EmptySet$.",
      "The result preserves encounter order rather than sorting into a canonical order.",
    ],
    examples: [
      {
        expr: ["SetMinus", ["Set", 1, 2, 3], ["Set", 2]],
        expected: ["Set", 1, 3],
      },
      {
        expr: ["SetMinus", ["Set", 1, 2, 3, 4], ["Set", 2, 4]],
        expected: ["Set", 1, 3],
      },
      {
        expr: ["SetMinus", ["Set", 1, 2, 3], ["Set", 9]],
        expected: ["Set", 1, 2, 3],
        caption: "Removing elements that aren't present leaves the set unchanged",
      },
      {
        expr: [
          "Equal",
          ["SetMinus", ["Set", 1, 2, 3, 4], ["SetMinus", ["Set", 1, 2, 3, 4], ["Set", 2, 4]]],
          ["Intersection", ["Set", 1, 2, 3, 4], ["Set", 2, 4]],
        ],
        expected: "True",
        category: "Properties",
        caption: "$A \\setminus (A \\setminus B) = A \\cap B$. See [[Intersection]]",
      },
      {
        expr: ["SetMinus", ["Set", 2, 4], ["Set", 1, 2, 3, 4]],
        expected: "EmptySet",
        category: "Possible issues",
        caption:
          "$SetMinus$ is not commutative: $B \\setminus A$ can differ wildly from $A \\setminus B$",
        divergence: {
          wolfram: "An empty result is the symbol EmptySet here and the empty list {} in Wolfram.",
        },
      },
    ],
    seeAlso: ["Union", "Intersection"],
  },
  {
    name: "First",
    domain: "Collections",
    signature: "First(collection)",
    summary: "The first element of a collection.",
    signatures: [
      { call: "First(collection)", description: "the first element of the collection." },
    ],
    details: [
      "$First(c) = At(c, 1)$. See [[At]].",
      "Positional indexing from the front (index 1) and back (negative indices).",
      "On an empty collection, returns the symbol $Missing$ rather than raising an error.",
      "compute-engine's First doesn't accept one yet.",
    ],
    examples: [
      { expr: ["First", ["List", 1, 2, 3]], expected: 1 },
      { expr: ["First", ["List", 10, 20, 30]], expected: 10 },
      {
        expr: ["Equal", ["First", ["List", 1, 2, 3]], ["At", ["List", 1, 2, 3], 1]],
        expected: "True",
        category: "Properties",
        caption: "$First(c) = At(c, 1)$. See [[At]]",
      },
      {
        expr: ["First", ["List"]],
        expected: "Missing",
        category: "Possible issues",
        caption:
          "An empty collection has no first element; compute-engine returns the symbol $Missing$",
        divergence: {
          wolfram:
            "First of an empty list is the symbol Missing here; Wolfram leaves First[{}] unevaluated (with a First::nofirst message).",
        },
      },
      {
        expr: ["First", ["List"], 99],
        expected: 99,
        aspirational: true,
        category: "Scope",
        caption: "compute-engine's First doesn't accept a second argument yet",
      },
    ],
    seeAlso: ["Last", "At"],
  },
  {
    name: "Last",
    domain: "Collections",
    signature: "Last(collection)",
    summary: "The last element of a collection.",
    signatures: [{ call: "Last(collection)", description: "the last element of the collection." }],
    details: [
      "$Last(c) = At(c, -1)$. See [[At]].",
      "Positional indexing from the front (index 1) and back (negative indices).",
      "Complements [[First]] for the other end of a collection.",
      "compute-engine's Last doesn't accept one yet.",
    ],
    examples: [
      { expr: ["Last", ["List", 1, 2, 3]], expected: 3 },
      { expr: ["Last", ["List", 10, 20, 30]], expected: 30 },
      {
        expr: ["Equal", ["Last", ["List", 1, 2, 3]], ["At", ["List", 1, 2, 3], -1]],
        expected: "True",
        category: "Properties",
        caption: "$Last(c) = At(c, -1)$. See [[At]]",
      },
      {
        expr: ["Last", ["List"], 99],
        expected: 99,
        aspirational: true,
        category: "Scope",
        caption: "compute-engine's Last doesn't accept a second argument yet",
      },
    ],
    seeAlso: ["First", "At"],
  },
  {
    name: "At",
    domain: "Collections",
    signature: "At(collection, index)",
    summary: "The element at the given position; a negative index counts from the end.",
    signatures: [
      {
        call: "At(collection, index)",
        description: "the element at `index`; a negative index counts from the end.",
      },
      {
        call: "At(collection, [i1, i2, …])",
        description: "the elements at several positions at once.",
      },
      {
        call: "At(collection, Range(start, end))",
        description: "a contiguous slice selected by a [[Range]].",
      },
    ],
    details: [
      "Negative indices count from the end: $At(c, -1)$ is the last element. See [[Last]].",
      "Chaining reaches into nested collections, like indexing a matrix row then column.",
      "An out-of-range index evaluates to $NaN$ rather than raising an error.",
      "compute-engine treats 0 as out of range.",
      "Positional element access, 1-based; negative indices count from the end.",
    ],
    examples: [
      { expr: ["At", ["List", 1, 2, 3, 4], 2], expected: 2 },
      { expr: ["At", ["List", 1, 2, 3, 4], -1], expected: 4 },
      {
        expr: ["At", ["List", "a", "b", "c", "d"], -2],
        expected: "c",
      },
      {
        expr: ["At", ["At", ["List", ["List", 1, 2], ["List", 3, 4]], 2], 1],
        expected: 3,
        category: "Applications",
        caption:
          "Chaining $At$ reaches into nested collections, like indexing a matrix row then column",
      },
      {
        expr: ["At", ["List", "a", "b", "c", "d"], ["List", 1, 3]],
        expected: ["List", "a", "c"],
        category: "Scope",
        caption: "A list of indices selects several elements at once",
      },
      {
        expr: ["At", ["List", "a", "b", "c", "d", "e"], ["Range", 2, 4]],
        expected: ["List", "b", "c", "d"],
        category: "Scope",
        caption: "A [[Range]] also works as an index list, extracting a contiguous slice",
      },
      {
        expr: ["At", ["List", 1, 2, 3], 0],
        expected: "List",
        aspirational: true,
        category: "Scope",
        caption: "compute-engine treats 0 as out of range",
      },
      {
        expr: ["At", ["List", 1, 2, 3], 10],
        expected: "NaN",
        category: "Possible issues",
        caption: "An out-of-range index evaluates to $NaN$ rather than raising an error",
        divergence: {
          wolfram:
            "An out-of-range index is NaN here; Wolfram leaves Part unevaluated (with a Part::partw message).",
        },
      },
    ],
    seeAlso: ["First", "Last", "IndexOf"],
  },
  {
    name: "IndexOf",
    domain: "Collections",
    signature: "IndexOf(collection, value)",
    summary: "The position of the first occurrence of value in the collection.",
    signatures: [
      {
        call: "IndexOf(collection, value)",
        description: "the position of the first occurrence of `value`.",
      },
    ],
    details: [
      "Returns 0 when the value isn't present, since 0 is never a valid position.",
      "Round-trips with [[At]]: $At(c, IndexOf(c, v)) = v$ whenever v occurs in c.",
      "compute-engine's IndexOf reports only the first occurrence, as a plain index (not every match).",
    ],
    examples: [
      { expr: ["IndexOf", ["List", 1, 2, 3], 2], expected: 2 },
      {
        expr: ["IndexOf", ["List", 1, 2, 3], 9],
        expected: 0,
        caption: "0 signals that the value isn't present, since 0 is never a valid position",
      },
      {
        expr: ["Equal", ["At", ["List", 10, 20, 30], ["IndexOf", ["List", 10, 20, 30], 20]], 20],
        expected: "True",
        category: "Properties",
        caption: "$At(c, IndexOf(c, v)) = v$ whenever v occurs in c. See [[At]]",
      },
      {
        expr: ["IndexOf", ["List", 1, 2, 3, 2], 2],
        expected: ["List", ["List", 2], ["List", 4]],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine's IndexOf reports only the first occurrence as a plain index",
      },
    ],
    seeAlso: ["At", "Count"],
  },
  {
    name: "Sort",
    domain: "Collections",
    signature: "Sort(collection)",
    summary: "The elements of the collection in increasing order.",
    signatures: [
      { call: "Sort(collection)", description: "the elements in increasing numeric order." },
      {
        call: "Sort(collection, comparator)",
        description: "sorted by a custom [[Function]] comparator, e.g. descending order.",
      },
    ],
    details: [
      "Idempotent: sorting an already-sorted collection changes nothing.",
      "$Sort(c) = At(c, Ordering(c))$. See [[Ordering]] and [[At]].",
      "compute-engine's Sort compares numeric values and leaves non-numeric elements like strings untouched.",
      "The comparator form `Sort(list, p)` takes a predicate `p` reporting whether a pair is already in order.",
    ],
    examples: [
      { expr: ["Sort", ["List", 3, 1, 2]], expected: ["List", 1, 2, 3] },
      {
        expr: ["Sort", ["List", 4, 2, 5, 1, 3]],
        expected: ["List", 1, 2, 3, 4, 5],
      },
      {
        expr: ["Equal", ["Sort", ["Sort", ["List", 3, 1, 2]]], ["Sort", ["List", 3, 1, 2]]],
        expected: "True",
        category: "Properties",
        caption: "$Sort$ is idempotent: sorting an already-sorted collection changes nothing",
      },
      {
        expr: [
          "Equal",
          ["Sort", ["List", 3, 1, 2]],
          ["At", ["List", 3, 1, 2], ["Ordering", ["List", 3, 1, 2]]],
        ],
        expected: "True",
        category: "Properties",
        caption: "$Sort(c) = At(c, Ordering(c))$. See [[Ordering]] and [[At]]",
      },
      {
        expr: ["Sort", ["List", 3, 1, 2], ["Function", ["Greater", "_1", "_2"]]],
        expected: ["List", 3, 2, 1],
        category: "Scope",
        caption: "A custom comparator sorts in a different order, here descending",
      },
      {
        expr: ["Sort", ["List", "banana", "apple", "cherry"]],
        expected: ["List", "apple", "banana", "cherry"],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine's Sort leaves a list of strings untouched",
      },
    ],
    seeAlso: ["Ordering"],
  },
  {
    name: "Ordering",
    domain: "Collections",
    signature: "Ordering(collection)",
    summary: "The permutation of indices that would sort the collection into increasing order.",
    signatures: [
      {
        call: "Ordering(collection)",
        description: "the permutation of indices that sorts the collection into increasing order.",
      },
    ],
    details: [
      "$c[[Ordering(c)]] = Sort(c)$: applying the permutation at those positions recovers [[Sort]]'s result.",
      "Ties break in favor of earlier position, i.e. it's a stable ordering.",
      "compute-engine's Ordering only computes the full permutation.",
    ],
    examples: [
      { expr: ["Ordering", ["List", 3, 1, 2]], expected: ["List", 2, 3, 1] },
      {
        expr: ["Ordering", ["List", 2, 1, 2, 1]],
        expected: ["List", 2, 4, 1, 3],
        category: "Scope",
        caption: "Ties break in favor of the earlier position: both 1s come before both 2s",
      },
      {
        expr: ["Ordering", ["List", 2, 6, 1, 9, 1, 2, 3], 4],
        expected: ["List", 3, 5, 1, 6],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine's Ordering only computes the full permutation",
      },
    ],
    seeAlso: ["Sort"],
  },
  {
    name: "Length",
    domain: "Collections",
    signature: "Length(collection)",
    summary: "The number of elements in the collection.",
    signatures: [
      { call: "Length(collection)", description: "the number of elements in the collection." },
    ],
    details: [
      "Works on any collection head, not just $List$ — e.g. $Set$.",
      "Additive over concatenation: $Length(Join(A, B)) = Length(A) + Length(B)$. See [[Join]].",
      "compute-engine's Length requires an actual collection.",
      "See [[Count]] to count occurrences of a specific value instead of every element.",
    ],
    examples: [
      { expr: ["Length", ["List", 1, 2, 3, 4]], expected: 4 },
      { expr: ["Length", ["List", 1, 2, 3, 4, 5]], expected: 5 },
      {
        expr: ["Length", ["Set", 1, 2, 3]],
        expected: 3,
        caption: "Works on any collection, not just $List$",
      },
      {
        expr: [
          "Equal",
          ["Length", ["Join", ["List", 1, 2, 3], ["List", 4, 5]]],
          ["Add", ["Length", ["List", 1, 2, 3]], ["Length", ["List", 4, 5]]],
        ],
        expected: "True",
        category: "Properties",
        caption: "$Length(Join(A, B)) = Length(A) + Length(B)$. See [[Join]]",
      },
      {
        expr: ["Length", 5],
        expected: 0,
        aspirational: true,
        category: "Scope",
        caption: "compute-engine's Length requires an actual collection",
      },
    ],
    seeAlso: ["Count"],
  },
  {
    name: "Count",
    domain: "Collections",
    signature: "Count(collection, value)",
    summary: "The number of elements equal to value in the collection.",
    signatures: [
      { call: "Count(collection, value)", description: "the number of elements equal to `value`." },
    ],
    details: [
      "A value absent from the collection counts as 0.",
      "compute-engine's Count only tests exact equality against a fixed value.",
      "See [[Length]] for the total element count, and [[IndexOf]] for a single matching position.",
    ],
    examples: [
      { expr: ["Count", ["List", 1, 2, 2, 3, 2], 2], expected: 3 },
      { expr: ["Count", ["List", 1, 2, 2, 3, 2, 4], 2], expected: 3 },
      {
        expr: ["Count", ["List", 1, 2, 3], 9],
        expected: 0,
        caption: "A value absent from the collection counts as 0",
      },
      {
        expr: ["Count", ["List", 1, "a", 2, "b"], "_Integer"],
        expected: 2,
        aspirational: true,
        category: "Scope",
        caption: "compute-engine's Count only tests exact equality against a fixed value",
      },
    ],
    seeAlso: ["Length", "IndexOf"],
  },
  {
    name: "Join",
    domain: "Collections",
    signature: "Join(a, b, …)",
    summary: "The concatenation of the argument collections, in order.",
    signatures: [
      { call: "Join(a, b, …)", description: "the concatenation of the collections, in order." },
    ],
    details: [
      "$Join(A, B) = Flatten(\\{A, B\\}, 1)$. See [[Flatten]].",
      "The argument collections don't need to be $List$, but must all share the same head.",
      "compute-engine's Join always concatenates at the top level.",
      "See [[Append]] for adding a single element rather than concatenating collections.",
    ],
    examples: [
      {
        expr: ["Join", ["List", 1, 2], ["List", 3, 4]],
        expected: ["List", 1, 2, 3, 4],
      },
      {
        expr: ["Join", ["List", 1, 2], ["List", 3, 4], ["List", 5]],
        expected: ["List", 1, 2, 3, 4, 5],
      },
      {
        expr: [
          "Equal",
          ["Join", ["List", 1, 2], ["List", 3, 4]],
          ["Flatten", ["List", ["List", 1, 2], ["List", 3, 4]], 1],
        ],
        expected: "True",
        category: "Properties",
        caption: "$Join(A, B) = Flatten(\\{A, B\\}, 1)$. See [[Flatten]]",
      },
      {
        expr: [
          "Join",
          ["List", ["List", 1, 2], ["List", 3, 4]],
          ["List", ["List", 5, 6], ["List", 7, 8]],
          2,
        ],
        expected: ["List", ["List", 1, 2, 5, 6], ["List", 3, 4, 7, 8]],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine's Join always concatenates at the top level",
      },
    ],
    seeAlso: ["Flatten", "Append"],
  },
  {
    name: "Flatten",
    domain: "Collections",
    signature: "Flatten(collection)",
    summary: "The collection with all levels of nested lists merged into one.",
    signatures: [
      { call: "Flatten(collection)", description: "every level of nested lists merged into one." },
      { call: "Flatten(collection, n)", description: "flattening limited to the top `n` levels." },
    ],
    details: [
      "Undoes [[Partition]]: chunking and then re-flattening recovers the original list.",
      "Simply deletes inner braces/levels; it doesn't otherwise reorder or transform elements.",
      "A depth argument limits flattening to that many levels, leaving deeper nesting intact.",
      "compute-engine's Flatten is $List$-only.",
    ],
    examples: [
      {
        expr: ["Flatten", ["List", ["List", 1, 2], ["List", 3, 4]]],
        expected: ["List", 1, 2, 3, 4],
      },
      {
        expr: ["Flatten", ["List", ["List", 1, ["List", 2, 3]], ["List", 4]]],
        expected: ["List", 1, 2, 3, 4],
      },
      {
        expr: ["Flatten", ["List", ["List", 1, 2], ["List", 3, ["List", 4]]], 1],
        expected: ["List", 1, 2, 3, ["List", 4]],
        category: "Scope",
        caption:
          "A depth argument limits flattening to just that many levels, leaving deeper nesting intact",
      },
      {
        expr: [
          "Equal",
          ["Flatten", ["Partition", ["List", 1, 2, 3, 4, 5, 6], 2]],
          ["List", 1, 2, 3, 4, 5, 6],
        ],
        expected: "True",
        category: "Properties",
        caption:
          "$Flatten$ undoes [[Partition]]: chunking and re-flattening recovers the original list",
      },
    ],
    seeAlso: ["Join"],
  },
  {
    name: "Append",
    domain: "Collections",
    signature: "Append(collection, value)",
    summary: "The collection with value added as its last element.",
    signatures: [
      {
        call: "Append(collection, value)",
        description: "the collection with `value` added as its last element.",
      },
    ],
    details: [
      "$Append(c, x) = Join(c, \\{x\\})$. See [[Join]].",
      "Appending a list nests it as a single element rather than splicing its contents in — use [[Join]] to splice.",
      "Works on a set as well as a list.",
    ],
    examples: [
      {
        expr: ["Append", ["List", 1, 2, 3], 4],
        expected: ["List", 1, 2, 3, 4],
      },
      {
        expr: ["Equal", ["Append", ["List", 1, 2, 3], 4], ["Join", ["List", 1, 2, 3], ["List", 4]]],
        expected: "True",
        category: "Properties",
        caption: "$Append(c, x) = Join(c, \\{x\\})$. See [[Join]]",
      },
      {
        expr: ["Append", ["List", 1, 2, 3], ["List", 9]],
        expected: ["List", 1, 2, 3, ["List", 9]],
        category: "Possible issues",
        caption:
          "Appending a list nests it as a single element rather than splicing its contents in",
      },
      {
        expr: ["Append", ["Set", 1, 2, 3], 4],
        expected: ["Set", 1, 2, 3, 4],
        category: "Scope",
        caption: "A set as well as a list",
      },
    ],
    seeAlso: ["Join"],
  },
  {
    name: "Partition",
    domain: "Collections",
    signature: "Partition(collection, n)",
    summary: "The collection split into consecutive, non-overlapping chunks of length n.",
    signatures: [
      {
        call: "Partition(collection, n)",
        description: "the collection split into non-overlapping chunks of length `n`.",
      },
      {
        call: "Partition(collection, n, d)",
        description: "overlapping sliding windows of length `n`, offset by `d` between windows.",
      },
    ],
    details: [
      "[[Flatten]] undoes Partition: chunking and re-flattening recovers the original list.",
      "With $d < n$, windows overlap; the two-argument form is equivalent to $d = n$, giving non-overlapping chunks.",
      "compute-engine keeps the ragged remainder instead.",
      "compute-engine's Partition doesn't yet.",
    ],
    examples: [
      {
        expr: ["Partition", ["List", 1, 2, 3, 4, 5, 6], 2],
        expected: ["List", ["List", 1, 2], ["List", 3, 4], ["List", 5, 6]],
      },
      {
        expr: ["Partition", ["List", 1, 2, 3, 4, 5, 6], 3, 1],
        expected: [
          "List",
          ["List", 1, 2, 3],
          ["List", 2, 3, 4],
          ["List", 3, 4, 5],
          ["List", 4, 5, 6],
        ],
        category: "Scope",
        caption: "A third, offset argument produces overlapping sliding windows",
      },
      {
        expr: ["Partition", ["List", 1, 2, 3, 4, 5], 2],
        expected: ["List", ["List", 1, 2], ["List", 3, 4]],
        aspirational: true,
        category: "Possible issues",
        caption:
          "compute-engine keeps it, so $\\{1..5\\}$ partitioned by 2 also yields the ragged $\\{5\\}$",
      },
    ],
    seeAlso: ["Flatten"],
  },
  {
    name: "Mean",
    domain: "Collections",
    signature: "Mean(collection)",
    summary: "The arithmetic average of the elements of the collection.",
    signatures: [
      { call: "Mean(collection)", description: "the arithmetic average of the elements." },
    ],
    details: [
      "$Mean(c) = \\dfrac{\\sum c}{Length(c)}$. See [[Length]].",
      "Sensitive to outliers — a single extreme value can drag the mean far from the bulk of the data. See [[Median]] for a more robust alternative.",
      "compute-engine's Mean requires a flat list of numbers.",
      "See [[Mode]] for the most frequent value rather than the average.",
    ],
    examples: [
      { expr: ["Mean", ["List", 1, 2, 3, 4]], expected: ["Rational", 5, 2] },
      { expr: ["Mean", ["List", 2, 4, 4, 4, 5, 5, 7, 9]], expected: 5 },
      {
        expr: [
          "Equal",
          ["Mean", ["List", 1, 2, 3, 4]],
          ["Divide", ["Add", 1, 2, 3, 4], ["Length", ["List", 1, 2, 3, 4]]],
        ],
        expected: "True",
        category: "Properties",
        caption:
          "Mean is total divided by count: $Mean(c) = \\dfrac{\\sum c}{Length(c)}$. See [[Length]]",
      },
      {
        expr: ["Mean", ["List", -100, 1, 1, 1, 1, 20]],
        expected: ["Rational", -38, 3],
        category: "Possible issues",
        caption:
          "A single outlier drags the mean far from the rest of the data, here to $-\\frac{38}{3} \\approx -12.67$. See [[Median]] for a more robust alternative",
      },
      {
        expr: ["Mean", ["List", ["List", 1, 10], ["List", 2, 20], ["List", 3, 30]]],
        expected: ["List", 2, 20],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine's Mean requires a flat list of numbers",
      },
    ],
    seeAlso: ["Median", "Mode"],
  },
  {
    name: "Median",
    domain: "Collections",
    signature: "Median(collection)",
    summary: "The middle value of the collection once sorted.",
    signatures: [
      {
        call: "Median(collection)",
        description: "the middle value of the collection once sorted.",
      },
    ],
    details: [
      "For an odd-length collection, the median is the middle element of [[Sort]]'s result; for even length, it's the average of the two middle elements.",
      "Much less sensitive to outliers than [[Mean]] — a single extreme value barely moves it.",
      "compute-engine's Median requires a flat list of numbers.",
      "See [[Mode]] for the most frequent value.",
    ],
    examples: [
      { expr: ["Median", ["List", 1, 2, 3, 4, 5]], expected: 3 },
      {
        expr: ["Median", ["List", 1, 2, 3, 4]],
        expected: ["Rational", 5, 2],
      },
      {
        expr: [
          "Equal",
          ["Median", ["List", 5, 3, 1, 4, 2]],
          ["At", ["Sort", ["List", 5, 3, 1, 4, 2]], 3],
        ],
        expected: "True",
        category: "Properties",
        caption:
          "For an odd-length list, the median is the middle element of the sorted list. See [[Sort]]",
      },
      {
        expr: ["Median", ["List", -100, 1, 1, 1, 1, 20]],
        expected: 1,
        category: "Applications",
        caption:
          "The same outlier-laden data as in [[Mean]]'s example: the median of 1 barely moves, unlike the mean's $-\\frac{38}{3}$",
      },
      {
        expr: ["Median", ["List", ["List", 1, 11, 3], ["List", 4, 6, 7]]],
        expected: ["List", ["Rational", 5, 2], ["Rational", 17, 2], 5],
        aspirational: true,
        category: "Scope",
        caption: "compute-engine's Median requires a flat list of numbers",
      },
    ],
    seeAlso: ["Mean", "Mode"],
  },
  {
    name: "Mode",
    domain: "Collections",
    signature: "Mode(collection)",
    summary: "The most frequently occurring element of the collection.",
    signatures: [
      { call: "Mode(collection)", description: "the most frequently occurring element." },
    ],
    details: [
      "The mode occurs exactly as many times as the highest frequency in the collection: $Count(c, Mode(c))$ gives that frequency. See [[Count]].",
      "When several elements share the highest frequency, Mode returns just one; a form returning every tied value is not yet supported.",
      "See [[Mean]] and [[Median]] for other measures of central tendency.",
    ],
    examples: [
      { expr: ["Mode", ["List", 1, 2, 2, 3]], expected: 2 },
      {
        expr: ["Equal", ["Count", ["List", 1, 2, 2, 3], ["Mode", ["List", 1, 2, 2, 3]]], 2],
        expected: "True",
        category: "Properties",
        caption:
          "The mode occurs exactly as many times as the highest frequency in the collection. See [[Count]]",
      },
      {
        expr: ["Mode", ["List", 1, 1, 2, 2, 3]],
        expected: ["List", 1, 2],
        aspirational: true,
        category: "Scope",
        caption: "With a tie for most frequent, compute-engine's Mode returns just one",
      },
    ],
    seeAlso: ["Mean", "Median"],
  },
  {
    name: "Product",
    domain: "Collections",
    signature: "Product(collection)",
    summary: "The product of all elements in the collection.",
    signatures: [
      {
        call: "Product(collection)",
        description: "the product of all elements in the collection.",
      },
    ],
    details: [
      "The empty product is 1 by convention, matching $Factorial(0)$. See [[Factorial]].",
      "The product of $1$ through $n$ is $n!$: $Product(Range(1, n)) = Factorial(n)$.",
      "Applies $\\mathrm{Times}$ across the list's elements (the product of a list).",
      "Forces evaluation of a lazy collection like [[Range]], which otherwise stays unevaluated on its own.",
    ],
    examples: [
      { expr: ["Product", ["List", 1, 2, 3, 4]], expected: 24 },
      {
        expr: ["Product", ["List"]],
        expected: 1,
        caption: "The empty product is 1 by convention, matching [[Factorial]] of 0",
      },
      {
        expr: ["Equal", ["Product", ["List", 1, 2, 3, 4]], ["Factorial", 4]],
        expected: "True",
        category: "Properties",
        caption: "The product of $1$ through $n$ is $n!$. See [[Factorial]]",
      },
      {
        expr: ["Product", ["Range", 1, 6]],
        expected: 720,
        category: "Applications",
        caption: "[[Range]] stays lazy on its own, but Product forces it to compute $6!$",
      },
    ],
    seeAlso: ["Length"],
  },
];
