-- requires: traits, prime_compositions, carlitz_compositions, zigzag_composition
-- compositions-plus half of sqlsrc/traits.sql's no_closed_form_count trait assignments (#283 phase 3 extraction)
-- — split out because base_collection_trait_manual.collection REFERENCES base_collection (these rows would
-- FK-fail loading core alone). Collections confirmed to have no known simple closed form, each checked against
-- its own file's header comment / OEIS entry rather than asserted from memory —
--   prime_compositions   — A023360, direct-sum DP recurrence over the (irregular) primes, no closed form
--   carlitz_compositions — A003242, generating-function only (Carlitz 1976); no closed form is known
--   zigzag_composition   — no OEIS entry even cited; the file's own count was brute-force verified, not derived

INSERT INTO base_collection_trait_manual (trait, collection) VALUES
  ('no_closed_form_count', 'prime_compositions'), ('no_closed_form_count', 'carlitz_compositions'),
  ('no_closed_form_count', 'zigzag_composition');
