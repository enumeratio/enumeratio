-- requires: binary_words, number-theory, realizer, utilities
-- Cyclic-symmetry classes of binary words, each realized by its canonical (lex-least) representative — so they're
-- RESTRICTIONS of binary_words, not quotient engines:
--   binary_necklaces  — lex-least under ROTATION            — A000031: 2,3,4,6,8,14,20,…  (Cₙ orbits)
--   binary_bracelets  — lex-least under ROTATION+REFLECTION — A000029: 2,3,4,6,8,13,18,…  (dihedral Dₙ orbits)
-- Reflection here means REVERSAL (the word read backwards), not bit-complement — bracelets are the orbits under the
-- dihedral group (rotate + flip). A chiral necklace (whose reversal lands on a DIFFERENT, smaller necklace) is not a
-- bracelet rep; a palindromic/achiral one is its own reflection and stays.
-- Lyndon words are the *aperiodic* necklaces (strict <); necklaces allow the periodic ones (≤).
CREATE FUNCTION is_binary_necklace(w binary_word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM generate_series(1, coalesce(array_length((w).bits,1),0) - 1) d
                     WHERE ((w).bits[d+1:] || (w).bits[1:d]) < (w).bits) $$;   -- some rotation strictly precedes w

CREATE FUNCTION is_binary_bracelet(w binary_word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  WITH r AS (SELECT (SELECT array_agg(b ORDER BY o DESC) FROM unnest((w).bits) WITH ORDINALITY t(b, o)) AS rev,
                    coalesce(array_length((w).bits, 1), 0) AS n)
  SELECT is_binary_necklace(w)
     AND NOT EXISTS (SELECT 1 FROM r, generate_series(0, r.n - 1) d
                     WHERE (r.rev[d+1:] || r.rev[1:d]) < (w).bits) $$;           -- …nor any rotation of the reflection

-- accel hooks (#172):
--   necklaces (rotation only): |N(n)| = (1/n)Σ_{d|n} φ(d)·2^(n/d), n≥1; n=0 is the vacuous empty word.
--   bracelets (rotation+reflection, k=2): the standard dihedral-orbit-counting split on parity —
--     n even: B(n) = N(n)/2 + (3/4)·2^(n/2);  n odd: B(n) = N(n)/2 + (1/2)·2^((n+1)/2);  B(0) = 1.
--   Both divisions are exact (div(), not /, to avoid decimal-scale drift); verified against the file's own
--   anchor sequences (A000031, A000029) for n=1..7 before landing.
CREATE FUNCTION binary_necklace_count(f binary_words_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).n::int = 0 THEN 1::numeric ELSE
    div((SELECT sum(euler_phi(d) * pow_int(2, (f).n::int / d)) FROM generate_series(1, (f).n::int) d WHERE (f).n::int % d = 0), (f).n::int)
  END $$;
CREATE FUNCTION binary_bracelet_count(f binary_words_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN (f).n::int = 0 THEN 1::numeric
    WHEN (f).n::int % 2 = 0 THEN div(2 * binary_necklace_count(f) + 3 * pow_int(2, (f).n::int / 2), 4)
    ELSE div(binary_necklace_count(f) + pow_int(2, ((f).n::int + 1) / 2), 2)
  END $$;

SELECT base_restrict('binary_necklaces', 'binary_words', 'is_binary_necklace', count_fn => 'binary_necklace_count');
SELECT base_restrict('binary_bracelets', 'binary_words', 'is_binary_bracelet', count_fn => 'binary_bracelet_count');

CREATE FUNCTION fiber_symbol(f binary_necklaces_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Neck₂(' || (f).n::int || ')' $$;
CREATE FUNCTION fiber_symbol(f binary_bracelets_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Brace₂(' || (f).n::int || ')' $$;
SELECT wire_set_notation('binary_necklaces');
SELECT wire_set_notation('binary_bracelets');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('binary_necklaces','count = A000031 (binary necklaces) for n=1..7','eq','2,3,4,6,8,14,20','rotation orbits, lex-least reps',$q$
    SELECT string_agg(cardinality(binary_necklaces(n))::text, ',' ORDER BY n) FROM generate_series(1,7) n $q$),
  ('binary_necklaces','binary_necklaces(4) = the 6 rotation reps','eq','0000,0001,0011,0101,0111,1111','one per rotation class of length 4',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(binary_necklaces(4)) e $q$),
  ('binary_bracelets','count = A000029 (binary bracelets) for n=1..7','eq','2,3,4,6,8,13,18','rotation+reflection orbits; first differs from necklaces at n=6',$q$
    SELECT string_agg(cardinality(binary_bracelets(n))::text, ',' ORDER BY n) FROM generate_series(1,7) n $q$),
  ('binary_bracelets','at n=6 the chiral necklace 001101 ∈ necklaces but ∉ bracelets','eq','true|false','reflection = reversal: reverse(001101)=101100, whose min-rotation necklace rep 001011 is lex-smaller, so it wins the bracelet',$q$
    SELECT (ROW(ARRAY[0,0,1,1,0,1])::binary_word <@ binary_necklaces(6))::text || '|' ||
           (ROW(ARRAY[0,0,1,1,0,1])::binary_word <@ binary_bracelets(6))::text $q$),
  ('binary_bracelets','|bracelets(n)| ≤ |necklaces(n)| for n=1..10 — the dihedral group only ever coarsens the rotation-only orbits','eq','true','a structural cross-check, not a re-assertion of either count sequence',$q$
    SELECT bool_and(cardinality(binary_bracelets(n)) <= cardinality(binary_necklaces(n))) FROM generate_series(1,10) n $q$),
  ('binary_bracelets','every binary_bracelets(6) element is also a binary_necklaces(6) element — bracelet reps are a subset of necklace reps','eq','true','the reflection constraint only removes representatives, never adds one',$q$
    SELECT bool_and((e).value <@ binary_necklaces(6)) FROM elements(binary_bracelets(6)) e $q$);
