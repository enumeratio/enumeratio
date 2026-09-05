-- requires: realizer
-- hypernumerary — the GENERAL widened-alphabet base-b numeral family: base-b digit words d (MSB-first) over the
-- widened alphabet {0,1,…,b−1+k} with Σ dᵢ·bⁱ = n. Standard base-b numerals use only {0..b−1}; admitting k extra
-- top digits lets an integer have several valid numerals (each a different way to "carry" against the same
-- residue). hyperbinary_representations is exactly the b=2,k=1 INSTANCE of this family (asserted below
-- element-for-element, not just by count) — #86, generalizing #argument order matches that file's grade: b, then
-- k, then n. Requires b ≥ 2 (unenforced at the type level, same as other collections' implicit preconditions).
--
-- Fiber [b,k,n] = the hypernumerary numerals of n in base b widened by k, each padded to the canonical width
-- W_b(n) = the standard base-b digit count of n (the widest numeral). Canonical order = lexicographic on the
-- padded LSB-first digit array — the DFS order the remainder recursion emits, same convention as
-- hyperbinary_representations.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE hypernumerary_word AS (digits int[]);                     -- MSB-first digits over {0,…,b−1+k}
CREATE FUNCTION notation(w hypernumerary_word) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN EXISTS (SELECT 1 FROM unnest((w).digits) x WHERE x >= 10)
              THEN coalesce(array_to_string((w).digits, '-'), '')     -- digits ≥ 10 need a separator
              ELSE coalesce(array_to_string((w).digits, ''), '') END $$;

-- ── the FLOOR: remainder DP over places (LSB-first), generalizing hyperbinary_representations' b=2,k=1 recursion.
-- At place value bⁱ pick a digit d ≡ rem (mod b), 0 ≤ d ≤ min(b−1+k, rem), then recurse on (rem−d)/b; a numeral
-- terminates the instant rem hits 0. Words are built LSB-first, padded to the common width W, then reversed to
-- MSB-first for the carrier. ──────────────────────────────────────────────────────────────────────────────────
CREATE TYPE hypernumerary_fiber AS (b natural_number, k natural_number, n natural_number);   -- axes: b, k, n
CREATE FUNCTION fiber_elements(f hypernumerary_fiber, element_limit int) RETURNS SETOF hypernumerary_word LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(lsb, rem) AS (
      SELECT ARRAY[]::int[], (f).n::int
    UNION ALL
      SELECT g.lsb || d, (g.rem - d) / (f).b::int
        FROM gen g, generate_series(g.rem % (f).b::int, least((f).b::int - 1 + (f).k::int, g.rem), (f).b::int) AS d
       WHERE g.rem > 0
  ),
  done AS (SELECT lsb FROM gen WHERE rem = 0),                            -- terminated numerals (LSB-first)
  w AS (SELECT greatest(1, coalesce(max(array_length(lsb, 1)), 0)) AS width FROM done)
  SELECT ROW(ARRAY(SELECT coalesce(d.lsb[i], 0)                           -- reverse LSB→MSB, padding with 0
                     FROM generate_series((SELECT width FROM w), 1, -1) AS i))::hypernumerary_word
    FROM done d
   ORDER BY ARRAY(SELECT coalesce(d.lsb[i], 0)                            -- lex on the padded LSB-first array
                    FROM generate_series(1, (SELECT width FROM w)) AS i)
   LIMIT element_limit $$;

-- fiber_count — an INDEPENDENT path-counting DP, not a naive count(*) of the floor: cnt(rem) = Σ over valid d of
-- cnt((rem−d)/b), cnt(0)=1. Every transition strictly shrinks rem (⌊rem/b⌋ < rem for b≥2), so a plain BFS closure
-- over the reachable remainders terminates and gives a valid bottom-up (ascending-rem) evaluation order — the
-- distinct-rem set stays small (the same bound that keeps hyperbinary's fusc recursion cheap).
CREATE FUNCTION fiber_count(f hypernumerary_fiber) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $fc$
  DECLARE
    b bigint := (f).b::bigint; k bigint := (f).k::bigint; n bigint := (f).n::bigint;
    dmax bigint; d bigint; rem bigint; nxt bigint; total numeric; i int; pos int;
    seen bigint[] := ARRAY[]::bigint[];
    cnts numeric[] := ARRAY[]::numeric[];
    frontier bigint[] := ARRAY[n];
  BEGIN
    WHILE array_length(frontier, 1) > 0 LOOP                              -- BFS: discover every reachable remainder
      rem := frontier[1];
      frontier := frontier[2:array_length(frontier, 1)];
      IF rem = ANY(seen) THEN CONTINUE; END IF;
      seen := seen || rem;
      IF rem > 0 THEN
        dmax := least(b - 1 + k, rem);
        d := rem % b;
        WHILE d <= dmax LOOP
          nxt := (rem - d) / b;
          IF NOT (nxt = ANY(seen)) AND NOT (nxt = ANY(frontier)) THEN frontier := frontier || nxt; END IF;
          d := d + b;
        END LOOP;
      END IF;
    END LOOP;
    seen := ARRAY(SELECT unnest(seen) ORDER BY 1);                        -- ascending = a valid topological order
    cnts := array_fill(0::numeric, ARRAY[array_length(seen, 1)]);
    FOR i IN 1..array_length(seen, 1) LOOP
      rem := seen[i];
      IF rem = 0 THEN
        cnts[i] := 1;
      ELSE
        dmax := least(b - 1 + k, rem);
        d := rem % b;
        total := 0;
        WHILE d <= dmax LOOP
          nxt := (rem - d) / b;
          pos := array_position(seen, nxt);                              -- already computed: nxt < rem always
          total := total + cnts[pos];
          d := d + b;
        END LOOP;
        cnts[i] := total;
      END IF;
    END LOOP;
    RETURN cnts[array_position(seen, n)];
  END $fc$;

CREATE FUNCTION contains_in_fiber(f hypernumerary_fiber, v hypernumerary_word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT bool_and(x BETWEEN 0 AND (f).b::int - 1 + (f).k::int) FROM unnest((v).digits) x), false)
     AND array_length((v).digits, 1) =                                                       -- canonical width W_b(n)
         greatest(1, (SELECT count(*)::int FROM generate_series(0, 80) e WHERE ((f).b::numeric ^ e) <= (f).n::numeric))
     AND (SELECT coalesce(sum(x::numeric * ((f).b::numeric ^ (array_length((v).digits, 1) - i))), 0)   -- MSB value
            FROM unnest((v).digits) WITH ORDINALITY AS t(x, i)) = (f).n::numeric $$;

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('hypernumerary', 'hypernumerary_word');
INSERT INTO base_grade VALUES
  ('hypernumerary', 1, 'b', NULL, NULL),   -- the base
  ('hypernumerary', 2, 'k', NULL, NULL),   -- the widening (extra top digits)
  ('hypernumerary', 3, 'n', NULL, NULL);   -- the integer being represented
CREATE FUNCTION fiber_symbol(f hypernumerary_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'HN[' || (f).b::int || ',' || (f).k::int || '](' || (f).n::int || ')' $$;
SELECT base_realize('hypernumerary');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
-- the b=2,k=1 == hyperbinary_representations cross-check lives in packs/number-sets/examples.hypernumerary.sql
-- (hyperbinary_representations is a number-sets collection; core can't assert against it).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('hypernumerary','hypernumerary(3,1,3) = {10,03}; hypernumerary(3,1,4) = {11}','eq','10,03|11','worked by hand: alphabet {0,1,2,3}, Σdᵢ3ⁱ=n (3 = 1·3+0 = 0·3+3)',$q$
    SELECT (SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(hypernumerary(3,1,3)) e) || '|' ||
           (SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(hypernumerary(3,1,4)) e) $q$),
  ('hypernumerary','hypernumerary(2,2,2) = {10,02}','eq','10,02','worked by hand: alphabet {0,1,2,3} (base 2 widened by k=2), 2 = 1·2+0 = 0·2+2',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(hypernumerary(2,2,2)) e $q$),
  ('hypernumerary','floor count == accel cardinality at (b,k,n)=(3,1,7), independently derived','eq','true','count(*) of the floor enumeration equals the path-counting DP',$q$
    SELECT ((SELECT count(*) FROM elements(hypernumerary(3,1,7))) = cardinality(hypernumerary(3,1,7)))::text $q$),
  ('hypernumerary','every numeral of hypernumerary(2,2,5) evaluates back to 5 (Σdᵢ·2ⁱ)','eq','true','the defining invariant across the fiber',$q$
    SELECT bool_and(
        (SELECT coalesce(sum(x::numeric * (2::numeric ^ (array_length(((e).value).digits,1) - i))), 0)
           FROM unnest(((e).value).digits) WITH ORDINALITY AS t(x, i)) = 5)::text
      FROM elements(hypernumerary(2,2,5)) e $q$),
  ('hypernumerary','contains via <@: 10 ∈ (3,1,3), 03 ∈ (3,1,3), digit 4 ∉ (3,1,12) even though its value matches','eq','true|true|false','generated from contains_in_fiber — the last case fails the digit-range check (4 > b−1+k = 3), not the value check',$q$
    SELECT (ROW(ARRAY[1,0])::hypernumerary_word <@ hypernumerary(3,1,3))::text || '|' ||
           (ROW(ARRAY[0,3])::hypernumerary_word <@ hypernumerary(3,1,3))::text || '|' ||
           (ROW(ARRAY[4,0])::hypernumerary_word <@ hypernumerary(3,1,12))::text $q$);
