// The combinatorial statistics Sage computes with its own methods, by carrier and statistic name.
// `CombinatorialStat(Carrier(x), 'Name')` and a statistic's own head both go through
// `enumeratio_stat` (run.ts), which builds the Sage object the carrier names and applies the body
// here, `x` being that object. A statistic Sage has no method for is not listed, so it stays unmapped.

/** Python lambda bodies, `x` the Sage object (`Permutation`, `Partition`, `SetPartition`, `DyckWord`, trees). */
export const SAGE_STATS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  Permutation: {
    Descents: "x.number_of_descents()",
    MajorIndex: "x.major_index()",
    InverseMajorIndex: "x.imajor_index()",
    Inversions: "x.number_of_inversions()",
    NonInversions: "x.number_of_noninversions(2)",
    FixedPoints: "x.number_of_fixed_points()",
    Peaks: "x.number_of_peaks()",
    PermutationOrder: "x.order()",
    Sign: "x.sign()",
    LongestIncreasingSubsequence: "x.longest_increasing_subsequence_length()",
    Runs: "len(x.runs())",
    CycleCount: "len(x.to_cycles())",
    NontrivialCycles: "len(x.to_cycles(singletons=False))",
    LargestCycleLength: "max(x.cycle_type())",
    LongestCycleLength: "max(x.cycle_type())",
    ShortestCycleLength: "min(x.cycle_type())",
    ConjugacyClassSize: "Partition(x.cycle_type()).conjugacy_class_size()",
    ReflectionLength: "x.absolute_length()",
    WeakExceedances: "len(x.weak_excedences())",
    RightToLeftMaxima: "x.number_of_saliances()",
    LeftToRightMaxima: "x.reverse().number_of_saliances()",
    RightToLeftMinima: "x.complement().number_of_saliances()",
    LeftToRightMinima: "x.reverse().complement().number_of_saliances()",
    OccurrencesOf123: "len(x.pattern_positions([1, 2, 3]))",
    OccurrencesOf132: "len(x.pattern_positions([1, 3, 2]))",
    OccurrencesOf213: "len(x.pattern_positions([2, 1, 3]))",
    OccurrencesOf231: "len(x.pattern_positions([2, 3, 1]))",
    OccurrencesOf312: "len(x.pattern_positions([3, 1, 2]))",
    OccurrencesOf321: "len(x.pattern_positions([3, 2, 1]))",
  },
  IntegerPartition: {
    Crank: "x.crank()",
    DurfeeSquare: "x.frobenius_rank()",
    Corners: "len(x.corners())",
    AddableCells: "len(x.addable_cells())",
    IsSelfConjugate: "int(x.is_symmetric())",
    SumOfHookLengths: "sum(sum(r) for r in x.hook_lengths())",
    WeightedSize: "x.weighted_size()",
    LargestPart: "max(x, default=0)",
  },
  SetPartition: {
    Crossings: "x.number_of_crossings()",
    Nestings: "x.number_of_nestings()",
    LargestBlock: "x.max_block_size()",
    Blocks: "len(x)",
  },
  DyckPath: {
    Dinv: "x.dinv()",
    DoubleRises: "x.number_of_double_rises()",
    InitialRise: "x.number_of_initial_rises()",
    Returns: "x.number_of_touch_points()",
    TouchPointCount: "x.number_of_touch_points()",
  },
  BinaryTree: {
    TreeFactorial: "x.tree_factorial()",
  },
  OrderedTree: {
    TreeFactorial: "x.tree_factorial()",
  },
};

/** The statistics table as the Python the Sage preamble defines it by. */
export function sageStatsPython(): string {
  const rows = Object.entries(SAGE_STATS).flatMap(([carrier, stats]) =>
    Object.entries(stats).map(
      ([name, body]) => `    (${JSON.stringify(carrier)}, ${JSON.stringify(name)}): lambda x: ${body},`,
    ),
  );
  return `_enumeratio_stats = {\n${rows.join("\n")}\n}`;
}
