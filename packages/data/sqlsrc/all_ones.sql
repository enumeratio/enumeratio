-- requires: realizer, utilities
-- all_ones — the constant sequence 1,1,1,… (OEIS A000012). UNGRADED / infinite (carrier numeric), like
-- catalan_numbers / fibonacci_numbers. Trivial on its own, but it is the canonical argument for the multiplicative
-- sequence transforms (euler(all_ones) = the partition numbers; a unit for Dirichlet convolution) — see #239.
CREATE FUNCTION all_ones_term(r int) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN r < 0 THEN NULL ELSE 1 END $$;
CREATE TYPE all_ones_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f all_ones_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT all_ones_term(r) FROM generate_series(0, element_limit - 1) r $$;
CREATE FUNCTION fiber_symbol(f all_ones_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '1' $$;
CREATE FUNCTION fiber_unrank(f all_ones_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT all_ones_term(rank::int) $$;
INSERT INTO base_collection VALUES ('all_ones', 'numeric', true);   -- unbounded, ungraded
SELECT base_realize('all_ones');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('all_ones','first terms via the realized floor','eq','1,1,1,1,1,1','the constant-1 sequence (A000012)',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(all_ones(), 6) e $q$),
  ('all_ones','unrank(4) = 1; cardinality = Infinity','eq','1|Infinity','one endless fiber',$q$
    SELECT (unrank(all_ones(), 4)).value::text || '|' || cardinality(all_ones())::text $q$);
