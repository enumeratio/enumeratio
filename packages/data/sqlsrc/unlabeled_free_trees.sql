-- requires: rooted_unlabeled_trees, realizer
-- unlabeled_free_trees — free (unrooted) trees on n unlabeled nodes, up to isomorphism. Counted by A000055:
-- 1,1,1,1,2,3,6,11,23,47,106,235,551,... (n=1..13). Otter's formula gives the acceleration in terms of A000081
-- (rooted_unlabeled_tree_count, already built for rooted_unlabeled_trees): with r(k) = A000081(k),
--   a(n) = r(n) − ½·(Σ_{i=1}^{n-1} r(i)·r(n−i)) + ½·([n even]·r(n/2))
-- (the GF identity U(x) = T(x) − ½T(x)² + ½T(x²)). This is the primary correctness gate: it must reproduce
-- A000055 exactly, and must AGREE with the floor's count() at every n the floor is exercised at (selfcert's
-- differential).
--
-- Single grade [n], n>=1. Carrier: same shape as rooted_unlabeled_tree (a DFS-preorder level sequence), but
-- always CENTROID-rooted — the canonical representative of a free tree is its level sequence when rooted at its
-- centroid (the vertex/vertices minimizing the largest component left after its removal). A tree has either one
-- centroid, or two ADJACENT centroids (only when n is even and the tree splits into two equal n/2 halves); for a
-- bicentroid, both centroid-rootings are computed and the lexicographically smaller int[] encoding is kept — an
-- arbitrary but fixed tie-break, invariant of which rooting the input happened to arrive in.
--
-- Floor strategy (tractable, reuses the rooted-tree generator instead of writing a second one): every rooted
-- unlabeled tree of size n (rut_trees(n), already exactly r(n) of them, one per rooted-isomorphism-class) is
-- mapped through free_tree_canonicalize and deduplicated (SELECT DISTINCT) — rootings of the same underlying free
-- tree collapse onto the same centroid-canonical encoding, leaving exactly a(n) distinct results.
-- fiber_unrank is SKIPPED (free-tree unrank is genuinely hard, and optional per the design) — selfcert then
-- validates fiber_count (Otter) == count(elements) through the sequential path.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE unlabeled_free_tree AS (levels int[]);                    -- centroid-rooted DFS-preorder depths
CREATE FUNCTION notation(t unlabeled_free_tree) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_to_string((t).levels, ','), '') $$;

-- given ONE (already-canonical) child subtree's encoding and a neighbor to exclude, recursively canonicalize a
-- tree rooted at `v` from an undirected edge list (efrom[i]/eto[i] = both directions of every tree edge): [0]
-- followed by each neighbor-subtree's own recursive canonicalization, shifted +1, sorted non-increasing — same
-- ordering rule rut_canonicalize uses, just operating on an edge list instead of an already-rooted level sequence
-- (a free tree has no fixed rooting to split children from, so this walks the adjacency structure directly).
CREATE FUNCTION fte_canon_rooted(efrom int[], eto int[], v int, parent_v int) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE result int[] := ARRAY[0]; shifted int[];
  BEGIN
    FOR shifted IN
      SELECT s FROM (
        SELECT rut_shift(fte_canon_rooted(efrom, eto, eto[i], v), 1) AS s
        FROM generate_subscripts(efrom, 1) i
        WHERE efrom[i] = v AND eto[i] <> parent_v
      ) t ORDER BY s DESC
    LOOP
      result := result || shifted;
    END LOOP;
    RETURN result;
  END $$;

