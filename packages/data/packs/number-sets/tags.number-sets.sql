-- requires: tags
-- number-sets half of sqlsrc/tags.sql's editorial collection→tag rows (#283 phase 3 extraction) — split out
-- because base_collection_tag does not filter to existing base_collection rows: an orphaned row here would
-- break the count-cache guard (meta-collections.stats.sql) under core alone, same bug the polytopes extraction
-- hit (see packs/polytopes/tags.polytopes.sql for the precedent). Tag DEFINITIONS (base_tag) stay core; only
-- the per-collection assignment rows for number-sets collections move.

INSERT INTO base_collection_tag_manual (tag, collection)
SELECT tag, collection FROM (VALUES
  -- figurate
  ('figurate', 'pentagonal_numbers'), ('figurate', 'hexagonal_numbers'), ('figurate', 'heptagonal_numbers'),
  ('figurate', 'octagonal_numbers'), ('figurate', 'centered_triangular_numbers'), ('figurate', 'centered_square_numbers'),
  ('figurate', 'centered_hexagonal_numbers'), ('figurate', 'star_numbers'), ('figurate', 'pronic_numbers'),
  ('figurate', 'tetrahedral_numbers'), ('figurate', 'square_pyramidal_numbers'), ('figurate', 'pentatope_numbers'),
  -- primes
  ('prime_family', 'twin_primes'), ('prime_family', 'cousin_primes'), ('prime_family', 'sexy_primes'),
  ('prime_family', 'safe_primes'), ('prime_family', 'sophie_germain_primes'), ('prime_family', 'semiprime_numbers'),
  ('prime_family', 'squarefree_semiprimes'), ('prime_family', 'k_almost_primes'), ('prime_family', 'prime_power_numbers'),
  -- factorization shape
  ('factorization', 'semiprime_numbers'), ('factorization', 'squarefree_semiprimes'), ('factorization', 'sphenic_numbers'),
  ('factorization', 'square_free_numbers'), ('factorization', 'powerful_numbers'), ('factorization', 'perfect_power_numbers'),
  ('factorization', 'achilles_numbers'), ('factorization', 'prime_power_numbers'), ('factorization', 'k_almost_primes'),
  -- divisor sums
  ('divisor', 'abundant_numbers'), ('divisor', 'deficient_numbers'), ('divisor', 'perfect_numbers'),
  ('divisor', 'amicable_numbers'), ('divisor', 'practical_numbers'), ('divisor', 'arithmetic_numbers'),
  -- digit-based
  ('digit_based', 'happy_numbers'), ('digit_based', 'kaprekar_numbers'), ('digit_based', 'narcissistic_numbers'),
  ('digit_based', 'automorphic_numbers'), ('digit_based', 'evil_numbers'), ('digit_based', 'odious_numbers'),
  ('digit_based', 'pernicious_numbers'), ('digit_based', 'smith_numbers'), ('digit_based', 'harshad_numbers'),
  ('digit_based', 'thue_morse_numbers'),
  -- word/recurrence (Stern-Brocot / Calkin-Wilf / hyperbinary)
  ('word', 'calkin_wilf_paths'), ('word', 'stern_brocot_paths'), ('word', 'hyperbinary_representations'),
  ('recurrence', 'hyperbinary_representations')
) AS a(tag, collection);
