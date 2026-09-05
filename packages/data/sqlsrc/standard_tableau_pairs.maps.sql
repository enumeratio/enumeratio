-- requires: standard_tableau_pairs, maps-bijections
-- The RSK inverse, registered as a map ON standard_tableau_pairs (issue #153) — the closing half of the
-- permutations.rsk / standard_tableau_pairs.to_permutation pair declared in maps-bijections.sql. Split into its own
-- file purely for load order: standard_tableau_pair_to_perm and the carrier live in maps-bijections.sql, but this
-- INSERT needs standard_tableau_pairs' own base_collection row to exist first (FK on base_map.collection), and
-- maps-bijections.sql is a dependency OF standard_tableau_pairs.sql — requiring it back would be a cycle.

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, scope, inverse, is_bijection) VALUES
  ('standard_tableau_pairs','to_permutation','standard_tableau_pair_to_perm','permutations','RSK inverse: (P,Q) SYT pair → permutation','collection','rsk',true);