-- the correctness-critical piece: given ANY valid rooted-tree level sequence, find the underlying free tree's
-- centroid(s) and return its centroid-rooted canonical encoding. Two free trees are isomorphic iff this returns
-- the same int[] for both, regardless of which rooting either arrived in.
CREATE FUNCTION free_tree_canonicalize(levels int[]) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE
    n int := coalesce(array_length(levels, 1), 0);
    parent int[] := array_fill(0, ARRAY[n]);          -- parent[i] = index of i's parent in the GIVEN rooting, 0 = root
    last_at_depth int[] := array_fill(0, ARRAY[n + 1]); -- last_at_depth[d+1] = most recent index seen at depth d
    subtree_size int[] := array_fill(1, ARRAY[n]);
    max_branch int[] := array_fill(0, ARRAY[n]);
    efrom int[] := ARRAY[]::int[];
    eto int[] := ARRAY[]::int[];
    centroids int[];
    min_branch int;
    i int; j int; d int; u int; c int; branch int;
    cand1 int[]; cand2 int[];
  BEGIN
    -- parent[] via the standard "last node seen at depth d-1" preorder rule (rooted_unlabeled_trees.sql's
    -- rut_split_children reconstructs the same structure by scanning runs; this tracks ancestors directly instead)
    last_at_depth[levels[1] + 1] := 1;
    FOR i IN 2..n LOOP
      d := levels[i];
      parent[i] := last_at_depth[d];                  -- last index at depth d-1
      last_at_depth[d + 1] := i;
    END LOOP;
    -- undirected edge list, both directions
    FOR i IN 2..n LOOP
      efrom := efrom || ARRAY[parent[i], i];
      eto := eto || ARRAY[i, parent[i]];
    END LOOP;
    -- subtree sizes w.r.t. the GIVEN rooting: a node's subtree is a contiguous preorder run of strictly deeper depths
    FOR i IN 1..n LOOP
      j := i + 1;
      WHILE j <= n AND levels[j] > levels[i] LOOP j := j + 1; END LOOP;
      subtree_size[i] := j - i;
    END LOOP;
    -- max_branch(u) = largest component left after removing u = max(upward branch toward the given root,
    -- every downward child-subtree) — invariant of rooting choice, so this works from any fixed root
    FOR u IN 1..n LOOP
      branch := 0;
      IF u > 1 THEN branch := n - subtree_size[u]; END IF;
      FOR c IN 1..n LOOP
        IF parent[c] = u AND subtree_size[c] > branch THEN branch := subtree_size[c]; END IF;
      END LOOP;
      max_branch[u] := branch;
    END LOOP;
    min_branch := (SELECT min(x) FROM unnest(max_branch) x);
    centroids := ARRAY(SELECT k FROM generate_subscripts(max_branch, 1) k WHERE max_branch[k] = min_branch);
    cand1 := fte_canon_rooted(efrom, eto, centroids[1], 0);
    IF array_length(centroids, 1) = 1 THEN RETURN cand1; END IF;
    cand2 := fte_canon_rooted(efrom, eto, centroids[2], 0);   -- bicentroid: n even, exactly 2 adjacent centroids
    IF cand1 < cand2 THEN RETURN cand1; ELSE RETURN cand2; END IF;
  END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE unlabeled_free_trees_fiber AS (n natural_number);   -- typed fiber; axis: n
-- FLOOR: every rooted tree of size n (exactly r(n) of them, via rut_trees — the rooted_unlabeled_trees generator),
-- canonicalized to its centroid-rooting and deduped. count(DISTINCT ...) here is the primary oracle: it must equal
-- Otter's formula (unlabeled_free_tree_count) below for every n, or the centroid/dedup logic has a bug.
CREATE FUNCTION fiber_elements(f unlabeled_free_trees_fiber, element_limit int) RETURNS SETOF unlabeled_free_tree LANGUAGE sql STABLE AS $$
  SELECT ROW(levels)::unlabeled_free_tree FROM (
    SELECT DISTINCT free_tree_canonicalize(levels) AS levels FROM rut_trees((f).n::int) levels
  ) t ORDER BY levels LIMIT element_limit $$;

