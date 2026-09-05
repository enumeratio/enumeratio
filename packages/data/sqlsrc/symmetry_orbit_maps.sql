-- requires: words, k_ary_word_classes, realizer, utilities
-- Issue #233, chunk 1 — the orbit MAPS behind the k_ary necklace/bracelet restrictions (k_ary_word_classes.sql):
-- canonical_rotation sends a word to the lex-least word in its rotation class (the necklace representative);
-- canonical_dihedral additionally quotients by reversal (the bracelet representative). Both are IDEMPOTENT
-- (applying to an already-canonical word is a no-op) and carrier-scoped, so they inherit onto every `word`-carrier
-- collection (words, k_necklaces, k_bracelets, k_lyndon_words) via base_map_resolved. period/orbit_size are the
-- companion stats: period IS the rotation orbit's size (orbit-stabilizer: n rotations, stabilizer of size n/period
-- fixes w, so |orbit| = n / (n/period) = period); orbit_size = n/period is the complementary count — how many
-- copies of that minimal period-block tile the word (w = u^(n/period) for the primitive block u) — 1 exactly on
-- the aperiodic (Lyndon) words, since there the whole word IS the primitive block, occurring once. With these,
-- `GROUP BY canonical_rotation(w)` over words(n,b) IS Pólya's orbit-counting theorem made into a plain query (see
-- the orbit-count identity example).

