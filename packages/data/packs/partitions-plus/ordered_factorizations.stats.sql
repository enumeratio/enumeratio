-- requires: ordered_factorizations, realizer, utilities
-- ordered_factorizations statistics — factors (length of the sequence) and largest_factor, read directly off the
-- carrier (0 for the trivial n=1 empty-product factorization, matching integer_compositions' largest_part convention).

-- ── statistics (carrier: ordered_factorization(factors int[]), every entry ≥ 2) ────────────────────────
-- factors: the number of factors (0 for the empty product, n=1).
CREATE FUNCTION ordered_factorization_num_factors(f ordered_factorization) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((f).factors, 1), 0) $$;
-- largest_factor: the maximum factor (0 for the empty product).
CREATE FUNCTION ordered_factorization_largest_factor(f ordered_factorization) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(x) FROM unnest((f).factors) x), 0) $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('ordered_factorizations','factors','ordered_factorization_num_factors','Number of factors','natural_numbers'),
  ('ordered_factorizations','largest_factor','ordered_factorization_largest_factor','Largest factor','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- ordered_factorizations(12) in lex order (from ordered_factorizations.sql's own example):
--   2·2·3,2·3·2,2·6,3·2·2,3·4,4·3,6·2,12
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('ordered_factorizations','factors over ordered_factorizations(12) in lex order is 3,3,2,3,2,2,2,1','eq','3,3,2,3,2,2,2,1','sequence length per factorization',$q$
    SELECT string_agg(ordered_factorization_num_factors((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(ordered_factorizations(12)) e $q$),
  ('ordered_factorizations','largest_factor over ordered_factorizations(12) in lex order is 3,3,6,3,4,4,6,12','eq','3,3,6,3,4,4,6,12','max entry per factorization',$q$
    SELECT string_agg(ordered_factorization_largest_factor((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(ordered_factorizations(12)) e $q$),
  ('ordered_factorizations','the trivial factorization [n] always has factors=1, largest_factor=n','eq','1|24','the lex-last element at grade 24',$q$
    SELECT ordered_factorization_num_factors((unrank(ordered_factorizations(24), (cardinality(ordered_factorizations(24)) - 1)::int)).value)::text || '|' ||
           ordered_factorization_largest_factor((unrank(ordered_factorizations(24), (cardinality(ordered_factorizations(24)) - 1)::int)).value)::text $q$),
  ('ordered_factorizations','n=1: the empty product has factors=0, largest_factor=0','eq','0|0','the trivial "1" factorization',$q$
    SELECT ordered_factorization_num_factors((unrank(ordered_factorizations(1),0)).value)::text || '|' ||
           ordered_factorization_largest_factor((unrank(ordered_factorizations(1),0)).value)::text $q$),
  ('ordered_factorizations','largest_factor never exceeds n, over ordered_factorizations(24)','eq','true','no single factor can exceed the product',$q$
    SELECT bool_and(ordered_factorization_largest_factor((e).value) <= 24)::text FROM elements(ordered_factorizations(24)) e $q$);
