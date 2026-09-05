-- requires: cross-collection-maps, non_crossing_partitions
-- trees-graphs half of sqlsrc/cross-collection-maps.sql (#283 phase 3 extraction) — the dyck_paths ->
-- non_crossing_partitions bijection moved wholesale: its base_map row's codomain is a pack-owned collection, and
-- examples.catalog_metadata's "every base_map codomain resolves to a registered collection" self-test would fail
-- loading core alone otherwise (the row itself has no FK on codomain, but that self-test checks it exhaustively).

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
