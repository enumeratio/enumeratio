-- requires: traits, simplex
-- This pack's slice of the editorial trait assignments (#283 phase 2.2 split): `simplex`'s carrier lists its
-- vertex set ascending with no repeats, same as the finset family in core's traits.sql — split out only because
-- `simplex` itself is a packs/polytopes collection.
INSERT INTO base_collection_trait_manual (trait, collection) VALUES
  ('repetition_free', 'simplex'),
  ('strictly_increasing', 'simplex');
