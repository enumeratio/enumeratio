-- requires: maps-bijections, non_crossing_partitions, non_nesting_partitions
-- trees-graphs half of sqlsrc/maps-bijections.sql (#283 phase 3 extraction) — the crossing↔nesting swap between
-- non_crossing_partitions and non_nesting_partitions moved wholesale: both endpoint collections are pack-owned, and
-- base_map.collection REFERENCES base_collection, so these rows would FK-fail loading core alone.

-- ── crossing ↔ nesting ──────────────────────────────────────────────────────────────────────────────────
-- The classic crossing/nesting swap: a bijection non_crossing_partitions ↔ non_nesting_partitions (both Catalan(n),
-- both over the set_partition RGS carrier). It is the Kasraoui–Zeng / Chen-Deng-Du-Stanley-Yan involution restricted
-- to the crossing-free and nesting-free classes.
--   A set partition is a set of ARCS (each block's consecutive elements joined). Each position has an opener/closer
--   type: an OPENER (left endpoint — not last in its block), a CLOSER (right endpoint — not first), both (a middle
--   element), or neither (singleton). Theorem: given the opener set L and closer set R, there is EXACTLY ONE
--   non-crossing partition and EXACTLY ONE non-nesting partition realizing them — recovered by re-matching each
--   closer to an open opener with a STACK (LIFO, most-recent opener → non-crossing) or a QUEUE (FIFO, earliest
--   opener → non-nesting). So the swap is: read (L,R), re-match with the opposite rule. Same (L,R) both ways ⇒ the
--   two directions are mutual inverses. The witness at n=4: {1,4}/{2,3} (nested, 0110) ↔ {1,3}/{2,4} (crossing, 0101).

-- re-match a partition's arcs from its own opener/closer sets; use_stack ⇒ non-crossing (LIFO), else non-nesting (FIFO).
-- Returns a canonical RGS (block ids by first appearance). Positions are tiny, so the O(n²) endpoint scans are fine.
CREATE FUNCTION partition_rematch(rgs int[], use_stack boolean) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE
    n int := coalesce(array_length(rgs,1),0);
    is_left boolean[]; is_right boolean[];
    open int[] := '{}';                               -- open opener positions (stack top = last, queue front = first)
    parent int[];                                     -- union-find over positions 1..n
    i int; l int; ra int; rb int; rt int;
    label int[]; nextid int := 0; out int[] := '{}';
  BEGIN
    IF n = 0 THEN RETURN ARRAY[]::int[]; END IF;
    is_left := array_fill(false, ARRAY[n]); is_right := array_fill(false, ARRAY[n]);
    FOR i IN 1..n LOOP
      is_left[i]  := EXISTS (SELECT 1 FROM generate_series(i+1,n) j WHERE rgs[j] = rgs[i]);   -- has a successor in its block
      is_right[i] := EXISTS (SELECT 1 FROM generate_series(1,i-1) j WHERE rgs[j] = rgs[i]);   -- has a predecessor
    END LOOP;
    parent := ARRAY(SELECT g FROM generate_series(1,n) g);
    FOR i IN 1..n LOOP
      IF is_right[i] THEN                                                   -- close an arc onto an open opener…
        IF use_stack THEN l := open[array_length(open,1)]; open := open[1:array_length(open,1)-1];   -- LIFO
        ELSE               l := open[1];                    open := open[2:array_length(open,1)]; END IF;  -- FIFO
        ra := l;  WHILE parent[ra] <> ra LOOP ra := parent[ra]; END LOOP;   -- union(l, i)
        rb := i;  WHILE parent[rb] <> rb LOOP rb := parent[rb]; END LOOP;
        IF ra <> rb THEN parent[rb] := ra; END IF;
      END IF;
      IF is_left[i] THEN open := open || i; END IF;                         -- …then i becomes an available opener
    END LOOP;
    label := array_fill(-1, ARRAY[n]);
    FOR i IN 1..n LOOP
      rt := i; WHILE parent[rt] <> rt LOOP rt := parent[rt]; END LOOP;
      IF label[rt] = -1 THEN label[rt] := nextid; nextid := nextid + 1; END IF;
      out := out || label[rt];
    END LOOP;
    RETURN out;
  END $$;

CREATE FUNCTION partition_nc_to_nn(s set_partition) RETURNS set_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(partition_rematch((s).rgs, false))::set_partition $$;   -- FIFO rematch ⇒ non-nesting image
CREATE FUNCTION partition_nn_to_nc(s set_partition) RETURNS set_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(partition_rematch((s).rgs, true))::set_partition $$;    -- LIFO rematch ⇒ non-crossing image

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, scope, inverse, is_bijection) VALUES
  ('non_crossing_partitions','to_non_nesting','partition_nc_to_nn','non_nesting_partitions','Crossing↔nesting swap: non-crossing → non-nesting','collection','to_non_crossing',true),
  ('non_nesting_partitions','to_non_crossing','partition_nn_to_nc','non_crossing_partitions','Crossing↔nesting swap: non-nesting → non-crossing','collection','to_non_nesting',true);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('maps-bijections','crossing↔nesting: image of non_crossing_partitions(n) IS exactly non_nesting_partitions(n), n=0..7','eq','true','the bijection — image set equals the codomain fiber',$q$
    SELECT bool_and(
      (SELECT array_agg(s ORDER BY s) FROM (SELECT notation(partition_nc_to_nn((e).value)) s FROM elements(non_crossing_partitions(n)) e) t)
      = (SELECT array_agg(s ORDER BY s) FROM (SELECT notation((o).value) s FROM elements(non_nesting_partitions(n)) o) t))::text
    FROM generate_series(0,7) n $q$),
  ('maps-bijections','round-trips: nc(nn(c)) = c over non_crossing_partitions(n), n=0..7','eq','true','partition_nn_to_nc ∘ partition_nc_to_nn = id',$q$
    SELECT bool_and(partition_nn_to_nc(partition_nc_to_nn((e).value)) = (e).value)::text
    FROM generate_series(0,7) n, LATERAL elements(non_crossing_partitions(n)) e $q$),
  ('maps-bijections','round-trips the other way: nn(nc(v)) = v over non_nesting_partitions(n), n=0..7','eq','true','partition_nc_to_nn ∘ partition_nn_to_nc = id',$q$
    SELECT bool_and(partition_nc_to_nn(partition_nn_to_nc((o).value)) = (o).value)::text
    FROM generate_series(0,7) n, LATERAL elements(non_nesting_partitions(n)) o $q$),
  ('maps-bijections','the witness at n=4: nested {1,4}/{2,3} (0110) ↦ crossing {1,3}/{2,4} (0101), and back','eq','true','the swap on the canonical crossing/nesting pair',$q$
    SELECT (partition_nc_to_nn(ROW(ARRAY[0,1,1,0])::set_partition) = ROW(ARRAY[0,1,0,1])::set_partition
        AND partition_nn_to_nc(ROW(ARRAY[0,1,0,1])::set_partition) = ROW(ARRAY[0,1,1,0])::set_partition)::text $q$),
  ('maps-bijections','both directions are declared bijections with each other as inverse','eq','to_non_crossing:t|to_non_nesting:t','scope=collection, is_bijection, paired inverses',$q$
    SELECT 'to_non_crossing:' || left((is_bijection AND inverse='to_non_crossing')::text,1) || '|' ||
           'to_non_nesting:' || left((SELECT (is_bijection AND inverse='to_non_nesting')::text FROM base_map WHERE collection='non_nesting_partitions' AND map_id='to_non_crossing'),1)
    FROM base_map WHERE collection='non_crossing_partitions' AND map_id='to_non_nesting' $q$),
  ('maps-bijections','collection-scoped: the swap does NOT carrier-inherit onto plain set_partitions','eq','0','scope gating — set_partitions (same carrier) does not resolve the crossing/nesting maps',$q$
    SELECT count(*)::text FROM base_map_resolved WHERE collection='set_partitions' AND map_id IN ('to_non_nesting','to_non_crossing') $q$);
