-- requires: realizer, utilities
-- labeled_trees — trees on n labeled vertices {1..n}, represented by their PRUFER SEQUENCE: a word of length
-- n-2 over {1..n} (n=1,2 have the single empty sequence: the lone vertex, resp. the single edge). Single grade
-- [n]. The floor enumerates ALL n^(n-2) sequences in odometer order (mixed-radix base n, most-significant digit
-- first); count = n^(n-2) (Cayley's formula, taken as 1 for n<=2 by convention).

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE labeled_tree AS (prufer int[]);                              -- length n-2; e.g. {2,2} for n=4
CREATE FUNCTION notation(t labeled_tree) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '(' || array_to_string((t).prufer, ',') || ')' $$;


CREATE FUNCTION labeled_tree_unrank(n int, ord bigint) RETURNS labeled_tree LANGUAGE plpgsql IMMUTABLE AS $$   -- odometer decode
  DECLARE L int := GREATEST(n-2, 0); res int[] := array_fill(0, ARRAY[L]); x numeric := ord; i int; d int;
  BEGIN
    FOR i IN REVERSE L..1 LOOP
      d := mod(x, n)::int; x := div(x, n);   -- exact integer div/mod, rightmost digit fastest
      res[i] := d + 1;
    END LOOP;
    RETURN ROW(res)::labeled_tree;
  END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE labeled_trees_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_count(f labeled_trees_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).n::int <= 2 THEN 1::numeric ELSE pow_int((f).n::int, (f).n::int-2) END $$;
CREATE FUNCTION fiber_elements(f labeled_trees_fiber, element_limit int) RETURNS SETOF labeled_tree LANGUAGE sql STABLE AS $$
  SELECT labeled_tree_unrank((f).n::int, ord::int)
  FROM generate_series(0, least(fiber_count(f), element_limit::numeric) - 1) ord LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f labeled_trees_fiber, v labeled_tree) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).prufer,1), 0) = GREATEST((f).n::int-2, 0)
     AND NOT EXISTS (SELECT 1 FROM unnest((v).prufer) x WHERE x < 1 OR x > (f).n::int) $$;

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f labeled_trees_fiber, rank rank_index) RETURNS labeled_tree LANGUAGE sql IMMUTABLE AS $fu$ SELECT labeled_tree_unrank((f).n::int, rank) $fu$;
INSERT INTO base_collection VALUES ('labeled_trees', 'labeled_tree');
INSERT INTO base_grade VALUES ('labeled_trees', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f labeled_trees_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'T(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('labeled_trees');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('labeled_trees','cardinality anchors n=1..5: 1,1,3,16,125 (Cayley n^(n-2))','eq','1,1,3,16,125','closed-form accel',$q$
    SELECT string_agg(cardinality(labeled_trees(n))::text, ',' ORDER BY n) FROM generate_series(1,5) n $q$),
  ('labeled_trees','n=1,2: single empty-sequence tree','eq','()|()','the lone vertex / single edge',$q$
    SELECT notation((unrank(labeled_trees(1), 0)).value) || '|' || notation((unrank(labeled_trees(2), 0)).value) $q$),
  ('labeled_trees','elements(labeled_trees(3)) = the 3 sequences of length 1 over {1,2,3}','eq','(1),(2),(3)','n^(n-2) = 3^1 = 3',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(labeled_trees(3)) e $q$),
  ('labeled_trees','n=4 odometer order, first five of 16','eq','(1,1),(1,2),(1,3),(1,4),(2,1)','mixed-radix base 4, MSD first',$q$
    SELECT string_agg(notation(v), ',' ORDER BY rk) FROM (
      SELECT (e).value v, row_number() OVER (ORDER BY e) rk FROM elements(labeled_trees(4)) e) s WHERE rk <= 5 $q$),
  ('labeled_trees','element carries a TYPED point fiber + ordinality','eq','5|15','unrank(labeled_trees(5), 15)',$q$
    SELECT (unrank(labeled_trees(5), 15)).fiber.n::text || '|' || ordinality(unrank(labeled_trees(5), 15))::text $q$),
  ('labeled_trees','unrank crosses fibers via range handle (rank 3 = first n=4 sequence)','eq','(1,1)','ranks 0,1,2 are n=3 (3 seqs); rank 3 = n=4',$q$
    SELECT notation((unrank(labeled_trees(3,4), 3)).value) $q$),
  ('labeled_trees','contains via <@: (2,2) is a valid n=4 sequence, (2,5) is not','eq','true|false','generated from contains_in_fiber',$q$
    SELECT (ROW(ARRAY[2,2])::labeled_tree <@ labeled_trees(4))::text || '|' || (ROW(ARRAY[2,5])::labeled_tree <@ labeled_trees(4))::text $q$);
