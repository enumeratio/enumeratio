// Trees' own declare (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5, A-94): its
// carriers (LabeledTree and PruferSequence both live here, so the Prüfer-bijection constructor
// overload can attach right after), then the families they type.
import type { Engine } from "@enumeratio/engine";
import { declareCarriers } from "@enumeratio/structures";
import { declareFamilies } from "../../collections/src/families/declare.ts";
import { liftFamily } from "../../collections/src/families/epsil.ts";
import { TREES_CARRIERS } from "./carrier-data.ts";
import {
  coreEntries,
  labeledEntries,
  pruferSequencesEntries,
  rootedForestsEntries,
  unlabeledTreesEntries,
} from "./families/index.ts";
import { declareLabeledTreeFromPruferSequence } from "./prufer-conversion.ts";

export function declareTrees(ce: Engine): void {
  declareCarriers(ce, TREES_CARRIERS, { plurals: false });
  declareLabeledTreeFromPruferSequence(ce);
  declareFamilies(
    ce,
    [
      ...labeledEntries,
      ...rootedForestsEntries,
      ...coreEntries,
      ...pruferSequencesEntries,
      ...unlabeledTreesEntries,
    ].map(liftFamily),
  );
}
