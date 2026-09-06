-- requires: fibonacci, utilities, realizer
-- polygonal_numbers(k) — the GENERATOR family (#67 B3): the k-gonal figurate numbers P(k,r) = ((k-2)r² - (k-4)r)/2
-- for r=0,1,2,… (div for exact halving — the numerator is always even). k selects WHICH polygon (k=3 triangular,
-- k=4 square, k=5 pentagonal, k=6 hexagonal, …) — it is a FAMILY PARAM, not a grade axis: 36 is both P(3,8) and
-- P(4,6), so k is NOT recoverable from a bare element the way k_almost_primes' Ω is. Hence role='param', no
-- default range, no stat, no triangle (#67 D1 litmus: element-recoverable ⇒ axis; otherwise param).
-- contains_in_fiber solves the quadratic for r: with D = 8(k-2)v + (k-4)², r = (√D + (k-4)) / (2(k-2)); v is
-- k-gonal iff D is a perfect square AND that numerator divides 2(k-2) exactly (r=0 is a special case the general
-- test misses at v=0, handled directly). Reuses is_perfect_square from the fibonacci floor.

CREATE FUNCTION polygonal_number(k int, r int) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT div((k-2)::numeric*r*r - (k-4)::numeric*r, 2) $$;

CREATE TYPE polygonal_numbers_fiber AS (k natural_number);   -- typed fiber; param: k (polygon sides, k>=3)
CREATE FUNCTION fiber_elements(f polygonal_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT polygonal_number((f).k::int, r) FROM generate_series(0, element_limit-1) r $$;
CREATE FUNCTION contains_in_fiber(f polygonal_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  -- D = 8(k-2)v + (k-4)² kept numeric (int^int would be double, breaking is_perfect_square(numeric)); r = (√D+(k-4))/(2(k-2))
  WITH d AS (SELECT 8*(((f).k::int)-2)::numeric*v + (((f).k::int)-4)::numeric*(((f).k::int)-4) AS disc)
  SELECT v = 0 OR (
    is_perfect_square(disc)
    AND (trunc(sqrt(disc)) + (((f).k::int)-4)) >= 0
    AND mod(trunc(sqrt(disc)) + (((f).k::int)-4), (2*(((f).k::int)-2))::numeric) = 0
  ) FROM d $$;

-- direct unrank (capability layer 3): the r-th k-gonal number via the closed form — O(1), no scanning.
CREATE FUNCTION fiber_unrank(f polygonal_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$
  SELECT polygonal_number((f).k::int, rank::int) $fu$;

INSERT INTO base_collection VALUES ('polygonal_numbers', 'numeric', true);   -- unbounded fibers
INSERT INTO base_grade (collection,pos,name,lo_expr,hi_expr,role,admissible) VALUES
  ('polygonal_numbers',1,'k',NULL,NULL,'param','k >= 3');   -- k selects the polygon; not element-recoverable ⇒ param
CREATE FUNCTION fiber_symbol(f polygonal_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$   -- matches the render corpus figurate names
  SELECT CASE (f).k::int WHEN 3 THEN 'Tri' WHEN 4 THEN 'Sq' WHEN 5 THEN 'Pent' WHEN 6 THEN 'Hex' WHEN 7 THEN 'Hept' WHEN 8 THEN 'Oct'
                         ELSE 'P' || to_unicode_subscript((f).k) END $$;
SELECT base_realize('polygonal_numbers');

INSERT INTO base_collection_meta VALUES ('polygonal_numbers','Polygonal numbers','The k-gonal figurate numbers P(k,r); k selects the polygon.');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('polygonal_numbers','k=3 (triangular): first terms','eq','0,1,3,6,10,15,21,28,36','the k=3 fiber',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(polygonal_numbers(3), 9) e $q$),
  ('polygonal_numbers','k=5 (pentagonal): first terms','eq','0,1,5,12,22,35,51,70,92','the k=5 fiber',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(polygonal_numbers(5), 9) e $q$),
  ('polygonal_numbers','contains via <@: 22 ∈ k=5 (P(5,4)), 23 ∉','eq','true|false','generated contains, quadratic-root test',$q$
    SELECT (22::numeric <@ polygonal_numbers(5))::text || '|' || (23::numeric <@ polygonal_numbers(5))::text $q$),
  ('polygonal_numbers','graded (by param k) + unbounded: cardinality = infinity','eq','Infinity','each k-fiber is endless',$q$
    SELECT cardinality(polygonal_numbers(6))::text $q$),
  ('polygonal_numbers','(#67 D1) k is a family PARAM, not an axis — not element-recoverable (36 is both P(3,8) and P(4,6))','eq','param','the litmus: no single value of k is recoverable from a bare element',$q$
    SELECT role FROM base_grade WHERE collection='polygonal_numbers' AND name='k' $q$),
  ('polygonal_numbers','differential: polygonal_numbers(3,r) = triangular_numbers(r) for r=0..8 (k=3 is the triangular point)','eq','true','cross-check against the triangular_numbers floor',$q$
    SELECT bool_and((unrank(polygonal_numbers(3), r)).value = (unrank(triangular_numbers(), r)).value)
    FROM generate_series(0, 8) r $q$),
  ('polygonal_numbers','differential: polygonal_numbers(4,r) = square_numbers(r) for r=0..8 (k=4 is the square point)','eq','true','cross-check against the square_numbers floor',$q$
    SELECT bool_and((unrank(polygonal_numbers(4), r)).value = (unrank(square_numbers(), r)).value)
    FROM generate_series(0, 8) r $q$);
