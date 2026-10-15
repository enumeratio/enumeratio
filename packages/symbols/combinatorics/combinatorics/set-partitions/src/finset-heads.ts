import { defineOverload, operandsOf, type Engine, type Expr } from "@enumeratio/engine";

// A Finset is a subset of {1, …, n}: `Finset(Tuple(n, members))`. The heads that read a
// collection's members read it too: its largest and smallest member, and its cardinality as `Length`.

/** The members of a `Finset(Tuple(n, List(members)))`, or undefined for anything else. */
const membersOf = (op: Expr | undefined): readonly Expr[] | undefined => {
  if (op?.operator !== "Finset") return undefined;
  const tuple = operandsOf(op)[0];
  const list = tuple === undefined ? undefined : operandsOf(tuple)[1];
  return list?.operator === "List" ? operandsOf(list) : undefined;
};

export function declareFinsetHeads(ce: Engine): void {
  // Max and Min of the member list, so the empty case answers as it does for an empty list.
  for (const head of ["Max", "Min"]) {
    defineOverload(ce, head, {
      package: "combinatorics",
      on: ["Finset"],
      arity: 1,
      evaluate: (ops) => {
        const members = membersOf(ops[0]);
        return members === undefined ? undefined : ce.function(head, [ce.function("List", [...members])]).evaluate();
      },
    });
  }

  // Count would take a Finset only by widening its signature, which leaks `finset` into the types
  // inferred for every definition that counts an untyped value; Length already takes any value.
  defineOverload(ce, "Length", {
    package: "combinatorics",
    on: ["Finset"],
    arity: 1,
    evaluate: (ops) => {
      const members = membersOf(ops[0]);
      return members === undefined ? undefined : ce.number(members.length);
    },
  });
}
