-- requires: realizer, subsets, utilities
-- central_delannoy_numbers — the central Delannoy numbers D(n) as a first-class UNBOUNDED numeric collection
-- (A001850): 1,3,13,63,321,1683,8989,… Sibling of delannoy_paths. New helper via D(n) = Σ_k C(n,k)·C(n+k,k)
-- (reuses binomial). Ported from old-backup more-sequences-and-primes.sql.
CREATE FUNCTION central_delannoy_number(n term_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(binomial(n, k) * binomial(n + k, k)), 1) FROM generate_series(0, n) k $$;
CREATE TYPE central_delannoy_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f central_delannoy_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT central_delannoy_number(r) FROM generate_series(0, element_limit - 1) r $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f central_delannoy_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT central_delannoy_number(rank::term_index) $fu$;
INSERT INTO base_collection VALUES ('central_delannoy_numbers', 'numeric', true);
INSERT INTO base_monotonic_sequence VALUES ('central_delannoy_numbers');   -- non-decreasing: synth a scanning contains
SELECT base_realize('central_delannoy_numbers');
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('central_delannoy_numbers','first six D(0..5) — A001850','eq','1,3,13,63,321,1683','the realized floor',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(central_delannoy_numbers(), 6) e $q$),
  ('central_delannoy_numbers','unrank(3) = D(3) = 63','eq','63','off the floor',$q$
    SELECT (unrank(central_delannoy_numbers(), 3)).value::text $q$),
  ('central_delannoy_numbers','cardinality = infinity','eq','Infinity','unbounded sequence',$q$
    SELECT cardinality(central_delannoy_numbers())::text $q$);
