-- requires: narayana_numbers, realizer, utilities
-- narayana_numbers statistics — narayana_dyck is a BESPOKE carrier (distinct from dyck_path), so it carries none of
-- dyck_paths.stats.sql's inherited functions. `peaks` names the grading axis k directly (k = exactly this many
-- peaks by construction, per fiber) — registering it as a stat gives the query view something to GROUP BY on an
-- ungraded narayana_numbers(n) row-set, and lets it appear as a column without unfolding the k axis by hand.

-- ── statistics (carrier: narayana_dyck(steps int[]) of ±1) ─────────────────────────────────────────────
-- peaks: an up-step immediately followed by a down-step. Equals the k grade on every element of fiber [n,k].
CREATE FUNCTION narayana_peaks(p narayana_dyck) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).steps,1) i
   WHERE i < array_length((p).steps,1) AND (p).steps[i] = 1 AND (p).steps[i+1] = -1 $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('narayana_numbers','peaks','narayana_peaks','Peaks','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('narayana_numbers','peaks equals the k grade on every element of fiber [4,2]','eq','true','the defining invariant — this IS what k counts',$q$
    SELECT bool_and(narayana_peaks((e).value) = 2)::text FROM elements(narayana_numbers(4,2)) e $q$),
  ('narayana_numbers','the single 1-peak path at n=4 is UUUUDDDD','eq','1','N(4,1)=1, the maximally nested path',$q$
    SELECT narayana_peaks((unrank(narayana_numbers(4,1),0)).value)::text $q$),
  ('narayana_numbers','peaks over fiber [3,2] (UUDUDD,UUDDUD,UDUUDD) is 2,2,2','eq','2,2,2','all three 2-peak paths',$q$
    SELECT string_agg(narayana_peaks((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(narayana_numbers(3,2)) e $q$);
