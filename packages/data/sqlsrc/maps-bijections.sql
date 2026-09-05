-- requires: non_crossing_partitions, non_nesting_partitions, maps, permutations, standard_tableaux
-- The first COLLECTION-scoped bijections (base_map.scope='collection') — see https://github.com/enumeratio/enumeratio/wiki/Maps-and-Bijections.
-- Unlike a carrier-scoped map (a function of the carrier that inherits to every collection over it), a collection-
-- scoped map is bound to a specific (domain, codomain) pair, does NOT carrier-inherit, and carries an `inverse`
-- (the paired map_id, living on the codomain) + `is_bijection` (a declared property, verified below on windows where
-- both sides are finite — mirrors order_isomorphism-is-only-checkable-sometimes).
--
-- The Euler (Glaisher) distinct↔odd bijection that used to open this file moved to the partitions-plus pack
-- (maps-bijections.partitions-plus.sql, #283) — both endpoint collections are pack-owned.

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


-- ── RSK: permutation ↔ (P,Q) pair of standard Young tableaux ─────────────────────────────────────────────
-- The Robinson–Schensted–Knuth correspondence: a bijection permutations(n) ↔ {(P,Q) : a same-shape pair of standard
-- Young tableaux with n cells}. perm_rsk_insertion / perm_rsk_recording (maps.sql) are the two projections onto the
-- insertion tableau P and recording tableau Q; rsk_inverse(P,Q) reverse-bumps the pair back to the permutation. Here
-- RSK is registered as ONE first-class COLLECTION-scoped map by pairing the two tableaux into a single carrier value.
-- The `standard_tableau_pairs` codomain collection now exists (#66), so the pair carrier is hosted; the forward map is
-- registered with is_bijection DECLARED and round-trip-verified through `standard_tableau_pair_to_perm`. The reverse
-- map is now registered too (#153) — on standard_tableau_pairs.maps.sql, not here: it needs standard_tableau_pairs'
-- own base_collection row to exist first (FK), and this file is a dependency OF standard_tableau_pairs.sql (it hosts
-- the pair carrier), so the reverse registration can't live here without a cycle. `inverse` on each row pairs them by
-- bare map_id — same convention as the Euler and crossing/nesting pairs above.

CREATE TYPE standard_tableau_pair AS (p standard_tableau, q standard_tableau);   -- an RSK (insertion, recording) pair
CREATE FUNCTION notation(x standard_tableau_pair) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '(' || notation((x).p) || ' ; ' || notation((x).q) || ')' $$;
CREATE FUNCTION render_value(x standard_tableau_pair) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT notation(x) $$;

CREATE FUNCTION perm_rsk(p permutation) RETURNS standard_tableau_pair LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(perm_rsk_insertion(p), perm_rsk_recording(p))::standard_tableau_pair $$;   -- forward: w ↦ (P,Q)
-- the closing inverse, as a ONE-argument map on the pair carrier (wraps the two-arg rsk_inverse) — usable as a
-- mapping_fn, the piece that lets RSK be a single map rather than the two separate P/Q projections.
CREATE FUNCTION standard_tableau_pair_to_perm(x standard_tableau_pair) RETURNS permutation LANGUAGE sql IMMUTABLE AS $$
  SELECT rsk_inverse((x).p, (x).q) $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, scope, inverse, is_bijection) VALUES
  ('permutations','rsk','perm_rsk','standard_tableau_pairs','RSK correspondence: permutation → (P,Q) SYT pair','collection','to_permutation',true);
-- the reverse row (standard_tableau_pairs.to_permutation) is registered in standard_tableau_pairs.maps.sql, NOT here —
-- it must run after standard_tableau_pairs' own base_collection row exists (FK on base_map.collection), and this file
-- is a REQUIRED-BY of standard_tableau_pairs.sql (it defines the pair carrier), so it cannot require it back without
-- a cycle. `inverse` above just names it by map_id (bare text column, no FK) — same forward-declared-pairing
-- convention as the Euler/crossing-nesting pairs.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('maps-bijections','RSK round-trips: pair_to_perm(rsk(w)) = w over permutations(n), n=0..5','eq','true','the bijection closed through the inverse tableau-pair map',$q$
    SELECT bool_and(one_line(standard_tableau_pair_to_perm(perm_rsk((e).value))) = one_line((e).value))::text
    FROM generate_series(0,5) n, LATERAL elements(permutations(n)) e $q$),
  ('maps-bijections','RSK round-trips the other way: rsk(to_perm((P,Q))) = (P,Q) over standard_tableau_pairs(n), n=0..5','eq','true','perm_rsk ∘ standard_tableau_pair_to_perm = id on the pairs',$q$
    SELECT bool_and(perm_rsk(standard_tableau_pair_to_perm((e).value)) = (e).value)::text
    FROM generate_series(0,5) n, LATERAL elements(standard_tableau_pairs(n)) e $q$),
  ('maps-bijections','a worked instance: 2413 ↦ (P,Q) = (1,3/2,4 ; 1,2/3,4) and back to 2413','eq','(1,3/2,4 ; 1,2/3,4)|2413','RSK on one permutation, then rsk_inverse',$q$
    SELECT notation(perm_rsk(ROW(ARRAY[2,4,1,3])::permutation)) || '|' ||
           one_line(standard_tableau_pair_to_perm(perm_rsk(ROW(ARRAY[2,4,1,3])::permutation))) $q$),
  ('maps-bijections','both directions are declared bijections with each other as inverse','eq','rsk:t|to_permutation:t','scope=collection, is_bijection, paired inverses',$q$
    SELECT 'rsk:' || left((is_bijection AND inverse='to_permutation')::text,1) || '|' ||
           'to_permutation:' || left((SELECT (is_bijection AND inverse='rsk')::text FROM base_map WHERE collection='standard_tableau_pairs' AND map_id='to_permutation'),1)
    FROM base_map WHERE collection='permutations' AND map_id='rsk' $q$),
  ('maps-bijections','both base_map rows resolve on their own collection','eq','true|true','base_map_resolved sees rsk on permutations and to_permutation on standard_tableau_pairs, both own',$q$
    SELECT (EXISTS (SELECT 1 FROM base_map_resolved WHERE collection='permutations' AND map_id='rsk' AND own))::text || '|' ||
           (EXISTS (SELECT 1 FROM base_map_resolved WHERE collection='standard_tableau_pairs' AND map_id='to_permutation' AND own))::text $q$),
  ('maps-bijections','collection-scoped: rsk does NOT carrier-inherit onto derangements (shared permutation carrier)','eq','0','scope gating — a collection-scoped map resolves only to its own domain',$q$
    SELECT count(*)::text FROM base_map_resolved WHERE collection='derangements' AND map_id='rsk' $q$);
