-- requires: realizer
-- rooted_unlabeled_trees — rooted trees on n unlabeled nodes, up to isomorphism (children unordered). Counted by
-- A000081: 1,1,2,4,9,20,48,115,286,719,1842,4766,12486,... (n=1..13). No closed form — the divisor-sum recurrence
-- below (rooted_unlabeled_tree_count) is a genuine acceleration over the floor's own enumeration+count, and is the
-- primary correctness gate: it must reproduce A000081 exactly, and must AGREE with the floor's count() at every n
-- the floor is exercised at (selfcert's differential).
--
-- Single grade [n], n>=1. Carrier: the canonical DFS level sequence (root depth 0, preorder, children unordered).
-- The canonical representative of an isomorphism class is defined recursively: canon(root) = [0] followed by the
-- concatenation of the (already-canonical, then +1-shifted) child subtrees, with children ordered so those shifted
-- sequences are NON-INCREASING under plain array comparison (Postgres int[] comparison: elementwise, shorter-is-
-- smaller when one is a prefix of the other — any fixed total order works here, this one is simplest to express).
-- fiber_unrank is SKIPPED (unlabeled-tree unrank is genuinely hard, and optional per the design) — selfcert then
-- validates fiber_count == count(elements) through the sequential path, which is the essential differential.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE rooted_unlabeled_tree AS (levels int[]);                  -- DFS-preorder depths, root depth 0
CREATE FUNCTION notation(t rooted_unlabeled_tree) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_to_string((t).levels, ','), '') $$;

-- shift every depth by delta, preserving order (unnest without ORDER BY is not guaranteed-order; WITH ORDINALITY is)
CREATE FUNCTION rut_shift(levels int[], delta int) RETURNS int[] LANGUAGE sql IMMUTABLE AS $$
  SELECT array_agg(x + delta ORDER BY o) FROM unnest(levels) WITH ORDINALITY AS u(x, o) $$;

-- split a (root-included) level sequence into its top-level children's OWN sub-sequences, each renormalized to
-- start at depth 0 (subtract 1). A DFS-preorder walk decomposes into maximal runs each time depth returns to 1.
CREATE FUNCTION rut_split_children(levels int[]) RETURNS SETOF int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length(levels, 1), 0); i int := 2; start_i int;
  BEGIN
    WHILE i <= n LOOP
      IF levels[i] = 1 THEN
        start_i := i;
        i := i + 1;
        WHILE i <= n AND levels[i] > 1 LOOP i := i + 1; END LOOP;
        RETURN NEXT ARRAY(SELECT levels[k] - 1 FROM generate_series(start_i, i - 1) k);
      ELSE
        i := i + 1;   -- defensive; a valid level sequence never lands here
      END IF;
    END LOOP;
  END $$;

-- the canonical form of a VALID level sequence: recursively canonicalize each child, shift +1, sort descending,
-- concatenate after the root's own [0]. A leaf (length-1 sequence) has no children and canonicalizes to itself.
CREATE FUNCTION rut_canonicalize(levels int[]) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE result int[] := ARRAY[0]; shifted int[];
  BEGIN
    FOR shifted IN
      SELECT s FROM (
        SELECT rut_shift(rut_canonicalize(child), 1) AS s FROM rut_split_children(levels) child
      ) t ORDER BY s DESC
    LOOP
      result := result || shifted;
    END LOOP;
    RETURN result;
  END $$;

