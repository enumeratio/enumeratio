-- requires: realizer, utilities
-- requires-tag: collection
-- cross-collection bijective maps (canonical FindStat-style bijections between existing collections).
-- Each was verified element-wise against sage over the full source fiber (see per-map notes/counts).

-- [permutations.to_lehmer_code <-> lehmer_codes.to_permutation] moved to
-- packs/permutations-plus/cross-collection-maps.permutations-plus.sql — base_map.collection REFERENCES
-- base_collection, so the lehmer_codes-sourced row would FK-fail loading core alone, and its examples call
-- lehmer_codes() directly (#283 phase 3).

-- [integer_compositions.to_subset <-> subsets.to_composition]  64/64 vs sage, a PAIRED bijection
-- to_subset: a composition of n ↦ the set of its proper partial sums p_1, p_1+p_2, …, p_1+…+p_{k-1}
-- (the total is dropped), a finset of {1..n-1}. The gap-cut inverse of the composition floor. (Sage: Composition.to_subset)
-- to_composition: the reverse gap-cut read — parts are the consecutive gaps of [0, sorted members, n], where
-- n = ground+1 (mirrors permutation_descent_composition's [0, descents, n] read, one carrier over).
CREATE FUNCTION composition_to_subset(c composition) RETURNS finset LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(
    SELECT sum((c).parts[j]) OVER (ORDER BY j)                 -- cumulative sum p_1+…+p_j, already ascending
    FROM generate_subscripts((c).parts, 1) j
    WHERE j < array_length((c).parts, 1)                       -- drop the total (last part); empty/single ⇒ {}
  ), (SELECT sum(p) FROM unnest((c).parts) p)::int - 1)::finset $$;   -- ground = n−1: a finset of {1..n−1}

CREATE FUNCTION subset_to_composition(s finset) RETURNS composition LANGUAGE sql IMMUTABLE AS $$
  WITH cuts AS (                                          -- 0, the cut positions (members), then n = ground+1
    SELECT 0 AS c
    UNION SELECT m FROM unnest((s).members) m
    UNION SELECT (s).n + 1
  ),
  diffs AS (SELECT c - lag(c) OVER (ORDER BY c) AS part FROM cuts)   -- consecutive gaps = parts
  SELECT ROW(ARRAY(SELECT part FROM diffs WHERE part IS NOT NULL))::composition $$;

-- both directions, paired: to_subset moves from carrier-scoped to COLLECTION-scoped (bound to this specific
-- (integer_compositions, subsets) pair) to carry `inverse`/`is_bijection`, matching the Euler / crossing-nesting
-- convention in maps-bijections.sql. The forward function/behavior is unchanged; only the base_map row's scope +
-- pairing metadata are new. (compositions_into_k_parts / k_bounded_compositions also share the `composition`
-- carrier — under the old carrier scope they inherited to_subset for free; as a collection-scoped pair it now
-- belongs only to integer_compositions, same as every other collection-scoped bijection in the catalog.)
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat, scope, inverse, is_bijection) VALUES
  ('integer_compositions','to_subset','composition_to_subset','subsets','To finset',NULL,'collection','to_composition',true),
  ('subsets','to_composition','subset_to_composition','integer_compositions','To composition',NULL,'collection','to_subset',true);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('integer_compositions','to_subset: 1+2+1 ↦ 101, 2+1+1 ↦ 011 (finset of {1..n−1} as a bit register)','eq','101|011','proper partial sums (total dropped)',$q$
    SELECT notation(composition_to_subset(ROW(ARRAY[1,2,1])::composition)) || '|' ||
           notation(composition_to_subset(ROW(ARRAY[2,1,1])::composition)) $q$),
  ('integer_compositions','to_subset over compositions(3) renders in the CODOMAIN form','eq','00|10|01|11','image rendered via render_value on the finset (validated vs sage over n=0..6)',$q$
    SELECT string_agg(render_value(composition_to_subset((e).value)), '|' ORDER BY ordinality(e)) FROM elements(integer_compositions(3)) e $q$),
  ('subsets','to_composition: 101 ↦ 1+2+1, 011 ↦ 2+1+1 (the reverse gap-cut read, undoing the pair above)','eq','1+2+1|2+1+1','members ⊆ [n−1] → gaps of [0, members, n]',$q$
    SELECT notation(subset_to_composition(ROW(ARRAY[1,3], 3)::finset)) || '|' ||
           notation(subset_to_composition(ROW(ARRAY[2,3], 3)::finset)) $q$),
  ('subsets','to_composition over subsets(2) renders in the CODOMAIN form','eq','3|1+2|2+1|1+1+1','image of each finset of subsets(2) (k,colex order) — matches compositions(3)''s own mask order',$q$
    SELECT string_agg(render_value(subset_to_composition((e).value)), '|' ORDER BY ordinality(e)) FROM elements(subsets(2)) e $q$),
  ('integer_compositions','round-trip: to_composition(to_subset(c)) = c over compositions(n), n=1..8','eq','true','subset_to_composition ∘ composition_to_subset = id (n=0 excluded — the empty composition is a pre-existing forward-map edge case: it maps to an unbounded-ground finset, not a member of any subsets(k) fiber)',$q$
    SELECT bool_and(subset_to_composition(composition_to_subset((e).value)) = (e).value)::text
    FROM generate_series(1,8) n, LATERAL elements(integer_compositions(n)) e $q$),
  ('subsets','round-trip the other way: to_subset(to_composition(s)) = s over subsets(m), m=0..8','eq','true','composition_to_subset ∘ subset_to_composition = id',$q$
    SELECT bool_and(composition_to_subset(subset_to_composition((e).value)) = (e).value)::text
    FROM generate_series(0,8) m, LATERAL elements(subsets(m)) e $q$),
  ('integer_compositions','to_subset and to_composition resolve and declare each other as inverse','eq','to_subset:t|to_composition:t','scope=collection, is_bijection, paired inverses (mirrors the Euler-pair assertion in maps-bijections.sql)',$q$
    SELECT 'to_subset:' || left((is_bijection AND inverse = 'to_composition')::text, 1) || '|' ||
           'to_composition:' || left((SELECT (is_bijection AND inverse = 'to_subset')::text
                                       FROM base_map WHERE collection = 'subsets' AND map_id = 'to_composition'), 1)
    FROM base_map WHERE collection = 'integer_compositions' AND map_id = 'to_subset' $q$);

