import { registerAlgebra } from "@enumeratio/algebra";
import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, stringAt, symbolNameOf, widenSignature, wrapOperator } from "@enumeratio/boxed";
import {
  basisElement,
  classSum,
  conjugacyClasses,
  cyclicGroup,
  dihedralGroup,
  directProduct,
  type Element,
  type Group,
  isAbelian,
  isCentral,
  multiplyElements,
  order,
} from "./group.ts";
import {
  alternatingGenerators,
  applyPermutation,
  type Cycle,
  cyclesAreValid,
  cyclesToPermutation,
  dropFixedCycles,
  factorial,
  identityPermutation,
  invertPermutation,
  isPermutation,
  permutationGroupClosure,
  permutationToCycles,
} from "./permutations.ts";

// Wiring k[G] to compute-engine.
//
// Group elements are named by their LABEL (a string), so `GroupBasis("s0")` is the
// reflection s in a dihedral group. A basis element does not know which group it belongs
// to, so — as with quiver paths — the product takes the group as an argument.
//
// The heads worth having are not really about the product, which is just the group's own
// table. They are about the centre: `ConjugacyClasses`, `ClassSum`, and the fact that a
// class sum commutes with everything.

/**
 * The string an expression carries — which takes more care than it should.
 *
 * `ce.string("s0")` exposes `.string`, but the MathJSON form `["String", "s0"]` does not:
 * it boxes as a String FUNCTION, and canonicalises to a literal whose `.json` is
 * `'"s0"'` — single quotes for the literal, and INNER DOUBLE QUOTES that compute-engine
 * adds for a non-numeric string. `["String", "2"]` meanwhile becomes plain `'2'`. So a
 * naive reader works on numeric labels and silently fails on every other one, which is
 * exactly the bug this replaced: dihedral products quietly stayed symbolic while cyclic
 * ones worked. Strip both layers.
 */

/** Read `CyclicGroup(n)`, `DihedralGroup(n)` or `GroupDirectProduct(g, h)`. */
function groupOf(expr: BoxedExpression): Group | undefined {
  const ops = operandsOf(expr);
  if (expr.operator === "CyclicGroup") {
    const n = integerAt(ops[0]);
    return n === undefined ? undefined : cyclicGroup(n);
  }
  if (expr.operator === "DihedralGroup") {
    const n = integerAt(ops[0]);
    return n === undefined ? undefined : dihedralGroup(n);
  }
  if (expr.operator === "GroupDirectProduct") {
    const left = ops[0] === undefined ? undefined : groupOf(ops[0]);
    const right = ops[1] === undefined ? undefined : groupOf(ops[1]);
    return left === undefined || right === undefined ? undefined : directProduct(left, right);
  }
  return undefined;
}

// ── permutations: Cycles, Permute, PermutationGroup ────────────────────────────────

/** Read one cycle `List(i1, i2, …)` as a plain number array, or `undefined` if malformed. */
function cycleOf(expr: BoxedExpression): Cycle | undefined {
  if (expr.operator !== "List") return undefined;
  const entries = operandsOf(expr).map(integerAt);
  return entries.every((x): x is number => x !== undefined) ? entries : undefined;
}

/** Read `List(cycle, cycle, …)` — the argument `Cycles` and `PermutationCycles` both take. */
function cycleListOf(listExpr: BoxedExpression): Cycle[] | undefined {
  if (listExpr.operator !== "List") return undefined;
  const cycles = operandsOf(listExpr).map(cycleOf);
  return cycles.every((c): c is Cycle => c !== undefined) ? cycles : undefined;
}

/** Read `Cycles(List(cycle, cycle, …))` as an array of cycles. */
function cyclesOf(expr: BoxedExpression): Cycle[] | undefined {
  if (expr.operator !== "Cycles") return undefined;
  const listExpr = operandsOf(expr)[0];
  return listExpr === undefined ? undefined : cycleListOf(listExpr);
}

