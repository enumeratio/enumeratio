-- requires: number-theory, realizer, utilities
-- prime_pairs(gap) — the FAMILY (#67): the lesser member p of a prime pair (p, p+gap), both prime, for an even
-- gap >= 2. A param-restrict of prime_numbers: the floor scans the primes and keeps those whose gap-shifted
-- partner is also prime. gap is a family PARAMETER (role='param'): 5 is the lesser of both (5,7) and (5,11), so
-- the gap is NOT recoverable from a single element — it selects which pair-family. twin/cousin/sexy_primes are the
-- realized points at gap 2/4/6 (see those files). A001359 (gap 2), A023200 (4), A023201 (6).
CREATE FUNCTION is_prime_pair(v numeric, gap natural_number) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_prime_number(v + gap::numeric) $$;   -- v is already prime (parent = prime_numbers); the partner too
-- scan_factor 40: prime_pairs are a positive fraction of the primes, but sparse enough that finding N of them needs a
-- generous over-scan of the parent prime floor; 40× the request holds deep into every gap the selfcert exercises.
SELECT base_restrict('prime_pairs', 'prime_numbers', 'is_prime_pair', scan_factor => 40,
                     params => ARRAY['gap'], admissibles => ARRAY['gap >= 2 AND gap % 2 = 0']);
CREATE FUNCTION fiber_symbol(f prime_pairs_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Pr' || to_unicode_subscript((f).gap) $$;
INSERT INTO base_collection_meta VALUES ('prime_pairs', 'Prime pairs', 'The lesser prime p of a pair (p, p+gap); gap selects the family (twin=2, cousin=4, sexy=6).');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('prime_pairs','gap=2 (twin) lesser members, first eight','eq','3,5,11,17,29,41,59,71','A001359 via the param-restrict of primes',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(prime_pairs(2), 8) e $q$),
  ('prime_pairs','gap=4 (cousin) lesser members, first eight','eq','3,7,13,19,37,43,67,79','A023200',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(prime_pairs(4), 8) e $q$),
  ('prime_pairs','gap=6 (sexy) lesser members, first eight','eq','5,7,11,13,17,23,31,37','A023201',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(prime_pairs(6), 8) e $q$),
  ('prime_pairs','each member p has p+gap also prime (gap=6, first ten)','ok',NULL,'the defining invariant',$q$
    SELECT bool_and(is_prime_number((e).value) AND is_prime_number((e).value + 6)) FROM elements(prime_pairs(6), 10) e $q$),
  ('prime_pairs','contains via <@: 11 ∈ prime_pairs(2) (11,13), 23 ∉ (23,25)','eq','true|false','',$q$
    SELECT (11::numeric <@ prime_pairs(2))::text || '|' || (23::numeric <@ prime_pairs(2))::text $q$),
  ('prime_pairs','gap is role=param with an even-gap admissible','eq','param|gap >= 2 AND gap % 2 = 0','the family parameter, not a grade',$q$
    SELECT role || '|' || admissible FROM base_grade WHERE collection='prime_pairs' AND name='gap' $q$),
  ('prime_pairs','unrank(prime_pairs(2), 7) = 71 (8th twin-prime lesser)','eq','71','value-addressing off the param-restrict floor',$q$
    SELECT (unrank(prime_pairs(2), 7)).value::text $q$);
