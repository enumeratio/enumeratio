-- requires: set_partitions, maps
-- set_partition_maps — the block-structure analogue of perm_reverse / composition_reverse (maps.sql /
-- integer_compositions.stats.sql): read the ground set {1..n} in reverse order and recompute the canonical RGS
-- (blocks renumbered by first appearance in the NEW scan order). Block MEMBERSHIP is unaffected by how blocks are
-- numbered, so this is well-defined on the actual partition (not an artifact of RGS labelling) and, since it's
-- built from the involution i ↦ n+1-i on positions, applying it twice recovers the exact same block structure —
-- an involution on set_partitions(n).

CREATE FUNCTION setpart_reverse(p set_partition) RETURNS set_partition LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE
    n int := coalesce(array_length((p).rgs,1),0);
    label int[]; nextid int := 0; i int; blk int; newrgs int[] := '{}';
  BEGIN
    IF n = 0 THEN RETURN ROW('{}'::int[])::set_partition; END IF;
    label := array_fill(-1, ARRAY[n]);                        -- old block id (0-based) → new label, by first appearance
    FOR i IN 1..n LOOP
      blk := (p).rgs[n+1-i];                                  -- the block occupying the REFLECTED position n+1-i
      IF label[blk+1] = -1 THEN label[blk+1] := nextid; nextid := nextid + 1; END IF;
      newrgs := newrgs || label[blk+1];
    END LOOP;
    RETURN ROW(newrgs)::set_partition;
  END $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('set_partitions','reverse','setpart_reverse','set_partitions','Reverse (read the ground set backwards)',NULL);

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('set_partition_maps','reverse over set_partitions(3), in lex order: 000,001,010,011,012 ↦ 000,011,010,001,012','eq','000,011,010,001,012','the full n=3 fiber, hand-derived: {1,2}/{3} (001) ↔ {1}/{2,3} (011) swap; {1,3}/{2} (010) and 012 are fixed (both are palindromic under position reversal)',$q$
    SELECT string_agg(notation(setpart_reverse((e).value)), ',' ORDER BY ordinality(e)) FROM elements(set_partitions(3)) e $q$),
  ('set_partition_maps','reverse: {1,2,3}/{4} (0001) ↦ {1}/{2,3,4} (0111), and back','eq','0111|0001','reflecting the singleton {4} to position 1 makes it the FIRST-seen (and so lowest-labelled) block',$q$
    SELECT notation(setpart_reverse(ROW(ARRAY[0,0,0,1])::set_partition)) || '|' ||
           notation(setpart_reverse(setpart_reverse(ROW(ARRAY[0,0,0,1])::set_partition))) $q$),
  ('set_partition_maps','reverse fixes the crossing witness {1,3}/{2,4} (0101) at n=4: each block reflects onto the other, same partition','eq','0101','block {1,3} ↦ {4,2}={2,4} and {2,4} ↦ {3,1}={1,3} — the two blocks swap, so the partition is unchanged',$q$
    SELECT notation(setpart_reverse(ROW(ARRAY[0,1,0,1])::set_partition)) $q$),
  ('set_partition_maps','reverse is an involution over set_partitions(n), n=0..6','eq','true','applied twice = identity',$q$
    SELECT bool_and(setpart_reverse(setpart_reverse((e).value)) = (e).value)::text
    FROM generate_series(0,6) n, LATERAL elements(set_partitions(n)) e $q$),
  ('set_partition_maps','reverse is a bijection on set_partitions(4): 15 distinct images (Bell(4))','eq','15','the image set has full size',$q$
    SELECT count(DISTINCT notation(setpart_reverse((e).value)))::text FROM elements(set_partitions(4)) e $q$),
  ('set_partition_maps','reverse preserves shape: the block-size multiset is unchanged, over set_partitions(n), n=0..6','eq','true','reflection permutes positions within/across blocks but never changes a block''s SIZE',$q$
    SELECT bool_and(setpart_shape(setpart_reverse((e).value)) = setpart_shape((e).value))::text
    FROM generate_series(0,6) n, LATERAL elements(set_partitions(n)) e $q$);
