-- requires: traits, ascent_sequences
-- words-plus half of sqlsrc/traits.sql's no_closed_form_count assignments (#283 phase 3 extraction) —
-- base_collection_trait_manual.collection REFERENCES base_collection, so this row would FK-fail loading core alone.
--   ascent_sequences — A022493 (Fishburn numbers), only a continued-fraction generating function; no closed form
INSERT INTO base_collection_trait_manual (trait, collection) VALUES
  ('no_closed_form_count', 'ascent_sequences');
