-- requires: integer_partitions, integer_partitions.frobenius_abacus, core_partitions, maps, realizer, utilities
-- integer_partitions — the k-core maps and a small forgetful map (issue #230). k-core/k-quotient is flagged in the
-- catalog audit as "typed-parameter friction" (#67/#240): k is a constructor PARAMETER, not something a unary
-- mapping_fn(<carrier>) can take. Registered here per the audit's guidance — "register two_core / three_core as
-- fixed maps now and note the family" — as two concrete fixed-k maps landing in core_partitions (already realized,
-- #90-style — no bespoke carrier added). The k-QUOTIENT (a k-tuple of partitions) has no natural single-collection
-- codomain yet (a k-tuple carrier is out of this ticket's scope: "no new collections beyond what the ticket
-- names") and is deferred alongside the general parameterized k-core to #67/#240.
--
-- `add_row` (from the audit's map list) is dropped for the same reason from the other end: there is no unary,
-- well-defined "add a row" partition endomap (unlike removing the largest part, prepending one needs an extra
-- parameter — how large a part to add) — deferred alongside k-quotient.

-- ── k-core, via the beta-set / abacus algorithm ─────────────────────────────────────────────────────────
-- Standard abacus algorithm (e.g. sage's Partition.to_core): take the beta-set (first-column hook lengths, ℓ beads),
-- split it into k residue classes mod k, and in EACH class replace the beads with the ℓ_r smallest non-negative
-- values in that residue class (slide every bead down its own runner, closing gaps). Converting the result back
-- via β⁻¹ gives the k-core — a partition none of whose hook lengths is divisible by k (verified against
-- core_partitions.sql's own partition_hook_lengths(int[]) in the examples below).
CREATE FUNCTION partition_k_core(p integer_partition, k int) RETURNS integer_partition LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE beta int[] := partition_beta_set(p); ell int := coalesce(array_length(beta,1),0);
          r int; class int[]; m int; i int; newbeta int[] := '{}'; sorted int[]; parts int[] := '{}';
  BEGIN
    IF ell = 0 THEN RETURN ROW('{}'::int[])::integer_partition; END IF;
    FOR r IN 0..k-1 LOOP
      class := ARRAY(SELECT x FROM unnest(beta) x WHERE x % k = r);
      m := coalesce(array_length(class,1),0);
      FOR i IN 0..m-1 LOOP newbeta := newbeta || (r + i*k); END LOOP;   -- the m smallest values ≡ r (mod k)
    END LOOP;
    sorted := ARRAY(SELECT x FROM unnest(newbeta) x ORDER BY x DESC);
    FOR i IN 1..ell LOOP parts := parts || greatest(sorted[i] - ell + i, 0); END LOOP;
    WHILE array_length(parts,1) > 0 AND parts[array_length(parts,1)] = 0 LOOP    -- trim trailing zero "parts"
      parts := parts[1:array_length(parts,1)-1];
    END LOOP;
    RETURN ROW(parts)::integer_partition;
  END $$;

CREATE FUNCTION partition_two_core(p integer_partition) RETURNS core_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW((partition_k_core(p, 2)).parts)::core_partition $$;
CREATE FUNCTION partition_three_core(p integer_partition) RETURNS core_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW((partition_k_core(p, 3)).parts)::core_partition $$;

-- ── remove_largest_part: the forgetful partition endomap dropping the first (largest) part ─────────────────
CREATE FUNCTION partition_remove_largest_part(p integer_partition) RETURNS integer_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW((p).parts[2:])::integer_partition $$;   -- empty partition stays empty ([2:] on '{}' is '{}')

-- ── register in base_map ─────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('integer_partitions','two_core','partition_two_core','core_partitions','2-core',NULL),
  ('integer_partitions','three_core','partition_three_core','core_partitions','3-core',NULL),
  ('integer_partitions','remove_largest_part','partition_remove_largest_part','integer_partitions','Remove the largest part',NULL);

-- conjugate (registered in maps.sql, Mp00202) is an INVOLUTION — its own inverse; that fact is now set directly
-- on core's own INSERT row in maps.sql (#283) rather than here — a pack may not UPDATE a row it didn't insert.

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('integer_partitions','2-core of 3+1 is empty (the diagram reduces by two dominoes); 2-core of 4+2 is empty too','eq','0|0','removing dominoes down to nothing (notation(∅) = 0)',$q$
    SELECT notation(ROW((partition_two_core(ROW(ARRAY[3,1])::integer_partition)).parts)::integer_partition) || '|' ||
           notation(ROW((partition_two_core(ROW(ARRAY[4,2])::integer_partition)).parts)::integer_partition) $q$),
  ('integer_partitions','3-core of 4+2 is 4+2 itself (already a 3-core — matches core_partitions.sql''s own 3-cores-of-length-4 example)','eq','4+2','a fixed point of the 3-core map',$q$
    SELECT notation(ROW((partition_three_core(ROW(ARRAY[4,2])::integer_partition)).parts)::integer_partition) $q$),
  ('integer_partitions','3-core of the single row 3 is empty (the whole row is one rim hook of size 3)','eq','0','one 3-rim-hook removed leaves nothing (notation(∅) = 0)',$q$
    SELECT notation(ROW((partition_three_core(ROW(ARRAY[3])::integer_partition)).parts)::integer_partition) $q$),
  ('integer_partitions','two_core / three_core always land on an ACTUAL k-core: no hook length divisible by k, over partitions of 8','eq','true|true','checked via core_partitions.sql''s partition_hook_lengths(int[])',$q$
    SELECT bool_and(NOT EXISTS (SELECT 1 FROM partition_hook_lengths((partition_two_core((e).value)).parts) h WHERE h % 2 = 0))::text || '|' ||
           bool_and(NOT EXISTS (SELECT 1 FROM partition_hook_lengths((partition_three_core((e).value)).parts) h WHERE h % 3 = 0))::text
    FROM elements(integer_partitions(8)) e $q$),
  ('integer_partitions','remove_largest_part: 4+2+1 → 2+1, and the empty partition stays empty','eq','2+1|0','drop the first (largest) part (notation(∅) = 0)',$q$
    SELECT notation(partition_remove_largest_part(ROW(ARRAY[4,2,1])::integer_partition)) || '|' ||
           notation(partition_remove_largest_part(ROW(ARRAY[]::int[])::integer_partition)) $q$),
  ('integer_partitions','remove_largest_part strictly shrinks the size for every nonempty partition of 6','eq','true','|remove(p)| < |p| whenever p ≠ ∅',$q$
    SELECT bool_and(
      (SELECT coalesce(sum(x),0) FROM unnest((partition_remove_largest_part((e).value)).parts) x) < 6
    )::text FROM elements(integer_partitions(6)) e $q$),
  ('integer_partitions','conjugate is now declared its own inverse (an involution)','eq','conjugate|true','base_map.inverse / is_bijection updated',$q$
    SELECT inverse || '|' || is_bijection::text FROM base_map WHERE collection = 'integer_partitions' AND map_id = 'conjugate' $q$),
  ('integer_partitions','two_core / three_core / remove_largest_part are registered maps','eq','true','base_map rows',$q$
    SELECT (array_agg(map_id) @> ARRAY['conjugate','remove_largest_part','three_core','two_core'])::text
    FROM base_map WHERE collection = 'integer_partitions' $q$);
