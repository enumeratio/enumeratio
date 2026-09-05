-- requires: traits
-- permutations-plus half of sqlsrc/traits.sql's no_closed_form_count rows (#283 phase 3 extraction) —
-- base_collection_trait_manual.collection REFERENCES base_collection, so these rows would FK-fail loading core
-- alone.
--   simple_permutations       — A111111, atoms of the substitution decomposition; no closed form (only asymptotics)
--   non_crossing_permutations — cycles forming a non-crossing set partition; no closed form found in the audit
--   vexillary_permutations    — A005802, only a sum over standard-tableaux hook-length products (a base_restrict
--                               row INSIDE pattern_avoiding_permutations.sql, sharing this pack via that file)
INSERT INTO base_collection_trait_manual (trait, collection) VALUES
  ('no_closed_form_count', 'simple_permutations'), ('no_closed_form_count', 'non_crossing_permutations'),
  ('no_closed_form_count', 'vexillary_permutations');
