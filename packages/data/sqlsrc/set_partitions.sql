-- requires: realizer
-- set_partitions — realized from data. Single grade [n]. A set partition of {1..n} is represented as a
-- RESTRICTED GROWTH STRING (RGS): a[1]=0 and a[i] <= 1 + max(a[1..i-1]) — a[i] names the block of element i,
-- blocks numbered in order of first appearance. The floor generates every valid RGS of length n in lex order
-- (a recursive prefix build); cardinality = Bell(n). Provides a Bell closed-form count accel + a contains engine.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE set_partition AS (rgs int[]);                              -- restricted growth string; {0,1,0} = 1,3 | 2
CREATE FUNCTION notation(p set_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT array_to_string((p).rgs, '') $$;
-- the block reading: group positions by their RGS value (blocks already in first-appearance order)
CREATE FUNCTION set_partition_blocks(p set_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(blk, '/' ORDER BY g), '') FROM (
    SELECT (p).rgs[i] AS g, '{' || string_agg(i::text, ',' ORDER BY i) || '}' AS blk
    FROM generate_subscripts((p).rgs, 1) i GROUP BY (p).rgs[i]) s $$;

CREATE FUNCTION bell(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$   -- Bell triangle: Bell(n) = first entry of row n
  DECLARE cur numeric[] := ARRAY[1::numeric]; nxt numeric[]; i int; j int;
  BEGIN
    FOR i IN 1..n LOOP
      nxt := ARRAY[cur[array_length(cur,1)]];                                  -- new row starts with the tail of the last
      FOR j IN 1..array_length(cur,1) LOOP nxt := nxt || (nxt[j] + cur[j]); END LOOP;
      cur := nxt;
    END LOOP;
    RETURN cur[1];
  END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- the FLOOR: every valid RGS of length n in lex order. Grow prefixes: extend an RGS of max m by any value 0..m+1.
-- The empty seed (len 0, max -1) forces a[1]=0 (only value 0..0), and yields the single empty RGS when n=0.
CREATE TYPE set_partitions_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f set_partitions_fiber, element_limit int) RETURNS SETOF set_partition LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT ARRAY[]::int[] AS rgs, -1 AS mx, 0 AS len
    UNION ALL
    SELECT b.rgs || v, greatest(b.mx, v), b.len + 1
    FROM build b, generate_series(0, b.mx + 1) v
    WHERE b.len < (f).n::int)
  SELECT ROW(rgs)::set_partition FROM build WHERE len = (f).n::int ORDER BY rgs LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f set_partitions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT bell((f).n::int) $$;
CREATE FUNCTION contains_in_fiber(f set_partitions_fiber, v set_partition) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE r int[] := (v).rgs; mx int := -1; i int; len int := coalesce(array_length((v).rgs, 1), 0);
  BEGIN
    IF len <> (f).n::int THEN RETURN false; END IF;                           -- wrong length ⇒ not in this fiber
    FOR i IN 1..len LOOP
      IF r[i] < 0 OR r[i] > mx + 1 THEN RETURN false; END IF;                 -- a[i] must be in 0 .. 1+max(prefix)
      mx := greatest(mx, r[i]);
    END LOOP;
    RETURN true;
  END $$;

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('set_partitions', 'set_partition');
INSERT INTO base_grade VALUES ('set_partitions', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f set_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Π([' || (f).n::int || '])' $$;   -- corpus symbol
SELECT base_realize('set_partitions');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('set_partitions','RGS of [3] in lex order','eq','000,001,010,011,012','the floor: all valid length-3 RGS, Bell(3)=5',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(set_partitions(3)) e $q$),
  ('set_partitions','COUNT anchor: Bell(n) for n=0..5','eq','1,1,2,5,15,52','cardinality per fiber = Bell(n) (accel)',$q$
    SELECT string_agg(cardinality(set_partitions(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('set_partitions','cardinality(set_partitions(5)) = 52 = Bell(5)','eq','52','the closed-form count accel',$q$
    SELECT cardinality(set_partitions(5))::text $q$),
  ('set_partitions','unrank crosses lex: rank 4 of set_partitions(3) = 012','eq','012','ranks 0..4 = 000,001,010,011,012',$q$
    SELECT notation((unrank(set_partitions(3), 4)).value) $q$),
  ('set_partitions','element carries a TYPED point fiber (axis n)','eq','4','unrank(set_partitions(4),0).fiber.n',$q$
    SELECT (unrank(set_partitions(4), 0)).fiber.n::text $q$),
  ('set_partitions','block reading: rank 2 of set_partitions(3) is {0,1,0} = {1,3}/{2}','eq','{1,3}/{2}','RGS ↦ blocks',$q$
    SELECT set_partition_blocks((unrank(set_partitions(3), 2)).value) $q$),
  ('set_partitions','range constructor set_partitions(2,4): fibers unfold to n = 2,3,4','eq','2,3,4','the (lo,hi) grade range',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(set_partitions(2,4)) f $q$),
  ('set_partitions','range handle cardinality = Bell(2)+Bell(3)+Bell(4) = 22','eq','22','summed over fibers',$q$
    SELECT cardinality(set_partitions(2,4))::text $q$),
  ('set_partitions','contains: valid {0,1,0} ∈, malformed {0,2,1} ∉ set_partitions(3)','eq','true|false','a[2]=2 > 1+max prefix is not an RGS',$q$
    SELECT contains(set_partitions(3), ROW(ARRAY[0,1,0])::set_partition)::text || '|' ||
           contains(set_partitions(3), ROW(ARRAY[0,2,1])::set_partition)::text $q$),
  ('set_partitions','the <@ operator: {0,1,2} <@ set_partitions(3)','eq','true','operator wrapper over contains',$q$
    SELECT (ROW(ARRAY[0,1,2])::set_partition <@ set_partitions(3))::text $q$),
  ('set_partitions','handle ::text is the readable constructor form','eq','set_partitions(n=6)','clean canonical ::text, not the record/range wire format',$q$
    SELECT set_partitions(6)::text $q$),
  ('set_partitions','range handle ::text shows the axis range','eq','set_partitions(n=2..4)','the (lo,hi) grade range renders as lo..hi',$q$
    SELECT set_partitions(2,4)::text $q$),
  ('set_partitions','unnest(h) = carriers(h) on a finite handle','eq','true','unnest is the idiomatic alias of carriers',$q$
    SELECT ((SELECT count(*) FROM unnest(set_partitions(3))) = 5
        AND (SELECT array_agg(x::text ORDER BY x::text) FROM unnest(set_partitions(3)) x)
          = (SELECT array_agg(x::text ORDER BY x::text) FROM carriers(set_partitions(3)) x))::text $q$),
  ('set_partitions','unnest of an OPEN handle raises','eq','true','set_partitions() has an unbounded axis — no finite carrier set',$q$
    SELECT base_raises($e$ SELECT count(*) FROM unnest(set_partitions()) $e$)::text $q$);