/** Read a plain one-line permutation `List(sigma(1), sigma(2), …)`. */
function oneLineOf(expr: BoxedExpression): number[] | undefined {
  if (expr.operator !== "List") return undefined;
  const entries = operandsOf(expr).map(integerAt);
  return entries.every((x): x is number => x !== undefined) ? entries : undefined;
}

/** The largest point a set of cycles mentions. */
const maxSupport = (cycles: readonly Cycle[]): number =>
  cycles.reduce((m, cycle) => cycle.reduce((mm, x) => Math.max(mm, x), m), 0);

/** A one-line word that is actually a permutation -- anything else is left unevaluated. */
function permutationWordOf(expr: BoxedExpression): number[] | undefined {
  const word = oneLineOf(expr);
  return word !== undefined && isPermutation(word) ? word : undefined;
}

/** Either notation for a permutation, widened to degree `n` (identity past its own support). */
function permutationOf(expr: BoxedExpression, n?: number): number[] | undefined {
  const cycles = cyclesOf(expr);
  if (cycles !== undefined) {
    if (!cyclesAreValid(cycles)) return undefined;
    return cyclesToPermutation(cycles, Math.max(n ?? 0, maxSupport(cycles)));
  }
  const oneLine = permutationWordOf(expr);
  if (oneLine === undefined) return undefined;
  if (n === undefined || n <= oneLine.length) return oneLine;
  return oneLine.concat(identityPermutation(n).slice(oneLine.length));
}

const cyclesExpression = (ce: ComputeEngine, cycles: readonly Cycle[]): BoxedExpression =>
  ce.function("Cycles", [
    ce.function(
      "List",
      cycles.map((cycle) =>
        ce.function(
          "List",
          cycle.map((x) => ce.number(x)),
        ),
      ),
    ),
  ]);

/** `PermutationGroup(List(Cycles(...), …))` or `PermutationGroup(List(...), n)`. */
function permutationGroupOf(
  expr: BoxedExpression,
): { readonly degree: number; readonly generators: readonly number[][] } | undefined {
  if (expr.operator !== "PermutationGroup") return undefined;
  const ops = operandsOf(expr);
  const gensExpr = ops[0];
  if (gensExpr === undefined || gensExpr.operator !== "List") return undefined;
  const generatorCycles = operandsOf(gensExpr).map(cyclesOf);
  if (!generatorCycles.every((g): g is Cycle[] => g !== undefined && cyclesAreValid(g))) {
    return undefined;
  }
  const explicitDegree = integerAt(ops[1]) ?? 0;
  const degree = generatorCycles.reduce((m, g) => Math.max(m, maxSupport(g)), explicitDegree);
  const generators = generatorCycles.map((cycles) => cyclesToPermutation(cycles, degree));
  return { degree, generators };
}

/** A 1-based, possibly-negative (Part-style) index into a list of length `n`. */
const resolvePosition = (index: number, n: number): number | undefined => {
  if (index >= 1 && index <= n) return index - 1;
  if (index <= -1 && -index <= n) return n + index;
  return undefined;
};

/** `GroupAlgebra(group)` → its group. */
const algebraOf = (expr: BoxedExpression): Group | undefined =>
  expr.operator === "GroupAlgebra"
    ? (() => {
        const inner = operandsOf(expr)[0];
        return inner === undefined ? undefined : groupOf(inner);
      })()
    : undefined;

