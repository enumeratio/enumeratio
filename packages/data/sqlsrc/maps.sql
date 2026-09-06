-- requires: permutations, integer_partitions, set_partitions, standard_tableaux
-- maps — Phase 4 of the catalog port: morphisms between collections, registered in base_map. A mapping_fn is a
-- <fn>(<domain_carrier>) RETURNS <codomain_carrier>; the client projects the image in the CODOMAIN's own form via
-- render_value(mapping_fn((element).value)) (pg overload picks the codomain codec by the image's type). A STARTER
-- set: cycle_type (permutation → its cycle-length partition), inverse (a permutation endomorphism), conjugate (a
-- partition endomorphism). (Mirrors the C-ext `map` table + mapping_func_id; rankings/borrowed-orders are separate.)

-- ── mapping functions ───────────────────────────────────────────────────────────────────────────────────
-- cycle type: the multiset of cycle lengths, as a (non-increasing) integer partition. e.g. {2,3,1} → 3, {2,1,3} → 2+1.
CREATE FUNCTION perm_cycle_type(p permutation) RETURNS integer_partition LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((p).image,1),0); seen boolean[] := array_fill(false, ARRAY[greatest(n,1)]);
          lens int[] := '{}'; i int; j int; len int;
  BEGIN
    FOR i IN 1..n LOOP
      IF NOT seen[i] THEN
        j := i; len := 0;
        LOOP seen[j] := true; len := len + 1; j := (p).image[j]; EXIT WHEN j = i; END LOOP;
        lens := lens || len;
      END IF;
    END LOOP;
    RETURN ROW(ARRAY(SELECT x FROM unnest(lens) x ORDER BY x DESC))::integer_partition;
  END $$;

-- inverse permutation: inv[image[i]] = i, i.e. the i's ordered by their image value.
CREATE FUNCTION perm_inverse(p permutation) RETURNS permutation LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT i FROM generate_subscripts((p).image,1) i ORDER BY (p).image[i]))::permutation $$;

-- conjugate partition (transpose of the Young diagram): c[i] = #{ parts >= i } for i = 1 .. largest part.
CREATE FUNCTION partition_conjugate(p integer_partition) RETURNS integer_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(
    SELECT (SELECT count(*)::int FROM unnest((p).parts) part WHERE part >= i)
    FROM generate_series(1, coalesce((p).parts[1], 0)) i ORDER BY i))::integer_partition $$;

-- reverse: the one-line word read right-to-left, w'(i) = w(n+1-i). A permutation endomorphism (an involution).
-- As a rigid motion of the permutohedron this is a REFLECTION (conjugation by the longest element w0).
CREATE FUNCTION perm_reverse(p permutation) RETURNS permutation LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT (p).image[array_length((p).image,1) + 1 - i]
                   FROM generate_subscripts((p).image,1) i))::permutation $$;

-- cyclic_shift: apply the n-cycle (1 2 … n) to the VALUES, w'(i) = (w(i) mod n) + 1. Order n. As a rigid motion of
-- the permutohedron it is a ROTATION (left-multiplication by a coordinate n-cycle) — the third motion generator
-- alongside complement (central inversion) and reverse (reflection); composing them (via --through) walks the
-- permutohedron's symmetry group. (The tessellation's translations are NOT S_n endomaps — they belong to the
-- affine symmetric group / affine permutations.)
CREATE FUNCTION perm_cyclic_shift(p permutation) RETURNS permutation LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT CASE WHEN (p).image[i] = coalesce(array_length((p).image,1),0) THEN 1 ELSE (p).image[i] + 1 END
                   FROM generate_subscripts((p).image,1) i))::permutation $$;

-- shape: the multiset of block sizes of a set partition, as a (non-increasing) integer partition.
CREATE FUNCTION setpart_shape(s set_partition) RETURNS integer_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT count(*)::int FROM unnest((s).rgs) v GROUP BY v ORDER BY count(*) DESC))::integer_partition $$;

