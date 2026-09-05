-- requires: binary_trees, k_dyck_paths, realizer, utilities
-- k_ary_trees — trees where every internal node has EXACTLY k children (a leaf has 0). Graded by (n, k): n
-- internal nodes, kn leaf slots, kn+1 total nodes. Count = the Fuss-Catalan number C(kn,n)/((k-1)n+1) — the same
-- formula already realized for k_dyck_paths (k-ary Dyck paths), which is the classical bijective encoding this
-- collection's own carrier generalizes directly: k=2 IS binary_trees (same preorder-word encoding, same slot
-- recursion with k-1=1), asserted below element-for-element, not just by count.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE k_ary_tree AS (shape int[]);                               -- 1/0 preorder word, length kn+1
CREATE FUNCTION notation(t k_ary_tree) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(s::text, '' ORDER BY o), '') FROM unnest((t).shape) WITH ORDINALITY AS x(s, o) $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: the binary_trees slot recursion generalized — a 1 (internal, k children) consumes one open slot and
-- opens k (net +（k-1)); a 0 (leaf) consumes one (net -1). Root starts with 1 open slot; emitted in ascending
-- lex order of the shape array, same convention as binary_trees.
CREATE TYPE k_ary_trees_fiber AS (n natural_number, k natural_number);   -- axes: n (internal nodes), k (arity)
CREATE FUNCTION fiber_elements(f k_ary_trees_fiber, element_limit int) RETURNS SETOF k_ary_tree LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(shape, slots, ones, len) AS (
      SELECT ARRAY[]::int[], 1, 0, 0
    UNION ALL
      SELECT g.shape || c.sym, g.slots + CASE WHEN c.sym = 1 THEN (f).k::int - 1 ELSE -1 END,
             g.ones + CASE WHEN c.sym = 1 THEN 1 ELSE 0 END, g.len + 1
      FROM gen g CROSS JOIN (VALUES (1), (0)) AS c(sym)
      WHERE g.len < (f).k::int * (f).n::int + 1
        AND g.slots >= 1
        AND (c.sym = 0 OR g.ones < (f).n::int)
  )
  SELECT ROW(shape)::k_ary_tree FROM gen
  WHERE len = (f).k::int * (f).n::int + 1 AND slots = 0
  ORDER BY shape ASC LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f k_ary_trees_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT div(binomial((f).k::int * (f).n::int, (f).n::int), (((f).k::int - 1) * (f).n::int + 1)::numeric) $$;   -- Fuss-Catalan

-- contains: same slot-invariant check as binary_trees, generalized to k.
CREATE FUNCTION contains_in_fiber(f k_ary_trees_fiber, v k_ary_tree) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  WITH steps AS (
    SELECT s, o, 1 + sum(CASE WHEN s = 1 THEN (f).k::int - 1 ELSE -1 END) OVER (ORDER BY o) AS slots_after
    FROM unnest((v).shape) WITH ORDINALITY AS t(s, o)
  )
  SELECT coalesce(array_length((v).shape, 1), 0) = (f).k::int * (f).n::int + 1
     AND NOT EXISTS (SELECT 1 FROM steps WHERE s NOT IN (0, 1))
     AND coalesce((SELECT slots_after FROM steps ORDER BY o DESC LIMIT 1), -1) = 0
     AND coalesce((SELECT min(slots_after) FROM steps WHERE o < coalesce(array_length((v).shape, 1), 0)), 1) >= 1 $$;

