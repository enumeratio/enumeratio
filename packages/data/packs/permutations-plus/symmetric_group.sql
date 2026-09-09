-- requires: permutations, realizer, utilities
-- symmetric_group — the permutations carrier READ AS A GROUP: the same underlying set as `permutations`
-- (order-isomorphic — the r-th element of symmetric_group(n) IS the r-th permutation of size n, via the standard
-- cycle-decomposition bijection), but with the CANONICAL representation a group element wears — disjoint cycle
-- notation, e.g. permutation 231 (1↦2,2↦3,3↦1) ↦ (1 2 3) — rather than permutations' one-line word. #387: a
-- sibling collection BORROWING permutations' ranking through a bijection (mirrors lehmer_codes' second carrier,
-- sqlsrc/realizer.sql's "alternate structures are sibling collections borrowing rankings" design), not a copy of
-- the enumeration logic and not a `_suffix` restriction.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
-- flat encoding of the disjoint-cycle decomposition: cycles in increasing order of their minimal element, each
-- cycle listed starting at that minimum in image order, separated by a 0 sentinel (element values are 1..n, so 0
-- is unambiguous — same trick as lehmer_codes' implied trailing 0). Fixed points appear as singleton cycles, so
-- the encoding alone (no external n) determines the permutation.
CREATE TYPE permutation_cycles AS (cycles int[]);

-- the bijection permutation <-> permutation_cycles (borrowed ranking: order-iso BY CONSTRUCTION, since
-- fiber_unrank below transports permutations' own unrank through this map — see realizer.sql on is_order_iso).
CREATE FUNCTION to_cycles(p permutation) RETURNS permutation_cycles LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE img int[] := (p).image; n int := coalesce(array_length(img,1),0); visited boolean[] := array_fill(false, ARRAY[n]);
          out int[] := '{}'; i int; j int; first boolean := true;
  BEGIN
    FOR i IN 1..n LOOP                                        -- i unvisited ⇒ i is the MINIMUM of its cycle (any
      IF NOT visited[i] THEN                                  -- smaller cycle-mate would already have flagged it)
        IF NOT first THEN out := out || 0; END IF; first := false;
        j := i;
        LOOP visited[j] := true; out := out || j; j := img[j]; EXIT WHEN j = i; END LOOP;
      END IF;
    END LOOP;
    RETURN ROW(out)::permutation_cycles;
  END $$;
CREATE FUNCTION to_permutation(v permutation_cycles) RETURNS permutation LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE codes int[] := (v).cycles || 0; n int := (SELECT count(*) FROM unnest((v).cycles) e WHERE e <> 0);
          img int[] := array_fill(0, ARRAY[n]); cyc int[] := '{}'; x int; k int;
  BEGIN
    FOREACH x IN ARRAY codes LOOP                              -- trailing 0 (appended above) flushes the last cycle
      IF x = 0 THEN
        IF array_length(cyc,1) > 0 THEN
          FOR k IN 1..array_length(cyc,1) LOOP img[cyc[k]] := cyc[(k % array_length(cyc,1)) + 1]; END LOOP;
        END IF;
        cyc := '{}';
      ELSE cyc := cyc || x; END IF;
    END LOOP;
    RETURN ROW(img)::permutation;
  END $$;
CREATE FUNCTION notation(v permutation_cycles) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE codes int[] := (v).cycles || 0; cyc int[] := '{}'; out text := ''; x int;
  BEGIN
    FOREACH x IN ARRAY codes LOOP
      IF x = 0 THEN
        IF array_length(cyc,1) > 0 THEN out := out || '(' || array_to_string(cyc,' ') || ')'; END IF;
        cyc := '{}';
      ELSE cyc := cyc || x; END IF;
    END LOOP;
    RETURN coalesce(nullif(out,''), '()');                     -- n=0: the empty product, S₀'s sole (identity) element
  END $$;

-- ── the engines: BORROW permutations' lex ranking across the bijection ─────────────────────────────────
CREATE TYPE symmetric_group_fiber AS (size natural_number);   -- typed fiber; axis: size
CREATE FUNCTION fiber_elements(f symmetric_group_fiber, element_limit int) RETURNS SETOF permutation_cycles LANGUAGE sql STABLE AS $$
  SELECT to_cycles(permutation_unrank_lex((f).size::int, ord)) FROM generate_series(0, (factorial((f).size::int) - 1)::int) ord LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f symmetric_group_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$   -- same |Sₙ| = n! as permutations
  SELECT CASE WHEN (f).size::int <= 20 THEN factorial_bigint((f).size::int)::numeric ELSE factorial((f).size::int) END $$;
CREATE FUNCTION contains_in_fiber(f symmetric_group_fiber, v permutation_cycles) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT array_agg(x ORDER BY x) FROM unnest((v).cycles) x WHERE x <> 0), '{}'::int[])
       = ARRAY(SELECT generate_series(1, (f).size::int)) $$;    -- non-separator entries are exactly a permutation of [n]