-- [dyck_paths.to_noncrossing_partition -> non_crossing_partitions]  vs sage over n=0..6
-- Biane's bijection (sage DyckWord.to_noncrossing_partition, default): label the up-steps 1..n in order and
-- push each onto a stack; a run of k down-steps pops the top k labels as one block. The blocks are then
-- canonicalised to our RGS (numbered by least element). Codomain is the non_crossing_partitions sibling
-- collection (which reuses the set_partition RGS carrier), so every image is non-crossing by construction.
CREATE FUNCTION dyck_noncrossing_rgs(steps int[]) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE len int := coalesce(array_length(steps,1),0); n int := coalesce(array_length(steps,1),0)/2;
          stack int[] := '{}'; blockof int[]; i int; p int := 1; j int; nz int; b int := 0; k int;
          seen int[]; nextid int := 0; rgs int[]; a int;
  BEGIN
    IF n = 0 THEN RETURN '{}'::int[]; END IF;
    blockof := array_fill(0, ARRAY[n]);
    i := 1;
    WHILE i <= len LOOP
      stack := stack || p;                                            -- label the i-th up-step
      j := i + 1;
      WHILE j <= len AND steps[j] = -1 LOOP j := j + 1; END LOOP;     -- run of trailing down-steps
      nz := j - (i + 1);
      IF nz > 0 THEN
        b := b + 1;
        FOR k IN (array_length(stack,1) - nz + 1)..array_length(stack,1) LOOP blockof[stack[k]] := b; END LOOP;
        stack := stack[1:array_length(stack,1) - nz];
      END IF;
      i := j; p := p + 1;
    END LOOP;
    seen := array_fill(-1, ARRAY[b]);                                 -- canonicalise assignment-order blocks to RGS
    rgs := array_fill(0, ARRAY[n]);
    FOR k IN 1..n LOOP
      a := blockof[k];
      IF seen[a] = -1 THEN seen[a] := nextid; nextid := nextid + 1; END IF;
      rgs[k] := seen[a];
    END LOOP;
    RETURN rgs;
  END $$;