-- ── the FLOOR: canonical generation ──────────────────────────────────────────────────────────────────
-- rut_trees(n): every canonical level sequence of a rooted tree with n nodes, n>=1. rut_forest(remaining, cap):
-- every non-increasing (w.r.t. cap's ordering) concatenation of children's shifted canonical sequences totaling
-- `remaining` nodes, each bounded above by `cap` (NULL = unbounded, for the first/outermost pick). Structurally
-- identical to integer_partitions' "peel the largest part first, bound the tail by it" recursion — the largest
-- element of a valid non-increasing sequence is always its own first entry, so trying every candidate tree (of
-- every size <= remaining) for that first slot, then recursing on the remainder bounded by the chosen tree,
-- enumerates each non-increasing arrangement exactly once (no duplicates, no gaps).
CREATE FUNCTION rut_trees(n int) RETURNS SETOF int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE fseq int[];
  BEGIN
    IF n < 1 THEN RETURN; END IF;
    IF n = 1 THEN RETURN NEXT ARRAY[0]; RETURN; END IF;
    FOR fseq IN SELECT * FROM rut_forest(n - 1, NULL) LOOP
      RETURN NEXT ARRAY[0] || fseq;
    END LOOP;
  END $$;

CREATE FUNCTION rut_forest(remaining int, cap int[]) RETURNS SETOF int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE s int; t int[]; shifted int[]; tail int[];
  BEGIN
    IF remaining = 0 THEN RETURN NEXT ARRAY[]::int[]; RETURN; END IF;
    FOR s IN 1..remaining LOOP
      FOR t IN SELECT * FROM rut_trees(s) LOOP
        shifted := rut_shift(t, 1);
        IF cap IS NULL OR shifted <= cap THEN
          FOR tail IN SELECT * FROM rut_forest(remaining - s, shifted) LOOP
            RETURN NEXT shifted || tail;
          END LOOP;
        END IF;
      END LOOP;
    END LOOP;
  END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE rooted_unlabeled_trees_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f rooted_unlabeled_trees_fiber, element_limit int) RETURNS SETOF rooted_unlabeled_tree LANGUAGE sql STABLE AS $$
  SELECT ROW(levels)::rooted_unlabeled_tree FROM rut_trees((f).n::int) levels ORDER BY levels LIMIT element_limit $$;

