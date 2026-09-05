-- requires: realizer, utilities
-- endofunctions — all functions f:{1..n}->{1..n}, counted by n^n (n=0 is the single empty function, 0^0=1).
-- Single grade [n]. Provides the floor (tuples in lexicographic order of the images array) + an n^n count
-- accel + a contains engine; base_realize generates handle/fiber/element + constructor (incl. the (lo,hi)
-- range form) + the full surface.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE endofunction AS (images int[]);                           -- images[i] = f(i), each in [1,n]
CREATE FUNCTION notation(f endofunction) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT array_to_string((f).images, '') $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: every function {1..n}->{1..n}, built image-by-image (image of 1, then 2, …, then n), each image
-- ranging over 1..n; emitted in lexicographic order of the images array. n=0 needs no special case: the base
-- row (empty images, remaining=0) already satisfies the final filter, giving the single empty function.
CREATE TYPE endofunctions_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f endofunctions_fiber, element_limit int) RETURNS SETOF endofunction LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT ARRAY[]::int[] AS images, (f).n::int AS remaining
    UNION ALL
    SELECT images || i, remaining - 1
      FROM build, LATERAL generate_series(1, (f).n::int) i
     WHERE remaining > 0
  )
  SELECT ROW(images)::endofunction FROM build
   WHERE remaining = 0
   ORDER BY images
   LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f endofunctions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT pow_int((f).n::int, (f).n::int) $$;                          -- n^n (pow_int(_, 0) = 1, covers n=0)

-- contains: v is an endofunction of [n] iff it has exactly n images, each in [1,n].
CREATE FUNCTION contains_in_fiber(f endofunctions_fiber, v endofunction) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).images, 1), 0) = (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest((v).images) x WHERE x < 1 OR x > (f).n::int) $$;

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('endofunctions', 'endofunction');
INSERT INTO base_grade VALUES ('endofunctions', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f endofunctions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'End(' || (f).n::int || ')' $$;   -- corpus symbol
-- direct unrank: images are a length-n word over [n] in lex order = a base-n odometer (position 1 most significant).
CREATE FUNCTION fiber_unrank(f endofunctions_fiber, rank rank_index) RETURNS endofunction LANGUAGE sql IMMUTABLE AS $fu$
  SELECT ROW(ARRAY(
    SELECT (div(rank::numeric, pow_int((f).n::int, (f).n::int - i)) % (f).n::numeric)::int + 1
    FROM generate_series(1, (f).n::int) i))::endofunction $fu$;
SELECT base_realize('endofunctions');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('endofunctions','cardinality anchor = n^n for n=0..5 (accel)','eq','1,1,4,27,256,3125','0^0=1 by convention',$q$
    SELECT string_agg(cardinality(endofunctions(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('endofunctions','n=0 ⇒ one empty function','eq','1|','n^0=1, the empty tuple',$q$
    SELECT count(*)::text || '|' || notation((unrank(endofunctions(0), 0)).value) FROM elements(endofunctions(0)) e $q$),
  ('endofunctions','n=2 in lex order of images','eq','11,12,21,22','the four functions {1..2}->{1..2}',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(endofunctions(2)) e $q$),
  ('endofunctions','floor generates 27 functions at n=3 (cardinality via counting)','eq','27','independent of the n^n accel',$q$
    SELECT count(*)::text FROM elements(endofunctions(3)) e $q$),
  ('endofunctions','every generated function at n=3 has 3 images, each in [1,3]','eq','true','structural invariant across the fiber',$q$
    SELECT bool_and(
        array_length(((e).value).images, 1) = 3
        AND NOT EXISTS (SELECT 1 FROM unnest(((e).value).images) x WHERE x < 1 OR x > 3)
      )::text FROM elements(endofunctions(3)) e $q$),
  ('endofunctions','cardinality(endofunctions(5)) = 3125 (accel)','eq','3125','closed-form n^n',$q$
    SELECT cardinality(endofunctions(5))::text $q$),
  ('endofunctions','range handle: cardinality(endofunctions(0,3)) = 33','eq','33','1+1+4+27 summed over fibers',$q$
    SELECT cardinality(endofunctions(0,3))::text $q$),
  ('endofunctions','fibers(endofunctions(0,3)) unfold to n = 0,1,2,3','eq','0,1,2,3','the grade ranges',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(endofunctions(0,3)) f $q$),
  ('endofunctions','unrank first/last of n=2','eq','11|22','ranks 0 and 3',$q$
    SELECT notation((unrank(endofunctions(2), 0)).value) || '|' ||
           notation((unrank(endofunctions(2), 3)).value) $q$),
  ('endofunctions','element carries a TYPED point fiber + ordinality','eq','2|1','unrank(endofunctions(2),1)',$q$
    SELECT (unrank(endofunctions(2), 1)).fiber.n::text || '|' || ordinality(unrank(endofunctions(2), 1))::text $q$),
  ('endofunctions','global order across fibers = (n, ordinality): endofunctions(1,2)','eq','1|11|12|21|22','n ascending, lex within',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY e) FROM elements(endofunctions(1,2)) e $q$),
  ('endofunctions','contains: {1,1} ∈ endofunctions(2), {1,3} ∉ (image out of range) (via <@)','eq','true|false','generated contains + operator',$q$
    SELECT (ROW(ARRAY[1,1])::endofunction <@ endofunctions(2))::text || '|' ||
           (ROW(ARRAY[1,3])::endofunction <@ endofunctions(2))::text $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('endofunctions','fiber_unrank(endofunctions(3), 0..26) are all members (accel floor)','eq','true','base-n odometer lands inside End([3]) for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(endofunctions(3)) f), ord::rank_index) <@ endofunctions(3))::text
      FROM generate_series(0, cardinality(endofunctions(3))::int - 1) ord $q$);