CREATE FUNCTION dyck_to_noncrossing_partition(x dyck_path) RETURNS set_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(dyck_noncrossing_rgs((x).steps))::set_partition $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('dyck_paths','to_noncrossing_partition','dyck_to_noncrossing_partition','non_crossing_partitions','To non-crossing partition',NULL);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('dyck_paths','to_noncrossing_partition: UUDUDD ↦ 010 ({1,3}/{2}), UUDDUD ↦ 001, UUUDDD ↦ 000','eq','010|001|000','Biane bijection (validated vs sage)',$q$
    SELECT notation(dyck_to_noncrossing_partition(ROW(ARRAY[1,1,-1,1,-1,-1])::dyck_path)) || '|' ||
           notation(dyck_to_noncrossing_partition(ROW(ARRAY[1,1,-1,-1,1,-1])::dyck_path)) || '|' ||
           notation(dyck_to_noncrossing_partition(ROW(ARRAY[1,1,1,-1,-1,-1])::dyck_path)) $q$),
  ('dyck_paths','to_noncrossing_partition hits all 5 non-crossing partitions of [3] (a bijection)','eq','000,001,010,011,012','the image SET over dyck_paths(3), sorted',$q$
    SELECT string_agg(DISTINCT render_value(dyck_to_noncrossing_partition((e).value)), ',' ORDER BY render_value(dyck_to_noncrossing_partition((e).value))) FROM elements(dyck_paths(3)) e $q$),
  ('dyck_paths','to_noncrossing_partition images are all non-crossing and cover non_crossing_partitions(4)','eq','14','distinct images over dyck_paths(4) = Catalan(4)',$q$
    SELECT count(DISTINCT render_value(dyck_to_noncrossing_partition((e).value)))::text FROM elements(dyck_paths(4)) e $q$);

-- [permutations.cycle_partition -> set_partitions]  vs sage over S_5
-- cycle_partition: the partition of [n] into the permutation's cycle supports (sage Permutation.to_cycles). Scanning
-- i = 1..n and opening a new block at each unvisited i numbers the blocks by least element — exactly our RGS.
CREATE FUNCTION permutation_cycle_partition(p permutation) RETURNS set_partition LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((p).image,1),0); blockof int[]; i int; j int; b int := 0; rgs int[];
  BEGIN
    IF n = 0 THEN RETURN ROW('{}'::int[])::set_partition; END IF;
    blockof := array_fill(0, ARRAY[n]);
    FOR i IN 1..n LOOP
      IF blockof[i] = 0 THEN
        b := b + 1; j := i;
        LOOP blockof[j] := b; j := (p).image[j]; EXIT WHEN j = i; END LOOP;                 -- walk the cycle through i
      END IF;
    END LOOP;
    rgs := ARRAY(SELECT blockof[g] - 1 FROM generate_series(1, n) g);                         -- blocks already least-first ⇒ RGS
    RETURN ROW(rgs)::set_partition;
  END $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('permutations','cycle_partition','permutation_cycle_partition','set_partitions','Cycle partition',NULL);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('permutations','cycle_partition: 231 (one 3-cycle) ↦ 000, 213 ↦ 001, 123 ↦ 012','eq','000|001|012','partition of [n] by cycle supports',$q$
    SELECT notation(permutation_cycle_partition(ROW(ARRAY[2,3,1])::permutation)) || '|' ||
           notation(permutation_cycle_partition(ROW(ARRAY[2,1,3])::permutation)) || '|' ||
           notation(permutation_cycle_partition(ROW(ARRAY[1,2,3])::permutation)) $q$),
  ('permutations','cycle_partition block count = cycle count over permutations(4) (the two agree)','eq','true','#blocks of the cycle partition = perm_cycles',$q$
    SELECT bool_and(setpart_blocks(permutation_cycle_partition((e).value)) = perm_cycle_count((e).value))::text FROM elements(permutations(4)) e $q$);

