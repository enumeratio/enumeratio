-- requires: dyck_paths, realizer
-- ballot_sequences — ported from pg-enumeratio-core_old_backup/sqlsrc/ballot-sequences.sql.
-- A ballot sequence of length 2n is a ±1 step sequence where every prefix sum stays ≥ 0 and the total is 0
-- (a candidate never trails in the running count). A ballot sequence LITERALLY IS a Dyck path: +1 ↔ up,
-- −1 ↔ down. So this collection reuses the dyck_path carrier outright via base_restrict('ballot_sequences',
-- 'dyck_paths', 'is_ballot_sequence') — the predicate holds on every generated Dyck path (it's the same
-- object under an alternate ±1 reading), so the restriction changes nothing but the name and the accel below
-- pins the count to Catalan(n), reusing the identity established in 51-dyck-paths.sql.

-- ── the ballot-sequence predicate: every prefix sum ≥ 0 (only ±1 steps), total 0 ────────────────────────
CREATE FUNCTION is_ballot_sequence(bs dyck_path) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE steps int[] := (bs).steps; h int := 0; v int;
  BEGIN
    FOREACH v IN ARRAY coalesce(steps, '{}'::int[]) LOOP
      IF v <> 1 AND v <> -1 THEN RETURN false; END IF;                 -- only ±1 steps allowed
      h := h + v; IF h < 0 THEN RETURN false; END IF;                  -- every prefix sum ≥ 0
    END LOOP;
    RETURN h = 0;                                                      -- total = 0
  END $$;

-- accel hook (#172, was dead code — see below): pre-seed the fiber-count accel (Catalan(n), the same identity
-- dyck_paths uses) so base_realize picks it up as the closed form instead of counting the (identical) filtered
-- floor. count_fn is on the PARENT fiber (dyck_paths_fiber), wired through base_restrict.
-- BUG NOTE: this used to be `ballot_sequences_fiber_count(address int[])` — a name/signature that base_realize's
-- to_regprocedure('fiber_count(ballot_sequences_fiber)') lookup could never match (wrong name, and the child fiber
-- type didn't exist yet at that point in the file), so it was silently never wired; cardinality fell through to
-- the floor-count fallback despite this function sitting right here. Fixed by routing it through base_restrict's
-- count_fn hook (#89) like every other accelerated restriction in this codebase.
CREATE FUNCTION ballot_sequences_count(f dyck_paths_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT catalan((f).n::int) $$;

SELECT base_restrict('ballot_sequences', 'dyck_paths', 'is_ballot_sequence', count_fn => 'ballot_sequences_count');

CREATE FUNCTION fiber_symbol(f ballot_sequences_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Bal(' || (f).n::int || ')' $$;   -- corpus symbol

SELECT wire_set_notation('ballot_sequences');


-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  ('ballot_sequences','COUNT anchor: Catalan(n) for n=0..6 (A000108)','eq','1,1,2,5,14,42,132','1,1,2,5,14,42,132 — Catalan, the same identity as dyck_paths',$q$
    SELECT string_agg(cardinality(ballot_sequences(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),

  ('ballot_sequences','cardinality(ballot_sequences(4)) = 14 (accel)','eq','14','closed-form Catalan(4)',$q$
    SELECT cardinality(ballot_sequences(4))::text $q$),

  ('ballot_sequences','length-6 ballot sequences (n=3) as ± strings, lex up-first','eq','+++---,++-+--,++--+-,+-++--,+-+-+-','the 5 ballot sequences of semilength 3, read as +/− signs',$q$
    SELECT string_agg(translate(notation((e).value), 'UD', '+-'), ',' ORDER BY ordinality(e)) FROM elements(ballot_sequences(3)) e $q$),

  ('ballot_sequences','every generated element is a genuine ballot sequence','eq','true','every prefix sum ≥ 0 and total = 0, over the whole fiber at n=4',$q$
    SELECT bool_and(is_ballot_sequence((e).value))::text FROM elements(ballot_sequences(4)) e $q$),

  ('ballot_sequences','floor count independent of the accel: 42 at n=5','eq','42','counting the filtered floor directly',$q$
    SELECT count(*)::text FROM elements(ballot_sequences(5)) e $q$),

  ('ballot_sequences','range constructor ballot_sequences(0,3): fibers unfold to n = 0,1,2,3','eq','0,1,2,3','the (lo,hi) grade range',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(ballot_sequences(0,3)) f $q$),

  ('ballot_sequences','range handle cardinality = C0+C1+C2+C3 = 9','eq','9','summed over fibers',$q$
    SELECT cardinality(ballot_sequences(0,3))::text $q$),

  ('ballot_sequences','contains: UUDD ∈ ballot_sequences(2) (a genuine ±1 balanced word), DUUD ∉ (via <@)','eq','true|false','generated contains + operator, borrowed from dyck_paths',$q$
    SELECT (ROW(ARRAY[1,1,-1,-1])::dyck_path <@ ballot_sequences(2))::text || '|' ||
           (ROW(ARRAY[-1,1,1,-1])::dyck_path <@ ballot_sequences(2))::text $q$),

  ('ballot_sequences','accel hook (#172) is HONORED: fiber_count(ballot_sequences_fiber) exists (was dead code before the fix)','eq','true','base_restrict wired the closed form via count_fn',$q$
    SELECT (to_regprocedure('fiber_count(ballot_sequences_fiber)') IS NOT NULL)::text $q$),

  ('ballot_sequences','strict identity with dyck_paths: same cardinality at every n=0..6','ok',NULL,'ballot_sequences IS dyck_paths under the ±1 reading — nothing is actually filtered out',$q$
    DO $$ DECLARE n int; BEGIN
      FOR n IN 0..6 LOOP ASSERT cardinality(ballot_sequences(n)) = cardinality(dyck_paths(n)), 'card @' || n; END LOOP;
    END $$
  $q$);
