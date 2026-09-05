-- requires: dyck_paths, binary_trees, cross-collection-maps, element_relations
-- dyck_paths.relations — the Tamari lattice (#237 group 2), registered via base_element_relation.
--
-- Covers = the classical associativity rewrite x(yz) -> (xy)z ("left rotation"), stated directly on the
-- ±1 step array. A "valley" (a D immediately followed by a U) at positions (i, i+1) marks a node whose
-- RIGHT subtree is non-empty: the D at i closes some earlier up-step k, and the U at i+1 opens k's right
-- subtree. The rewrite absorbs that subtree's own left half into k's left child — mechanically, move the
-- valley's U to sit right after position k (everything between k and the valley slides down by one to fill
-- the gap). Every valley is one legal rotation site; a path has as many up-covers as it has valleys.
--
-- Bracket-matched and brute-verified (independent Python model, .scratch/tamari_check.py, not checked in):
-- cross-checked against a from-scratch tree-rotation model (via the existing dyck_to_binary_tree bijection)
-- element-for-element over dyck_paths(0..6); a full transitive-closure lattice check (unique join/meet for
-- every pair) over n=0..5; unique bottom = the staircase, unique top = the nested mountain, n=1..5; total
-- cover count = Catalan(n)·(n−1)/2, n=0..7 exact match. NOT graded: T_3's two maximal chains from bottom to
-- top have lengths 2 and 3 (the classic pentagon), so no rank-GF example is claimed here (unlike weak_order
-- / Young, which ARE graded) — this is deliberate, not an oversight.
CREATE FUNCTION dyck_tamari_covers(x dyck_path) RETURNS SETOF dyck_path LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE steps int[] := (x).steps; m int := coalesce(array_length(steps,1),0); i int; k int; bal int; p int;
  BEGIN
    FOR i IN 1..m-1 LOOP
      IF steps[i] = -1 AND steps[i+1] = 1 THEN                     -- valley: D at i, U at i+1
        bal := 0; k := NULL;
        FOR p IN REVERSE i..1 LOOP                                 -- find k: the U that this D closes
          bal := bal + steps[p];
          IF bal = 0 THEN k := p; EXIT; END IF;
        END LOOP;
        IF k IS NOT NULL THEN
          RETURN NEXT ROW(steps[1:k] || ARRAY[1] || steps[k+1:i] || steps[i+2:m])::dyck_path;
        END IF;
      END IF;
    END LOOP;
  END $$;

-- reachability under the cover relation ("≤"), for the self-tests below — a bounded recursive walk over one
-- fiber's finite DAG (Tamari has no cycles: every rewrite strictly grows the up-step run, so it terminates).
CREATE FUNCTION dyck_tamari_leq(x dyck_path, y dyck_path) RETURNS boolean LANGUAGE sql STABLE AS $$
  WITH RECURSIVE reach(v) AS (
      SELECT x
    UNION
      SELECT c FROM reach r, LATERAL dyck_tamari_covers(r.v) c
  )
  SELECT EXISTS (SELECT 1 FROM reach WHERE v = y) $$;