-- [permutations.descent_set -> subsets]  120/120 vs sage over S_5
-- descent_set: the set of descent positions {i : w(i) > w(i+1)}, a finset of {1..n-1}. Matches sage
-- Permutation.descents() (1-based positions). The identity and any increasing run map to the empty finset.
CREATE FUNCTION permutation_descent_set(p permutation) RETURNS finset LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(
    SELECT i FROM generate_subscripts((p).image, 1) i
    WHERE i < array_length((p).image, 1) AND (p).image[i] > (p).image[i+1]
    ORDER BY i
  ), array_length((p).image, 1) - 1)::finset $$;   -- ground = len−1: descent positions in {1..len−1}

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('permutations','descent_set','permutation_descent_set','subsets','Descent set',NULL);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('permutations','descent_set: 2413 ↦ 010, 321 ↦ 11, 123 ↦ 00 (finset of {1..n−1} as a bit register)','eq','010|11|00','positions i with w(i)>w(i+1)',$q$
    SELECT notation(permutation_descent_set(ROW(ARRAY[2,4,1,3])::permutation)) || '|' ||
           notation(permutation_descent_set(ROW(ARRAY[3,2,1])::permutation)) || '|' ||
           notation(permutation_descent_set(ROW(ARRAY[1,2,3])::permutation)) $q$),
  ('permutations','descent_set over permutations(3) renders in the CODOMAIN form','eq','00|01|10|01|10|11','image of each permutation of 3, in rank order (validated vs sage)',$q$
    SELECT string_agg(render_value(permutation_descent_set((e).value)), '|' ORDER BY ordinality(e)) FROM elements(permutations(3)) e $q$);

-- [dyck_paths.to_partition -> integer_partitions]  196/196 vs sage
-- DyckWord.to_partition(): the partition fitting between the path and the staircase. For each up step, count
-- the down steps that precede it; the nonzero counts, sorted descending, are the parts. (up=+1, down=-1.)
-- Flat UDUD… ↦ full staircase (n-1,…,1); nested UU…DD… ↦ empty. Validated element-wise vs sage over n=1..6.
CREATE FUNCTION dyck_to_partition(x dyck_path) RETURNS integer_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(coalesce(
    array_agg(cum_downs ORDER BY cum_downs DESC) FILTER (WHERE s = 1 AND cum_downs > 0),
    '{}'::int[]))::integer_partition
  FROM (
    SELECT s,
      sum(CASE WHEN s = -1 THEN 1 ELSE 0 END) OVER (ORDER BY o)::int AS cum_downs   -- downs in prefix; for an up step this is downs strictly before it
    FROM unnest((x).steps) WITH ORDINALITY AS t(s, o)
  ) q $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('dyck_paths','to_partition','dyck_to_partition','integer_partitions','To partition',NULL);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('dyck_paths','to_partition: staircase-fitting partition for dyck_paths(3) in rank order','eq','0,1,2,1+1,2+1','DyckWord.to_partition() — downs before each up (validated vs sage)',$q$
    SELECT string_agg(render_value(dyck_to_partition((e).value)), ',' ORDER BY ordinality(e)) FROM elements(dyck_paths(3)) e $q$),
  ('dyck_paths','to_partition: flat UDUDUD ↦ staircase 2+1, nested UUUDDD ↦ empty','eq','2+1|0','the two extremes of the bijection',$q$
    SELECT render_value(dyck_to_partition(ROW(ARRAY[1,-1,1,-1,1,-1])::dyck_path)) || '|' ||
           render_value(dyck_to_partition(ROW(ARRAY[1,1,1,-1,-1,-1])::dyck_path)) $q$);