CREATE FUNCTION fiber_symbol(f symmetric_group_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'S' || to_unicode_subscript((f).size) $$;   -- Sₙ, same symbol as permutations' fiber

-- direct unrank (capability layer 3): borrow permutations' unrank, transport through the bijection.
CREATE FUNCTION fiber_unrank(f symmetric_group_fiber, rank rank_index) RETURNS permutation_cycles LANGUAGE sql IMMUTABLE AS $fu$
  SELECT to_cycles(permutation_unrank_lex((f).size::int, rank)) $fu$;
INSERT INTO base_collection VALUES ('symmetric_group', 'permutation_cycles');
INSERT INTO base_grade VALUES ('symmetric_group', 1, 'size', NULL, NULL);
SELECT base_realize('symmetric_group');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('symmetric_group','notation: 231 (a 3-cycle) ↦ (1 2 3); 213 (one transposition + a fixed point) ↦ (1 2)(3)','eq','(1 2 3)|(1 2)(3)','to_cycles then notation',$q$
    SELECT notation(to_cycles(ROW(ARRAY[2,3,1])::permutation)) || '|' || notation(to_cycles(ROW(ARRAY[2,1,3])::permutation)) $q$),
  ('symmetric_group','identity of S₃ is three fixed points: (1)(2)(3)','eq','(1)(2)(3)','the identity permutation, in cycle notation',$q$
    SELECT notation((unrank(symmetric_group(3), 0)).value) $q$),
  ('symmetric_group','symmetric_group(3) in borrowed (permutations-lex) order','eq','(1)(2)(3),(1)(2 3),(1 2)(3),(1 2 3),(1 3 2),(1 3)(2)','one row per permutations(3) row, same order, cycle notation',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(symmetric_group(3)) e $q$),
  ('symmetric_group','same cardinality as permutations: |symmetric_group(4)| = 24 (accel, numeric)','eq','24','order-iso ⇒ same size',$q$
    SELECT cardinality(symmetric_group(4))::text $q$),
  ('symmetric_group','ORDER-ISO: to_permutation(r-th symmetric_group element) = r-th permutation, all r < 24','ok',NULL,'ranks correspond across the two carriers (n=4)',$q$
    DO $$ DECLARE r int; BEGIN
      FOR r IN 0..23 LOOP
        ASSERT to_permutation((unrank(symmetric_group(4), r)).value) = (unrank(permutations(4), r)).value, 'iso broke at rank '||r;
      END LOOP; END $$ $q$),
  ('symmetric_group','round-trip: to_cycles(to_permutation(v)) = v over all of symmetric_group(5)','eq','true','the bijection inverts cleanly',$q$
    SELECT bool_and(to_cycles(to_permutation((e).value)) = (e).value)::text FROM elements(symmetric_group(5)) e $q$),
  ('symmetric_group','round-trip the other way: to_permutation(to_cycles(p)) = p over all of permutations(5)','eq','true','and back',$q$
    SELECT bool_and(to_permutation(to_cycles((e).value)) = (e).value)::text FROM elements(permutations(5)) e $q$),
  ('symmetric_group','contains: (1 2)(3) ∈ symmetric_group(3), a malformed 4-cycle on 3 points ∉','eq','true|false','generated from contains_in_fiber',$q$
    SELECT contains(symmetric_group(3), ROW(ARRAY[1,2,0,3])::permutation_cycles)::text || '|' ||
           contains(symmetric_group(3), ROW(ARRAY[1,2,3,4])::permutation_cycles)::text $q$),
  ('symmetric_group','contains the identity of S₀ (the empty product, encoded as no cycles at all)','eq','true','symmetric_group(0)''s sole element',$q$
    SELECT contains(symmetric_group(0), (unrank(symmetric_group(0), 0::rank_index)).value)::text $q$),
  ('symmetric_group','accelerated unrank(handle,r) == the naive sequential scan, for every r','eq','true',
    'differential check: fiber_unrank must agree with elements()+OFFSET at every rank of symmetric_group(1,4)',$q$
    SELECT bool_and(
      unrank(symmetric_group(1,4), r) IS NOT DISTINCT FROM (
        SELECT e FROM elements(symmetric_group(1,4), least(r + 1, 2147483647)::int) e
         ORDER BY fiber_address((e).fiber), (e).rank OFFSET r LIMIT 1
      )
    )::text
    FROM generate_series(0, cardinality(symmetric_group(1,4))::int - 1) r $q$);
