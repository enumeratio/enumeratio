-- requires: distinct_partitions, odd_partitions, maps
-- Euler's theorem (core's maps-bijections.sql hosts the other collection-scoped bijections; this one moved here
-- because both endpoint collections are pack-owned): #{partitions of n into DISTINCT parts} = #{partitions of n
-- into ODD parts} (both A000009). The witnessing bijection is Glaisher's:
--   distinct → odd : write each part d = 2^a·m (m odd); replace d by m repeated 2^a times.
--   odd → distinct : for each odd part m of multiplicity k, binary-expand k = Σ 2^aᵢ; emit the (distinct) parts m·2^aᵢ.
-- These are mutual inverses. Both distinct_partitions and odd_partitions are base_restrict children of
-- integer_partitions (#90), so both directions are typed integer_partition -> integer_partition; the restriction
-- (distinct-parts / odd-parts) is enforced by the collections, not the carrier.

CREATE FUNCTION euler_distinct_to_odd(p integer_partition) RETURNS integer_partition LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE d int; m int; reps int; i int; out int[] := '{}';
  BEGIN
    FOREACH d IN ARRAY (p).parts LOOP
      m := d;
      WHILE m % 2 = 0 LOOP m := m / 2; END LOOP;   -- m = the odd part of d; d/m = 2^a
      reps := d / m;
      FOR i IN 1 .. reps LOOP out := out || m; END LOOP;
    END LOOP;
    RETURN ROW(ARRAY(SELECT x FROM unnest(out) x ORDER BY x DESC))::integer_partition;   -- non-increasing, all odd
  END $$;

CREATE FUNCTION euler_odd_to_distinct(p integer_partition) RETURNS integer_partition LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE m int; k int; a int; out int[] := '{}';
  BEGIN
    FOR m, k IN SELECT val, count(*)::int FROM unnest((p).parts) val GROUP BY val LOOP
      a := 0;
      WHILE k > 0 LOOP
        IF k % 2 = 1 THEN out := out || (m * (2 ^ a)::int); END IF;   -- set bit a ⇒ the part m·2^a
        k := k / 2; a := a + 1;
      END LOOP;
    END LOOP;
    RETURN ROW(ARRAY(SELECT x FROM unnest(out) x ORDER BY x DESC))::integer_partition;   -- strictly decreasing (distinct)
  END $$;

-- register both directions as paired collection-scoped bijections
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, scope, inverse, is_bijection) VALUES
  ('distinct_partitions','to_odd','euler_distinct_to_odd','odd_partitions','Euler (Glaisher): distinct → odd','collection','to_distinct',true),
  ('odd_partitions','to_distinct','euler_odd_to_distinct','distinct_partitions','Euler (Glaisher): odd → distinct','collection','to_odd',true);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('maps-bijections','Euler map: image of distinct_partitions(n) IS exactly odd_partitions(n), n=0..12','eq','true','the bijection — image set equals the codomain fiber',$q$
    SELECT bool_and(
      (SELECT array_agg(s ORDER BY s) FROM (SELECT notation(euler_distinct_to_odd((e).value)) s FROM elements(distinct_partitions(n)) e) t)
      = (SELECT array_agg(s ORDER BY s) FROM (SELECT notation((o).value) s FROM elements(odd_partitions(n)) o) t))::text
    FROM generate_series(0,12) n $q$),
  ('maps-bijections','round-trips: odd(distinct(d)) = d over distinct_partitions(n), n=0..14','eq','true','euler_odd_to_distinct ∘ euler_distinct_to_odd = id',$q$
    SELECT bool_and(euler_odd_to_distinct(euler_distinct_to_odd((e).value)) = (e).value)::text
    FROM generate_series(0,14) n, LATERAL elements(distinct_partitions(n)) e $q$),
  ('maps-bijections','round-trips the other way: distinct(odd(o)) = o over odd_partitions(n), n=0..14','eq','true','euler_distinct_to_odd ∘ euler_odd_to_distinct = id',$q$
    SELECT bool_and(euler_distinct_to_odd(euler_odd_to_distinct((o).value)) = (o).value)::text
    FROM generate_series(0,14) n, LATERAL elements(odd_partitions(n)) o $q$),
  ('maps-bijections','a worked instance: 5+3+1 (distinct) ↦ its odd partition, and back','eq','true','Glaisher on one element round-trips',$q$
    SELECT (euler_odd_to_distinct(euler_distinct_to_odd(ROW(ARRAY[5,3,1])::integer_partition)) = ROW(ARRAY[5,3,1])::integer_partition)::text $q$),
  ('maps-bijections','both directions are declared bijections with each other as inverse','eq','to_distinct:t|to_odd:t','scope=collection, is_bijection, paired inverses',$q$
    SELECT 'to_distinct:' || left((is_bijection AND inverse='to_distinct')::text,1) || '|' ||
           'to_odd:' || left((SELECT (is_bijection AND inverse='to_odd')::text FROM base_map WHERE collection='odd_partitions' AND map_id='to_distinct'),1)
    FROM base_map WHERE collection='distinct_partitions' AND map_id='to_odd' $q$),
  ('maps-bijections','collection-scoped maps do NOT carrier-inherit: to_distinct (on integer_partition) stays off other partition collections','eq','0','scope gating — integer_partitions does not resolve the Euler map',$q$
    SELECT count(*)::text FROM base_map_resolved WHERE collection='integer_partitions' AND map_id IN ('to_distinct','to_odd') $q$);