-- [dyck_paths.to_binary_tree -> binary_trees]  65/65 vs sage
-- dyck_paths → binary_trees: the standard first-return decomposition. A nonempty Dyck word factors as
-- 1·L·0·R (leading up, its matching return-to-0 down, the interior Dyck word L, the remainder R); its
-- binary tree is the internal node with left = tree(L), right = tree(R). We emit the codomain directly as
-- our preorder Łukasiewicz word: luka(empty)=0, luka(node)=1·luka(left)·luka(right). Matches sage's
-- DyckWord.to_binary_tree() (default usemap "1L0R") element-for-element over n=0..5.
CREATE FUNCTION dyck_luka(steps int[]) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length(steps,1),0); h int := 0; i int; close int;
  BEGIN
    IF n = 0 THEN RETURN ARRAY[0]; END IF;                          -- empty word ⇒ empty leaf
    FOR i IN 1..n LOOP h := h + steps[i]; IF h = 0 THEN close := i; EXIT; END IF; END LOOP;  -- first return
    RETURN ARRAY[1] || dyck_luka(steps[2:close-1]) || dyck_luka(steps[close+1:n]);           -- 1·luka(L)·luka(R)
  END $$;

CREATE FUNCTION dyck_to_binary_tree(x dyck_path) RETURNS binary_tree LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(dyck_luka((x).steps))::binary_tree $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('dyck_paths','to_binary_tree','dyck_to_binary_tree','binary_trees','To binary tree',NULL);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('dyck_paths','to_binary_tree: UUDD ↦ 11000, UDUD ↦ 10100','eq','11000|10100','Dyck path → binary tree preorder Łukasiewicz word (validated vs sage)',$q$
    SELECT notation(dyck_to_binary_tree(ROW(ARRAY[1,1,-1,-1])::dyck_path)) || '|' ||
           notation(dyck_to_binary_tree(ROW(ARRAY[1,-1,1,-1])::dyck_path)) $q$),
  ('dyck_paths','to_binary_tree over dyck_paths(3) renders in the codomain form','eq','1110000,1101000,1100100,1011000,1010100','image of each Dyck path of semilength 3, in rank order',$q$
    SELECT string_agg(render_value(dyck_to_binary_tree((e).value)), ',' ORDER BY ordinality(e)) FROM elements(dyck_paths(3)) e $q$),
  ('dyck_paths','to_binary_tree and binary_trees.to_dyck_path are mutual inverses over dyck_paths(4)','eq','true','the two halves of the Catalan bijection round-trip',$q$
    SELECT bool_and(binary_trees_to_dyck_path(dyck_to_binary_tree((e).value)) = (e).value)::text FROM elements(dyck_paths(4)) e $q$);


-- [permutations.binary_search_tree -> binary_trees]  the sylvester map / Tonks projection permutohedron ↠ associahedron
-- Insert the one-line word into a binary search tree and take its SHAPE (Łukasiewicz preorder): root = the first
-- entry, left subtree = the later entries below it, right = those above. Surjective onto binary_trees(n) (fibres =
-- the sylvester classes), so it realises the cellular map from the permutohedron onto the associahedron on vertices.
CREATE FUNCTION bst_luka(seq int[]) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE root int; l int[]; r int[];
  BEGIN
    IF coalesce(array_length(seq, 1), 0) = 0 THEN RETURN ARRAY[0]; END IF;                 -- empty ⇒ a leaf
    root := seq[1];
    l := ARRAY(SELECT x FROM unnest(seq[2:array_length(seq,1)]) WITH ORDINALITY t(x, o) WHERE x < root ORDER BY o);
    r := ARRAY(SELECT x FROM unnest(seq[2:array_length(seq,1)]) WITH ORDINALITY t(x, o) WHERE x > root ORDER BY o);
    RETURN ARRAY[1] || bst_luka(l) || bst_luka(r);
  END $$;
