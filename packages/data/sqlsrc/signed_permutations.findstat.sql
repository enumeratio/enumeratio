-- requires: signed_permutations.stats, signed_permutations, references, realizer
-- signed_permutations — FindStat sweep wave 2 (issue #263). Confirmed with findstat.org's Statistic Finder: our
-- value_fn's values over the B_1/B_2/B_3 fibers were submitted to the finder and the St-number returned is the one
-- whose definition AND per-object values match ours exactly. The value-example is the gate-run oracle.
--
-- CONFIRMED:
--   descents  St001427  "number of descents of a signed permutation: index 0<=i<n with σ(i)>σ(i+1), σ(0)=0" —
--                       exactly signed_perm_descents' w(0)=0 type-B convention (signed_permutations.stats.sql).
--
-- DELIBERATELY OMITTED (the finder returned NO exact match at depth 0 — do NOT fabricate):
--   inversions             — our window-inversion count #{i<j: w(i)>w(j)} is not a FindStat signed-perm statistic.
--   fixed_points           — our positive-fixed-point count w(i)=i has no exact FindStat match.
--   negative_fixed_points  — likewise no exact match. All left NULL.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','signed_permutations.descents','findstat','St001427','https://www.findstat.org/St001427','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('signed_permutations','descents (St001427): [-1]=1, [1,2]=0, [-1,-2]=2, [2,1]=1','eq','1|0|2|1','findstat.org St001427 Values (type-B, σ(0)=0)',$q$
    SELECT signed_perm_descents(ROW(ARRAY[-1])::signed_permutation)::text || '|' ||
           signed_perm_descents(ROW(ARRAY[1,2])::signed_permutation)::text || '|' ||
           signed_perm_descents(ROW(ARRAY[-1,-2])::signed_permutation)::text || '|' ||
           signed_perm_descents(ROW(ARRAY[2,1])::signed_permutation)::text $q$),
  ('references','findstat ref resolves for signed_permutations.descents (St001427)','eq','St001427','the identity strip pointer for a real base_stat row',$q$
    SELECT identity FROM base_reference WHERE subject_kind='stat' AND subject='signed_permutations.descents' AND system='findstat' $q$);
