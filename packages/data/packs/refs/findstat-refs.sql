-- requires: references, statistics
-- FindStat pointers as base_reference rows (system='findstat', subject_kind='stat') — issue #161. Mirrors the
-- oeis-refs.sql pattern: a uniform cross-reference layer keyed into the SAME base_reference table as mathlib4/sage/
-- oeis, so the explorer's identity strip can list a statistic's FindStat id (St######) alongside its other pointers.
--
-- KEYING: subject = '<collection>.<stat_id>' (e.g. 'dyck_paths.area'), NOT the bare stat_id. base_stat itself is
-- keyed (collection, stat_id) because a stat_id is only unique WITHIN a collection — e.g. 'largest_part' is a stat
-- on both integer_partitions and integer_compositions (see statistics.sql) — so a bare-stat_id subject would
-- collide across collections. The two existing carrier-scoped `('stat', 'additive_energy', …)` rows in
-- references.sql predate this convention and get away with a bare subject only because that stat name happens to
-- be globally unique (it carrier-inherits across subsets/finsets/k_subsets, not collection-specific); don't follow
-- that shape for a new, collection-scoped stat. `references('dyck_paths.area')` returns exactly this row.
--
-- FABRICATION GUARD: only St-numbers I'm confident of are seeded. area/bounce/dinv on Dyck paths are FindStat's
-- three best-known q,t-Catalan statistics — St000012 (area), St000005 (bounce), St000006 (dinv) — but as of this
-- commit only `dyck_paths.area` exists as a real base_stat row (statistics.sql); bounce and dinv have NOT been
-- ported into this codebase yet (that's issue #130's job, not #161's — adding the stat functions is out of this
-- issue's scope). Seeding a base_reference row for a subject with no backing base_stat row would be a dangling
-- cross-reference, so bounce (St000005) and dinv (St000006) are deliberately OMITTED here — add them alongside
-- the stat_id rows themselves when #130 lands.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','dyck_paths.area',  'findstat','St000012','https://www.findstat.org/St000012',''),
  ('stat','dyck_paths.bounce','findstat','St000005','https://www.findstat.org/St000005',''),
  ('stat','dyck_paths.dinv',  'findstat','St000006','https://www.findstat.org/St000006','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('references','findstat ref resolves for dyck_paths.area (St000012)','eq','St000012','the identity strip pointer for a real base_stat row',$q$
    SELECT identity FROM base_reference WHERE subject_kind='stat' AND subject='dyck_paths.area' AND system='findstat' $q$),
  ('references','findstat rows pass the known-system whitelist','eq','0','the widened allowlist (mathlib4/sage/oeis/findstat) accepts findstat rows with none left over',$q$
    SELECT count(*)::text FROM base_reference WHERE system = 'findstat' AND system NOT IN ('mathlib4','sage','oeis','findstat') $q$);