-- fiber_count ACCEL: a(1)=1; b(k) = sum_{d|k} d*a(d); a(n+1) = (1/n) * sum_{k=1}^n b(k)*a(n-k+1). Exact numeric[]
-- DP; the division by n is exact at every step (a classical fact of this recurrence, over the integers).
CREATE FUNCTION rooted_unlabeled_tree_count(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE a numeric[]; b numeric[]; s numeric; i int; k int; d int;
  BEGIN
    IF n < 1 THEN RETURN 0; END IF;
    a := array_fill(0::numeric, ARRAY[n]);
    a[1] := 1;
    b := array_fill(0::numeric, ARRAY[n]);           -- b[k] = sum_{d|k} d*a(d), computed once per k as a(k) settles
    FOR i IN 1..(n - 1) LOOP
      s := 0;
      FOR d IN 1..i LOOP IF i % d = 0 THEN s := s + d * a[d]; END IF; END LOOP;
      b[i] := s;                                     -- b(i), a(i) is already final at this point
      s := 0;
      FOR k IN 1..i LOOP s := s + b[k] * a[i - k + 1]; END LOOP;   -- sum_{k=1}^i b(k)*a(i-k+1)
      a[i + 1] := trim_scale(s / i);                   -- exact: the recurrence divides evenly at every step;
                                                        -- trim_scale keeps display scale from growing per division
    END LOOP;
    RETURN trim_scale(a[n]);
  END $$;
CREATE FUNCTION fiber_count(f rooted_unlabeled_trees_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT rooted_unlabeled_tree_count((f).n::int) $$;

-- contains: v is a member iff its length is n, it starts at depth 0, every step increases depth by at most 1
-- (a valid DFS depth profile) and never goes negative, AND v is already in canonical form (re-canonicalizing it
-- reproduces it exactly).
CREATE FUNCTION contains_in_fiber(f rooted_unlabeled_trees_fiber, v rooted_unlabeled_tree) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).levels, 1), 0) = (f).n::int
     AND (f).n::int >= 1
     AND (v).levels[1] = 0
     AND NOT EXISTS (
       SELECT 1 FROM generate_subscripts((v).levels, 1) i
       WHERE i > 1 AND ((v).levels[i] > (v).levels[i - 1] + 1 OR (v).levels[i] < 0)
     )
     AND (v).levels = rut_canonicalize((v).levels) $$;

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('rooted_unlabeled_trees', 'rooted_unlabeled_tree');
INSERT INTO base_grade VALUES ('rooted_unlabeled_trees', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f rooted_unlabeled_trees_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'RUT(' || (f).n::int || ')' $$;   -- corpus symbol
-- no fiber_unrank: base_realize falls back to the floor-scan path for element_at/unrank/random_element/range.
SELECT base_realize('rooted_unlabeled_trees');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('rooted_unlabeled_trees','A000081 anchor: cardinality (accel) for n=1..10','eq','1,1,2,4,9,20,48,115,286,719','the recurrence, checked against the known sequence',$q$
    SELECT string_agg(cardinality(rooted_unlabeled_trees(n))::text, ',' ORDER BY n) FROM generate_series(1,10) n $q$),
  ('rooted_unlabeled_trees','A000081 anchor: the full recurrence to n=13','eq','1,1,2,4,9,20,48,115,286,719,1842,4766,12486','a(1..13) via rooted_unlabeled_tree_count',$q$
    SELECT string_agg(rooted_unlabeled_tree_count(n)::text, ',' ORDER BY n) FROM generate_series(1,13) n $q$),
  ('rooted_unlabeled_trees','n=3 elements in ascending order: cherry (0,1,1), then path (0,1,2)','eq','0,1,1,0,1,2','the 2 trees of A000081(3)=2',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(rooted_unlabeled_trees(3)) e $q$),
  ('rooted_unlabeled_trees','floor count == accel count at n=7 (independent double-check)','eq','48','count(*) over the generated floor vs the recurrence',$q$
    SELECT count(*)::text FROM elements(rooted_unlabeled_trees(7)) e $q$),
  ('rooted_unlabeled_trees','floor count == accel count at n=8','eq','115','one more n, independent double-check',$q$
    SELECT count(*)::text FROM elements(rooted_unlabeled_trees(8)) e $q$),
  ('rooted_unlabeled_trees','n=1 ⇒ the single node','eq','1|0','A000081(1)=1, just the root',$q$
    SELECT count(*)::text || '|' || notation((unrank(rooted_unlabeled_trees(1), 0)).value) FROM elements(rooted_unlabeled_trees(1)) e $q$),
  ('rooted_unlabeled_trees','every generated element validates against contains_in_fiber (n=1..7)','eq','true','self-consistency: floor ⊆ contains',$q$
    SELECT bool_and(contains_in_fiber(ROW(n)::rooted_unlabeled_trees_fiber, (e).value))
    FROM generate_series(1,7) n, LATERAL elements(rooted_unlabeled_trees(n)) e $q$),
  ('rooted_unlabeled_trees','<@ containment: canonical 0,1,2,1 (root''s bigger child first) is a member of n=4, its child-order permutation 0,1,1,2 is not','eq','true|false','same shape (a leaf child + a 2-chain child of the root), only the child order differs — canonical demands the larger subtree first',$q$
    SELECT (ROW(ARRAY[0,1,2,1])::rooted_unlabeled_tree <@ rooted_unlabeled_trees(4))::text || '|' ||
           (ROW(ARRAY[0,1,1,2])::rooted_unlabeled_tree <@ rooted_unlabeled_trees(4))::text $q$),
  ('rooted_unlabeled_trees','range handle: cardinality(rooted_unlabeled_trees(1,5)) = 1+1+2+4+9','eq','17','fibers unfold over n=1..5',$q$
    SELECT cardinality(rooted_unlabeled_trees(1,5))::text $q$),
  ('rooted_unlabeled_trees','fibers(rooted_unlabeled_trees(1,5)) unfold to n = 1,2,3,4,5','eq','1,2,3,4,5','the grade range',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(rooted_unlabeled_trees(1,5)) f $q$);