CREATE FUNCTION permutation_to_binary_tree(p permutation) RETURNS binary_tree LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(bst_luka((p).image))::binary_tree $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('permutations','binary_search_tree','permutation_to_binary_tree','binary_trees','Binary search tree (sylvester / permutohedron ↠ associahedron)',NULL);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('permutations','binary_search_tree: 213 ↦ 1100100 (root 2, then 1 left, 3 right)','eq','1100100','BST shape as a Łukasiewicz word',$q$
    SELECT notation(permutation_to_binary_tree(ROW(ARRAY[2,1,3])::permutation)) $q$),
  ('permutations','the sylvester map is onto binary_trees(3): S_3 covers all 5 trees (Catalan)','eq','5','distinct BST shapes over permutations(3)',$q$
    SELECT count(DISTINCT render_value(permutation_to_binary_tree((e).value)))::text FROM elements(permutations(3)) e $q$),
  ('permutations','every image is a valid binary tree of the same order (permutohedron ↠ associahedron)','eq','true','the map lands in binary_trees(4)',$q$
    SELECT bool_and(contains(binary_trees(4), permutation_to_binary_tree((e).value)))::text FROM elements(permutations(4)) e $q$);

-- [permutations.descent_composition -> integer_compositions]  the composition side of the descent map
-- descent_composition: the composition of n whose partial sums are the descent set — the inverse image of
-- composition_to_subset applied to permutation_descent_set. Parts are the gaps of [0, descents…, n]. The identity
-- (no descent) ↦ (n); the decreasing permutation ↦ (1,1,…,1). (Sage: Permutation.descents_composition.)
CREATE FUNCTION permutation_descent_composition(p permutation) RETURNS composition LANGUAGE sql IMMUTABLE AS $$
  WITH nn AS (SELECT coalesce(array_length((p).image,1),0) AS n),
  cuts AS (                                                                         -- 0, the descent positions, then n
    SELECT 0 AS c
    UNION SELECT i FROM generate_subscripts((p).image,1) i, nn WHERE i < nn.n AND (p).image[i] > (p).image[i+1]
    UNION SELECT n FROM nn
  ),
  diffs AS (SELECT c - lag(c) OVER (ORDER BY c) AS part FROM cuts)                   -- consecutive gaps
  SELECT ROW(ARRAY(SELECT part FROM diffs WHERE part IS NOT NULL))::composition $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('permutations','descent_composition','permutation_descent_composition','integer_compositions','Descent composition',NULL);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('permutations','descent_composition: 2413 ↦ 2+2, 321 ↦ 1+1+1, 123 ↦ 3','eq','2+2|1+1+1|3','gaps of [0, descents, n]',$q$
    SELECT notation(permutation_descent_composition(ROW(ARRAY[2,4,1,3])::permutation)) || '|' ||
           notation(permutation_descent_composition(ROW(ARRAY[3,2,1])::permutation))   || '|' ||
           notation(permutation_descent_composition(ROW(ARRAY[1,2,3])::permutation)) $q$),
  ('permutations','descent_composition over permutations(3) in the CODOMAIN form','eq','3|2+1|1+2|2+1|1+2|1+1+1','image of each permutation of 3, in rank order',$q$
    SELECT string_agg(render_value(permutation_descent_composition((e).value)), '|' ORDER BY ordinality(e)) FROM elements(permutations(3)) e $q$),
  ('permutations','descent_composition and descent_set agree: to_subset(descent_composition(w)) = descent_set(w) over permutations(4)','eq','true','the two descent maps are the same statistic, two carriers',$q$
    SELECT bool_and(composition_to_subset(permutation_descent_composition((e).value)) = permutation_descent_set((e).value))::text FROM elements(permutations(4)) e $q$);
