-- requires: natural_numbers, number-predicates
-- semiprime_numbers — products of exactly two primes counted WITH multiplicity (Ω=2), A001358: 4,6,9,10,14,…
-- A base_restrict specialization of natural_numbers: the floor filters the naturals ascending by
-- is_semiprime_number (delegating to is_semiprime(factored) — the exponent-vector view). Ungraded / unbounded.
SELECT base_restrict('semiprime_numbers', 'natural_numbers', 'is_semiprime_number');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('semiprime_numbers','first ten via the realized floor','eq','4,6,9,10,14,15,21,22,25,26','a restriction of the naturals',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(semiprime_numbers(), 10) e $q$),
  ('semiprime_numbers','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(semiprime_numbers()) f LIMIT 1) FROM fibers(semiprime_numbers()) $q$),
  ('semiprime_numbers','unrank(6) = 21 (the 7th semiprime)','eq','21','rank 6 (0-based)',$q$
    SELECT (unrank(semiprime_numbers(), 6)).value::text $q$),
  ('semiprime_numbers','cardinality = infinity','eq','Infinity','unbounded',$q$
    SELECT cardinality(semiprime_numbers())::text $q$),
  ('semiprime_numbers','contains via <@: 9 ∈ (3·3), 8 ∉ (2^3, Ω=3)','eq','true|false','the Ω=2 boundary, not mere compositeness',$q$
    SELECT (9::numeric <@ semiprime_numbers())::text || '|' || (8::numeric <@ semiprime_numbers())::text $q$),
  ('semiprime_numbers','parent is natural_numbers','eq','natural_numbers|is_semiprime_number','base_collection_parent records the specialization',$q$
    SELECT parent || '|' || predicate FROM base_collection_parent WHERE collection = 'semiprime_numbers' $q$);