-- fiber_count ACCEL: Otter's formula, built on rooted_unlabeled_tree_count (already an exact numeric DP). The two
-- half-integer terms always combine to an exact integer (a classical fact of the GF identity); trim_scale clears
-- the trailing-zero display-scale artifact the same way rooted_unlabeled_tree_count does after its own division.
CREATE FUNCTION unlabeled_free_tree_count(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE r_n numeric; sum_prod numeric := 0; even_term numeric := 0; i int;
  BEGIN
    IF n < 1 THEN RETURN 0; END IF;
    r_n := rooted_unlabeled_tree_count(n);
    FOR i IN 1..(n - 1) LOOP
      sum_prod := sum_prod + rooted_unlabeled_tree_count(i) * rooted_unlabeled_tree_count(n - i);
    END LOOP;
    IF n % 2 = 0 THEN even_term := rooted_unlabeled_tree_count(n / 2); END IF;
    RETURN trim_scale(r_n - sum_prod / 2 + even_term / 2);
  END $$;
CREATE FUNCTION fiber_count(f unlabeled_free_trees_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT unlabeled_free_tree_count((f).n::int) $$;

-- contains: v is a member iff its length is n, it's a valid DFS depth profile (same shape check as
-- rooted_unlabeled_tree's contains_in_fiber), AND it's already exactly in centroid-canonical form — a valid-but-
-- non-centroid rooting of the same underlying tree is rejected.
CREATE FUNCTION contains_in_fiber(f unlabeled_free_trees_fiber, v unlabeled_free_tree) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).levels, 1), 0) = (f).n::int
     AND (f).n::int >= 1
     AND (v).levels[1] = 0
     AND NOT EXISTS (
       SELECT 1 FROM generate_subscripts((v).levels, 1) i
       WHERE i > 1 AND ((v).levels[i] > (v).levels[i - 1] + 1 OR (v).levels[i] < 0)
     )
     AND (v).levels = free_tree_canonicalize((v).levels) $$;

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('unlabeled_free_trees', 'unlabeled_free_tree');
INSERT INTO base_grade VALUES ('unlabeled_free_trees', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f unlabeled_free_trees_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'FT(' || (f).n::int || ')' $$;
-- no fiber_unrank: base_realize falls back to the floor-scan path for element_at/unrank/random_element/range.
SELECT base_realize('unlabeled_free_trees');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('unlabeled_free_trees','A000055 anchor: cardinality (Otter accel) for n=1..10','eq','1,1,1,2,3,6,11,23,47,106','the GF identity, checked against the known sequence',$q$
    SELECT string_agg(cardinality(unlabeled_free_trees(n))::text, ',' ORDER BY n) FROM generate_series(1,10) n $q$),
  ('unlabeled_free_trees','A000055 anchor: the full formula to n=13','eq','1,1,1,2,3,6,11,23,47,106,235,551,1301','a(1..13) via unlabeled_free_tree_count',$q$
    SELECT string_agg(unlabeled_free_tree_count(n)::text, ',' ORDER BY n) FROM generate_series(1,13) n $q$),
  ('unlabeled_free_trees','floor count == accel count at n=7 (independent double-check)','eq','11','count(*) over the generated+deduped floor vs the Otter formula',$q$
    SELECT count(*)::text FROM elements(unlabeled_free_trees(7)) e $q$),
  ('unlabeled_free_trees','floor count == accel count at n=9','eq','47','one more n, independent double-check',$q$
    SELECT count(*)::text FROM elements(unlabeled_free_trees(9)) e $q$),
  ('unlabeled_free_trees','n=1..3 each give exactly the 1 possible tree shape','eq','true','A000055(1..3) = 1,1,1',$q$
    SELECT bool_and(cardinality(unlabeled_free_trees(n)) = 1) FROM generate_series(1,3) n $q$),
  ('unlabeled_free_trees','n=4 gives exactly 2: the path P4 and the star K(1,3) are already distinct shapes','eq','2','A000055(4)=2 — path and star first diverge here (both 3 edges, different degree sequences)',$q$
    SELECT count(*)::text FROM elements(unlabeled_free_trees(4)) e $q$),
  ('unlabeled_free_trees','n=5 elements: path P5, the ''fork''/spider (legs 1,1,2), and the star K(1,4) — all 3 of A000055(5)','eq','0,1,2,1,2|0,1,2,1,1|0,1,1,1,1','centroid-rooted at, respectively: path''s middle vertex, the fork''s degree-3 hub, the star''s hub',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY notation((e).value) DESC) FROM elements(unlabeled_free_trees(5)) e $q$),
  ('unlabeled_free_trees','<@ containment: centroid-rooted 0,1,2,1 is a member of n=4; the non-centroid rooting 0,1,2,3 of the same path is not','eq','true|false','both encode the 4-node path (bicentroid: rooting at either of its 2 adjacent centroids yields the same symmetric encoding); only that centroid rooting is canonical',$q$
    SELECT (ROW(ARRAY[0,1,2,1])::unlabeled_free_tree <@ unlabeled_free_trees(4))::text || '|' ||
           (ROW(ARRAY[0,1,2,3])::unlabeled_free_tree <@ unlabeled_free_trees(4))::text $q$),
  ('unlabeled_free_trees','range handle: cardinality(unlabeled_free_trees(1,6)) = 1+1+1+2+3+6','eq','14','fibers unfold over n=1..6',$q$
    SELECT cardinality(unlabeled_free_trees(1,6))::text $q$),
  ('unlabeled_free_trees','fibers(unlabeled_free_trees(1,5)) unfold to n = 1,2,3,4,5','eq','1,2,3,4,5','the grade range',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(unlabeled_free_trees(1,5)) f $q$);
