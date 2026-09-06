-- requires: dyck_paths, dyck_paths.stats, references, realizer
-- dyck_paths — FindStat sweep wave 3 (issue #326), MAPS. The reverse-complement involution gets its FindStat
-- Mp-number, confirmed against findstat.org's Mp page (definition + images). Carrier steps are ±1 (1 = up, -1 =
-- down); FindStat's [1,0,…] encodes 0 = down. FindStat calls it "reverse", but its images reverse AND complement
-- (so the image stays a Dyck path) — exactly dyck_reverse_complement. Image compared as the steps array.
--
-- CONFIRMED:
--   reverse_complement  Mp00028  "reverse" (reverse the step word and swap up/down)  UDUUDD ↦ UUDDUD
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('map','dyck_paths.reverse_complement','findstat','Mp00028','https://www.findstat.org/Mp00028','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('dyck_paths','reverse_complement (Mp00028): UDUUDD↦UUDDUD and back, UDUD & UUDUDD fixed','eq','{1,1,-1,-1,1,-1}|{1,-1,1,1,-1,-1}|{1,-1,1,-1}|{1,1,-1,1,-1,-1}','findstat.org Mp00028 images, as the image steps',$q$
    SELECT (dyck_reverse_complement(ROW(ARRAY[1,-1,1,1,-1,-1])::dyck_path)).steps::text || '|' ||
           (dyck_reverse_complement(ROW(ARRAY[1,1,-1,-1,1,-1])::dyck_path)).steps::text || '|' ||
           (dyck_reverse_complement(ROW(ARRAY[1,-1,1,-1])::dyck_path)).steps::text || '|' ||
           (dyck_reverse_complement(ROW(ARRAY[1,1,-1,1,-1,-1])::dyck_path)).steps::text $q$),
  ('references','findstat map ref resolves for dyck_paths.reverse_complement (Mp00028)','eq','Mp00028','the identity strip pointer for a real base_map row',$q$
    SELECT identity FROM base_reference WHERE subject_kind='map' AND subject='dyck_paths.reverse_complement' AND system='findstat' $q$);