INSERT INTO base_element_relation (collection, rel_id, kind, forward_fn, title, findstat) VALUES
  ('dyck_paths', 'tamari', 'cover', 'dyck_tamari_covers',
   'the Tamari lattice — covers are the associativity rewrite x(yz) -> (xy)z, one per valley (DU)', NULL);

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('dyck_paths', 'Tamari covers of UDUUDD (n=3): its single valley (positions 2-3) rotates to UUDUDD',
   'eq', 'UUDUDD', 'a concrete mid-lattice element with one valley',$q$
    SELECT string_agg(notation(c), ',' ORDER BY notation(c))
      FROM dyck_tamari_covers(ROW(ARRAY[1,-1,1,1,-1,-1])::dyck_path) c $q$),
  ('dyck_paths', 'the mountain UUUDDD (n=3) has no valleys, hence no Tamari up-covers: it is the top',
   'eq', '0', 'no DU pattern in an all-ups-then-all-downs path',$q$
    SELECT count(*)::text FROM dyck_tamari_covers(ROW(ARRAY[1,1,1,-1,-1,-1])::dyck_path) c $q$),
  ('dyck_paths', 'the staircase UDUDUD (n=3) has n-1 = 2 valleys, its full up-cover count',
   'eq', '2', 'every DU boundary is a rotation site',$q$
    SELECT count(*)::text FROM dyck_tamari_covers(ROW(ARRAY[1,-1,1,-1,1,-1])::dyck_path) c $q$),

  -- structural: up-cover count = valley count, for every path (not just the extremes), n=0..6
  ('dyck_paths', 'up-cover count = valley (DU) count, for every path, n=0..6',
   'eq', 'true', 'one rotation site per valley — the defining correspondence',$q$
    SELECT bool_and(
      (SELECT count(*) FROM dyck_tamari_covers((e).value) c) =
      (SELECT count(*) FROM generate_subscripts(((e).value).steps, 1) i
        WHERE i < array_length(((e).value).steps, 1)
          AND ((e).value).steps[i] = -1 AND ((e).value).steps[i+1] = 1)
    )::text FROM generate_series(0,6) n, LATERAL elements(dyck_paths(n)) e $q$),

  -- every cover stays a valid Dyck path of the SAME semilength (same fiber; the relation is same-fiber, per kind='cover')
  ('dyck_paths', 'every Tamari cover of a semilength-n path is itself in dyck_paths(n), n=0..6',
   'eq', 'true', 'the rewrite preserves the fiber (no cross-fiber leak, unlike Young)',$q$
    SELECT bool_and(c <@ dyck_paths(n))::text
      FROM generate_series(0,6) n, LATERAL elements(dyck_paths(n)) e, LATERAL dyck_tamari_covers((e).value) c $q$),

  -- unique top / unique bottom, n=1..5 (top = mountain, no covers; bottom = staircase, unreachable from any other element)
  ('dyck_paths', 'the Tamari order has a UNIQUE top (mountain, no up-covers) and UNIQUE bottom (staircase, no in-edges), n=1..5',
   'eq', 'true', 'the two poset extremes, both counted independently of the lattice check below',$q$
    SELECT bool_and(tops = 1 AND bottoms = 1)::text FROM (
      SELECT n,
        (SELECT count(*) FROM elements(dyck_paths(n)) e WHERE NOT EXISTS (SELECT 1 FROM dyck_tamari_covers((e).value))) tops,
        (SELECT count(*) FROM elements(dyck_paths(n)) e WHERE NOT EXISTS (
           SELECT 1 FROM elements(dyck_paths(n)) e2, LATERAL dyck_tamari_covers((e2).value) c WHERE c = (e).value)) bottoms
      FROM generate_series(1,5) n) t $q$),
  ('dyck_paths', 'the unique top is the mountain UUU...DDD and the unique bottom is the staircase UDUD...UD, n=1..5',
   'eq', 'true', 'names the two extremes concretely, not just their existence',$q$
    SELECT bool_and(
      (SELECT (e).value FROM elements(dyck_paths(n)) e WHERE NOT EXISTS (SELECT 1 FROM dyck_tamari_covers((e).value)))
        = ROW((SELECT array_agg(1) FROM generate_series(1,n)) || (SELECT array_agg(-1) FROM generate_series(1,n)))::dyck_path
      AND
      (SELECT (e).value FROM elements(dyck_paths(n)) e WHERE NOT EXISTS (
           SELECT 1 FROM elements(dyck_paths(n)) e2, LATERAL dyck_tamari_covers((e2).value) c WHERE c = (e).value))
        = ROW((SELECT array_agg(CASE WHEN j % 2 = 1 THEN 1 ELSE -1 END ORDER BY j) FROM generate_series(1, 2*n) j))::dyck_path
    )::text FROM generate_series(1,5) n $q$),

  -- total cover count = Catalan(n)*(n-1)/2, n=2..7 (mirrors the permutations weak-order n!*(n-1)/2 edge
  -- identity; n=0,1 have zero edges and are skipped so the LATERAL join still yields a row per n, as the
  -- weak-order example does)
  ('dyck_paths', 'total Tamari cover edges on dyck_paths(n) = Catalan(n)*(n-1)/2, n=2..7',
   'eq', 'true', 'brute-counted, echoing the weak-order n!*(n-1)/2 edge identity',$q$
    SELECT bool_and(edges = (catalan(n) * (n-1) / 2))::text FROM (
      SELECT n, count(*) edges FROM generate_series(2,7) n, LATERAL elements(dyck_paths(n)) e,
             LATERAL dyck_tamari_covers((e).value) c GROUP BY n) t $q$),

  -- the lattice property itself: every pair has a UNIQUE join and UNIQUE meet, n=0..4 (Catalan(4)=14, the largest fiber checked)
  ('dyck_paths', 'the Tamari order is a genuine lattice: every pair of paths has a unique join and unique meet, n=0..4',
   'eq', 'true', 'transitive-closure check via dyck_tamari_leq over every unordered pair per fiber',$q$
    SELECT bool_and(
      (SELECT count(*) FROM elements(dyck_paths(n)) u
        WHERE dyck_tamari_leq((a).value,(u).value) AND dyck_tamari_leq((b).value,(u).value)
          AND NOT EXISTS (SELECT 1 FROM elements(dyck_paths(n)) u2
                WHERE NOT ((u2).value = (u).value)
                  AND dyck_tamari_leq((a).value,(u2).value) AND dyck_tamari_leq((b).value,(u2).value)
                  AND dyck_tamari_leq((u).value,(u2).value))) = 1
      AND
      (SELECT count(*) FROM elements(dyck_paths(n)) l
        WHERE dyck_tamari_leq((l).value,(a).value) AND dyck_tamari_leq((l).value,(b).value)
          AND NOT EXISTS (SELECT 1 FROM elements(dyck_paths(n)) l2
                WHERE NOT ((l2).value = (l).value)
                  AND dyck_tamari_leq((l2).value,(a).value) AND dyck_tamari_leq((l2).value,(b).value)
                  AND dyck_tamari_leq((l2).value,(l).value))) = 1
    )::text FROM generate_series(0,4) n, LATERAL elements(dyck_paths(n)) a, LATERAL elements(dyck_paths(n)) b
     WHERE ordinality(a) <= ordinality(b) $q$),

  -- crux: transported through the existing dyck_to_binary_tree bijection, a Tamari cover IS one of the two
  -- rotation directions binary_tree_flip_words already computes on the associahedron (the "left rotation"
  -- half — the one that applies when the RIGHT child is internal). Same edges, two registries (per the
  -- element-relations design doc, crux (c)): the primary stays on dyck_paths; this only notes the connection.
  ('dyck_paths', 'a Tamari cover on dyck_paths, transported via to_binary_tree, is always one of binary_trees'' flips',
   'eq', 'true', 'the relation transported through an order-iso lands inside the (undirected) associahedron edge set',$q$
    SELECT bool_and(
      dyck_to_binary_tree(c) IN (SELECT f FROM binary_tree_flips(dyck_to_binary_tree((e).value)) f)
    )::text FROM generate_series(0,5) n, LATERAL elements(dyck_paths(n)) e, LATERAL dyck_tamari_covers((e).value) c $q$);
