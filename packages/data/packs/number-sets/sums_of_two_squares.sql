-- requires: gaussian_integers, realizer, utilities
-- sums_of_two_squares(n) — representations n = a²+b² with 0 ≤ a ≤ b, graded by n. The kernel of the norm map on
-- gaussian_integers (a+bi ↦ a²+b², restricted to the first octant a≤b, both ≥0, so each representation appears
-- once): REUSES the gaussian_integer carrier rather than inventing a pair type (audit §3.2). No closed form wired
-- (r₂(n) needs the prime factorization split by p≡1 vs p≡3 mod 4 — future accel); direct search per fiber.
CREATE TYPE sums_of_two_squares_fiber AS (n natural_number);   -- typed fiber; axis: n

CREATE FUNCTION fiber_elements(f sums_of_two_squares_fiber, element_limit int) RETURNS SETOF gaussian_integer LANGUAGE sql STABLE AS $$
  SELECT ROW(a, b)::gaussian_integer
    FROM generate_series(0, floor(sqrt((f).n::numeric / 2))::int) a,
         LATERAL (SELECT round(sqrt(((f).n::int - a*a)::numeric))::int AS b) sq
   WHERE (f).n::int - a*a >= 0 AND sq.b * sq.b = (f).n::int - a*a AND sq.b >= a
   ORDER BY a
   LIMIT element_limit $$;

CREATE FUNCTION contains_in_fiber(f sums_of_two_squares_fiber, v gaussian_integer) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (v).re >= 0 AND (v).im >= 0 AND (v).re <= (v).im
     AND (v).re * (v).re + (v).im * (v).im = (f).n::int $$;

INSERT INTO base_collection VALUES ('sums_of_two_squares', 'gaussian_integer');
INSERT INTO base_grade VALUES ('sums_of_two_squares', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f sums_of_two_squares_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'R₂(' || (f).n::int || ')' $$;
SELECT base_realize('sums_of_two_squares');

-- reuse gaussian_integers' carrier stats (norm/real_part/imaginary_part) under this collection's own id too
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('sums_of_two_squares','norm','gaussian_norm','Norm (a²+b²)','natural_numbers'),
  ('sums_of_two_squares','real_part','gaussian_integers_real_part','Real part','integer_numbers'),
  ('sums_of_two_squares','imaginary_part','gaussian_integers_imaginary_part','Imaginary part','integer_numbers');

-- map: the kernel embeds into gaussian_integers (identity on the shared carrier — every representation IS a
-- Gaussian integer of that norm).
CREATE FUNCTION sums_of_two_squares_to_gaussian_integer(v gaussian_integer) RETURNS gaussian_integer LANGUAGE sql IMMUTABLE AS $$ SELECT v $$;
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('sums_of_two_squares','gaussian_integer','sums_of_two_squares_to_gaussian_integer','gaussian_integers','As a Gaussian integer',NULL);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('sums_of_two_squares','25 = 0²+5² = 3²+4² (two representations)','eq','5i,3+4i',NULL,$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(sums_of_two_squares(25)) e $q$),
  ('sums_of_two_squares','3 (≡3 mod 4, prime, odd exponent) has NO representation','eq','0',NULL,$q$
    SELECT cardinality(sums_of_two_squares(3))::text $q$),
  ('sums_of_two_squares','2 = 1²+1² (one representation)','eq','1+i',NULL,$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(sums_of_two_squares(2)) e $q$),
  ('sums_of_two_squares','every representation up to n=200 has norm exactly n','eq','true','the defining invariant',$q$
    SELECT bool_and(gaussian_norm((e).value) = n) FROM generate_series(1,200) n, LATERAL elements(sums_of_two_squares(n)) e $q$),
  ('sums_of_two_squares','contains: 3+4i ∈ R₂(25), 4+3i (a>b) ∉','eq','true|false',NULL,$q$
    SELECT (ROW(3,4)::gaussian_integer <@ sums_of_two_squares(25))::text || '|' || (ROW(4,3)::gaussian_integer <@ sums_of_two_squares(25))::text $q$);
