-- requires: fibonacci, polygonal_numbers, realizer
-- pentagonal_numbers — UNGRADED / infinite (carrier numeric), like triangular/fibonacci: one empty-address
-- fiber, unbounded ⇒ cardinality = ∞. Floor = P(r) = r·(3r-1)/2 (div for exact halving; r(3r-1) is always
-- even). contains is rank-agnostic: x is pentagonal iff 24x+1 is a perfect square with sqrt ≡ 5 (mod 6) —
-- i.e. n = (1+√(24x+1))/6 is a non-negative integer; x=0 (=P(0)) is the lone exception the mod test misses.
-- Reuses is_perfect_square from the fibonacci floor.

CREATE FUNCTION pentagonal_number(r term_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT div(r::numeric*(3*r-1), 2) $$;

CREATE TYPE pentagonal_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f pentagonal_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT pentagonal_number(r) FROM generate_series(0, element_limit-1) r $$;
CREATE FUNCTION contains_in_fiber(f pentagonal_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT v = 0 OR (is_perfect_square(24*v + 1) AND mod(trunc(sqrt(24*v + 1)), 6) = 5) $$;   -- n = (1+√(24x+1))/6 ∈ ℤ≥0

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f pentagonal_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT pentagonal_number(rank::term_index) $fu$;
INSERT INTO base_collection VALUES ('pentagonal_numbers', 'numeric', true);   -- unbounded, ungraded
SELECT base_realize('pentagonal_numbers');
INSERT INTO base_family_point (collection, family, bindings) VALUES ('pentagonal_numbers','polygonal_numbers','{"k": 5}');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('pentagonal_numbers','first terms via the realized floor','eq','0,1,5,12,22,35,51,70,92','elements over the one infinite fiber (r=0..8)',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(pentagonal_numbers(), 9) e $q$),
  ('pentagonal_numbers','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(pentagonal_numbers()) f LIMIT 1) FROM fibers(pentagonal_numbers()) $q$),
  ('pentagonal_numbers','unrank(8) = 92 = P(8)','eq','92','off the floor',$q$
    SELECT (unrank(pentagonal_numbers(), 8)).value::text $q$),
  ('pentagonal_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(pentagonal_numbers())::text $q$),
  ('pentagonal_numbers','contains is rank-agnostic: 35 ∈, 36 ∉ (via <@)','eq','true|false','generated contains + operator (24n+1 square, √≡5 mod 6)',$q$
    SELECT (35::numeric <@ pentagonal_numbers())::text || '|' || (36::numeric <@ pentagonal_numbers())::text $q$);
