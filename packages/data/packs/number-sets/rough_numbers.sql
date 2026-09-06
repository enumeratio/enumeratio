-- requires: natural_numbers, number-theory, realizer, family_relations, utilities
-- rough_numbers(k) — the FAMILY (#67): positive integers whose least prime factor is >= k (k-rough) — no prime
-- factor below k. A THRESHOLD family (D1): the least-prime-factor is a recoverable stat, k selects the superlevel
-- set — a re-ranking param-restrict of the naturals + a declared is_cumulative_of(least_prime_factor, '>='). Unlike
-- smooth, k-rough numbers are DENSE (5-rough ≈ φ(6)/6 = 1/3 of the naturals), so the scan floor reaches deep fine.
-- A007310 (5-rough — coprime to 6). 1 is vacuously k-rough (no prime factors).
CREATE FUNCTION is_rough_number(v numeric, k natural_number) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT v >= 1 AND (least_prime_factor(v) IS NULL OR least_prime_factor(v) >= k::numeric) $$;   -- spf(1)=NULL ⇒ 1 is k-rough
SELECT base_restrict('rough_numbers', 'natural_numbers', 'is_rough_number', scan_factor => 8,
                     params => ARRAY['k'], admissibles => ARRAY['k >= 2']);
CREATE FUNCTION fiber_symbol(f rough_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'R' || to_unicode_subscript((f).k) $$;
INSERT INTO base_collection_meta VALUES ('rough_numbers', 'Rough numbers', 'Positive integers with no prime factor below k (k-rough); k selects the family.');
INSERT INTO base_cumulative_of (collection, stat, op, param) VALUES ('rough_numbers', 'least_prime_factor', '>=', 'k');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('rough_numbers','k=5 (coprime to 6), first twelve','eq','1,5,7,11,13,17,19,23,25,29,31,35','A007310 via the param-restrict',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(rough_numbers(5), 12) e $q$),
  ('rough_numbers','k=7, first twelve','eq','1,7,11,13,17,19,23,29,31,37,41,43','no factor of 2, 3, or 5',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(rough_numbers(7), 12) e $q$),
  ('rough_numbers','contains via <@: 25 ∈ 5-rough (5·5), 15 ∉ (3|15), 1 ∈','eq','true|false|true','the spf threshold',$q$
    SELECT (25::numeric <@ rough_numbers(5))::text || '|' || (15::numeric <@ rough_numbers(5))::text || '|' || (1::numeric <@ rough_numbers(5))::text $q$),
  ('rough_numbers','k is role=param (k >= 2)','eq','param|k >= 2','a family parameter',$q$
    SELECT role || '|' || admissible FROM base_grade WHERE collection='rough_numbers' AND name='k' $q$),
  ('rough_numbers','is_cumulative_of least_prime_factor with >= (the superlevel reading)','eq','least_prime_factor|>=','#67 D1',$q$
    SELECT stat || '|' || op FROM base_cumulative_of WHERE collection='rough_numbers' $q$),
  ('rough_numbers','unrank(rough_numbers(5), 4) = 13','eq','13','value-addressing off the dense floor',$q$
    SELECT (unrank(rough_numbers(5), 4)).value::text $q$);