export function declareGroupAlgebra(ce: ComputeEngine): void {
  ce.declare("CyclicGroup", { signature: "(integer) -> value" });
  ce.declare("DihedralGroup", { signature: "(integer) -> value" });
  ce.declare("GroupDirectProduct", { signature: "(value, value) -> value" });
  ce.declare("GroupAlgebra", { signature: "(value) -> value" });
  ce.declare("GroupBasis", { signature: "(string) -> number" });

  const basisExpression = (g: Group, i: number): BoxedExpression =>
    ce.function("GroupBasis", [ce.string(g.elements[i]!)]);

  const toExpression = (g: Group, element: Element): BoxedExpression => {
    const terms = [...element].sort(([a], [b]) => a - b);
    if (terms.length === 0) return ce.number(0);
    const parts = terms.map(([index, coefficient]) => {
      const b = basisExpression(g, index);
      return coefficient === 1 ? b : ce.function("Multiply", [ce.number(coefficient), b]);
    });
    return parts.length === 1 ? parts[0]! : ce.function("Add", parts);
  };

  /** Read an element of k[G]: a basis element, a scalar multiple, or a sum of those. */
  const toElement = (g: Group, expr: BoxedExpression): Element | undefined => {
    if (expr.operator === "GroupBasis") {
      const label = stringAt(operandsOf(expr)[0]);
      if (label === undefined) return undefined;
      const index = g.elements.indexOf(label);
      return index < 0 ? undefined : basisElement(index);
    }
    const ops = operandsOf(expr);
    if (expr.operator === "Add") {
      const parts = ops.map((op) => toElement(g, op));
      if (!parts.every((p): p is Element => p !== undefined)) return undefined;
      const out = new Map<number, number>();
      for (const part of parts) {
        for (const [i, c] of part) out.set(i, (out.get(i) ?? 0) + c);
      }
      return out;
    }
    if (expr.operator === "Multiply") {
      const read = ops.map((op) => toElement(g, op));
      const carried = read.filter((r) => r !== undefined);
      if (carried.length !== 1) return undefined;
      const index = read.findIndex((r) => r !== undefined);
      const scalars = ops.filter((_, i) => i !== index).map(integerAt);
      if (!scalars.every((s): s is number => s !== undefined)) return undefined;
      const factor = scalars.reduce((a, b) => a * b, 1);
      const out = new Map<number, number>();
      for (const [i, c] of carried[0]!) if (c * factor !== 0) out.set(i, c * factor);
      return out;
    }
    return undefined;
  };

  /** A head taking a group and returning a plain value. */
  const aboutGroup = (head: string, signature: string, answer: (g: Group) => BoxedExpression | undefined): void => {
    ce.declare(head, {
      signature,
      evaluate: (ops: readonly BoxedExpression[]) => {
        const g = ops[0] === undefined ? undefined : groupOf(ops[0]);
        return g === undefined ? undefined : answer(g);
      },
    });
  };

  aboutGroup("GroupOrder", "(value) -> integer", (g) => ce.number(order(g)));
  // GroupOrder(SymmetricGroup(n)) -> n!. SymmetricGroup is @enumeratio/collections' own
  // lazy indexed family (n! one-line words) rather than a Group this package builds a
  // Cayley table for -- n! elements would make that table, not the answer, the expensive
  // part. Attached right here (not from collections, which declares SymmetricGroup) so it
  // works regardless of which of the two packages happens to declare first; wrapOperator
  // only needs GroupOrder's OWN definition to exist yet, which it now does.
  wrapOperator(
    ce,
    ["GroupOrder", ["SymmetricGroup", 1]],
    (ops) => ops[0]?.operator === "SymmetricGroup",
    () => (ops) => {
      const n = integerAt(operandsOf(ops[0]!)[0]);
      return n === undefined ? undefined : ce.number(factorial(n));
    },
    1,
  );
  // GroupOrder(PermutationGroup(gens)) -> |⟨gens⟩|, by BFS closure. No Cayley table exists
  // up front here — only generators — so this sidesteps `groupOf` entirely, same reasoning
  // as the SymmetricGroup wrapper just above.
  wrapOperator(
    ce,
    ["GroupOrder", ["PermutationGroup", 1]],
    (ops) => ops[0]?.operator === "PermutationGroup",
    () => (ops) => {
      const group = permutationGroupOf(ops[0]!);
      if (group === undefined) return undefined;
      const closure = permutationGroupClosure(group.generators, group.degree);
      return closure === undefined ? undefined : ce.number(closure.length);
    },
    1,
  );

  aboutGroup("GroupIsAbelian", "(value) -> boolean", (g) => ce.symbol(isAbelian(g) ? "True" : "False"));
  aboutGroup("GroupElements", "(value) -> list", (g) =>
    ce.function(
      "List",
      g.elements.map((_, i) => basisExpression(g, i)),
    ),
  );
  // GroupElements(PermutationGroup(gens)) prints elements as Cycles(...), not GroupBasis
  // labels -- so it bypasses `aboutGroup`/`basisExpression`, which are tied to the
  // Cayley-table Group's string labels. A second, list argument selects elements by
  // POSITION in the (sorted) closure -- Part semantics, negative counts from the end --
  // rather than picking points of the domain, matching Wolfram's own GroupElements(g, list).
  widenSignature(ce, "GroupElements", "(value, value?) -> list");
  wrapOperator(
    ce,
    ["GroupElements", ["PermutationGroup", 1]],
    (ops) => ops[0]?.operator === "PermutationGroup",
    () => (ops) => {
      const group = permutationGroupOf(ops[0]!);
      if (group === undefined) return undefined;
      const closure = permutationGroupClosure(group.generators, group.degree);
      if (closure === undefined) return undefined;
      const elements = closure.map((sigma) => permutationToCycles(sigma));
      if (ops[1] === undefined) {
        return ce.function(
          "List",
          elements.map((cycles) => cyclesExpression(ce, cycles)),
        );
      }
      const positions = oneLineOf(ops[1]);
      if (positions === undefined) return undefined;
      const picked = positions.map((p) => resolvePosition(p, elements.length));
      if (!picked.every((p): p is number => p !== undefined)) return undefined;
      return ce.function(
        "List",
        picked.map((i) => cyclesExpression(ce, elements[i]!)),
      );
    },
    { min: 1, max: 2 },
  );
  aboutGroup("ConjugacyClasses", "(value) -> list", (g) =>
    ce.function(
      "List",
      conjugacyClasses(g).map((members) =>
        ce.function(
          "List",
          members.map((i) => basisExpression(g, i)),
        ),
      ),
    ),
  );
  // The dimension of the centre — and the number of irreducible characters of G.
  aboutGroup("GroupCentreDimension", "(value) -> integer", (g) => ce.number(conjugacyClasses(g).length));

  /** The k-th class sum: a basis element of the centre of k[G]. */
  ce.declare("ClassSum", {
    signature: "(value, integer) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const g = ops[0] === undefined ? undefined : groupOf(ops[0]);
      const k = integerAt(ops[1]);
      if (g === undefined || k === undefined) return undefined;
      const classes = conjugacyClasses(g);
      const members = classes[k - 1]; // 1-indexed, as elsewhere in the catalogue
      return members === undefined ? undefined : toExpression(g, classSum(members));
    },
  });

  /** Whether an element lies in the centre. */
  ce.declare("IsCentral", {
    signature: "(value, number) -> boolean",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const g = ops[0] === undefined ? undefined : groupOf(ops[0]);
      const element = g === undefined || ops[1] === undefined ? undefined : toElement(g, ops[1]);
      if (g === undefined || element === undefined) return undefined;
      return ce.symbol(isCentral(g, element) ? "True" : "False");
    },
  });

  /** The product of k[G] — it takes the group, since a basis element does not carry it. */
  ce.declare("GroupProduct", {
    signature: "(value, number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const g = ops[0] === undefined ? undefined : groupOf(ops[0]);
      if (g === undefined) return undefined;
      const a = ops[1] === undefined ? undefined : toElement(g, ops[1]);
      const b = ops[2] === undefined ? undefined : toElement(g, ops[2]);
      if (a === undefined || b === undefined) return undefined;
      return toExpression(g, multiplyElements(g, a, b));
    },
  });

  // ── permutations: Cycles, PermutationCycles, InversePermutation, Permute, PermutationGroup ──

  /** `Cycles(List(cycle, …))` — a carrier for a permutation in disjoint-cycle notation.
   *  Canonicalises by dropping fixed points (singleton cycles), same as Wolfram's own. */
  ce.declare("Cycles", {
    signature: "(list) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const cycles = ops[0] === undefined ? undefined : cycleListOf(ops[0]);
      if (cycles === undefined || !cyclesAreValid(cycles)) return undefined;
      const trimmed = dropFixedCycles(cycles);
      if (trimmed.length === cycles.length) return undefined; // already canonical
      return cyclesExpression(ce, trimmed);
    },
  });

  /** `PermutationCycles(perm)` -> cycle notation; `PermutationCycles(perm, f)` wraps EVERY
   *  position (fixed points included) with `f` instead of `Cycles`. */
  const permutationCycles = (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
    const input = ops[0];
    if (input === undefined) return undefined;
    const head = ops[1];
    if (head === undefined) {
      // Cycles(...) is already in cycle notation -- pass it through unchanged.
      if (input.operator === "Cycles") return input;
      const perm = permutationWordOf(input);
      if (perm === undefined) return undefined;
      return cyclesExpression(ce, permutationToCycles(perm));
    }
    const headName = symbolNameOf(head);
    if (headName === undefined) return undefined;
    const perm = permutationOf(input);
    if (perm === undefined) return undefined;
    const cycles = permutationToCycles(perm, true);
    return ce.function(headName, [
      ce.function(
        "List",
        cycles.map((cycle) =>
          ce.function(
            "List",
            cycle.map((x) => ce.number(x)),
          ),
        ),
      ),
    ]);
  };
  const existing = ce.lookupDefinition("PermutationCycles");
  if (existing === undefined || !("operator" in existing)) {
    ce.declare("PermutationCycles", {
      signature: "(value, any?) -> value",
      evaluate: permutationCycles,
    });
  } else {
    // @enumeratio/domains' carrier constructor got the name first; a second declare throws.
    widenSignature(ce, "PermutationCycles", `(${String(existing.operator.signature)}) & ((value, any?) -> value)`);
    wrapOperator(
      ce,
      ["PermutationCycles"],
      () => true,
      (native) => (ops, options) => permutationCycles(ops) ?? native?.(ops, options),
    );
  }

  /** `InversePermutation(perm)`, in either notation. */
  ce.declare("InversePermutation", {
    signature: "(value) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const input = ops[0];
      if (input === undefined) return undefined;
      if (input.operator === "Cycles") {
        const cycles = cyclesOf(input);
        if (cycles === undefined || !cyclesAreValid(cycles)) return undefined;
        // Reverse the traversal but keep each cycle's own starting point, matching
        // Wolfram: (i1 i2 … ik)⁻¹ is written (i1 ik … i2), not the bare array reversal.
        return cyclesExpression(
          ce,
          cycles.map((cycle) => [cycle[0]!, ...cycle.slice(1).reverse()]),
        );
      }
      const perm = permutationWordOf(input);
      return perm === undefined
        ? undefined
        : ce.function(
            "List",
            invertPermutation(perm).map((x) => ce.number(x)),
          );
    },
  });

  /** `Permute(list, perm)` moves the item at position `i` to position `perm(i)`; `perm`
   *  in either notation. `Permute(list, group)` (a `PermutationGroup`) instead returns
   *  the list permuted by EVERY element of the group. */
  ce.declare("Permute", {
    signature: "(list, value) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const listExpr = ops[0];
      const permExpr = ops[1];
      if (listExpr === undefined || permExpr === undefined || listExpr.operator !== "List") {
        return undefined;
      }
      const items = operandsOf(listExpr);
      const group = permutationGroupOf(permExpr);
      if (group !== undefined) {
        const closure = permutationGroupClosure(group.generators, group.degree);
        if (closure === undefined) return undefined;
        return ce.function(
          "List",
          closure.map((sigma) => ce.function("List", applyPermutation(items, sigma))),
        );
      }
      const perm = permutationOf(permExpr, items.length);
      if (perm === undefined || perm.length > items.length) return undefined;
      return ce.function("List", applyPermutation(items, perm));
    },
  });

  /** `PermutationList(Cycles(...))` -> its one-line image list; `PermutationList(perm, n)`
   *  pads that list to length `n` with fixed points (an `n` short of the cycles' own
   *  support leaves the call unevaluated — there is nowhere for the extra points to go). */
  ce.declare("PermutationList", {
    signature: "(value, integer?) -> list",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const input = ops[0];
      if (input === undefined || input.operator !== "Cycles") return undefined;
      const cycles = cyclesOf(input);
      if (cycles === undefined || !cyclesAreValid(cycles)) return undefined;
      const support = maxSupport(cycles);
      const requestedN = ops[1] === undefined ? undefined : integerAt(ops[1]);
      if (ops[1] !== undefined && requestedN === undefined) return undefined;
      if (requestedN !== undefined && requestedN < support) return undefined;
      const word = cyclesToPermutation(cycles, requestedN ?? support);
      return ce.function(
        "List",
        word.map((x) => ce.number(x)),
      );
    },
  });

  /** `PermutationReplace(expr, perm)` -- Wolfram's other permutation action, by VALUE
   *  rather than by position (unlike `Permute`): a bare point `i` becomes `perm(i)`, a
   *  list has each entry replaced the same way, and `Cycles(...)` is conjugated —
   *  `perm . cyc . perm⁻¹` — since conjugation is exactly relabelling the points a cycle
   *  names. A point past `perm`'s own support is a fixed point of `perm` and passes
   *  through unchanged. */
  ce.declare("PermutationReplace", {
    signature: "(value, value) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const expr = ops[0];
      const permExpr = ops[1];
      if (expr === undefined || permExpr === undefined) return undefined;
      const perm = permutationOf(permExpr);
      if (perm === undefined) return undefined;
      const replacePoint = (i: number): number | undefined => {
        if (!Number.isSafeInteger(i) || i < 1) return undefined;
        return i <= perm.length ? perm[i - 1]! : i;
      };
      if (expr.operator === "Cycles") {
        const cycles = cyclesOf(expr);
        if (cycles === undefined || !cyclesAreValid(cycles)) return undefined;
        const degree = Math.max(maxSupport(cycles), perm.length);
        const widePerm = permutationOf(permExpr, degree)!;
        // Conjugate at the PERMUTATION level (sigma . tau . sigma⁻¹), then re-derive cycles
        // the same way PermutationCycles/GroupElements do: `permutationToCycles` is Cycles'
        // own canonical presentation (smallest point first, ascending order, singletons
        // dropped) — a bare per-entry relabelling keeps the input's rotation and order,
        // which is right for a literal Cycles(...) but not for a COMPUTED result.
        const tau = cyclesToPermutation(cycles, degree);
        const inverseSigma = invertPermutation(widePerm);
        const conjugatedTau = tau.map((_, i) => widePerm[tau[inverseSigma[i]! - 1]! - 1]!);
        return cyclesExpression(ce, permutationToCycles(conjugatedTau));
      }
      if (expr.operator === "List") {
        const replaced = operandsOf(expr).map((item) => {
          const n = integerAt(item);
          return n === undefined ? undefined : replacePoint(n);
        });
        if (!replaced.every((x): x is number => x !== undefined)) return undefined;
        return ce.function(
          "List",
          replaced.map((x) => ce.number(x)),
        );
      }
      const n = integerAt(expr);
      if (n === undefined) return undefined;
      const result = replacePoint(n);
      return result === undefined ? undefined : ce.number(result);
    },
  });

  // PermutationGroup(List(Cycles(...), …)) and PermutationGroup(List(...), n) are pure
  // carriers, read by `permutationGroupOf` above -- same shape as CyclicGroup/DihedralGroup,
  // which stay symbolic rather than evaluating to anything.
  ce.declare("PermutationGroup", { signature: "(list, integer?) -> value" });

  /** `GroupGenerators(PermutationGroup(gens))` -> the given generators, in cycle notation. */
  ce.declare("GroupGenerators", {
    signature: "(value) -> list",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const group = ops[0] === undefined ? undefined : permutationGroupOf(ops[0]);
      if (group === undefined) return undefined;
      return ce.function(
        "List",
        group.generators.map((sigma) => cyclesExpression(ce, permutationToCycles(sigma))),
      );
    },
  });

  // AlternatingGroup(n): the even permutations of {1..n} — a pure carrier, same shape as
  // SymmetricGroup and PermutationGroup, read by its own GroupOrder/GroupElements/
  // GroupGenerators wrappers rather than through `groupOf` (no Cayley table: n!/2 elements
  // would make the TABLE, not the answer, the expensive part). Declared down here, after
  // GroupOrder/GroupElements/GroupGenerators all exist, since `wrapOperator` needs the
  // probed head already declared.
  ce.declare("AlternatingGroup", { signature: "(integer) -> value" });
  wrapOperator(
    ce,
    ["GroupOrder", ["AlternatingGroup", 1]],
    (ops) => ops[0]?.operator === "AlternatingGroup",
    () => (ops) => {
      const n = integerAt(operandsOf(ops[0]!)[0]);
      if (n === undefined || n < 1) return undefined;
      return ce.number(n <= 2 ? 1 : factorial(n) / 2); // A_1, A_2 are trivial: 1!/2 isn't an integer
    },
    1,
  );
  wrapOperator(
    ce,
    ["GroupGenerators", ["AlternatingGroup", 1]],
    (ops) => ops[0]?.operator === "AlternatingGroup",
    () => (ops) => {
      const n = integerAt(operandsOf(ops[0]!)[0]);
      if (n === undefined || n < 1) return undefined;
      return ce.function(
        "List",
        alternatingGenerators(n).map((sigma) => cyclesExpression(ce, permutationToCycles(sigma))),
      );
    },
    1,
  );
  // GroupElements(AlternatingGroup(n)) -- BFS closure over alternatingGenerators, same
  // Part-style position selector as PermutationGroup's GroupElements above.
  wrapOperator(
    ce,
    ["GroupElements", ["AlternatingGroup", 1]],
    (ops) => ops[0]?.operator === "AlternatingGroup",
    () => (ops) => {
      const n = integerAt(operandsOf(ops[0]!)[0]);
      if (n === undefined || n < 1) return undefined;
      const closure = permutationGroupClosure(alternatingGenerators(n), n);
      if (closure === undefined) return undefined;
      const elements = closure.map((sigma) => permutationToCycles(sigma));
      if (ops[1] === undefined) {
        return ce.function(
          "List",
          elements.map((cycles) => cyclesExpression(ce, cycles)),
        );
      }
      const positions = oneLineOf(ops[1]);
      if (positions === undefined) return undefined;
      const picked = positions.map((p) => resolvePosition(p, elements.length));
      if (!picked.every((p): p is number => p !== undefined)) return undefined;
      return ce.function(
        "List",
        picked.map((i) => cyclesExpression(ce, elements[i]!)),
      );
    },
    { min: 1, max: 2 },
  );

  registerAlgebra(ce, {
    name: "groupalgebra",
    basis: (expr) => {
      const g = algebraOf(expr);
      if (g === undefined || order(g) > 512) return undefined;
      return ce.function(
        "List",
        g.elements.map((_, i) => basisExpression(g, i)),
      );
    },
    dimension: (expr) => {
      const g = algebraOf(expr);
      return g === undefined ? undefined : ce.number(order(g));
    },
    contains: (element, expr) => {
      const g = algebraOf(expr);
      if (g === undefined) return undefined;
      const read = toElement(g, element);
      return ce.symbol(read === undefined ? "False" : "True");
    },
  });
}
