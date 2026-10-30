import { expect, test } from "vite-plus/test";
import { TREE_STATISTICS } from "../src/statistics.ts";
import { COMPILED } from "../src/statistics.compiled.generated.js";

// The definitions the JavaScript compiler does not lower, which run in the interpreter. A new
// definition that lands here is slower than the rest, so it should be a deliberate addition;
// one that starts compiling should leave the list. Every one reads a nested tree (a binary tree
// is 0 or [left, right], an ordered tree the list of its children's trees), and the compiler
// has no reader for a subtree of unknown depth yet; only the root's own children compile.
const INTERPRETED = [
  "AutomorphismGroupSize",
  "BinaryNodes",
  "BoundaryLength",
  "BoundaryLengthBeyondTrunk",
  "BoundaryNodes",
  "Breadth",
  "CollessIndex",
  "DistinctSubtrees",
  "DistinctSubtrees",
  "ExternalPathLength",
  "Height",
  "Height",
  "HookNumber",
  "InequivalentIncreasingTreeCount",
  "LargestOutDegree",
  "Leaves",
  "Leaves",
  "LeftSpine",
  "LeftSubtreeSize",
  "LinearExtensionCount",
  "LinearExtensionCount",
  "LongestPathVertexCount",
  "MaximalLeftBranches",
  "NonBoundaryNodes",
  "NonRootBinaryNodes",
  "NonRootInternalNodes",
  "OneProtectedNodeCount",
  "ParenthesisCodeValue",
  "PathLength",
  "PathLength",
  "Pitchforks",
  "ProtectionNumber",
  "ProtectionNumber",
  "PruningNumber",
  "RightChildCount",
  "RightLeftLeftLeftPathCount",
  "RightLeftLeftPathCount",
  "RightRightLeftLeftPathCount",
  "RightRightLeftPathCount",
  "RightRightLeftRightPathCount",
  "RightRightPathCount",
  "RightRightRightLeftPathCount",
  "RightRightRightPathCount",
  "RightRightRightRightPathCount",
  "RightSubtreeSizeSum",
  "StrahlerNumber",
  "StrahlerNumber",
  "TreeFactorial",
  "TreeFactorial",
  "TrunkLength",
  "TwoProtectedNodeCount",
  "UnaryNodes",
  "VertexHeightSum",
];

// The compiled file is built, and empty until the package's build has run.
test.skipIf(Object.keys(COMPILED).length === 0)("exactly these tree definitions fall back to the interpreter", () => {
  const interpreted = TREE_STATISTICS.filter((d) => !(`${d.head}@${d.on}` in COMPILED)).map((d) => d.head);
  expect(interpreted.toSorted()).toEqual(INTERPRETED);
});
