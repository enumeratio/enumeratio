-- requires: natural_numbers, number-theory, realizer, family_relations, utilities
-- smooth_numbers(k) — the FAMILY (#67): positive integers whose greatest prime factor is <= k (k-smooth). A
-- THRESHOLD family (D1): gpf is a recoverable stat, k selects the sublevel set — a re-ranking param-restrict of the
-- naturals + a declared is_cumulative_of(greatest_prime_factor, '<='). A051037 (5-smooth) · A003586 (3-smooth).
-- NOTE the floor is a linear over-scan of the naturals, and k-smooth numbers are exponentially SPARSE for small k
-- (2-smooth = powers of 2), so the realized floor reaches only modest ranks — deep enumeration of a small-k fiber
-- is not supported by the scan (a genuine limitation of the threshold-restrict realization, not an error).
CREATE FUNCTION is_smooth_number(v numeric, k natural_number) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT v >= 1 AND (greatest_prime_factor(v) IS NULL OR greatest_prime_factor(v) <= k::numeric) $$;   -- gpf(1)=NULL ⇒ 1 is k-smooth
SELECT base_restrict('smooth_numbers', 'natural_numbers', 'is_smooth_number', scan_factor => 16,
                     params => ARRAY['k'], admissibles => ARRAY['k >= 2']);
CREATE FUNCTION fiber_symbol(f smooth_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'S' || to_unicode_subscript((f).k) $$;
INSERT INTO base_collection_meta VALUES ('smooth_numbers', 'Smooth numbers', 'Positive integers whose greatest prime factor is at most k (k-smooth); k selects the family.');
INSERT INTO base_cumulative_of (collection, stat, op, param) VALUES ('smooth_numbers', 'greatest_prime_factor', '<=', 'k');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('smooth_numbers','k=5 (regular numbers), first twelve','eq','1,2,3,4,5,6,8,9,10,12,15,16','A051037 via the param-restrict',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(smooth_numbers(5), 12) e $q$),
  ('smooth_numbers','k=3, first twelve','eq','1,2,3,4,6,8,9,12,16,18,24,27','A003586',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(smooth_numbers(3), 12) e $q$),
  ('smooth_numbers','contains via <@: 12 ∈ 5-smooth, 14 ∉ 5-smooth (7 | 14), 1 ∈','eq','true|false|true','the gpf threshold',$q$
    SELECT (12::numeric <@ smooth_numbers(5))::text || '|' || (14::numeric <@ smooth_numbers(5))::text || '|' || (1::numeric <@ smooth_numbers(5))::text $q$),
  ('smooth_numbers','k is role=param (k >= 2)','eq','param|k >= 2','a family parameter',$q$
    SELECT role || '|' || admissible FROM base_grade WHERE collection='smooth_numbers' AND name='k' $q$),
  ('smooth_numbers','is_cumulative_of greatest_prime_factor with <= (the downset reading)','eq','greatest_prime_factor|<=','#67 D1',$q$
    SELECT stat || '|' || op FROM base_cumulative_of WHERE collection='smooth_numbers' $q$);
