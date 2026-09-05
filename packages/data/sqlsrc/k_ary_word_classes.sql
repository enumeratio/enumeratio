-- requires: words, realizer, utilities
-- The k-ary cyclic word classes, as lex-least representatives — RESTRICTIONS of `words` (carrier `word`, letters
-- 1..base, graded size×base). Generalise the binary_* collections to any alphabet; the base=2 slice agrees with
-- binary_necklaces/binary_bracelets/lyndon_words.
--   k_necklaces    — lex-least under rotation             — (1/n)·Σ_{d|n} φ(d)·baseⁿ/ᵈ
--   k_bracelets    — lex-least under rotation+reflection  — dihedral orbits
--   k_lyndon_words — aperiodic + lex-least (strict)       — (1/n)·Σ_{d|n} μ(d)·baseⁿ/ᵈ
CREATE FUNCTION is_word_necklace(w word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM generate_series(1, coalesce(array_length((w).letters,1),0) - 1) d
                     WHERE ((w).letters[d+1:] || (w).letters[1:d]) < (w).letters) $$;
CREATE FUNCTION is_word_lyndon(w word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM generate_series(1, coalesce(array_length((w).letters,1),0) - 1) d
                     WHERE ((w).letters[d+1:] || (w).letters[1:d]) <= (w).letters) $$;
CREATE FUNCTION is_word_bracelet(w word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  WITH r AS (SELECT (SELECT array_agg(x ORDER BY o DESC) FROM unnest((w).letters) WITH ORDINALITY t(x,o)) AS rev,
                    coalesce(array_length((w).letters,1),0) AS n)
  SELECT is_word_necklace(w)
     AND NOT EXISTS (SELECT 1 FROM r, generate_series(0, r.n - 1) d WHERE (r.rev[d+1:] || r.rev[1:d]) < (w).letters) $$;

SELECT base_restrict('k_necklaces', 'words', 'is_word_necklace');
SELECT base_restrict('k_bracelets', 'words', 'is_word_bracelet');
SELECT base_restrict('k_lyndon_words', 'words', 'is_word_lyndon');

CREATE FUNCTION fiber_symbol(f k_necklaces_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Neck(' || (f).size::int || ',' || (f).base::int || ')' $$;
CREATE FUNCTION fiber_symbol(f k_bracelets_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Brace(' || (f).size::int || ',' || (f).base::int || ')' $$;
CREATE FUNCTION fiber_symbol(f k_lyndon_words_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Lyn(' || (f).size::int || ',' || (f).base::int || ')' $$;
SELECT wire_set_notation('k_necklaces');
SELECT wire_set_notation('k_bracelets');
SELECT wire_set_notation('k_lyndon_words');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('k_ary_word_classes','ternary necklaces/bracelets/lyndon of length 4 over 3 letters: 24, 21, 18','eq','24|21|18','(size=4, base=3)',$q$
    SELECT cardinality(k_necklaces(4,3))::text || '|' || cardinality(k_bracelets(4,3))::text || '|' || cardinality(k_lyndon_words(4,3))::text $q$),
  ('k_ary_word_classes','the base=2 slice agrees with the dedicated binary collections','eq','true|true|true','k_necklaces(5,2)=binary_necklaces(5), etc.',$q$
    SELECT (cardinality(k_necklaces(5,2)) = cardinality(binary_necklaces(5)))::text || '|' ||
           (cardinality(k_bracelets(5,2)) = cardinality(binary_bracelets(5)))::text || '|' ||
           (cardinality(k_lyndon_words(5,2)) = cardinality(lyndon_words(5)))::text $q$),
  ('k_ary_word_classes','k_lyndon_words(3,3) = the 8 ternary Lyndon words of length 3','eq','1,1,2|1,1,3|1,2,2|1,2,3|1,3,2|1,3,3|2,2,3|2,3,3','strictly less than every rotation',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY ordinality(e)) FROM elements(k_lyndon_words(3,3)) e $q$);

-- per-collection living examples (suite = the collection id, so each row's collection is tagged) ──────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('k_necklaces','ternary necklaces of length 4: 24 rotation orbits; 1122 is a necklace, 1211 is not (rotates to 1112)','eq','24|true|false','lex-least under rotation; A001867(3,4)',$q$
    SELECT cardinality(k_necklaces(4,3))::text || '|' ||
           (ROW(ARRAY[1,1,2,2])::word <@ k_necklaces(4,3))::text || '|' ||
           (ROW(ARRAY[1,2,1,1])::word <@ k_necklaces(4,3))::text $q$),
  ('k_bracelets','ternary bracelets of length 4: 21 dihedral orbits; 1213 is lex-least under rotation+reflection','eq','21|true','rotation + reflection',$q$
    SELECT cardinality(k_bracelets(4,3))::text || '|' ||
           (ROW(ARRAY[1,2,1,3])::word <@ k_bracelets(4,3))::text $q$),
  ('k_lyndon_words','ternary Lyndon words of length 4: 18 aperiodic classes; 1123 is Lyndon, 1212 is not (periodic)','eq','18|true|false','aperiodic + strictly lex-least; A027376',$q$
    SELECT cardinality(k_lyndon_words(4,3))::text || '|' ||
           (ROW(ARRAY[1,1,2,3])::word <@ k_lyndon_words(4,3))::text || '|' ||
           (ROW(ARRAY[1,2,1,2])::word <@ k_lyndon_words(4,2))::text $q$);
