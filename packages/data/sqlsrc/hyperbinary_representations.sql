-- requires: stern_diatomic_sequence, realizer
-- hyperbinary_representations — the (generally NON-UNIQUE) base-2 expansions of n over the WIDENED digit alphabet
-- {0,1,2}: digit words d (most-significant-first) with Σ dᵢ·2^i = n. A standard binary numeral allows only {0,1};
-- admitting a 2 lets an integer have several valid numerals (each a different way to "carry" against the same
-- residue). |hyperbinary_representations(n)| = fusc(n+1) = Stern's diatomic sequence [[OEIS:A002487]] (1,1,2,1,3,…
-- for n=0,1,2,…); consecutive counts s(n)/s(n+1) list every positive rational once (the Calkin–Wilf enumeration).
-- This is ONLY the b=2, k=1 INSTANCE of the numbers `hypernumerary` family. The general parameterized
-- (b,k)/mixed-radix family (+ the carries / numeral-plot presentation) is NOT ported here — it needs the bindable
-- family-parameter constructor tier (#67) and is tracked as #86; multicomplex is deferred as #87. Grade [n] = the
-- integer being represented.
--
-- Fiber [n] = the hyperbinary numerals of n, each padded to the canonical width W(n) = bit-length of n (the widest
-- numeral, its standard binary expansion). Canonical order = lexicographic on the LSB-first digit array — the DFS
-- order the remainder recursion emits (n=4 ⇒ 100, 020, 012).

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE hyperbinary_word AS (digits int[]);                       -- MSB-first digits over {0,1,2}
CREATE FUNCTION notation(w hyperbinary_word) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_to_string((w).digits, ''), '') $$;            -- digits ≤ 2 ⇒ no separator needed

-- ── the FLOOR: remainder DP over places (LSB-first). At place value 2^i pick a digit d ≡ rem (mod 2), 0 ≤ d ≤ 2,
-- d ≤ rem, then recurse on (rem−d)/2; a numeral terminates the instant rem hits 0 (higher digits are all 0).
-- Words are built LSB-first, padded to the common width W, then reversed to MSB-first for the carrier. ──────────
CREATE TYPE hyperbinary_representations_fiber AS (n natural_number);   -- typed fiber; axis: n (the integer)
CREATE FUNCTION fiber_elements(f hyperbinary_representations_fiber, element_limit int) RETURNS SETOF hyperbinary_word LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(lsb, rem) AS (
      SELECT ARRAY[]::int[], (f).n::int
    UNION ALL
      SELECT g.lsb || d, (g.rem - d) / 2
        FROM gen g, generate_series(g.rem % 2, least(2, g.rem), 2) AS d   -- d ≡ rem (mod 2), 0..min(2,rem)
       WHERE g.rem > 0
  ),
  done AS (SELECT lsb FROM gen WHERE rem = 0),                            -- terminated numerals (LSB-first)
  w AS (SELECT greatest(1, coalesce(max(array_length(lsb, 1)), 0)) AS width FROM done)
  SELECT ROW(ARRAY(SELECT coalesce(d.lsb[i], 0)                           -- reverse LSB→MSB, padding with 0
                     FROM generate_series((SELECT width FROM w), 1, -1) AS i))::hyperbinary_word
    FROM done d
   ORDER BY ARRAY(SELECT coalesce(d.lsb[i], 0)                            -- lex on the padded LSB-first array
                    FROM generate_series(1, (SELECT width FROM w)) AS i)
   LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f hyperbinary_representations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT stern_term((f).n::int + 1) $$;                                  -- fusc(n+1), Stern's diatomic