-- ── maps ─────────────────────────────────────────────────────────────────────────────────────────────────
-- lex-least rotation: scan all n rotations (n ≤ ~12 fine; Booth's algorithm would make this O(n), not needed yet).
CREATE FUNCTION word_canonical_rotation(w word) RETURNS word LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(letters)::word FROM (
    SELECT (w).letters AS letters
    UNION ALL
    SELECT (w).letters[d+1:] || (w).letters[1:d]
      FROM generate_series(1, coalesce(array_length((w).letters,1),0) - 1) d
  ) rotations
  ORDER BY letters LIMIT 1 $$;

-- lex-least under rotation+reversal (the dihedral/bracelet quotient) — same scan, plus every rotation of the
-- reversed word (mirrors is_word_bracelet's reflection set in k_ary_word_classes.sql).
CREATE FUNCTION word_canonical_dihedral(w word) RETURNS word LANGUAGE sql IMMUTABLE AS $$
  WITH r AS (SELECT (SELECT array_agg(x ORDER BY o DESC) FROM unnest((w).letters) WITH ORDINALITY t(x,o)) AS rev,
                    coalesce(array_length((w).letters,1),0) AS n)
  SELECT ROW(letters)::word FROM (
    SELECT (w).letters AS letters
    UNION ALL SELECT (w).letters[d+1:] || (w).letters[1:d] FROM generate_series(1, (SELECT n FROM r) - 1) d
    UNION ALL SELECT r.rev FROM r
    UNION ALL SELECT r.rev[d+1:] || r.rev[1:d] FROM r, generate_series(1, r.n - 1) d
  ) all_rotations
  ORDER BY letters LIMIT 1 $$;

-- period: the smallest p such that rotating w by p returns w itself. For a word invariant under rotation-by-p,
-- gcd(p,n) is also a period, so the minimal period always divides n — the scan below only checks divisors of n.
-- n=0 (the empty word) is a vacuous special case, set to 0 (matching words.stats.sql's "every stat is 0" edge).
CREATE FUNCTION word_period(w word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN coalesce(array_length((w).letters,1),0) = 0 THEN 0 ELSE
    (SELECT min(d) FROM generate_series(1, array_length((w).letters,1)) d
      WHERE array_length((w).letters,1) % d = 0
        AND ((w).letters[d+1:] || (w).letters[1:d]) = (w).letters)
  END $$;
-- orbit_size: n / period — the repetition count (how many copies of the minimal period-block tile the word);
-- n for a constant word (the length-1 block repeats n times), 1 for an aperiodic/Lyndon word (no repetition).
CREATE FUNCTION word_orbit_size(w word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN coalesce(array_length((w).letters,1),0) = 0 THEN 0
              ELSE array_length((w).letters,1) / word_period(w) END $$;

-- ── register ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('words','canonical_rotation','word_canonical_rotation','k_necklaces','Canonical rotation (necklace representative)',NULL),
  ('words','canonical_dihedral','word_canonical_dihedral','k_bracelets','Canonical rotation+reflection (bracelet representative)',NULL);
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('words','period','word_period','Rotation period (= the rotation orbit size)','natural_numbers'),
  ('words','orbit_size','word_orbit_size','Period-block repetition count (n / period)','natural_numbers');

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('words','canonical_rotation is idempotent and lands in k_necklaces, over words(4,3)','eq','true',
   'canonical_rotation(canonical_rotation(w)) = canonical_rotation(w), and the image satisfies is_word_necklace',$q$
    SELECT bool_and(
      word_canonical_rotation(word_canonical_rotation((e).value)) = word_canonical_rotation((e).value)
      AND is_word_necklace(word_canonical_rotation((e).value))
    )::text FROM elements(words(4,3)) e $q$),
  ('words','canonical_dihedral is idempotent and lands in k_bracelets, over words(4,3)','eq','true',
   'canonical_dihedral(canonical_dihedral(w)) = canonical_dihedral(w), and the image satisfies is_word_bracelet',$q$
    SELECT bool_and(
      word_canonical_dihedral(word_canonical_dihedral((e).value)) = word_canonical_dihedral((e).value)
      AND is_word_bracelet(word_canonical_dihedral((e).value))
    )::text FROM elements(words(4,3)) e $q$),
  ('words','the chiral necklace 001101 (letters 1,1,2,2,1,2) rotates to itself but dihedral-canonicalizes to 001011',
   'eq','1,1,2,2,1,2|1,1,2,1,2,2','canonical_rotation is a no-op (already the necklace rep); canonical_dihedral finds the smaller reflected rotation',$q$
    SELECT notation(word_canonical_rotation(ROW(ARRAY[1,1,2,2,1,2])::word)) || '|' ||
           notation(word_canonical_dihedral(ROW(ARRAY[1,1,2,2,1,2])::word)) $q$),
  ('words','period/orbit_size: 1,1,1 (period 1, orbit 3), 1,2,1,2 (period 2, orbit 2), 1,2,3 (period 3, orbit 1)',
   'eq','1,3|2,2|3,1','constant word, half-period word, aperiodic word',$q$
    SELECT word_period(ROW(ARRAY[1,1,1])::word)::text || ',' || word_orbit_size(ROW(ARRAY[1,1,1])::word)::text || '|' ||
           word_period(ROW(ARRAY[1,2,1,2])::word)::text || ',' || word_orbit_size(ROW(ARRAY[1,2,1,2])::word)::text || '|' ||
           word_period(ROW(ARRAY[1,2,3])::word)::text || ',' || word_orbit_size(ROW(ARRAY[1,2,3])::word)::text $q$),
  ('words','Lyndon = aperiodic: period(w) = n (and orbit_size(w) = 1) for every w in k_lyndon_words(n,b), n=1..6, b=1..3','eq','true',
   'a Lyndon word has no proper rotation symmetry, so its rotation orbit has full size n and the block repeats once',$q$
    SELECT bool_and(
      (SELECT bool_and(word_period((e).value) = n AND word_orbit_size((e).value) = 1) FROM elements(k_lyndon_words(n,b)) e)
    )::text FROM generate_series(1,6) n, generate_series(1,3) b $q$),
  ('words','orbit-count identity: count(DISTINCT canonical_rotation(w)) over words(n,b) = |k_necklaces(n,b)|, n=1..6, b=1..3',
   'eq','true','Pólya''s rotation-orbit count, made visible as a plain GROUP BY over the map''s image',$q$
    SELECT bool_and(
      (SELECT count(DISTINCT word_canonical_rotation((e).value)) FROM elements(words(n,b)) e) = cardinality(k_necklaces(n,b))
    )::text FROM generate_series(1,6) n, generate_series(1,3) b $q$),
  ('words','Lyndon = aperiodic necklaces: |k_lyndon_words(n,b)| = #{necklace reps with period = n}, n=1..6, b=1..3',
   'eq','true','the Lyndon words are exactly the necklace representatives with no proper rotation symmetry',$q$
    SELECT bool_and(
      cardinality(k_lyndon_words(n,b)) = (SELECT count(*) FROM elements(k_necklaces(n,b)) e WHERE word_period((e).value) = n)
    )::text FROM generate_series(1,6) n, generate_series(1,3) b $q$),
  ('words','bracelets ≤ necklaces: |k_bracelets(n,b)| <= |k_necklaces(n,b)|, n=1..8, b=1..3','eq','true',
   'the dihedral group refines the rotation group, so it can only merge orbits, never split them',$q$
    SELECT bool_and(cardinality(k_bracelets(n,b)) <= cardinality(k_necklaces(n,b)))::text
    FROM generate_series(1,8) n, generate_series(1,3) b $q$);