-- RSK insertion tableau: the Robinson-Schensted P tableau of a permutation, by row insertion (bumping). The image
-- is a standard Young tableau on {1..n}, returned as its row-word (row_word[v] = the 0-based row holding value v).
-- Validated element-by-element against sage's robinson_schensted over all permutations of size ≤ 5.
CREATE FUNCTION perm_rsk_insertion(p permutation) RETURNS standard_tableau LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((p).image,1),0); cells int[] := '{}'; rowlen int[] := '{}';
          x int; r int; base int; rl int; pos int; y int; i int; rw int[];
  BEGIN
    FOR i IN 1..n LOOP
      x := (p).image[i]; r := 1;
      LOOP
        base := coalesce((SELECT sum(rowlen[j])::int FROM generate_series(1, r-1) j), 0);
        rl := coalesce(rowlen[r], 0);
        pos := (SELECT min(q) FROM generate_series(base+1, base+rl) q WHERE cells[q] > x);   -- leftmost entry to bump
        IF pos IS NULL THEN                                                                  -- no bump: append to row r
          cells := cells[1:base+rl] || x || cells[base+rl+1:];
          IF r > coalesce(array_length(rowlen,1),0) THEN rowlen := rowlen || 1; ELSE rowlen[r] := rl + 1; END IF;
          EXIT;
        ELSE y := cells[pos]; cells[pos] := x; x := y; r := r + 1; END IF;                    -- bump, carry down a row
      END LOOP;
    END LOOP;
    rw := array_fill(0, ARRAY[n]);   -- n=0 ⇒ '{}' (the empty tableau); greatest(n,1) would forge a phantom cell
    FOR r IN 1..coalesce(array_length(rowlen,1),0) LOOP
      base := coalesce((SELECT sum(rowlen[j])::int FROM generate_series(1, r-1) j), 0);
      FOR i IN 1..rowlen[r] LOOP rw[cells[base+i]] := r - 1; END LOOP;
    END LOOP;
    RETURN ROW(rw)::standard_tableau;
  END $$;

-- RSK recording tableau: the Robinson-Schensted Q tableau of a permutation. Same row-insertion as above, but Q
-- records WHERE the shape grew: the cell added at step i holds the value i. So the row-word is simply rw[i] = the
-- (0-based) row whose end received the new cell at step i. Q is a standard Young tableau of the same shape as P.
CREATE FUNCTION perm_rsk_recording(p permutation) RETURNS standard_tableau LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((p).image,1),0); cells int[] := '{}'; rowlen int[] := '{}';
          x int; r int; base int; rl int; pos int; y int; i int; rw int[];
  BEGIN
    rw := array_fill(0, ARRAY[n]);   -- n=0 ⇒ '{}' (the empty tableau); greatest(n,1) would forge a phantom cell
    FOR i IN 1..n LOOP
      x := (p).image[i]; r := 1;
      LOOP
        base := coalesce((SELECT sum(rowlen[j])::int FROM generate_series(1, r-1) j), 0);
        rl := coalesce(rowlen[r], 0);
        pos := (SELECT min(q) FROM generate_series(base+1, base+rl) q WHERE cells[q] > x);
        IF pos IS NULL THEN                                                                  -- new cell ends row r
          cells := cells[1:base+rl] || x || cells[base+rl+1:];
          IF r > coalesce(array_length(rowlen,1),0) THEN rowlen := rowlen || 1; ELSE rowlen[r] := rl + 1; END IF;
          rw[i] := r - 1;                                                                    -- Q: value i lands here
          EXIT;
        ELSE y := cells[pos]; cells[pos] := x; x := y; r := r + 1; END IF;
      END LOOP;
    END LOOP;
    RETURN ROW(rw)::standard_tableau;
  END $$;

-- Inverse RSK: recover the permutation from an (insertion, recording) pair of same-shape standard tableaux, by
-- reverse row-bumping. Not a registered base_map (it takes two arguments, not one element), but it closes the RSK
-- bijection: rsk_inverse(perm_rsk_insertion(p), perm_rsk_recording(p)) = p. Cells are held row-major (ascending
-- within each row, exactly as a SYT reads) as flat cells + rowlen, mirroring the forward insertion above.
CREATE FUNCTION rsk_inverse(p_tab standard_tableau, q_tab standard_tableau) RETURNS permutation LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE rwp int[] := (p_tab).row_word; rwq int[] := (q_tab).row_word;
          n int := coalesce(array_length(rwp,1),0);
          cells int[] := '{}'; rowlen int[] := '{}'; img int[];
          r int; base int; rl int; i int; x int; idx int; v int;
  BEGIN
    IF n = 0 THEN RETURN ROW(ARRAY[]::int[])::permutation; END IF;
    FOR r IN 0..coalesce((SELECT max(rwp[j]) FROM generate_subscripts(rwp,1) j), -1) LOOP   -- rebuild P row by row
      FOR v IN SELECT g FROM generate_subscripts(rwp,1) g WHERE rwp[g] = r ORDER BY g LOOP  -- row r = its entries, ascending
        cells := cells || v; rowlen := rowlen[1:r] || (coalesce(rowlen[r+1],0) + 1) || rowlen[r+2:];
      END LOOP;
    END LOOP;
    img := array_fill(0, ARRAY[n]);
    FOR i IN REVERSE n..1 LOOP
      r := rwq[i] + 1;                                                                       -- row whose corner was added at step i
      base := coalesce((SELECT sum(rowlen[j])::int FROM generate_series(1, r-1) j), 0);
      rl := rowlen[r];
      x := cells[base+rl];                                                                   -- eject its rightmost cell
      cells := cells[1:base+rl-1] || cells[base+rl+1:];
      rowlen[r] := rl - 1;
      FOR r IN REVERSE r-1..1 LOOP                                                           -- reverse-bump up the rows
        base := coalesce((SELECT sum(rowlen[j])::int FROM generate_series(1, r-1) j), 0);
        rl := rowlen[r];
        idx := (SELECT max(q) FROM generate_series(base+1, base+rl) q WHERE cells[q] < x);   -- largest entry below x
        v := cells[idx]; cells[idx] := x; x := v;
      END LOOP;
      img[i] := x;                                                                           -- what row 1 finally ejects
    END LOOP;
    RETURN ROW(img)::permutation;
  END $$;

