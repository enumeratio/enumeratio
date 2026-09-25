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
      "Sorted, matching Wolfram's Union — compute-engine's own de-duplication preserves first-seen order instead.",
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
        expected: ["Set", 1, 2, 3, 5, 10, 15],
        category: "Applications",
        caption: "Combining the divisors of 10 and 15 into one set",
      },
      {
        expr: ["Union", ["Divisors", 10], ["Divisors", 12], ["Divisors", 20]],
        expected: ["Set", 1, 2, 3, 4, 5, 6, 10, 12, 20],
        category: "Applications",
        caption: "Combining the divisors of 10, 12 and 20 into one sorted set",
      },
      {
        expr: ["Union", ["List", "a", "b", "c"], ["List", "b", "c", "d"]],
        expected: ["Set", "a", "b", "c", "d"],
      },
      {
        expr: ["Union", ["List", 1, 2, 1, 3, 6, 2, 2]],
        expected: ["Set", 1, 2, 3, 6],
        category: "Scope",
        caption: "A single list is de-duplicated",
      },
      {
        expr: [
          "Union",
          ["List", "a", "b", "a", "c"],
          ["List", "d", "a", "f", "b"],
          ["List", "c", "a"],
        ],
        expected: ["Set", "a", "b", "c", "d", "f"],
        category: "Scope",
        caption: "Symbolic elements, merged across three lists",
      },
      {
        expr: [
          "Union",
          ["List", ["List", 1, 2], ["List", 1, 2, 3]],
          ["List", ["List", 2, 1], ["List", 1, 2]],
          ["List", ["List", 3, 2, 1], ["List", 1, 2, 3]],
        ],
        expected: ["Set", ["List", 1, 2], ["List", 1, 2, 3], ["List", 2, 1], ["List", 3, 2, 1]],
        category: "Scope",
        caption: "Elements can themselves be lists; $\\{1, 2\\}$ and $\\{2, 1\\}$ stay distinct",
        divergence: {
          wolfram:
            "Wolfram sorts the result into canonical order, shorter lists first: {{1, 2}, {2, 1}, {1, 2, 3}, {3, 2, 1}}.",
        },
      },
      {
        expr: ["Union"],
        expected: "EmptySet",
        category: "Scope",
        caption: "With no arguments, the union is empty",
        divergence: { wolfram: "Union[] is the empty list {} in Wolfram." },
      },
      {
        expr: ["Union", ["Set", 1, 2], "EmptySet"],
        expected: ["Set", 1, 2],
        category: "Properties",
        caption: "The empty set is the identity for $Union$: $A \\cup \\varnothing = A$",
      },
      {
        expr: ["Length", ["Union", ["List", 1, 2, 1, 3, 6, 2, 2]]],
        expected: 4,
        category: "Applications",
        caption: "Counting the distinct values in a list. See [[Length]]",
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
      {
        expr: ["Intersection", ["List", 1, 1, 2, 3], ["List", 3, 1, 4], ["List", 4, 1, 3, 3]],
        expected: ["Set", 1, 3],
        caption: "Duplicates are dropped as well",
      },
      {
        expr: ["Intersection", ["List", "a", "b", "c"], ["List", "b", "c", "d"]],
        expected: ["Set", "b", "c"],
        category: "Scope",
        caption: "Symbolic elements",
      },
      {
        expr: ["Intersection", ["List", 1, 2, 3]],
        expected: ["Set", 1, 2, 3],
        category: "Scope",
        caption: "A single collection comes back as a set",
      },
      {
        expr: ["Intersection", ["List", 1, 2, 3], "EmptySet"],
        expected: "EmptySet",
        category: "Properties",
        caption:
          "Intersecting with the empty set gives the empty set: $A \\cap \\varnothing = \\varnothing$",
      },
      {
        expr: ["Intersection", ["List", "c", "b", "a"], ["List", "a", "b"]],
        expected: ["Set", "b", "a"],
        category: "Possible issues",
        caption:
          "The result keeps the order elements were met in the first collection, not sorted order",
        divergence: {
          wolfram: "Wolfram sorts the result: Intersection[{c, b, a}, {a, b}] is {a, b}.",
        },
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
      {
        expr: ["SetMinus", ["Set", "a", "b", "c", "d", "f"], ["Set", "a", "c"], ["Set", "d"]],
        expected: ["Set", "b", "f"],
        caption: "Several sets can be removed at once",
      },
      {
        expr: ["SetMinus", ["List", "a", "b", "c", "d", "f"], ["List", "a", "c"], ["List", "d"]],
        expected: ["Set", "b", "f"],
        aspirational: true,
        category: "Scope",
        caption:
          "Lists as well as sets, as Wolfram's $Complement$ takes; compute-engine's SetMinus rejects a $List$ — not yet",
      },
      {
        expr: ["SetMinus", ["Range", 1, 10], ["Set", 2, 3]],
        expected: ["Set", 1, 4, 5, 6, 7, 8, 9, 10],
        aspirational: true,
        category: "Scope",
        caption:
          "A [[Range]] as the universe to remove from; compute-engine wants an explicit $Set$ — not yet",
      },
      {
        expr: ["SetMinus", ["Set", 1, 2, 3], "EmptySet"],
        expected: ["Set", 1, 2, 3],
        category: "Properties",
        caption: "Removing the empty set changes nothing: $A \\setminus \\varnothing = A$",
      },
      {
        expr: ["SetMinus", ["Set", 1, 2, 3], ["Set", 1, 2, 3]],
        expected: "EmptySet",
        category: "Properties",
        caption: "$A \\setminus A = \\varnothing$",
      },
      {
        expr: ["SetMinus", ["Set", 5, 4, 3, 2, 1], ["Set", 2]],
        expected: ["Set", 5, 4, 3, 1],
        category: "Possible issues",
        caption: "The result keeps the first set's order rather than sorting it",
        divergence: {
          wolfram:
            "Wolfram's Complement sorts its result: Complement[{5, 4, 3, 2, 1}, {2}] is {1, 3, 4, 5}.",
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
      {
        call: "First(collection, default)",
        description: "`default` when the collection is empty, instead of the first element.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "$First(c) = At(c, 1)$. See [[At]].",
      "Positional indexing from the front (index 1) and back (negative indices).",
      "On an empty collection with no default given, returns the symbol $Missing$ rather than raising an error.",
      "A second argument supplies a default for an empty collection, instead of $Missing$.",
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
        category: "Scope",
        caption: "A second argument supplies a default for an empty collection",
      },
      { expr: ["First", ["List", "a", "b", "c"]], expected: "a" },
      {
        expr: ["First", ["List", ["List", "a", "b"], ["List", "c", "d"]]],
        expected: ["List", "a", "b"],
        category: "Scope",
        caption: "Of a matrix, the first row",
      },
      {
        expr: ["First", ["Range", 5, 10]],
        expected: 5,
        category: "Scope",
        caption: "A lazy [[Range]] works too",
      },
      {
        expr: ["First", ["Add", ["Power", "a", 2], ["Power", "b", 2]]],
        expected: ["Power", "a", 2],
        aspirational: true,
        category: "Scope",
        caption:
          "Any expression, not just a list: the first term of a sum; compute-engine's First wants a collection — not yet",
      },
      {
        expr: ["First", ["List", "a", "b"], "x"],
        expected: "a",
        category: "Scope",
        caption: "A default is ignored when the collection has a first element",
      },
    ],
    seeAlso: ["Last", "At"],
  },
  {
    name: "Last",
    domain: "Collections",
    signature: "Last(collection)",
    summary: "The last element of a collection.",
    signatures: [
      { call: "Last(collection)", description: "the last element of the collection." },
      {
        call: "Last(collection, default)",
        description: "`default` when the collection is empty, instead of the last element.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "$Last(c) = At(c, -1)$. See [[At]].",
      "Positional indexing from the front (index 1) and back (negative indices).",
      "Complements [[First]] for the other end of a collection.",
      "A second argument supplies a default for an empty collection, instead of $Missing$.",
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
        category: "Scope",
        caption: "A second argument supplies a default for an empty collection",
      },
      { expr: ["Last", ["List", "a", "b", "c"]], expected: "c" },
      {
        expr: ["Last", ["List", ["List", "a", "b"], ["List", "c", "d"], ["List", "f", "g"]]],
        expected: ["List", "f", "g"],
        category: "Scope",
        caption: "Of a matrix, the last row",
      },
      {
        expr: ["Last", ["Range", 5, 10]],
        expected: 10,
        category: "Scope",
        caption: "A lazy [[Range]] works too",
      },
      {
        expr: ["Last", ["Add", ["Power", "a", 2], ["Power", "b", 2]]],
        expected: ["Power", "b", 2],
        aspirational: true,
        category: "Scope",
        caption:
          "Any expression, not just a list: the last term of a sum; compute-engine's Last wants a collection — not yet",
      },
      {
        expr: ["Last", ["List", "a", "b"], "x"],
        expected: "b",
        category: "Scope",
        caption: "A default is ignored when the collection has a last element",
      },
      {
        expr: ["Last", ["List"]],
        expected: "Missing",
        category: "Possible issues",
        caption:
          "An empty collection has no last element; compute-engine returns the symbol $Missing$",
        divergence: {
          wolfram:
            "Last of an empty list is the symbol Missing here; Wolfram leaves Last[{}] unevaluated (with a Last::nolast message).",
        },
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
      "Index 0 is the collection's own head, matching Wolfram's Part[c, 0] — compute-engine gave $NaN$ before.",
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
        category: "Scope",
        caption: "Index 0 is the collection's own head, matching Wolfram's Part[c, 0]",
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
      { expr: ["At", ["List", "a", "b", "c", "d"], 3], expected: "c" },
      {
        expr: ["At", ["List", ["List", 1, 2, 3], ["List", 4, 5, 6]], 2, 3],
        expected: 6,
        category: "Scope",
        caption: "Several indices reach into successive levels: row 2, column 3",
      },
      {
        expr: ["At", ["List", ["List", 1, 2], ["List", 3, 4]], -1, -1],
        expected: 4,
        category: "Scope",
        caption: "Negative indices work at every level",
      },
      {
        expr: ["At", ["List", "a", "b", "c", "d", "f"], ["List", -1, -2]],
        expected: ["List", "f", "d"],
        category: "Scope",
        caption: "Negative indices inside an index list",
      },
      {
        expr: ["At", ["List", "a", "b", "c", "d", "f"], ["Range", 1, 5, 2]],
        expected: ["List", "a", "c", "f"],
        category: "Scope",
        caption: "A stepped [[Range]] takes every other element",
      },
      {
        expr: ["At", ["List", "a", "b", "c", "d", "f"], ["Range", -3, -1]],
        expected: ["List", "c", "d", "f"],
        category: "Scope",
        caption: "Negative bounds count from the end: the last three elements",
      },
      {
        expr: ["At", ["Range", 5, 10], 2],
        expected: 6,
        category: "Scope",
        caption: "A lazy [[Range]] is indexed directly",
      },
      {
        expr: ["At", ["List", ["List", 1, 2, 3], ["List", 4, 5, 6]], "All", 2],
        expected: ["List", 2, 5],
        aspirational: true,
        category: "Scope",
        caption:
          "$All$ at the first level takes a whole column; compute-engine's At has no $All$ — not yet",
      },
      {
        expr: [
          "At",
          ["List", ["List", 1, 2, 3], ["List", 4, 5, 6], ["List", 7, 8, 9]],
          ["List", 1, 3],
          ["List", 2, 3],
        ],
        expected: ["List", ["List", 2, 3], ["List", 8, 9]],
        aspirational: true,
        category: "Scope",
        caption:
          "Index lists at two levels extract a submatrix (rows 1 and 3, columns 2 and 3); not yet",
      },
      {
        expr: ["At", ["List", "a", "b", "c", "d", "f"], ["Span", 2, 4]],
        expected: ["List", "b", "c", "d"],
        aspirational: true,
        category: "Scope",
        caption:
          "A $Span$ ($2;;4$ in Wolfram) takes a contiguous slice; compute-engine has no $Span$ — not yet",
      },
      {
        expr: ["At", ["List", "a", "b", "c", "d", "f"], ["Span", 1, -1, 2]],
        expected: ["List", "a", "c", "f"],
        aspirational: true,
        category: "Scope",
        caption: "A stepped $Span$ ($1;;-1;;2$) takes every other element up to the end; not yet",
      },
      {
        expr: ["At", ["List", "a", "b", "c", "d", "f"], ["Span", -1, 1, -1]],
        expected: ["List", "f", "d", "c", "b", "a"],
        aspirational: true,
        category: "Scope",
        caption: "A negative step ($-1;;1;;-1$) walks backwards, reversing the list; not yet",
      },
      {
        expr: ["At", ["Add", "a", "b", "c"], 2],
        expected: "b",
        aspirational: true,
        category: "Scope",
        caption: "Parts of any expression, not just lists: the second term of a sum; not yet",
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
      "Reports only the first occurrence, as a plain index. See [[Position]] for every occurrence.",
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
        expected: 2,
        category: "Possible issues",
        caption: "IndexOf reports only the first occurrence; see [[Position]] for every one",
        divergence: {
          wolfram:
            "Wolfram's Position gives every occurrence, [[2], [4]]; IndexOf keeps only the first.",
        },
      },
      {
        expr: ["IndexOf", ["List", "a", "b", "a", "a", "b", "c", "b"], "b"],
        expected: 2,
        caption: "Only the first of several occurrences is reported",
      },
      {
        expr: ["IndexOf", ["List", ["List", 1, 2], ["List", 3, 4]], ["List", 3, 4]],
        expected: 2,
        category: "Scope",
        caption: "The value can itself be a list",
      },
      {
        expr: [
          "IndexOf",
          ["List", ["List", "a", "a", "b"], ["List", "b", "a", "a"], ["List", "a", "b", "a"]],
          "b",
        ],
        expected: ["List", 1, 3],
        aspirational: true,
        category: "Scope",
        caption:
          "Searching nested levels, as Wolfram's $FirstPosition$ does, gives the position $\\{1, 3\\}$; compute-engine's IndexOf looks only at the top level",
      },
    ],
    seeAlso: ["At", "Count", "Position"],
  },
  {
    name: "Position",
    domain: "Collections",
    signature: "Position(collection, value)",
    summary: "Every position value occurs at in the collection.",
    signatures: [
      {
        call: "Position(collection, value)",
        description: "every position `value` occurs at, each wrapped in its own $List$.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Wolfram's answer where [[IndexOf]] reports only the first occurrence, as a plain index.",
      "An empty $List$ when the value isn't present.",
      "Each position is wrapped in its own single-element $List$, matching Wolfram's Position — since a position can itself be a multi-level index into a nested collection.",
    ],
    examples: [
      {
        expr: ["Position", ["List", 1, 2, 3, 2], 2],
        expected: ["List", ["List", 2], ["List", 4]],
      },
      {
        expr: ["Position", ["List", 1, 2, 3], 9],
        expected: ["List"],
        caption: "A value absent from the collection has no positions",
      },
      {
        expr: ["At", ["Position", ["List", 1, 2, 3, 2], 2], 1],
        expected: ["List", 2],
        category: "Properties",
        caption: "Position's first entry agrees with [[IndexOf]]",
      },
    ],
    seeAlso: ["IndexOf", "At"],
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
      "Orders numbers numerically and strings lexicographically.",
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
        category: "Scope",
        caption: "A list of strings sorts lexicographically",
      },
      {
        expr: ["Sort", ["List", "d", "b", "c", "a"]],
        expected: ["List", "a", "b", "c", "d"],
        caption: "Symbols sort alphabetically",
      },
      {
        expr: ["Sort", ["List", ["Rational", 3, 2], 1, 0.5, -2]],
        expected: ["List", -2, 0.5, 1, ["Rational", 3, 2]],
        category: "Scope",
        caption: "Integers, rationals and floats together sort by value",
      },
      {
        expr: ["Sort", ["List", "Pi", "ExponentialE", 2, 3, 1, ["Sqrt", 2]]],
        expected: ["List", 1, ["Sqrt", 2], 2, "ExponentialE", 3, "Pi"],
        category: "Scope",
        caption: "Exact numeric constants sort by their value",
        divergence: {
          wolfram:
            "Wolfram's default canonical order puts explicit numbers before symbolic ones: {1, 2, 3, Sqrt[2], E, Pi}; Sort[…, Less] gives this numeric order.",
        },
      },
      {
        expr: ["Sort", ["List", "Pi", "ExponentialE", 2, 3, 1, ["Sqrt", 2]], "Less"],
        expected: ["List", 1, ["Sqrt", 2], 2, "ExponentialE", 3, "Pi"],
        category: "Scope",
        caption: "$Less$ as the ordering function sorts by numeric value",
      },
      {
        expr: ["Sort", ["List", 4, 1, 3, 2, 2], "Greater"],
        expected: ["List", 4, 3, 2, 2, 1],
        category: "Scope",
        caption: "A named ordering function: $Greater$ sorts in descending order",
      },
      {
        expr: [
          "Sort",
          ["List", ["List", "a", 2], ["List", "c", 1], ["List", "d", 3]],
          ["Function", ["Less", ["At", "_1", 2], ["At", "_2", 2]]],
        ],
        expected: ["List", ["List", "c", 1], ["List", "a", 2], ["List", "d", 3]],
        category: "Scope",
        caption: "Sorting pairs by their second element with a custom comparator",
      },
      {
        expr: ["Sort", ["f", "b", "a", "c"]],
        expected: ["f", "a", "b", "c"],
        aspirational: true,
        category: "Scope",
        caption: "Sorts the arguments of any head, not just a list; not yet",
      },
      {
        expr: ["Equal", ["Sort", ["Reverse", ["List", 3, 1, 2]]], ["Sort", ["List", 3, 1, 2]]],
        expected: "True",
        category: "Properties",
        caption: "The result doesn't depend on the input order",
      },
      {
        expr: ["Sort", ["List"]],
        expected: ["List"],
        aspirational: true,
        category: "Possible issues",
        caption: "The empty list sorts to itself; compute-engine leaves $Sort(\\{\\})$ unevaluated",
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
      {
        call: "Ordering(collection, n)",
        description: "just the first `n` indices of the full ordering.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "$c[[Ordering(c)]] = Sort(c)$: applying the permutation at those positions recovers [[Sort]]'s result.",
      "Ties break in favor of earlier position, i.e. it's a stable ordering.",
      "A second argument $n$ takes just the first $n$ indices of the full ordering.",
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
        category: "Scope",
        caption: "A second argument takes just the first n indices of the full ordering",
      },
      {
        expr: ["Ordering", ["List", 2, 6, 1, 9, 1, 2, 3]],
        expected: ["List", 3, 5, 1, 6, 7, 2, 4],
      },
      {
        expr: ["Ordering", ["List", "c", "a", "b"]],
        expected: ["List", 2, 3, 1],
        aspirational: true,
        category: "Scope",
        caption:
          "Symbols order alphabetically; compute-engine returns the identity permutation for them",
      },
      {
        expr: ["Ordering", ["List", 2, 6, 1, 9, 1, 2, 3], -1],
        expected: ["List", 4],
        aspirational: true,
        category: "Scope",
        caption: "A negative count gives the positions of the largest elements; not yet",
      },
      {
        expr: ["Ordering", ["List", 2, 6, 1, 9, 1, 2, 3], ["List", 4, -1]],
        expected: ["List", 6, 7, 2, 4],
        aspirational: true,
        category: "Scope",
        caption:
          "A $\\{m, n\\}$ spec takes the 4th through the last entries of the ordering; not yet",
      },
      {
        expr: ["Ordering", ["List", 2, 6, 1, 9, 3], "All", "Greater"],
        expected: ["List", 4, 2, 5, 1, 3],
        aspirational: true,
        category: "Scope",
        caption: "A third argument orders by a custom test, here descending; not yet",
      },
      {
        expr: ["Ordering", ["List", 2, 6, 1, 9, 2], ["UpTo", 6]],
        expected: ["List", 3, 1, 5, 2, 4],
        aspirational: true,
        category: "Scope",
        caption: "$UpTo(6)$ asks for at most 6 positions, so a 5-element list gives all 5; not yet",
      },
      {
        expr: ["Ordering", ["Ordering", ["List", 3, 1, 2]]],
        expected: ["List", 3, 1, 2],
        category: "Properties",
        caption:
          "On a permutation, $Ordering$ is the inverse, so applying it twice recovers the permutation",
      },
      {
        expr: ["First", ["Ordering", ["List", 2, 6, 1, 9, 1, 2, 3]]],
        expected: 3,
        category: "Applications",
        caption: "The position of the smallest element. See [[First]]",
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
      "An atom has no parts, so its length is 0 — it isn't a type error.",
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
        category: "Scope",
        caption: "An atom has no parts, so its length is 0",
      },
      { expr: ["Length", ["List", "a", "b", "c", "d"]], expected: 4 },
      {
        expr: ["Length", ["List"]],
        expected: 0,
        category: "Scope",
        caption: "The empty list has length 0",
      },
      {
        expr: ["Length", ["List", ["List", 1, 2], ["List", 3, 4], ["List", 5, 6]]],
        expected: 3,
        category: "Scope",
        caption: "Of a matrix, the number of rows",
      },
      {
        expr: ["Length", ["Set", 1, 1, 2]],
        expected: 2,
        category: "Scope",
        caption: "A $Set$ holds each element once, so a repeated element counts once",
      },
      {
        expr: ["Length", ["Add", "a", "b", "c", "d"]],
        expected: 4,
        aspirational: true,
        category: "Scope",
        caption:
          "Any expression: the number of terms in a sum; compute-engine's Length wants a collection — not yet",
      },
      {
        expr: ["Length", ["f", ["g", "x", "y"], "z"]],
        expected: 2,
        aspirational: true,
        category: "Scope",
        caption: "The number of arguments of a call, counting only the top level; not yet",
      },
      {
        expr: ["Length", "Pi"],
        expected: 0,
        category: "Scope",
        caption: "A symbol such as $\\pi$ is an atom, of length 0",
      },
      {
        expr: ["Length", ["Range", 1, 20]],
        expected: 20,
        category: "Scope",
        caption: "A lazy [[Range]] is counted without being materialised",
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
      "Tests exact equality against a fixed value — not a Wolfram-style typed pattern like `_Integer`.",
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
        expected: 0,
        category: "Possible issues",
        caption: "Count tests exact equality; a typed pattern like `_Integer` matches nothing",
        divergence: {
          wolfram: "Wolfram's `_Integer` pattern counts every integer element, here 2 (1 and 2).",
        },
      },
      { expr: ["Count", ["List", "a", "b", "a", "a", "b", "c", "b"], "b"], expected: 3 },
      {
        expr: ["Count", ["List", ["List", 1, 2], ["List", 1, 2], 3], ["List", 1, 2]],
        expected: 2,
        category: "Scope",
        caption: "The value can itself be a list",
      },
      {
        expr: ["Count", ["List", 1, 2, 3, 4], ["Function", ["Greater", "_1", 2]]],
        expected: 2,
        category: "Scope",
        caption:
          "A predicate counts the elements satisfying it, like Wolfram's pattern test $\\_?(\\# > 2 \\&)$",
      },
      {
        expr: ["Count", ["List", ["List", "a", "a", "b"], "b", ["List", "a", "b", "a"]], "b"],
        expected: 1,
        category: "Scope",
        caption: "Only top-level elements are compared by default",
      },
      {
        expr: ["Count", ["List", ["List", "a", "a", "b"], "b", ["List", "a", "b", "a"]], "b", 2],
        expected: 3,
        aspirational: true,
        category: "Scope",
        caption: "A level spec counts matches down to level 2; not yet",
      },
      {
        expr: [
          "Count",
          ["List", ["List", "a", "a", "b"], "b", ["List", "a", "b", "a"]],
          "b",
          ["List", 2],
        ],
        expected: 2,
        aspirational: true,
        category: "Scope",
        caption: "$\\{2\\}$ counts matches at level 2 only; not yet",
      },
      {
        expr: ["Count", ["List", "a", 2, "a", "a", 1, "c", "b", 3, 3], "_Integer"],
        expected: 4,
        aspirational: true,
        category: "Scope",
        caption: "A pattern $\\_Integer$ counts the integers among symbols; not yet",
      },
      {
        expr: [
          "Equal",
          [
            "Add",
            ["Count", ["List", 1, 2, 2, 3, 3, 3], 1],
            ["Count", ["List", 1, 2, 2, 3, 3, 3], 2],
            ["Count", ["List", 1, 2, 2, 3, 3, 3], 3],
          ],
          ["Length", ["List", 1, 2, 2, 3, 3, 3]],
        ],
        expected: "True",
        category: "Properties",
        caption: "The counts of the distinct values add up to the [[Length]]",
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
      {
        call: "Join(a, b, …, n)",
        description:
          "corresponding sublists n-1 levels down joined pairwise, instead of the top level.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "$Join(A, B) = Flatten(\\{A, B\\}, 1)$. See [[Flatten]].",
      "The argument collections don't need to be $List$, but must all share the same head.",
      "A trailing integer argument joins at that level instead of the top level.",
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
        category: "Scope",
        caption: "A trailing integer argument joins at that level rather than the top level",
      },
      {
        expr: ["Join", ["List", "a", "b", "c"], ["List", "x", "y"], ["List", "u", "v", "w"]],
        expected: ["List", "a", "b", "c", "x", "y", "u", "v", "w"],
      },
      {
        expr: [
          "Join",
          ["List", ["List", "a", "b"], ["List", "c", "d"]],
          ["List", ["List", 1, 2], ["List", 3, 4]],
        ],
        expected: ["List", ["List", "a", "b"], ["List", "c", "d"], ["List", 1, 2], ["List", 3, 4]],
        category: "Scope",
        caption: "Joining matrices stacks their rows",
      },
      {
        expr: ["Join", ["Set", 1, 2], ["Set", 3]],
        expected: ["Set", 1, 2, 3],
        aspirational: true,
        category: "Scope",
        caption:
          "Sets as well as lists, as long as all arguments share the head; left unevaluated since the level-aware Join override",
      },
      {
        expr: ["Join", ["List", 1, 2], ["Range", 3, 5]],
        expected: ["List", 1, 2, 3, 4, 5],
        category: "Scope",
        caption: "A lazy [[Range]] is spliced in",
      },
      {
        expr: ["Join"],
        expected: ["List"],
        aspirational: true,
        category: "Scope",
        caption:
          "With no arguments, the empty list; left unevaluated since the level-aware Join override",
      },
      {
        expr: [
          "Join",
          ["List", ["List", "a", "b"], ["List", "c", "d"]],
          ["List", ["List", 1, 2], ["List", 3, 4]],
          2,
        ],
        expected: ["List", ["List", "a", "b", 1, 2], ["List", "c", "d", 3, 4]],
        category: "Scope",
        caption: "At level 2, matrices are joined side by side",
      },
      {
        expr: [
          "Join",
          ["List", ["List", 1], ["List", 5, 6]],
          ["List", ["List", 2, 3], ["List", 7]],
          ["List", ["List", 4], ["List", 8]],
          2,
        ],
        expected: ["List", ["List", 1, 2, 3, 4], ["List", 5, 6, 7, 8]],
        category: "Scope",
        caption: "Ragged rows join at level 2 too",
      },
      {
        expr: ["Join", ["List", ["List", "x"]], ["List", ["List", 1, 2], ["List", 3, 4]], 2],
        expected: ["List", ["List", "x", 1, 2], ["List", 3, 4]],
        aspirational: true,
        category: "Scope",
        caption: "Rows missing from the shorter array are taken as empty; not yet",
      },
      {
        expr: ["Join", ["f", "a"], ["f", "b"]],
        expected: ["f", "a", "b"],
        aspirational: true,
        category: "Scope",
        caption: "Any head, as long as all the arguments share it; not yet",
      },
      {
        expr: [
          "Equal",
          ["Join", ["Join", ["List", "a", "b", "c"], ["List", "x", "y"]], ["List", "u", "v", "w"]],
          ["Join", ["List", "a", "b", "c"], ["Join", ["List", "x", "y"], ["List", "u", "v", "w"]]],
        ],
        expected: "True",
        category: "Properties",
        caption: "$Join$ is associative",
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
      {
        expr: [
          "Flatten",
          [
            "List",
            ["List", "a", "b"],
            ["List", "c", ["List", "d"], "f"],
            ["List", "g", ["List", "h", "k"]],
          ],
        ],
        expected: ["List", "a", "b", "c", "d", "f", "g", "h", "k"],
      },
      {
        expr: [
          "Flatten",
          [
            "List",
            ["List", "a", "b"],
            ["List", "c", ["List", "d"], "f"],
            ["List", "g", ["List", "h", "k"]],
          ],
          1,
        ],
        expected: ["List", "a", "b", "c", ["List", "d"], "f", "g", ["List", "h", "k"]],
        category: "Scope",
        caption: "Flatten only the first level",
      },
      {
        expr: [
          "Flatten",
          [
            "List",
            0,
            ["List", 1],
            ["List", ["List", 2, -2]],
            ["List", ["List", ["List", 3], ["List", -3]]],
            ["List", ["List", ["List", ["List", 4]]]],
          ],
          0,
        ],
        expected: [
          "List",
          0,
          ["List", 1],
          ["List", ["List", 2, -2]],
          ["List", ["List", ["List", 3], ["List", -3]]],
          ["List", ["List", ["List", ["List", 4]]]],
        ],
        category: "Scope",
        caption: "Depth 0 leaves the list unchanged",
      },
      {
        expr: [
          "Flatten",
          [
            "List",
            0,
            ["List", 1],
            ["List", ["List", 2, -2]],
            ["List", ["List", ["List", 3], ["List", -3]]],
            ["List", ["List", ["List", ["List", 4]]]],
          ],
          2,
        ],
        expected: ["List", 0, 1, 2, -2, ["List", 3], ["List", -3], ["List", ["List", 4]]],
        category: "Scope",
        caption: "Depth 2 removes two levels of nesting",
      },
      {
        expr: [
          "Flatten",
          [
            "List",
            0,
            ["List", 1],
            ["List", ["List", 2, -2]],
            ["List", ["List", ["List", 3], ["List", -3]]],
            ["List", ["List", ["List", ["List", 4]]]],
          ],
          3,
        ],
        expected: ["List", 0, 1, 2, -2, 3, -3, ["List", 4]],
        category: "Scope",
        caption: "Depth 3",
      },
      {
        expr: [
          "Flatten",
          [
            "List",
            0,
            ["List", 1],
            ["List", ["List", 2, -2]],
            ["List", ["List", ["List", 3], ["List", -3]]],
            ["List", ["List", ["List", ["List", 4]]]],
          ],
          4,
        ],
        expected: ["List", 0, 1, 2, -2, 3, -3, 4],
        category: "Scope",
        caption: "Depth 4 reaches the deepest level",
      },
      {
        expr: [
          "Flatten",
          [
            "List",
            0,
            ["List", 1],
            ["List", ["List", 2, -2]],
            ["List", ["List", ["List", 3], ["List", -3]]],
            ["List", ["List", ["List", ["List", 4]]]],
          ],
          "PositiveInfinity",
        ],
        expected: ["List", 0, 1, 2, -2, 3, -3, 4],
        aspirational: true,
        category: "Scope",
        caption:
          "An infinite depth flattens every level, like the default; compute-engine wants an integer depth",
      },
      {
        expr: [
          "Flatten",
          ["List", ["List", 1, 2], ["List", 3, 4]],
          ["List", ["List", 2], ["List", 1]],
        ],
        expected: ["List", ["List", 1, 3], ["List", 2, 4]],
        aspirational: true,
        category: "Scope",
        caption: "Lists of levels regroup the dimensions, here into a transpose; not yet",
      },
      {
        expr: ["Flatten", ["f", "a", ["f", "b", ["f", "c"]]]],
        expected: ["f", "a", "b", "c"],
        aspirational: true,
        category: "Scope",
        caption: "Nested calls of any one head flatten, not just lists; not yet",
      },
      {
        expr: ["Flatten", ["List", 1, 2, 3]],
        expected: ["List", 1, 2, 3],
        category: "Properties",
        caption: "A list with no nesting is unchanged",
      },
      {
        expr: ["Length", ["Flatten", ["List", ["List", 1, 2, 3], ["List", 4, 5, 6]]]],
        expected: 6,
        category: "Properties",
        caption: "Flattening an $m \\times n$ matrix gives $mn$ elements. See [[Length]]",
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
      {
        expr: ["Append", ["List", "a", "b", "c", "d"], "x"],
        expected: ["List", "a", "b", "c", "d", "x"],
      },
      {
        expr: ["Append", ["List"], "x"],
        expected: ["List", "x"],
        category: "Scope",
        caption: "Onto the empty list",
      },
      {
        expr: ["Append", ["Range", 1, 3], 4],
        expected: ["List", 1, 2, 3, 4],
        category: "Scope",
        caption: "A lazy [[Range]] is materialised first",
      },
      {
        expr: ["Append", ["f", "a", "b"], "c"],
        expected: ["f", "a", "b", "c"],
        aspirational: true,
        category: "Scope",
        caption: "Any head, not just a list; not yet",
      },
      {
        expr: ["Append", ["List", ["List", 1, 2], ["List", 3, 4]], ["List", 5, 6]],
        expected: ["List", ["List", 1, 2], ["List", 3, 4], ["List", 5, 6]],
        category: "Applications",
        caption: "Adding a row to a matrix",
      },
      {
        expr: [
          "Equal",
          ["Length", ["Append", ["List", 1, 2, 3], 4]],
          ["Add", ["Length", ["List", 1, 2, 3]], 1],
        ],
        expected: "True",
        category: "Properties",
        caption: "Appending adds exactly one element. See [[Length]]",
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
      "[[Flatten]] undoes Partition: chunking and re-flattening recovers the original list — when the length divides evenly.",
      "With $d < n$, windows overlap; the two-argument form is equivalent to $d = n$, giving non-overlapping chunks.",
      "A ragged remainder, shorter than $n$, is dropped rather than kept as a partial chunk.",
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
        category: "Possible issues",
        caption: "$\\{1..5\\}$ partitioned by 2 drops the ragged remainder $\\{5\\}$",
      },
      {
        expr: ["Partition", ["List", 1, 2, 3, 4, 5, 6, 7], 3, 2],
        expected: ["List", ["List", 1, 2, 3], ["List", 3, 4, 5], ["List", 5, 6, 7]],
        category: "Scope",
        caption: "Windows of 3 with offset 2 share one element with their neighbour",
      },
      {
        expr: ["Partition", ["List", 1, 2, 3, 4, 5, 6, 7], 2, 3],
        expected: ["List", ["List", 1, 2], ["List", 4, 5]],
        category: "Scope",
        caption: "An offset larger than the size skips elements between chunks",
      },
      {
        expr: [
          "Partition",
          ["List", ["List", 11, 12, 13], ["List", 21, 22, 23], ["List", 31, 32, 33]],
          ["List", 2, 2],
          1,
        ],
        expected: [
          "List",
          [
            "List",
            ["List", ["List", 11, 12], ["List", 21, 22]],
            ["List", ["List", 12, 13], ["List", 22, 23]],
          ],
          [
            "List",
            ["List", ["List", 21, 22], ["List", 31, 32]],
            ["List", ["List", 22, 23], ["List", 32, 33]],
          ],
        ],
        aspirational: true,
        category: "Scope",
        caption: "A list of sizes cuts a matrix into overlapping $2 \\times 2$ blocks; not yet",
      },
      {
        expr: ["Partition", ["List", 1, 2, 3, 4, 5, 6], ["UpTo", 4]],
        expected: ["List", ["List", 1, 2, 3, 4], ["List", 5, 6]],
        aspirational: true,
        category: "Scope",
        caption: "$UpTo(4)$ allows a shorter final chunk; not yet",
      },
      {
        expr: ["Partition", ["List", 1, 2, 3, 4, 5, 6], 5, 1, ["List", 1, 1]],
        expected: [
          "List",
          ["List", 1, 2, 3, 4, 5],
          ["List", 2, 3, 4, 5, 6],
          ["List", 3, 4, 5, 6, 1],
          ["List", 4, 5, 6, 1, 2],
          ["List", 5, 6, 1, 2, 3],
          ["List", 6, 1, 2, 3, 4],
        ],
        aspirational: true,
        category: "Scope",
        caption:
          "Overhangs $\\{1, 1\\}$ wrap cyclically until the last window starts at the last element; not yet",
      },
      {
        expr: ["Partition", ["List", 1, 2, 3, 4, 5, 6], 5, 1, ["List", -1, 1]],
        expected: [
          "List",
          ["List", 3, 4, 5, 6, 1],
          ["List", 4, 5, 6, 1, 2],
          ["List", 5, 6, 1, 2, 3],
          ["List", 6, 1, 2, 3, 4],
          ["List", 1, 2, 3, 4, 5],
          ["List", 2, 3, 4, 5, 6],
          ["List", 3, 4, 5, 6, 1],
          ["List", 4, 5, 6, 1, 2],
          ["List", 5, 6, 1, 2, 3],
          ["List", 6, 1, 2, 3, 4],
        ],
        aspirational: true,
        category: "Scope",
        caption:
          "Overhangs $\\{-1, 1\\}$: the first window ends at the first element, the last starts at the last; not yet",
      },
      {
        expr: ["Partition", ["List", 1, 2, 3, 4, 5, 6], 3, 1, ["List", 1, 1], "x"],
        expected: [
          "List",
          ["List", 1, 2, 3],
          ["List", 2, 3, 4],
          ["List", 3, 4, 5],
          ["List", 4, 5, 6],
          ["List", 5, 6, "x"],
          ["List", 6, "x", "x"],
        ],
        aspirational: true,
        category: "Scope",
        caption: "A padding element fills the overhang instead of wrapping around; not yet",
      },
      {
        expr: ["Partition", ["List", 1, 2, 3, 4, 5, 6], 3, 1, ["List", -1, -1], "x"],
        expected: [
          "List",
          ["List", "x", "x", 1],
          ["List", "x", 1, 2],
          ["List", 1, 2, 3],
          ["List", 2, 3, 4],
          ["List", 3, 4, 5],
          ["List", 4, 5, 6],
        ],
        aspirational: true,
        category: "Scope",
        caption: "Padding on the left, with overhangs $\\{-1, -1\\}$; not yet",
      },
      {
        expr: ["Partition", ["List", 1, 2, 3, 4, 5, 6], 3, 1, ["List", -1, 1], "x"],
        expected: [
          "List",
          ["List", "x", "x", 1],
          ["List", "x", 1, 2],
          ["List", 1, 2, 3],
          ["List", 2, 3, 4],
          ["List", 3, 4, 5],
          ["List", 4, 5, 6],
          ["List", 5, 6, "x"],
          ["List", 6, "x", "x"],
        ],
        aspirational: true,
        category: "Scope",
        caption: "Padding on both sides, with overhangs $\\{-1, 1\\}$; not yet",
      },
      {
        expr: ["Partition", ["List", 1, 2, 3, 4, 5, 6, 7, 8, 9], 3],
        expected: ["List", ["List", 1, 2, 3], ["List", 4, 5, 6], ["List", 7, 8, 9]],
        category: "Applications",
        caption: "Reshaping a list of 9 into a $3 \\times 3$ matrix",
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
      {
        call: "Mean(matrix)",
        description: "the column-wise mean, one value per column.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "$Mean(c) = \\dfrac{\\sum c}{Length(c)}$. See [[Length]].",
      "Sensitive to outliers — a single extreme value can drag the mean far from the bulk of the data. See [[Median]] for a more robust alternative.",
      "Given a matrix (a list of equal-length rows), computes the mean of each column.",
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
        category: "Scope",
        caption: "Given a matrix, Mean is column-wise",
      },
      { expr: ["Mean", ["List", 1.21, 3.4, 2.15, 4, 1.55]], expected: 2.462 },
      {
        expr: ["Mean", ["List", ["Rational", 1, 2], ["Rational", 1, 3], ["Rational", 1, 6]]],
        expected: ["Rational", 1, 3],
        category: "Scope",
        caption: "Exact rationals give an exact mean",
      },
      {
        expr: ["Mean", ["List", "a", "b", "c", "d"]],
        expected: ["Multiply", ["Rational", 1, 4], ["Add", "a", "b", "c", "d"]],
        aspirational: true,
        category: "Scope",
        caption:
          "Symbolic data: $\\frac{a+b+c+d}{4}$; compute-engine's Mean needs numbers — not yet",
      },
      {
        expr: ["Mean", ["List", "Pi", "ExponentialE", 2]],
        expected: ["Multiply", ["Rational", 1, 3], ["Add", 2, "ExponentialE", "Pi"]],
        aspirational: true,
        category: "Scope",
        caption: "Exact constants give an exact mean $\\frac{2+e+\\pi}{3}$; not yet",
      },
      {
        expr: ["Mean", ["List", ["List", "a", "u"], ["List", "b", "v"], ["List", "c", "w"]]],
        expected: [
          "List",
          ["Multiply", ["Rational", 1, 3], ["Add", "a", "b", "c"]],
          ["Multiply", ["Rational", 1, 3], ["Add", "u", "v", "w"]],
        ],
        aspirational: true,
        category: "Scope",
        caption: "Of a matrix, the mean of each column; not yet",
      },
      {
        expr: ["Mean", ["Range", 1, 100]],
        expected: ["Rational", 101, 2],
        category: "Scope",
        caption: "The mean of a lazy [[Range]], exactly",
      },
      {
        expr: ["Mean", ["List"]],
        expected: "NaN",
        category: "Possible issues",
        caption: "The mean of no data is $NaN$",
        divergence: {
          wolfram: "Wolfram leaves Mean[{}] unevaluated (with a Mean::rectn message).",
        },
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
      {
        call: "Median(matrix)",
        description: "the column-wise median, one value per column.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "For an odd-length collection, the median is the middle element of [[Sort]]'s result; for even length, it's the average of the two middle elements.",
      "Much less sensitive to outliers than [[Mean]] — a single extreme value barely moves it.",
      "Given a matrix (a list of equal-length rows), computes the median of each column.",
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
        category: "Scope",
        caption: "Given a matrix, Median is column-wise",
      },
      { expr: ["Median", ["List", 1, 2, 3, 4, 5, 6, 7]], expected: 4 },
      { expr: ["Median", ["List", 1, 2, 3, 4, 5, 6, 7, 8]], expected: ["Rational", 9, 2] },
      {
        expr: ["Median", ["List", 3, 1, 4, 1, 5, 9, 2, 6]],
        expected: ["Rational", 7, 2],
        category: "Scope",
        caption:
          "Unsorted data is sorted first; the middle pair 3 and 4 averages to $\\frac{7}{2}$",
      },
      {
        expr: ["Median", ["List", ["Rational", 1, 2], ["Rational", 1, 3], ["Rational", 1, 6]]],
        expected: ["Rational", 1, 3],
        category: "Scope",
        caption: "Exact rationals",
      },
      {
        expr: ["Median", ["List", "Pi", "ExponentialE", 2]],
        expected: "ExponentialE",
        aspirational: true,
        category: "Scope",
        caption:
          "Exact constants are ordered by value, putting $e$ in the middle; compute-engine's Median needs explicit numbers — not yet",
      },
      {
        expr: ["Median", ["Range", 1, 100]],
        expected: ["Rational", 101, 2],
        category: "Scope",
        caption: "The median of a lazy [[Range]] of even length is the mean of the middle two",
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
      "When several elements share the highest frequency, Mode returns just one. See [[Commonest]] for every tied value.",
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
        expected: 1,
        category: "Possible issues",
        caption:
          "With a tie for most frequent, Mode returns just one; see [[Commonest]] for every tied value",
        divergence: {
          wolfram: "Wolfram's Commonest returns every tied mode, [1, 2], here.",
        },
      },
      { expr: ["Mode", ["List", 1, 2, 3, 3, 2, 3]], expected: 3 },
      {
        expr: ["Mode", ["List", ["Rational", 1, 2], 1, ["Rational", 1, 2]]],
        expected: ["Rational", 1, 2],
        category: "Scope",
        caption: "Exact rationals",
      },
      {
        expr: ["Mode", ["List", "b", "a", "c", 2, "a", "b", 1, 2]],
        expected: ["List", "b", "a", 2],
        aspirational: true,
        category: "Scope",
        caption:
          "Symbols and numbers mixed, three-way tie: Wolfram's $Commonest$ lists $b$, $a$, $2$ in order of first appearance; compute-engine's Mode needs numbers",
      },
      {
        expr: ["Mode", ["List"]],
        expected: "NaN",
        category: "Possible issues",
        caption: "Empty data has no mode; compute-engine returns $NaN$",
        divergence: { wolfram: "Wolfram's Commonest[{}] is the empty list {}." },
      },
    ],
    seeAlso: ["Mean", "Median", "Commonest"],
  },
  {
    name: "Commonest",
    domain: "Collections",
    signature: "Commonest(collection)",
    summary: "Every element tied for the most frequently occurring in the collection.",
    signatures: [
      {
        call: "Commonest(collection)",
        description:
          "every element tied for the highest frequency, in the order first encountered.",
        library: "enumeratio-collections",
      },
    ],
    details: [
      "Wolfram's answer to a tied [[Mode]]: where Mode picks one, Commonest returns every value tied for the highest frequency.",
      "With a unique mode, $Commonest(c) = \\{Mode(c)\\}$: a single-element list.",
      "Every returned value occurs exactly as many times as the highest frequency in the collection. See [[Count]].",
    ],
    examples: [
      { expr: ["Commonest", ["List", 1, 1, 2, 2, 3]], expected: ["List", 1, 2] },
      {
        expr: ["Commonest", ["List", 1, 2, 2, 3]],
        expected: ["List", 2],
        caption: "With a unique mode, Commonest returns a single-element list",
      },
      {
        expr: ["First", ["Commonest", ["List", 1, 2, 2, 3]]],
        expected: 2,
        category: "Properties",
        caption: "With a unique mode, $Commonest(c) = \\{Mode(c)\\}$. See [[Mode]]",
      },
      {
        expr: ["Commonest", ["List", "b", "a", "c", 2, "a", "b", 1, 2]],
        expected: ["List", "b", "a", 2],
        caption: "Every element tied for most frequent, symbols and numbers alike",
      },
      {
        expr: ["Commonest", ["List", 1, 2, 3]],
        expected: ["List", 1, 2, 3],
        category: "Scope",
        caption: "All distinct: all tie",
      },
      {
        expr: ["Commonest", ["List", 1, 2, 2, 3, 3, 3, 4]],
        expected: ["List", 3],
        caption: "A single most-frequent element still comes back in a list",
      },
      {
        expr: ["Commonest", ["List", 1, 2, 2, 3, 3, 3, 4], 2],
        expected: ["List", 3, 2],
        aspirational: true,
        category: "Scope",
        caption: "The $n$ commonest, most frequent first; the count argument is not taken yet",
      },
      {
        expr: [
          "Equal",
          ["First", ["Commonest", ["List", 1, 2, 2, 3, 3, 3, 4]]],
          ["Mode", ["List", 1, 2, 2, 3, 3, 3, 4]],
        ],
        expected: "True",
        category: "Properties",
        caption: "Without a tie, the single commonest element is the [[Mode]]",
      },
    ],
    seeAlso: ["Mode", "Mean", "Median"],
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
      {
        expr: ["Product", ["Power", "i", 2], ["Tuple", "i", 1, 6]],
        expected: 518400,
        caption: "$\\prod_{i=1}^{6} i^2 = (6!)^2$",
      },
      {
        expr: ["Product", ["Power", "i", 2], ["Tuple", "i", 1, "n"]],
        expected: ["Power", ["Factorial", "n"], 2],
        aspirational: true,
        caption: "A symbolic upper limit: $\\prod_{i=1}^{n} i^2 = (n!)^2$; not yet",
      },
      {
        expr: ["Product", "k", ["Tuple", "k", 1, "n"]],
        expected: ["Factorial", "n"],
        category: "Scope",
        caption: "A symbolic upper limit: $\\prod_{k=1}^{n} k = n!$. See [[Factorial]]",
      },
      {
        expr: ["Product", ["Power", "x", "k"], ["Tuple", "k", 1, "n"]],
        expected: ["Power", "x", ["Multiply", ["Rational", 1, 2], "n", ["Add", "n", 1]]],
        aspirational: true,
        category: "Scope",
        caption: "Exponents add: $\\prod_{k=1}^{n} x^k = x^{n(n+1)/2}$; not yet",
      },
      {
        expr: ["Product", ["Divide", ["Add", "k", 1], "k"], ["Tuple", "k", 1, "n"]],
        expected: ["Add", "n", 1],
        category: "Scope",
        caption: "A telescoping product: $\\prod_{k=1}^{n} \\frac{k+1}{k} = n+1$",
      },
      {
        expr: ["Product", ["f", "i"], ["Tuple", "i", 1, 4]],
        expected: ["Multiply", ["f", 1], ["f", 2], ["f", 3], ["f", 4]],
        category: "Scope",
        caption: "An undefined function, expanded term by term",
      },
      {
        expr: ["Product", ["f", "i"], ["Tuple", "i", 1, 4, 2]],
        expected: ["Multiply", ["f", 1], ["f", 3]],
        category: "Scope",
        caption: "A step of 2 takes every other index",
      },
      {
        expr: ["Product", ["f", "i"], ["Element", "i", ["List", "a", "b", "c"]]],
        expected: ["Multiply", ["f", "a"], ["f", "b"], ["f", "c"]],
        category: "Scope",
        caption: "Over an explicit list of values",
      },
      {
        expr: ["Product", ["Subtract", "x", "k"], ["Tuple", "k", 1, 3]],
        expected: ["Multiply", ["Add", "x", -3], ["Add", "x", -2], ["Add", "x", -1]],
        category: "Scope",
        caption: "A polynomial with roots 1, 2 and 3",
      },
      {
        expr: ["Product", ["Add", "i", "j"], ["Tuple", "i", 1, 3], ["Tuple", "j", 1, 3]],
        expected: 172800,
        category: "Scope",
        caption: "A double product over a $3 \\times 3$ grid",
      },
      {
        expr: ["Product", ["Add", "i", "j"], ["Tuple", "i", 1, 3], ["Tuple", "j", 1, "i"]],
        expected: 2880,
        aspirational: true,
        category: "Scope",
        caption: "An inner limit that depends on the outer index, a triangular product; not yet",
      },
      {
        expr: [
          "Product",
          ["Power", 2, ["Add", "i", "j"]],
          ["Tuple", "i", 1, "p"],
          ["Tuple", "j", 1, "i"],
        ],
        expected: [
          "Power",
          2,
          ["Multiply", ["Rational", 1, 2], "p", ["Power", ["Add", "p", 1], 2]],
        ],
        aspirational: true,
        category: "Scope",
        caption:
          "A symbolic triangular product: $\\prod_{i=1}^{p}\\prod_{j=1}^{i} 2^{i+j} = 2^{p(p+1)^2/2}$; not yet",
      },
      {
        expr: [
          "Product",
          ["Add", 1, ["Divide", 1, ["Power", "k", 2]]],
          ["Tuple", "k", 1, "PositiveInfinity"],
        ],
        expected: ["Divide", ["Sinh", "Pi"], "Pi"],
        category: "Scope",
        caption:
          "An infinite product with a closed form: $\\prod_{k=1}^{\\infty} (1 + 1/k^2) = \\frac{\\sinh \\pi}{\\pi}$",
      },
      {
        expr: [
          "Product",
          ["Subtract", 1, ["Divide", 1, ["Power", "k", 2]]],
          ["Tuple", "k", 2, "PositiveInfinity"],
        ],
        expected: ["Rational", 1, 2],
        category: "Scope",
        caption:
          "An infinite telescoping product: $\\prod_{k=2}^{\\infty} (1 - 1/k^2) = \\frac{1}{2}$",
      },
      {
        expr: [
          "Product",
          ["Subtract", 1, ["Divide", 1, ["Power", "i", 4]]],
          ["Tuple", "i", 2, "PositiveInfinity"],
        ],
        expected: ["Divide", ["Sinh", "Pi"], ["Multiply", 4, "Pi"]],
        aspirational: true,
        category: "Scope",
        caption: "$\\prod_{i=2}^{\\infty} (1 - 1/i^4) = \\frac{\\sinh \\pi}{4\\pi}$; not yet",
      },
      {
        expr: ["Product", ["List", ["Rational", 1, 2], ["Rational", 2, 3], ["Rational", 3, 4]]],
        expected: ["Rational", 1, 4],
        category: "Scope",
        caption: "Exact rationals in a collection",
      },
      {
        expr: ["Product", ["List", "a", "b", "c"]],
        expected: ["Multiply", "a", "b", "c"],
        category: "Scope",
        caption: "Symbolic elements",
      },
      {
        expr: [
          "Product",
          [
            "Divide",
            ["Multiply", 4, ["Power", "k", 2]],
            ["Subtract", ["Multiply", 4, ["Power", "k", 2]], 1],
          ],
          ["Tuple", "k", 1, "PositiveInfinity"],
        ],
        expected: ["Multiply", ["Rational", 1, 2], "Pi"],
        aspirational: true,
        category: "Neat examples",
        caption:
          "The Wallis product: $\\prod_{k=1}^{\\infty} \\frac{4k^2}{4k^2-1} = \\frac{\\pi}{2}$; not yet",
      },
    ],
    seeAlso: ["Length"],
  },
];
