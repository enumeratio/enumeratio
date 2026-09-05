-- requires: realizer, utilities, k_subsets
-- box_confined_partitions — the partitions fitting inside a `parts × max_part` box: at most `parts` parts, each at
-- most `max_part`. Over ALL sizes, so it's graded by the two box dimensions, not by n. The count is the binomial
-- C(parts+max_part, parts) — the Gaussian binomial [parts+max_part choose parts]_q evaluated at q=1; and grouping a
-- box by |λ| recovers the q-binomial's coefficients (a q-analog gem). Reuses the integer_partition carrier.
CREATE TYPE box_confined_partitions_fiber AS (parts natural_number, max_part natural_number);   -- box dimensions
CREATE FUNCTION fiber_elements(f box_confined_partitions_fiber, element_limit int) RETURNS SETOF integer_partition LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build(pp, last, len) AS (                        -- weakly-decreasing parts, each ≤ last (≤ max_part), ≤ parts of them
    SELECT ARRAY[]::int[], (f).max_part::int, 0
    UNION ALL
    SELECT pp || v, v, len + 1 FROM build, LATERAL generate_series(1, last) v WHERE len < (f).parts::int
  )
  SELECT ROW(pp)::integer_partition FROM build ORDER BY pp LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f box_confined_partitions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT binomial((f).parts::int + (f).max_part::int, (f).parts::int)::numeric $$;
CREATE FUNCTION contains_in_fiber(f box_confined_partitions_fiber, p integer_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((p).parts,1),0) <= (f).parts::int AND coalesce((p).parts[1], 0) <= (f).max_part::int $$;

INSERT INTO base_collection VALUES ('box_confined_partitions', 'integer_partition');
INSERT INTO base_grade VALUES ('box_confined_partitions', 1, 'parts', NULL, NULL), ('box_confined_partitions', 2, 'max_part', NULL, NULL);
CREATE FUNCTION fiber_symbol(f box_confined_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '[' || (f).parts::int || '×' || (f).max_part::int || ']' $$;

-- direct unrank: the floor's explicit "ORDER BY pp" is plain int[] ascending lex (a proper prefix sorts before
-- any of its extensions), which is a clean pre-order trie walk: at each node (rem parts left, next value ≤ last)
-- "stop here" sorts first, then each extension v=1..last (ascending) in turn, recursively. C(rem,last) = 1 (stop)
-- + Σ_{v=1}^{last} C(rem-1,v) counts the subtree; decoding against it reproduces that walk exactly.
CREATE FUNCTION box_confined_partition_unrank(parts int, max_part int, ord bigint) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE C numeric[]; rem int; last int; v int; s numeric; x numeric := ord; out int[] := '{}'; blk numeric; chosen boolean;
  BEGIN
    C := array_fill(0::numeric, ARRAY[parts+1, max_part+1]);    -- C[rem+1][last+1] = 1 + Σ_{v=1}^{last} C[rem-1][v]
    FOR last IN 0..max_part LOOP C[1][last+1] := 1; END LOOP;   -- rem=0: only the stop option
    FOR rem IN 1..parts LOOP
      C[rem+1][1] := 1;                                         -- last=0: only the stop option
      s := 0;
      FOR last IN 1..max_part LOOP
        s := s + C[rem][last+1];                                -- C[rem-1][last]
        C[rem+1][last+1] := 1 + s;
      END LOOP;
    END LOOP;
    rem := parts; last := max_part;
    LOOP
      EXIT WHEN rem = 0;                                        -- no room left; only the stop option remains
      IF x = 0 THEN EXIT; END IF;                                -- stop here: this prefix is the answer
      x := x - 1;
      chosen := false;
      FOR v IN 1..last LOOP
        blk := C[rem][v+1];                                     -- C[rem-1][v]
        IF x < blk THEN
          out := out || v; rem := rem - 1; last := v; chosen := true; EXIT;
        ELSE
          x := x - blk;
        END IF;
      END LOOP;
      EXIT WHEN NOT chosen;                                     -- defensive: shouldn't happen for a valid rank
    END LOOP;
    RETURN out;
  END $$;
CREATE FUNCTION fiber_unrank(f box_confined_partitions_fiber, rank rank_index) RETURNS integer_partition LANGUAGE sql IMMUTABLE AS $fu$
  SELECT ROW(box_confined_partition_unrank((f).parts::int, (f).max_part::int, rank::bigint))::integer_partition $fu$;
SELECT base_realize('box_confined_partitions');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('box_confined_partitions','count = C(parts+max, parts) — the Gaussian binomial at q=1','eq','10|20|15','boxes (2,3), (3,3), (2,4)',$q$
    SELECT cardinality(box_confined_partitions(2,3))::text || '|' || cardinality(box_confined_partitions(3,3))::text || '|' || cardinality(box_confined_partitions(2,4))::text $q$),
  ('box_confined_partitions','box(2,3) partitions, lex by part-array','eq','0,1,1+1,2,2+1,2+2,3,3+1,3+2,3+3','≤2 parts, each ≤3',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(box_confined_partitions(2,3)) e $q$),
  ('box_confined_partitions','THE GEM: grouping box(2,2) by |λ| gives the q-binomial [4 choose 2]_q coefficients','eq','1,1,2,1,1','1+q+2q²+q³+q⁴ — a Gaussian binomial coefficient',$q$
    SELECT string_agg(c::text, ',' ORDER BY s) FROM (
      SELECT coalesce((SELECT sum(x) FROM unnest(((e).value).parts) x), 0) s, count(*) c
      FROM elements(box_confined_partitions(2,2)) e GROUP BY 1) t $q$),
  ('box_confined_partitions','contains via <@: 3+1 ∈ box(2,3), 3+3+1 ∉ (3 parts), 4 ∉ box(2,3) (part > 3)','eq','true|false|false','≤parts parts, largest ≤max_part',$q$
    SELECT (ROW(ARRAY[3,1])::integer_partition <@ box_confined_partitions(2,3))::text || '|' ||
           (ROW(ARRAY[3,3,1])::integer_partition <@ box_confined_partitions(2,3))::text || '|' ||
           (ROW(ARRAY[4])::integer_partition <@ box_confined_partitions(2,3))::text $q$),
  ('box_confined_partitions','THREE FACES of [4 choose 2]_q: 2-subsets by sum ≡ box(2,2) by |λ| ≡ 1,1,2,1,1','eq','1,1,2,1,1|1,1,2,1,1','the q-binomial identity, realized on two collections (see docs/explorations)',$q$
    SELECT (SELECT string_agg(c::text, ',' ORDER BY s) FROM (   -- k-subsets of [4] by (sum − min sum 3)
              SELECT (SELECT sum(m) - 3 FROM unnest(((e).value).members) m) s, count(*) c
              FROM elements(k_subsets(4,2)) e GROUP BY 1) t)
        || '|' ||
           (SELECT string_agg(c::text, ',' ORDER BY s) FROM (   -- partitions in the 2×2 box by size
              SELECT coalesce((SELECT sum(x) FROM unnest(((e).value).parts) x), 0) s, count(*) c
              FROM elements(box_confined_partitions(2,2)) e GROUP BY 1) t) $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('box_confined_partitions','fiber_unrank(box_confined_partitions(2,3), 0..9) are all members (accel floor)','eq','true','trie-walk unrank lands inside box(2,3) (10 elements) for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(box_confined_partitions(2,3)) f), ord::rank_index) <@ box_confined_partitions(2,3))::text
      FROM generate_series(0, cardinality(box_confined_partitions(2,3))::int - 1) ord $q$);