-- ── register in base_map (collection, map_id, mapping_fn, codomain, title, findstat) ────────────────────
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('permutations','cycle_type','perm_cycle_type','integer_partitions','Cycle type','Mp00108'),
  ('permutations','inverse','perm_inverse','permutations','Inverse',NULL),
  ('permutations','reverse','perm_reverse','permutations','Reverse (reflection)',NULL),
  ('permutations','cyclic_shift','perm_cyclic_shift','permutations','Cyclic value shift (rotation)',NULL),
  ('permutations','rsk_insertion','perm_rsk_insertion','standard_tableaux','RSK insertion tableau',NULL),
  ('permutations','rsk_recording','perm_rsk_recording','standard_tableaux','RSK recording tableau',NULL),
  ('integer_partitions','conjugate','partition_conjugate','integer_partitions','Conjugate','Mp00202'),
  ('set_partitions','shape','setpart_shape','integer_partitions','Shape',NULL);

-- conjugate is an INVOLUTION — its own inverse. Set here (same INSERT's own row, same pack) rather than via an
-- UPDATE from packs/partitions-plus/integer_partitions.cores_quotients.sql (#283) — that file only USES conjugate
-- as a building block for k-core; the involution fact belongs with the row core already owns, not a cross-pack
-- UPDATE (base_guard_pack forbids a pack touching a row it didn't insert).
UPDATE base_map SET inverse = 'conjugate', is_bijection = true
  WHERE collection = 'integer_partitions' AND map_id = 'conjugate';

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('maps','cycle_type: 231 → 3 (one 3-cycle), 213 → 2+1','eq','3|2+1','permutation → cycle-length partition',$q$
    SELECT notation(perm_cycle_type(ROW(ARRAY[2,3,1])::permutation)) || '|' ||
           notation(perm_cycle_type(ROW(ARRAY[2,1,3])::permutation)) $q$),
  ('maps','inverse: 231 → 312, and it is an involution on 312','eq','312|231','inverse permutation',$q$
    SELECT one_line(perm_inverse(ROW(ARRAY[2,3,1])::permutation)) || '|' ||
           one_line(perm_inverse(ROW(ARRAY[3,1,2])::permutation)) $q$),
  ('maps','conjugate: 3+1 → 2+1+1, and it is an involution','eq','2+1+1|3+1','transpose of the Young diagram',$q$
    SELECT notation(partition_conjugate(ROW(ARRAY[3,1])::integer_partition)) || '|' ||
           notation(partition_conjugate(partition_conjugate(ROW(ARRAY[3,1])::integer_partition))) $q$),
  ('maps','the image renders in the CODOMAIN form via render_value','eq','2+1','render_value on an integer_partition image',$q$
    SELECT render_value(perm_cycle_type(ROW(ARRAY[2,1,3])::permutation)) $q$),
  ('maps','cycle_type over permutations(3): the S_3 cycle-type multiset','eq','1+1+1,2+1,2+1,3,3,2+1','cycle type of each permutation of 3 (123,132,213,231,312,321), in rank order',$q$
    SELECT string_agg(render_value(perm_cycle_type((e).value)), ',' ORDER BY ordinality(e)) FROM elements(permutations(3)) e $q$),
  ('maps','reverse: 231 → 132, and it is an involution','eq','132|231','w(n+1-i)',$q$
    SELECT one_line(perm_reverse(ROW(ARRAY[2,3,1])::permutation)) || '|' ||
           one_line(perm_reverse(perm_reverse(ROW(ARRAY[2,3,1])::permutation))) $q$),
  ('maps','shape: set partition {1,3}/{2} → its block-size partition 2+1','eq','2+1','set_partitions → integer_partitions',$q$
    SELECT notation(setpart_shape(ROW(ARRAY[0,1,0])::set_partition)) $q$),
  ('maps','shape renders in the CODOMAIN form (an integer partition) via render_value','eq','2+1+1','{1,2}/{3}/{4} ↦ 2+1+1',$q$
    SELECT render_value(setpart_shape(ROW(ARRAY[0,0,1,2])::set_partition)) $q$),
  ('maps','RSK insertion: 231 ↦ the tableau 1,3/2, and the identity 123 ↦ the single row 1,2,3','eq','1,3/2|1,2,3','the Robinson-Schensted P tableau (validated vs sage)',$q$
    SELECT render_value(perm_rsk_insertion(ROW(ARRAY[2,3,1])::permutation)) || '|' ||
           render_value(perm_rsk_insertion(ROW(ARRAY[1,2,3])::permutation)) $q$),
  ('maps','RSK is shape-compatible: the P tableau of a permutation of 4 has 4 cells','eq','true','|shape(P)| = n for every permutation',$q$
    SELECT bool_and(coalesce(array_length((perm_rsk_insertion((e).value)).row_word,1),0) = 4)::text FROM elements(permutations(4)) e $q$),
  ('maps','RSK recording: 231 ↦ Q = 1,2/3; 312 ↦ Q = 1,3/2 (validated vs sage)','eq','1,2/3|1,3/2','the Robinson-Schensted Q tableau',$q$
    SELECT render_value(perm_rsk_recording(ROW(ARRAY[2,3,1])::permutation)) || '|' ||
           render_value(perm_rsk_recording(ROW(ARRAY[3,1,2])::permutation)) $q$),
  ('maps','P and Q share a shape: 2413 ↦ P = 1,3/2,4 and Q = 1,2/3,4','eq','1,3/2,4|1,2/3,4','same shape, different fillings',$q$
    SELECT render_value(perm_rsk_insertion(ROW(ARRAY[2,4,1,3])::permutation)) || '|' ||
           render_value(perm_rsk_recording(ROW(ARRAY[2,4,1,3])::permutation)) $q$),
  ('maps','inverse RSK closes the bijection: rsk_inverse(P,Q) = p for every permutation of 4','eq','true','RSK is a bijection permutations ↔ same-shape (P,Q) pairs',$q$
    SELECT bool_and(one_line(rsk_inverse(perm_rsk_insertion((e).value), perm_rsk_recording((e).value))) = one_line((e).value))::text
    FROM elements(permutations(4)) e $q$),
  ('maps','inverse RSK recovers 2413 from its P and Q tableaux','eq','2413','round-trip on a single permutation',$q$
    SELECT one_line(rsk_inverse(perm_rsk_insertion(ROW(ARRAY[2,4,1,3])::permutation),
                                perm_rsk_recording(ROW(ARRAY[2,4,1,3])::permutation))) $q$),
  ('maps','RSK on inverse permutations swaps P and Q: P(w⁻¹)=Q(w) over permutations(4)','eq','true','the Schützenberger symmetry P(w⁻¹)=Q(w), Q(w⁻¹)=P(w)',$q$
    SELECT bool_and(
      render_value(perm_rsk_insertion(perm_inverse((e).value))) = render_value(perm_rsk_recording((e).value)) AND
      render_value(perm_rsk_recording(perm_inverse((e).value))) = render_value(perm_rsk_insertion((e).value))
    )::text FROM elements(permutations(4)) e $q$),
  ('maps','the permutohedron motions: reverse (reflection), complement (inversion), cyclic_shift (rotation)','eq','231|321|231','reverse 132, complement 123, cyclic_shift 123',$q$
    SELECT one_line(perm_reverse(ROW(ARRAY[1,3,2])::permutation)) || '|' ||
           one_line(perm_complement(ROW(ARRAY[1,2,3])::permutation)) || '|' ||
           one_line(perm_cyclic_shift(ROW(ARRAY[1,2,3])::permutation)) $q$),
  ('maps','cyclic_shift is an order-n rotation: applied 3× over permutations(3) it is the identity','eq','true','the n-cycle on values has order n',$q$
    SELECT bool_and(perm_cyclic_shift(perm_cyclic_shift(perm_cyclic_shift((e).value))) = (e).value)::text FROM elements(permutations(3)) e $q$),
  ('maps','permutations maps include at least the RSK pair rsk_insertion + rsk_recording (a floor — more may be added)','eq','true','base_map rows (to_lehmer_code moved to packs/permutations-plus/cross-collection-maps.permutations-plus.sql, #283 phase 3; the collection-scoped ''rsk'' row moved to packs/tableaux/maps-bijections.tableaux.sql, #283 phase 3 lane 2, its codomain standard_tableau_pairs is pack-owned — not part of core''s own floor)',$q$
    SELECT (array_agg(map_id) @> ARRAY['binary_search_tree','complement','cycle_partition','cycle_type','cyclic_shift','descent_composition','descent_set','inverse','permutahedron_vertex','reverse','rsk_insertion','rsk_recording'])::text
    FROM base_map WHERE collection = 'permutations' $q$);
