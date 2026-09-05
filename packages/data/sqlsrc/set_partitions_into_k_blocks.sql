-- requires: realizer, set_partitions
-- set_partitions_into_k_blocks — set partitions of {1..n} into EXACTLY k blocks, counted by the Stirling
-- numbers of the second kind S(n,k). Multi-grade chain [n, k]; k ranges 1..n by default (lo_expr '1'). REUSES
-- the existing `set_partition` carrier (RGS: a[1]=0, a[i] <= 1+max(a[1..i-1])) — a[i] names the block of
-- element i, blocks numbered in order of first appearance. Fiber [n,k] = every RGS of length n whose maximum
-- value is exactly k-1 (so it uses values 0..k-1 with k-1 attained, i.e. exactly k blocks).
--
-- The floor prunes the same prefix-growth recursion as set_partitions, but caps each new value at k-1 (a
-- block index beyond k-1 could never be un-attained again) and filters to max = k-1 at the end.

-- ── NEW helper: Stirling numbers of the second kind, S(n,k) = k*S(n-1,k) + S(n-1,k-1), S(0,0)=1 ─────────
CREATE FUNCTION stirling_second(n int, k int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE row numeric[] := ARRAY[1::numeric];   -- row represents S(0, 0..0) = [S(0,0)=1], 1-based: row[j+1]=S(i,j)
          newrow numeric[]; i int; j int; maxk int;
  BEGIN
    IF n < 0 OR k < 0 OR k > n THEN RETURN 0; END IF;
    IF n = 0 THEN RETURN 1; END IF;                                        -- only (0,0) survives the check above
    FOR i IN 1..n LOOP
      maxk := least(i, k);
      newrow := ARRAY[]::numeric[];
      FOR j IN 0..maxk LOOP
        newrow := newrow || (CASE WHEN j = 0 THEN 0::numeric                                 -- S(i,0) = 0 for i>0
                                   ELSE j::numeric * coalesce(row[j+1], 0) + coalesce(row[j], 0) END);
      END LOOP;
      row := newrow;
    END LOOP;
    RETURN row[k+1];
  END $$;

-- The collection OWNS its fiber type — a named typed-axis struct whose SIGNATURE is the fibration (n, then k),
-- each a natural_number. Its hooks are the generic overloaded fiber_elements / fiber_count / contains_in_fiber,
-- dispatched on set_partitions_into_k_blocks_fiber. base_realize introspects it → a natural_range handle.
CREATE TYPE set_partitions_into_k_blocks_fiber AS (n natural_number, k natural_number);

-- ── the FLOOR: every RGS of length n with max = k-1 (exactly k blocks), in lex order ────────────────────
-- Same prefix-growth as set_partitions_fiber_elements, but a new value is capped at k-1 (never worth
-- proposing a block index that would already overshoot the target block count).
CREATE FUNCTION fiber_elements(f set_partitions_into_k_blocks_fiber, element_limit int) RETURNS SETOF set_partition LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT ARRAY[]::int[] AS rgs, -1 AS mx, 0 AS len
    UNION ALL
    SELECT b.rgs || v, greatest(b.mx, v), b.len + 1
    FROM build b, generate_series(0, least(b.mx + 1, (f).k::int - 1)) v
    WHERE b.len < (f).n::int)
  SELECT ROW(rgs)::set_partition FROM build WHERE len = (f).n::int AND mx = (f).k::int - 1 ORDER BY rgs LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f set_partitions_into_k_blocks_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT stirling_second((f).n::int, (f).k::int) $$;
CREATE FUNCTION contains_in_fiber(f set_partitions_into_k_blocks_fiber, v set_partition) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE r int[] := (v).rgs; mx int := -1; i int; len int := coalesce(array_length((v).rgs, 1), 0);
  BEGIN
    IF len <> (f).n::int THEN RETURN false; END IF;                       -- wrong length ⇒ not in this fiber
    FOR i IN 1..len LOOP
      IF r[i] < 0 OR r[i] > mx + 1 THEN RETURN false; END IF;              -- a[i] must be in 0 .. 1+max(prefix)
      mx := greatest(mx, r[i]);
    END LOOP;
    RETURN mx + 1 = (f).k::int;                                          -- exactly k blocks
  END $$;

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('set_partitions_into_k_blocks', 'set_partition');
INSERT INTO base_grade VALUES
  ('set_partitions_into_k_blocks', 1, 'n', NULL, NULL),
  ('set_partitions_into_k_blocks', 2, 'k', '1', 'g1');                     -- k ranges 1..n by default
SELECT base_realize('set_partitions_into_k_blocks');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('set_partitions_into_k_blocks','COUNT anchor: Stirling row S(4,k) for k=1..4','eq','1,7,6,1','cardinality per fiber = S(n,k) (accel)',$q$
    SELECT string_agg(cardinality(set_partitions_into_k_blocks(4,k))::text, ',' ORDER BY k) FROM generate_series(1,4) k $q$),
  ('set_partitions_into_k_blocks','row-sum over k = Bell(4) = 15','eq','15','the k RANGE handle sums fibers k=1..4',$q$
    SELECT cardinality(set_partitions_into_k_blocks(4))::text $q$),
  ('set_partitions_into_k_blocks','fiber [4,2] RGS listing in lex order','eq','0001,0010,0011,0100,0101,0110,0111','the realized floor for fiber [4,2], S(4,2)=7',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(set_partitions_into_k_blocks(4,2)) e $q$),
  ('set_partitions_into_k_blocks','fibers(set_partitions_into_k_blocks(4)) unfold to k = 1,2,3,4','eq','1,2,3,4','the second grade ranges 1..n',$q$
    SELECT string_agg((f).k::text, ',' ORDER BY (f).k) FROM fibers(set_partitions_into_k_blocks(4)) f $q$),
  ('set_partitions_into_k_blocks','multi-grade chain: fiber = (n,k) named axes','eq','4|2','unrank(...).fiber is (n=4,k=2)',$q$
    SELECT (unrank(set_partitions_into_k_blocks(4,2), 0)).fiber.n::text || '|' || (unrank(set_partitions_into_k_blocks(4,2), 0)).fiber.k::text $q$),
  ('set_partitions_into_k_blocks','every element of fiber [4,2] has exactly 2 blocks (max(rgs)+1 = 2)','eq','true','the defining invariant across the fiber',$q$
    SELECT bool_and((SELECT max(x) FROM unnest(((e).value).rgs) x) + 1 = 2)::text
      FROM elements(set_partitions_into_k_blocks(4,2)) e $q$),
  ('set_partitions_into_k_blocks','contains via <@: 0101 ∈ (4,2), 0000 ∉ (4,2), 0120 ∉ (4,2)','eq','true|false|false','generated from contains_in_fiber',$q$
    SELECT (ROW(ARRAY[0,1,0,1])::set_partition <@ set_partitions_into_k_blocks(4,2))::text || '|' ||
           (ROW(ARRAY[0,0,0,0])::set_partition <@ set_partitions_into_k_blocks(4,2))::text || '|' ||
           (ROW(ARRAY[0,1,2,0])::set_partition <@ set_partitions_into_k_blocks(4,2))::text $q$);