CREATE FUNCTION contains_in_fiber(f hyperbinary_representations_fiber, v hyperbinary_word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT bool_and(x BETWEEN 0 AND 2) FROM unnest((v).digits) x), false)   -- digits in {0,1,2}
     AND array_length((v).digits, 1) =                                                     -- canonical width W(n)
         greatest(1, (SELECT count(*)::int FROM generate_series(0, 62) k WHERE ((f).n::bigint >> k) > 0))
     AND (SELECT coalesce(sum(x::bigint * (2::bigint ^ (array_length((v).digits,1) - i))::bigint), 0)   -- MSB value
            FROM unnest((v).digits) WITH ORDINALITY AS t(x, i)) = (f).n::bigint $$;

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('hyperbinary_representations', 'hyperbinary_word');
INSERT INTO base_grade VALUES ('hyperbinary_representations', 1, 'n', NULL, NULL);
SELECT base_realize('hyperbinary_representations');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('hyperbinary_representations','the 3 hyperbinary numerals of 4','eq','100,020,012','the realized floor for fiber [4] (anchor: numbers/src)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(hyperbinary_representations(4)) e $q$),
  ('hyperbinary_representations','cardinality anchor is fusc(n+1) — Stern''s diatomic, n=0..8','eq','1,1,2,1,3,2,3,1,4','A002487 shifted (accel)',$q$
    SELECT string_agg(cardinality(hyperbinary_representations(n))::text, ',' ORDER BY n) FROM generate_series(0,8) n $q$),
  ('hyperbinary_representations','hyperbinary count of 8 = fusc(9) = 4','eq','4','anchor: numbers/src',$q$
    SELECT cardinality(hyperbinary_representations(8))::text $q$),
  ('hyperbinary_representations','the hyperbinary numerals of 6','eq','110,102,022','fiber [6], fusc(7)=3',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(hyperbinary_representations(6)) e $q$),
  ('hyperbinary_representations','every numeral of 6 evaluates back to 6 (Σ dᵢ·2^i)','eq','true','the defining invariant across the fiber',$q$
    SELECT bool_and(
        (SELECT coalesce(sum(x::bigint * (2::bigint ^ (array_length(((e).value).digits,1) - i))::bigint), 0)
           FROM unnest(((e).value).digits) WITH ORDINALITY AS t(x, i)) = 6)::text
      FROM elements(hyperbinary_representations(6)) e $q$),
  ('hyperbinary_representations','element carries a TYPED point fiber + ordinality','eq','4|1','unrank(hyperbinary_representations(4),1)',$q$
    SELECT (unrank(hyperbinary_representations(4), 1)).fiber.n::text || '|' || ordinality(unrank(hyperbinary_representations(4), 1))::text $q$),
  ('hyperbinary_representations','n RANGE: cardinality(hyperbinary_representations(0,8)) sums fusc(1..9)','eq','18','1+1+2+1+3+2+3+1+4',$q$
    SELECT cardinality(hyperbinary_representations(0,8))::text $q$),
  ('hyperbinary_representations','fibers(hyperbinary_representations(0,3)) unfold to n = 0,1,2,3','eq','0,1,2,3','the single grade ranges',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(hyperbinary_representations(0,3)) f $q$),
  ('hyperbinary_representations','contains via <@: 100 ∈ (4), 020 ∈ (4), 012 ∈ (4), 101 ∉ (4) [value 5], 10 ∈ (2), 30 ∉ (digit 3)','eq','true|true|true|false|true|false','generated from contains_in_fiber (012 = 0·4+1·2+2·1 = 4, a member)',$q$
    SELECT (ROW(ARRAY[1,0,0])::hyperbinary_word <@ hyperbinary_representations(4))::text || '|' ||
           (ROW(ARRAY[0,2,0])::hyperbinary_word <@ hyperbinary_representations(4))::text || '|' ||
           (ROW(ARRAY[0,1,2])::hyperbinary_word <@ hyperbinary_representations(4))::text || '|' ||
           (ROW(ARRAY[1,0,1])::hyperbinary_word <@ hyperbinary_representations(4))::text || '|' ||
           (ROW(ARRAY[1,0])::hyperbinary_word   <@ hyperbinary_representations(2))::text || '|' ||
           (ROW(ARRAY[3,0])::hyperbinary_word   <@ hyperbinary_representations(6))::text $q$);
