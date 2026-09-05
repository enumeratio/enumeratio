-- requires: permutations, maps, subsets, binary_words, symmetry_orbit_maps, realizer, utilities
-- Issue #233, chunk 3 — two more symmetry-orbit maps, beyond the word/necklace family:
--   conjugacy_class_representative — the canonical permutation of a cycle type (built directly from
--     perm_cycle_type, maps.sql): kernel = conjugacy classes, already visible as a kernel via cycle_type itself.
--   inverse_cyclic_shift — the functional inverse of perm_cyclic_shift (maps.sql), completing that rotation
--     generator into a pair.
-- Plus canonical_rotation on subsets: a subset of [n] read as a characteristic bitstring is a binary word, and its
-- rotation orbit representative is a binary necklace — "necklaces of subsets", linking subsets → binary_necklaces
-- through the bitstring (reusing word_canonical_rotation, symmetry_orbit_maps.sql).

-- ── permutations ─────────────────────────────────────────────────────────────────────────────────────────
-- canonical representative of p's conjugacy class: rebuild a permutation directly from cycle_type's (non-
-- increasing) part list, laying each cycle out as consecutive increasing integers — e.g. cycle type 3+1 on [4]
-- becomes (1 2 3)(4), one-line 2,3,1,4. Depends only on cycle_type, so it's automatically idempotent and
-- cycle-type-preserving: conjugacy_class_representative(p) always has the same cycle_type as p.
CREATE FUNCTION perm_conjugacy_class_representative(p permutation) RETURNS permutation LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE parts int[] := (perm_cycle_type(p)).parts; n int := coalesce(array_length((p).image,1),0);
          img int[] := array_fill(0, ARRAY[greatest(n,0)]); start int := 1; ln int; i int;
  BEGIN
    FOREACH ln IN ARRAY parts LOOP
      FOR i IN start..start+ln-2 LOOP img[i] := i+1; END LOOP;   -- each cycle: i -> i+1, ...
      img[start+ln-1] := start;                                  -- ...and the last element closes back to the start
      start := start + ln;
    END LOOP;
    RETURN ROW(img)::permutation;
  END $$;

-- inverse of perm_cyclic_shift (maps.sql): shift VALUES down by one (n wraps to... 1 wraps to n).
CREATE FUNCTION perm_inverse_cyclic_shift(p permutation) RETURNS permutation LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT CASE WHEN (p).image[i] = 1 THEN coalesce(array_length((p).image,1),0) ELSE (p).image[i] - 1 END
                   FROM generate_subscripts((p).image,1) i))::permutation $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('permutations','conjugacy_class_representative','perm_conjugacy_class_representative','permutations','Conjugacy class representative',NULL),
  ('permutations','inverse_cyclic_shift','perm_inverse_cyclic_shift','permutations','Inverse cyclic value shift',NULL);

-- ── subsets ──────────────────────────────────────────────────────────────────────────────────────────────
-- a subset of [n] as its characteristic bitstring, MSB (position 1) first. NULL when n is unset (the ungraded
-- finsets carrier can have n IS NULL for an infinite ambient set) — the open-handle trap: generate_series(1,NULL)
-- silently returns zero rows, which would forge a spurious empty bitstring instead of "undefined".
CREATE FUNCTION subset_to_binary_word(s finset) RETURNS binary_word LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (s).n IS NULL THEN NULL ELSE
    ROW(ARRAY(SELECT CASE WHEN i = ANY((s).members) THEN 1 ELSE 0 END FROM generate_series(1, (s).n) i))::binary_word
  END $$;
-- canonical_rotation of the bitstring, via the word-carrier engine (letters = bits+1, symmetry_orbit_maps.sql).
CREATE FUNCTION subset_canonical_rotation(s finset) RETURNS binary_word LANGUAGE sql IMMUTABLE AS $$
  SELECT binary_word_of_word(word_canonical_rotation(word_of_binary_word(bw)))
    FROM (SELECT subset_to_binary_word(s) AS bw) t WHERE bw IS NOT NULL $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('subsets','canonical_rotation','subset_canonical_rotation','binary_necklaces','Canonical rotation (as a binary necklace)',NULL);

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('permutations','conjugacy_class_representative: 3,1,2 and 2,3,1 (both 3-cycles) both canonicalize to 2,3,1','eq','231|231',
   'the map depends only on cycle type, not the particular permutation',$q$
    SELECT one_line(perm_conjugacy_class_representative(ROW(ARRAY[3,1,2])::permutation)) || '|' ||
           one_line(perm_conjugacy_class_representative(ROW(ARRAY[2,3,1])::permutation)) $q$),
  ('permutations','conjugacy_class_representative preserves cycle_type, over permutations(4)','eq','true',
   'the defining property: same class in, same-shaped canonical form out',$q$
    SELECT bool_and(
      perm_cycle_type(perm_conjugacy_class_representative((e).value)) = perm_cycle_type((e).value)
    )::text FROM elements(permutations(4)) e $q$),
  ('permutations','inverse_cyclic_shift: identity 1,2,3 ↦ 3,1,2, and cyclic_shift undoes it back to 1,2,3','eq','312|123',
   'value shift by -1 (1 wraps to n)',$q$
    SELECT one_line(perm_inverse_cyclic_shift(ROW(ARRAY[1,2,3])::permutation)) || '|' ||
           one_line(perm_cyclic_shift(perm_inverse_cyclic_shift(ROW(ARRAY[1,2,3])::permutation))) $q$),
  ('permutations','cyclic_shift and inverse_cyclic_shift are mutual inverses, over permutations(4)','eq','true',
   'round-trip both ways',$q$
    SELECT bool_and(
      perm_cyclic_shift(perm_inverse_cyclic_shift((e).value)) = (e).value AND
      perm_inverse_cyclic_shift(perm_cyclic_shift((e).value)) = (e).value
    )::text FROM elements(permutations(4)) e $q$),
  ('subsets','canonical_rotation: {1,3} ⊆ [4] (bitstring 1010) rotates to 0101, linking subsets into binary_necklaces','eq','0101',
   'the characteristic bitstring''s rotation orbit representative',$q$
    SELECT notation(subset_canonical_rotation(ROW(ARRAY[1,3],4)::finset)) $q$),
  ('subsets','orbit-count identity via subsets: count(DISTINCT canonical_rotation(s)) over subsets(n) = |binary_necklaces(n)|, n=1..8',
   'eq','true','the same Pólya orbit count, reached through subsets instead of words',$q$
    SELECT bool_and(
      (SELECT count(DISTINCT subset_canonical_rotation((e).value)) FROM elements(subsets(n)) e) = cardinality(binary_necklaces(n))
    )::text FROM generate_series(1,8) n $q$);
