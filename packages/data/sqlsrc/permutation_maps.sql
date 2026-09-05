-- requires: permutations, maps
-- permutation_maps — more classic permutation endomorphisms, extending the STARTER set in maps.sql
-- (inverse, reverse, cyclic_shift) and permutations.stats.sql (complement). Two additions here:
--   reverse_complement — the third dihedral symmetry of the permutohedron (reverse and complement already
--     cover reflection and central inversion; their composite, also an involution, completes the pair).
--   foata               — Foata's fundamental bijection (the classical maj↔inv equidistribution witness).
-- Simion–Schmidt (the 123/132-avoidance bijection) is NOT included: its exact defining algorithm couldn't
-- be pinned down with confidence here, so per the fabrication guard it's left out rather than guessed at.

-- ── reverse-complement: w'(i) = n+1-w(n+1-i) ────────────────────────────────────────────────────────────
-- Reverse (reflection, maps.sql) and complement (central inversion, permutations.stats.sql) commute — each
-- acts on one "coordinate" of the one-line word independently — so their composite in EITHER order is this
-- single map. An involution (the composite of two commuting involutions). Hand-verified: 231 →(reverse)→ 132
-- →(complement)→ 312, and 231 →(complement)→ 213 →(reverse)→ 312 — both orders agree, and applying
-- reverse_complement twice to 312 returns 231.
CREATE FUNCTION perm_reverse_complement(p permutation) RETURNS permutation LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT array_length((p).image,1) + 1 - (p).image[array_length((p).image,1) + 1 - i]
                   FROM generate_subscripts((p).image,1) i))::permutation $$;

-- ── Foata's fundamental bijection (the "second fundamental transformation") ────────────────────────────────
-- The classical direct witness (Foata 1968) that maj and inv are equidistributed on S_n: an endomorphism φ
-- with maj(w) = inv(φ(w)) for every permutation w. Built by inserting w's letters one at a time into a
-- growing word v: to place the next letter x after v = v_1…v_i, compare x to v_i (the last letter placed):
--   x > v_i : cut v right after every v_j < x
--   x < v_i : cut v right after every v_j > x
-- (v_i itself always satisfies its branch's predicate, so x always lands as its own new trailing singleton
-- block — the cut set never leaves a dangling partial block at the end); within each resulting block of v,
-- cyclically shift right by one (the block's last letter moves to its front); concatenate the shifted blocks,
-- then append x. Repeat until every letter of w has been placed.
-- Hand-verified against perm_major_index / perm_inversions (statistics.sql): 312 ↦ 132 (maj(312)=1=inv(132))
-- and 2413 ↦ 2143 (maj(2413)=2=inv(2143)); base_example below pins the full S_3 table and a maj=inv sweep.
CREATE FUNCTION perm_foata(p permutation) RETURNS permutation LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE
    n int := coalesce(array_length((p).image,1),0);
    v int[]; acc int[]; blk int[] := '{}'; x int; last int; grows boolean; k int; j int;
  BEGIN
    IF n = 0 THEN RETURN ROW(ARRAY[]::int[])::permutation; END IF;
    v := ARRAY[(p).image[1]];
    FOR k IN 2..n LOOP
      x := (p).image[k];
      last := v[array_length(v,1)];
      grows := (x > last);                          -- true ⇒ cut after each v_j < x; false ⇒ cut after each v_j > x
      acc := '{}'; blk := '{}';
      FOR j IN 1..array_length(v,1) LOOP
        blk := blk || v[j];
        IF (grows AND v[j] < x) OR (NOT grows AND v[j] > x) THEN
          acc := acc || (blk[array_length(blk,1)] || blk[1:array_length(blk,1)-1]);   -- close block: last elt to front
          blk := '{}';
        END IF;
      END LOOP;
      v := acc || x;                                 -- v's last letter always satisfies the cut ⇒ blk is empty here
    END LOOP;
    RETURN ROW(v)::permutation;
  END $$;

-- ── register in base_map ────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('permutations','reverse_complement','perm_reverse_complement','permutations','Reverse-complement (the third dihedral symmetry)',NULL),
  ('permutations','foata','perm_foata','permutations','Foata''s fundamental bijection (maj → inv)',NULL);

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('permutation_maps','reverse_complement: 231 ↦ 312, and it is an involution','eq','312|231','w(i) ↦ n+1-w(n+1-i)',$q$
    SELECT one_line(perm_reverse_complement(ROW(ARRAY[2,3,1])::permutation)) || '|' ||
           one_line(perm_reverse_complement(perm_reverse_complement(ROW(ARRAY[2,3,1])::permutation))) $q$),
  ('permutation_maps','reverse_complement agrees with reverse∘complement AND complement∘reverse on 231','eq','312|312','the two commuting factors compose to the same map, either order',$q$
    SELECT one_line(perm_reverse(perm_complement(ROW(ARRAY[2,3,1])::permutation))) || '|' ||
           one_line(perm_complement(perm_reverse(ROW(ARRAY[2,3,1])::permutation))) $q$),
  ('permutation_maps','reverse_complement over permutations(3), in rank order (two fixed points, two swapped pairs)','eq','123,213,132,312,231,321','image of 123,132,213,231,312,321',$q$
    SELECT string_agg(one_line(perm_reverse_complement((e).value)), ',' ORDER BY ordinality(e)) FROM elements(permutations(3)) e $q$),
  ('permutation_maps','reverse_complement is an involution over permutations(n), n=0..5','eq','true','applied twice = identity',$q$
    SELECT bool_and(perm_reverse_complement(perm_reverse_complement((e).value)) = (e).value)::text
    FROM generate_series(0,5) n, LATERAL elements(permutations(n)) e $q$),

  ('permutation_maps','Foata: 312 ↦ 132 (maj(312)=1=inv(132))','eq','132|1|1','the image, then maj(input) and inv(image) agree',$q$
    SELECT one_line(perm_foata(ROW(ARRAY[3,1,2])::permutation)) || '|' ||
           perm_major_index(ROW(ARRAY[3,1,2])::permutation)::text || '|' ||
           perm_inversions(perm_foata(ROW(ARRAY[3,1,2])::permutation))::text $q$),
  ('permutation_maps','Foata: 2413 ↦ 2143 (maj(2413)=2=inv(2143))','eq','2143|2|2','a size-4 instance with a size-2 block shift',$q$
    SELECT one_line(perm_foata(ROW(ARRAY[2,4,1,3])::permutation)) || '|' ||
           perm_major_index(ROW(ARRAY[2,4,1,3])::permutation)::text || '|' ||
           perm_inversions(perm_foata(ROW(ARRAY[2,4,1,3])::permutation))::text $q$),
  ('permutation_maps','Foata over permutations(3), in rank order','eq','123,312,213,231,132,321','image of 123,132,213,231,312,321',$q$
    SELECT string_agg(one_line(perm_foata((e).value)), ',' ORDER BY ordinality(e)) FROM elements(permutations(3)) e $q$),
  ('permutation_maps','Foata''s defining property: maj(w) = inv(foata(w)) over permutations(n), n=0..6','eq','true','the maj↔inv equidistribution witness, checked on the whole fiber',$q$
    SELECT bool_and(perm_major_index((e).value) = perm_inversions(perm_foata((e).value)))::text
    FROM generate_series(0,6) n, LATERAL elements(permutations(n)) e $q$),
  ('permutation_maps','Foata is a bijection on permutations(4): 24 distinct images','eq','24','the image set has full size',$q$
    SELECT count(DISTINCT one_line(perm_foata((e).value)))::text FROM elements(permutations(4)) e $q$);
