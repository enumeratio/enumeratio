-- requires: realizer, references
-- requires-tag: collection
-- search_sequence (issue #126) — paste a run of integer terms (OEIS-style) and find which catalog collections
-- produce that sequence. A pure-SQL analogue of find_stat.sql: sweep the catalog, not one collection.
--
-- A collection's characteristic sequence is one of two kinds:
--   'counting'  — fiber_count per grade value in order (any GRADED collection: cardinality(coll(n)), n=0..size_cap).
--   'elements'  — the numbers a NUMERIC, UNGRADED collection enumerates in order (elements(coll(), per_fiber_cap)).
-- 'counting' only sweeps collections with an ACCELERATED fiber_count (closed-form — see the guard below); mirrors
-- find_stat_source's one-bound-variable `n`, so a multi-axis constructor called with one argument (remaining axes
-- default NULL ⇒ OPEN, fibers() over an open axis yields none) just contributes an all-empty/all-zero sequence, and
-- any genuine error (no single-arg constructor at all) is caught per-collection and skipped.
--
-- MATCH. terms is matched against a collection's sequence as a CONTIGUOUS subsequence (array slice equality) — this
-- is what makes the search tolerant of an OEIS offset for free: if our own indexing starts at a different n than
-- OEIS's, the match still lands wherever the terms line up, no offset arithmetic needed up front. offset_index in
-- the result is where the match starts in OUR OWN indexing (grade n for 'counting', 0-based element rank for
-- 'elements') — the caller can compare it against the OEIS `delta` (also returned) to translate to the OEIS index.
--
-- OEIS IDENTITY. Left-joined from base_reference WHERE system='oeis'; a collection with more than one OEIS pointer
-- (e.g. prime_gaps) fans out into one result row per pointer. No pointer ⇒ one row with oeis_id NULL (a genuine
-- catalog-only match, or a sequence base_reference hasn't been enriched with yet).
--
-- WINDOW SIZE. per_fiber_cap defaults to a deliberately small 30, not a generous few hundred: several numeric
-- collections compute term r via a from-scratch recurrence per row (motzkin/fubini/partition_number/…), so cost
-- grows with the SQUARE of the cap (confirmed empirically — 500 terms swept the whole numeric-collection set in
-- minutes; 30 terms in seconds), and a couple (automorphic_numbers) scale their internal search bound as cap².
-- 30 is still ample for a pasted run — the living examples below match on 5-10 terms.

CREATE TYPE search_sequence_hit AS (collection text, sequence_kind text, offset_index int,
                                     oeis_id text, oeis_url text, oeis_delta text);

-- The contiguous-subsequence search: the 0-based offset in `seq` where `terms` first matches exactly, else NULL.
-- Array-slice equality (seq[i:i+m-1] = terms) compares both length and every element in one shot.
CREATE FUNCTION search_sequence_find(seq numeric[], terms numeric[]) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE n int := coalesce(array_length(seq, 1), 0); m int := coalesce(array_length(terms, 1), 0); i int;
BEGIN
  IF m = 0 OR n < m THEN RETURN NULL; END IF;
  FOR i IN 1..(n - m + 1) LOOP
    IF seq[i:i + m - 1] = terms THEN RETURN i - 1; END IF;
  END LOOP;
  RETURN NULL;
END $$;

-- The catalog SWEEP is independent of `terms` — it only depends on the two caps. It is the whole cost (each numeric
-- collection recomputes its sequence from a recurrence; see WINDOW SIZE above), so we materialize it ONCE per session
-- into a temp table keyed by (size_cap, per_fiber_cap) and reuse it across every search_sequence() call — the
-- find_stat_src pattern (#202). A pasted-run search is then just a contiguous-subsequence scan over the cache.
CREATE FUNCTION search_sequence_catalog(p_size_cap int, p_per_fiber_cap int) RETURNS void LANGUAGE plpgsql AS $$
DECLARE coll record; seq numeric[];
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS search_sequence_cache (
    size_cap int, per_fiber_cap int, collection text, sequence_kind text, seq numeric[]);
  -- already swept for these caps? (a sentinel row — collection NULL — guarantees presence even if nothing matched)
  IF EXISTS (SELECT 1 FROM search_sequence_cache c
              WHERE c.size_cap = p_size_cap AND c.per_fiber_cap = p_per_fiber_cap) THEN RETURN; END IF;
  INSERT INTO search_sequence_cache VALUES (p_size_cap, p_per_fiber_cap, NULL, NULL, NULL);

  -- 'counting': every graded collection that carries an ACCELERATED fiber_count (closed-form, O(1) regardless of
  -- how large the count is). Skip the handful without one: cardinality() then falls back to materializing the
  -- floor, and at n up to size_cap that's a real hang risk for a combinatorially explosive family — not a window
  -- worth capping, a scan worth avoiding entirely.
  FOR coll IN SELECT DISTINCT collection FROM base_grade ORDER BY collection LOOP
    IF to_regprocedure(format('fiber_count(%I)', coll.collection || '_fiber')) IS NULL THEN CONTINUE; END IF;
    seq := NULL;
    BEGIN
      EXECUTE format('SELECT array_agg(cardinality(%1$I(n))::numeric ORDER BY n) FROM generate_series(0, %2$s) n',
                      coll.collection, p_size_cap) INTO seq;
    EXCEPTION WHEN OTHERS THEN CONTINUE;   -- no single-arg constructor (multi-axis), or the accel refuses this n
    END;
    IF seq IS NULL THEN CONTINUE; END IF;
    INSERT INTO search_sequence_cache VALUES (p_size_cap, p_per_fiber_cap, coll.collection, 'counting', seq);
  END LOOP;

  -- 'elements': numeric, ungraded collections — the values themselves, in enumeration order.
  FOR coll IN
    SELECT c.id AS collection FROM base_collection c
     WHERE c.carrier = 'numeric' AND NOT EXISTS (SELECT 1 FROM base_grade g WHERE g.collection = c.id)
     ORDER BY c.id
  LOOP
    seq := NULL;
    BEGIN
      EXECUTE format('SELECT array_agg((e).value ORDER BY ordinality(e)) FROM elements(%1$I(), %2$s) e',
                      coll.collection, p_per_fiber_cap) INTO seq;
    EXCEPTION WHEN OTHERS THEN CONTINUE;
    END;
    IF seq IS NULL THEN CONTINUE; END IF;
    INSERT INTO search_sequence_cache VALUES (p_size_cap, p_per_fiber_cap, coll.collection, 'elements', seq);
  END LOOP;
END $$;

CREATE FUNCTION search_sequence(terms numeric[], size_cap int DEFAULT 20, per_fiber_cap int DEFAULT 30)
RETURNS SETOF search_sequence_hit LANGUAGE plpgsql AS $$   -- VOLATILE: it populates the session sweep cache
BEGIN
  IF coalesce(array_length(terms, 1), 0) = 0 THEN RETURN; END IF;
  PERFORM search_sequence_catalog(size_cap, per_fiber_cap);
  RETURN QUERY
    SELECT m.collection, m.sequence_kind, m.off, r.identity, r.url, r.delta
    FROM (
      SELECT c.collection, c.sequence_kind, search_sequence_find(c.seq, terms) AS off
      FROM search_sequence_cache c
      WHERE c.size_cap = search_sequence.size_cap AND c.per_fiber_cap = search_sequence.per_fiber_cap
        AND c.collection IS NOT NULL
    ) m
    LEFT JOIN base_reference r ON r.subject_kind = 'collection' AND r.subject = m.collection AND r.system = 'oeis'
    WHERE m.off IS NOT NULL
    ORDER BY m.collection, m.sequence_kind, r.identity NULLS FIRST;
END $$;

-- ── examples (self-certifying: the paste is read straight off the catalog's own realized surface) ────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('search_sequence','Catalan run finds dyck_paths (counting) and catalan_numbers (elements), both A000108','eq','true|true',
   '1,1,2,5,14 is the Catalan numbers, reachable both as a fiber_count sweep and as a numeric collection''s own values',$q$
    SELECT bool_or(collection = 'dyck_paths' AND sequence_kind = 'counting' AND oeis_id = 'A000108')::text || '|' ||
           bool_or(collection = 'catalan_numbers' AND sequence_kind = 'elements' AND oeis_id = 'A000108')::text
    FROM search_sequence(ARRAY[1,1,2,5,14]) $q$),

  ('search_sequence','partition-count run finds BOTH integer_partitions (counting, catalog-only) and partition_numbers (elements, A000041)','eq','true|true',
   'p(0..5) = 1,1,2,3,5,7 — the OEIS pointer sits on the numeric sibling partition_numbers, not on integer_partitions itself',$q$
    SELECT bool_or(collection = 'integer_partitions' AND sequence_kind = 'counting' AND oeis_id IS NULL)::text || '|' ||
           bool_or(collection = 'partition_numbers' AND sequence_kind = 'elements' AND oeis_id = 'A000041')::text
    FROM search_sequence(ARRAY[1,1,2,3,5,7]) $q$),

  ('search_sequence','a run of primes finds prime_numbers (elements, A000040)','eq','true','2,3,5,7,11 read straight off elements(prime_numbers())',$q$
    SELECT bool_or(collection = 'prime_numbers' AND sequence_kind = 'elements' AND oeis_id = 'A000040')::text
    FROM search_sequence(ARRAY[2,3,5,7,11]) $q$),

  ('search_sequence','a mid-sequence paste still matches — offset tolerance is free from the contiguous search','eq','5',
   'square_free_numbers starts 1,2,3,5,6,7,10,11,13,14; pasting from the 6-th term (0-based offset 5) lands at offset 5',$q$
    SELECT offset_index::text FROM search_sequence(ARRAY[7,10,11,13,14]) WHERE collection = 'square_free_numbers' $q$),

  ('search_sequence','no match for an unrelated run returns no rows','eq','0','a sequence no realized collection produces in the swept window',$q$
    SELECT count(*)::text FROM search_sequence(ARRAY[3,1,4,1,5,9,2,6]) $q$);
