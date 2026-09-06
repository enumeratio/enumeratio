-- requires: signed_permutations.stats, signed_permutations, references, realizer
-- signed_permutations — FindStat sweep wave 3 (issue #326), deeper STAT coverage. negatives_count gets its
-- FindStat id, confirmed with findstat.org's Statistic Finder (pointwise + definition). Carrier image int[].
--   negatives_count  St001429  "the number of negative entries in a signed permutation"
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','signed_permutations.negatives_count','findstat','St001429','https://www.findstat.org/St001429','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('signed_permutations','negatives_count (St001429): [-1]=1, [1,2]=0, [-1,-2]=2, [-3,-2,-1]=3','eq','1|0|2|3','findstat.org St001429 Values table',$q$
    SELECT negatives_count(ROW(ARRAY[-1])::signed_permutation)::text || '|' ||
           negatives_count(ROW(ARRAY[1,2])::signed_permutation)::text || '|' ||
           negatives_count(ROW(ARRAY[-1,-2])::signed_permutation)::text || '|' ||
           negatives_count(ROW(ARRAY[-3,-2,-1])::signed_permutation)::text $q$),
  ('references','findstat ref resolves for signed_permutations.negatives_count (St001429)','eq','St001429','the identity strip pointer',$q$
    SELECT identity FROM base_reference WHERE subject_kind='stat' AND subject='signed_permutations.negatives_count' AND system='findstat' $q$);