INSERT INTO base_collection VALUES ('k_ary_trees', 'k_ary_tree');
INSERT INTO base_grade VALUES ('k_ary_trees', 1, 'n', NULL, NULL), ('k_ary_trees', 2, 'k', NULL, NULL);
CREATE FUNCTION fiber_symbol(f k_ary_trees_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'KT' || to_unicode_subscript((f).k) || '(' || (f).n::int || ')' $$;

-- direct unrank: same forced-final-leaf reduction binary_trees uses (the preorder word's LAST symbol is always a
-- leaf — slots hits exactly 1 right before it), leaving kn symbols (n ups of rise u=k−1, n·u downs of fall 1) to
-- unrank against a generalized ballot count. Unlike the ±1 case (dyck_completions' reflection-principle closed
-- form), asymmetric step sizes have no such O(1) formula here, so completions(p,q,h) — p remaining ups, q
-- remaining downs, height h, stay ≥0, land on exactly 0 — is filled bottom-up as a DP cube (linear-indexed
-- numeric[]; p ascending outer needs only smaller-p layers already filled, q ascending inner only smaller-q
-- within the same p-layer): O(n²·(k−1)) cells, each O(1). Preference order matches the floor's ASCENDING shape
-- order (0 before 1): try a down/leaf step first.
CREATE FUNCTION fiber_unrank(f k_ary_trees_fiber, rank rank_index) RETURNS k_ary_tree LANGUAGE plpgsql IMMUTABLE AS $fu$
  DECLARE
    n int := (f).n::int; k int := (f).k::int; u int := k - 1;
    qmax int := n * u; hmax int := n * u;               -- max remaining downs / max reachable height
    qw int := qmax + 1; hw int := hmax + 1;              -- (q,h)-plane width for linear indexing into dp
    dp numeric[]; p int; q int; h int; idx int; up_v numeric; down_v numeric;
    shape int[] := '{}'; ru int := n; rd int := qmax; hh int := 0; r numeric := rank; cd numeric; i int;
  BEGIN
    IF n = 0 THEN RETURN ROW(ARRAY[0])::k_ary_tree; END IF;      -- the single leaf (k irrelevant)
    dp := array_fill(0::numeric, ARRAY[(n + 1) * qw * hw]);
    FOR p IN 0..n LOOP
      FOR q IN 0..qmax LOOP
        FOR h IN 0..hmax LOOP
          idx := p * qw * hw + q * hw + h;                       -- 0-based; +1 on every array access below
          IF p = 0 AND q = 0 THEN
            dp[idx + 1] := CASE WHEN h = 0 THEN 1 ELSE 0 END;
          ELSE
            up_v := 0; down_v := 0;
            IF p > 0 AND h + u <= hmax THEN                      -- take an up-step (+u): one fewer up, height h+u
              up_v := dp[(p - 1) * qw * hw + q * hw + (h + u) + 1];
            END IF;
            IF q > 0 AND h - 1 >= 0 THEN                         -- take a down-step (-1): one fewer down, height h-1
              down_v := dp[p * qw * hw + (q - 1) * hw + (h - 1) + 1];
            END IF;
            dp[idx + 1] := up_v + down_v;
          END IF;
        END LOOP;
      END LOOP;
    END LOOP;
    FOR i IN 1..(k * n) LOOP
      cd := CASE WHEN rd > 0 AND hh - 1 >= 0 THEN dp[ru * qw * hw + (rd - 1) * hw + (hh - 1) + 1] ELSE 0 END;
      IF rd > 0 AND hh - 1 >= 0 AND r < cd THEN
        shape := shape || 0; rd := rd - 1; hh := hh - 1;
      ELSE
        IF rd > 0 AND hh - 1 >= 0 THEN r := r - cd; END IF;
        shape := shape || 1; ru := ru - 1; hh := hh + u;
      END IF;
    END LOOP;
    shape := shape || 0;   -- the forced trailing leaf (slots always lands at exactly 0 here)
    RETURN ROW(shape)::k_ary_tree;
  END $fu$;
SELECT base_realize('k_ary_trees');

-- ── map to k-Dyck paths ───────────────────────────────────────────────────────────────────────────────
-- classical Łukasiewicz-walk truncation (the k=2 case is the textbook binary-tree ↔ Dyck-path bijection): the
-- preorder word's LAST symbol is always a leaf (the slot count hits exactly 1 right before it, 0 right after —
-- it's forced), so dropping it leaves kn symbols with exactly n ones (all n internal nodes, none dropped) and
-- n(k-1) zeros; rescaling 1↦(k-1) (up) and 0↦-1 (down) reproduces the running "open slots − 1" trajectory
-- exactly, which is precisely a k-Dyck path of order n: n up-steps of rise (k−1), n(k−1) down-steps of fall 1.
CREATE FUNCTION k_ary_tree_to_k_dyck_path(t k_ary_tree, k int) RETURNS k_dyck_path LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT CASE WHEN s = 1 THEN k - 1 ELSE -1 END
              FROM unnest((t).shape[1:coalesce(array_length((t).shape,1),0) - 1]) s))::k_dyck_path $$;

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('k_ary_trees','Fuss-Catalan counts match k_dyck_paths exactly, k=2,3,4, n=0..5','eq','1,1,2,5,14,42|1,1,3,12,55,273|1,1,4,22,140,969','same formula, independently realized',$q$
    SELECT concat_ws('|',
      (SELECT string_agg(cardinality(k_ary_trees(n,2))::text, ',' ORDER BY n) FROM generate_series(0,5) n),
      (SELECT string_agg(cardinality(k_ary_trees(n,3))::text, ',' ORDER BY n) FROM generate_series(0,5) n),
      (SELECT string_agg(cardinality(k_ary_trees(n,4))::text, ',' ORDER BY n) FROM generate_series(0,5) n)) $q$),
  ('k_ary_trees','k=2 IS binary_trees: identical shape encoding, element-for-element, n=0..5','eq','true','not just equal counts — equal notations, in rank order',$q$
    SELECT bool_and(
      (SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(k_ary_trees(n,2)) e)
      = (SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(binary_trees(n)) e))::text
    FROM generate_series(0,5) n $q$),
  ('k_ary_trees','the single ternary tree (k=3) of order n=1: one internal node, 3 leaves','eq','1000','root + 3 leaf children',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(k_ary_trees(1,3)) e $q$),
  ('k_ary_trees','floor generates 12 trees at n=3, k=3 (independent of the accel)','eq','12','counted off the floor',$q$
    SELECT count(*)::text FROM elements(k_ary_trees(3,3)) e $q$),
  ('k_ary_trees','contains via <@: 1000 ∈ k_ary_trees(1,3), 1100 ∉ (wrong slot count for k=3)','eq','true|false','generated from contains_in_fiber',$q$
    SELECT (ROW(ARRAY[1,0,0,0])::k_ary_tree <@ k_ary_trees(1,3))::text || '|' ||
           (ROW(ARRAY[1,1,0,0])::k_ary_tree <@ k_ary_trees(1,3))::text $q$),
  ('k_ary_trees','to_k_dyck_path: the image of k_ary_trees(2,3) IS exactly k_dyck_paths(2,3)','eq','true','the bijection — image set equals the codomain fiber',$q$
    SELECT (
      (SELECT array_agg(s ORDER BY s) FROM (SELECT notation(k_ary_tree_to_k_dyck_path((e).value, 3)) s FROM elements(k_ary_trees(2,3)) e) t)
      = (SELECT array_agg(s ORDER BY s) FROM (SELECT notation((d).value) s FROM elements(k_dyck_paths(2,3)) d) t))::text $q$),
  ('k_ary_trees','fiber_unrank(k_ary_trees(3,3), 0..11) are all members (accel floor)','eq','true','generalized ballot-DP unrank lands inside the Fuss-Catalan(3,3)=12 fiber for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(k_ary_trees(3,3)) f), ord::rank_index) <@ k_ary_trees(3,3))::text
      FROM generate_series(0, cardinality(k_ary_trees(3,3))::int - 1) ord $q$),
  ('k_ary_trees','fiber_unrank(k_ary_trees(4,2), 0..13) are all members (k=2 slice matches binary_trees'' own DP shape)','eq','true','u=1 degenerates cleanly to the ordinary Catalan(4)=14 fiber',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(k_ary_trees(4,2)) f), ord::rank_index) <@ k_ary_trees(4,2))::text
      FROM generate_series(0, cardinality(k_ary_trees(4,2))::int - 1) ord $q$);
