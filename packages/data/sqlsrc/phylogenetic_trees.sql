-- requires: realizer, utilities
-- phylogenetic_trees — rooted binary trees on n LABELED leaves (labels 1..n), internal nodes unlabeled ("tree
-- shapes with labeled tips" — the objects OEIS A001147 counts, shifted: n=1..6 → 1,1,3,15,105,945). Carrier is the
-- INSERTION-SEQUENCE encoding, not a raw tree: a tree on leaves 1..n is uniquely determined by (s_3,...,s_n) where
-- s_k names which of the 2k-3 edges of the tree-on-leaves-1..(k-1) leaf k subdivides (edges numbered by a fixed
-- preorder-of-edges convention below). This is a mixed-radix odometer with radices 3,5,7,...,(2n-3) — the product
-- IS (2n-3)!! — so fiber_count/floor/fiber_unrank are all trivial and EXACT, unlike a raw-tree carrier which would
-- need de-duplication of isomorphic shapes.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE phylogenetic_tree AS (inserts int[]);                      -- s_3..s_n; empty for n <= 2
CREATE FUNCTION notation(t phylogenetic_tree) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_to_string((t).inserts, '.'), '') $$;            -- the insertion word itself, dot-separated

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: the mixed-radix odometer itself — every sequence s_3..s_n with 0 <= s_k <= 2k-4, ascending lex order.
-- n <= 2 → the single empty-sequence element (the unique tree on 0/1/2 leaves, by convention).
CREATE TYPE phylogenetic_trees_fiber AS (n natural_number);            -- axis: n (number of labeled leaves)
CREATE FUNCTION fiber_elements(f phylogenetic_trees_fiber, element_limit int) RETURNS SETOF phylogenetic_tree LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(k, inserts) AS (
      SELECT 3, ARRAY[]::int[]
    UNION ALL
      SELECT g.k + 1, g.inserts || s.s
      FROM gen g CROSS JOIN generate_series(0, 2 * g.k - 4) AS s(s)
      WHERE g.k <= (f).n::int
  )
  SELECT ROW(CASE WHEN (f).n::int <= 2 THEN ARRAY[]::int[] ELSE inserts END)::phylogenetic_tree
  FROM gen
  WHERE k = (f).n::int + 1 OR (f).n::int <= 2 AND k = 3
  ORDER BY inserts ASC LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f phylogenetic_trees_fiber) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := (f).n::int; total numeric := 1; j int;
  BEGIN
    IF n <= 2 THEN RETURN 1; END IF;
    FOR j IN 3..n LOOP total := total * (2 * j - 3); END LOOP;
    RETURN total;                                                     -- (2n-3)!!
  END $$;

-- contains: length matches max(n-2,0), each s_k in range [0, 2k-4] (k = index + 2).
CREATE FUNCTION contains_in_fiber(f phylogenetic_trees_fiber, v phylogenetic_tree) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).inserts, 1), 0) = greatest((f).n::int - 2, 0)
     AND NOT EXISTS (
       SELECT 1 FROM generate_subscripts((v).inserts, 1) i
       WHERE (v).inserts[i] < 0 OR (v).inserts[i] > 2 * (i + 2) - 4
     ) $$;

INSERT INTO base_collection VALUES ('phylogenetic_trees', 'phylogenetic_tree');
INSERT INTO base_grade VALUES ('phylogenetic_trees', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f phylogenetic_trees_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'PT(' || (f).n::int || ')' $$;

-- direct unrank: mixed-radix (factorial-number-system-style) decode with radices (3,5,...,2n-3), MSD-first to
-- match the floor's ascending lex order — s_3 (the outermost/slowest-varying digit) is decoded FIRST by dividing
-- by the product of the remaining (smaller-k, later-index) radices, exactly like a odometer's most-significant
-- wheel changing slowest. Verified against the floor via selfcert (element_at == sequential).
CREATE FUNCTION fiber_unrank(f phylogenetic_trees_fiber, rank rank_index) RETURNS phylogenetic_tree LANGUAGE plpgsql IMMUTABLE AS $fu$
  DECLARE
    n int := (f).n::int; r numeric := rank; inserts int[] := '{}';
    k int; radix int; suffix_product numeric; digit int;
  BEGIN
    IF n <= 2 THEN RETURN ROW(ARRAY[]::int[])::phylogenetic_tree; END IF;
    FOR k IN 3..n LOOP
      radix := 2 * k - 3;
      suffix_product := 1;                                            -- product of radices for k+1..n (less significant digits)
      FOR digit IN (k+1)..n LOOP suffix_product := suffix_product * (2 * digit - 3); END LOOP;
      digit := floor(r / suffix_product);
      inserts := inserts || digit;
      r := r - digit * suffix_product;
    END LOOP;
    RETURN ROW(inserts)::phylogenetic_tree;
  END $fu$;
SELECT base_realize('phylogenetic_trees');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('phylogenetic_trees','cardinality matches A001147 (double factorial), n=1..6','eq','1,1,3,15,105,945','n=0 and n=1 are 1 by convention; n=2 is the unique 2-leaf tree',$q$
    SELECT string_agg(cardinality(phylogenetic_trees(n))::text, ',' ORDER BY n) FROM generate_series(1,6) n $q$),
  ('phylogenetic_trees','n=3: the 3 trees, by insertion word (ascending lex)','eq','0,1,2','leaf 3 subdivides one of the 2*3-3=3 edges of (1,2)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(phylogenetic_trees(3)) e $q$),
  ('phylogenetic_trees','floor count independent of the accel: |elements(phylogenetic_trees(4))| = 15','eq','15','counted off the floor, not fiber_count',$q$
    SELECT count(*)::text FROM elements(phylogenetic_trees(4)) e $q$),
  ('phylogenetic_trees','fiber_unrank(phylogenetic_trees(4), 0..14) are all members (accel floor)','eq','true','mixed-radix decode lands inside the (2*4-3)!!=15 fiber for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(phylogenetic_trees(4)) f), ord::rank_index) <@ phylogenetic_trees(4))::text
      FROM generate_series(0, cardinality(phylogenetic_trees(4))::int - 1) ord $q$),
  ('phylogenetic_trees','contains via <@: 0.1 valid at n=4 (2 digits, radices 3,5), 3.1 invalid (digit 0 out of range [0,2])','eq','true|false','generated from contains_in_fiber',$q$
    SELECT (ROW(ARRAY[0,1])::phylogenetic_tree <@ phylogenetic_trees(4))::text || '|' ||
           (ROW(ARRAY[3,1])::phylogenetic_tree <@ phylogenetic_trees(4))::text $q$);
