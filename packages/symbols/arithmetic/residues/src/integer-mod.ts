import { bigIntegerAt, bigRationalAt, defineOverload, operandsOf, type Engine, type Expr } from "@enumeratio/engine";
import { gcd, mod } from "./arith.ts";
import { INTEGER_MOD, RESIDUE_CLASS } from "./names.ts";
import { residueClassOf } from "./residue-class-declare.ts";
import { SUMMARIES } from "@enumeratio/manifest/package/residues";

// IntegerMod(a, m) is Sage's Mod(a, m): the strict ResidueClass(a, m), except that classes of
// different moduli combine in ℤ/gcd(m, n), where both reduce (Sage coerces to the common
// quotient ring). Arithmetic is ResidueClass's, run on the operands reduced to that ring; the
// answer is read back as an IntegerMod. Moduli with gcd 1 have no common ring but the trivial
// one, which Sage rejects, so the call stays as written.

const isIntegerMod = (expr: Expr | undefined): boolean => expr?.operator === INTEGER_MOD;

/** Read `IntegerMod(a, m)` with integer a and modulus m ≥ 1. */
function integerModOf(expr: Expr | undefined): { residue: bigint; modulus: bigint } | undefined {
  if (!isIntegerMod(expr)) return undefined;
  const [a, m] = operandsOf(expr);
  const [value, modulus] = [bigIntegerAt(a), bigIntegerAt(m)];
  return value === undefined || modulus === undefined || modulus < 1n
    ? undefined
    : { residue: mod(value, modulus), modulus };
}

export function declareIntegerMod(ce: Engine): void {
  // A canonical call with its operands as given, skipping the canonical handler.
  const build = (ops: readonly Expr[]): Expr =>
    (ce as unknown as { _fn(h: string, o: readonly Expr[]): Expr })._fn(INTEGER_MOD, ops);
  const writeClass = (residue: bigint, modulus: bigint): Expr => build([ce.number(residue), ce.number(modulus)]);
  const strict = (residue: bigint, modulus: bigint): Expr =>
    ce.function(RESIDUE_CLASS, [ce.number(residue), ce.number(modulus)]);

  /** An operand as the strict class in ℤ/modulus, if it is a class of a modulus it reduces to. */
  const reduced = (op: Expr, modulus: bigint): Expr => {
    const x = integerModOf(op);
    return x === undefined ? op : strict(x.residue % modulus, modulus);
  };

  /** The common ring of the classes among the operands, when every other operand is a plain
   *  number and the moduli share a factor. */
  function commonModulus(ops: readonly Expr[]): bigint | undefined {
    const moduli: bigint[] = [];
    for (const op of ops) {
      const x = integerModOf(op);
      if (x !== undefined) moduli.push(x.modulus);
      else if (isIntegerMod(op) || bigRationalAt(op) === undefined) return undefined;
    }
    if (moduli.length === 0) return undefined;
    const g = moduli.reduce(gcd);
    return g >= 2n || moduli.every((m) => m === moduli[0]) ? g : undefined;
  }

  /** `head` of the operands in the common ring, read back as an IntegerMod. */
  function combine(head: string, ops: readonly Expr[]): Expr | undefined {
    const g = commonModulus(ops);
    if (g === undefined) return undefined;
    const answer = ce
      .function(
        head,
        ops.map((op) => reduced(op, g).canonical),
      )
      .evaluate();
    const x = residueClassOf(answer);
    return x === undefined ? undefined : writeClass(x.residue, x.modulus);
  }

  // The value: normalised as ResidueClass normalises it, and left as written where it can't be.
  const asIntegerMod = (ops: readonly Expr[]): Expr | undefined => {
    const answer = ce
      .function(
        RESIDUE_CLASS,
        ops.map((op) => {
          const x = integerModOf(op);
          return x === undefined ? op : strict(x.residue, x.modulus);
        }),
      )
      .evaluate();
    const x = residueClassOf(answer);
    return x === undefined ? undefined : writeClass(x.residue, x.modulus);
  };
  ce.declare(INTEGER_MOD, {
    description: SUMMARIES.IntegerMod,
    signature: "(any, any) -> value",
    pure: true,
    lazy: true,
    canonical: (ops: readonly Expr[]) => {
      const canonical = ops.map((op) => op.canonical);
      return asIntegerMod(canonical) ?? build(canonical);
    },
    // Lazy so the operands are read exactly, as N() would otherwise turn 1/2 into 0.5.
    evaluate: (ops: readonly Expr[]) => {
      const exact = ops.map((op) => op.evaluate());
      return asIntegerMod(exact) ?? build(exact);
    },
  });

  for (const head of ["Add", "Multiply", "Divide", "Negate"]) {
    defineOverload(ce, head, {
      package: "residues",
      on: [INTEGER_MOD],
      evaluate: (ops) => combine(head, ops),
    });
  }
  defineOverload(ce, "Power", {
    package: "residues",
    on: [INTEGER_MOD],
    arity: 2,
    when: (ops) => isIntegerMod(ops[0]) && bigIntegerAt(ops[1]) !== undefined,
    evaluate: (ops) => combine("Power", ops),
  });

  // Sage's ==: classes are equal when they agree in the common ring; a plain integer is read in it.
  for (const [head, equal] of [
    ["Equal", true],
    ["NotEqual", false],
  ] as const) {
    defineOverload(ce, head, {
      package: "residues",
      on: [INTEGER_MOD],
      arity: 2,
      evaluate: (ops) => {
        const g = commonModulus(ops);
        const [x, y] = ops.map((op) => integerModOf(op)?.residue ?? bigIntegerAt(op));
        if (g === undefined || x === undefined || y === undefined) return undefined;
        return ce.symbol((mod(x - y, g) === 0n) === equal ? "True" : "False");
      },
    });
  }

  // The rest of the strict class's heads take each class at its own modulus.
  const own = (op: Expr): Expr => {
    const x = integerModOf(op);
    return x === undefined ? op : strict(x.residue, x.modulus);
  };
  for (const head of ["Element", "MultiplicativeOrder"]) {
    defineOverload(ce, head, {
      package: "residues",
      on: [INTEGER_MOD],
      evaluate: (ops) => {
        if (!ops.some((op) => integerModOf(op) !== undefined)) return undefined;
        return ce
          .function(
            head,
            ops.map((op) => own(op).canonical),
          )
          .evaluate();
      },
    });
  }
  defineOverload(ce, "ChineseRemainder", {
    package: "residues",
    on: [INTEGER_MOD],
    native: (op) => op.operator === "List",
    signature: "(value+) -> value",
    when: (ops) => ops.every((op) => integerModOf(op) !== undefined),
    evaluate: (ops) => {
      const x = residueClassOf(
        ce
          .function(
            "ChineseRemainder",
            ops.map((op) => own(op).canonical),
          )
          .evaluate(),
      );
      return x === undefined ? undefined : writeClass(x.residue, x.modulus);
    },
  });
}
