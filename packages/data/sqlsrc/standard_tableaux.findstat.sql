-- requires: standard_tableaux.stats, standard_tableaux.promotion, references, realizer
-- standard_tableaux — FindStat cross-references (issue #224): findstat ids for the existing statistics and maps.
-- NOTE: the PROMOTION map itself is defined by #225's standard_tableaux.promotion.sql (canonical jeu-de-taquin
-- version); #224 originally shipped its own promotion, but on integration that duplicated #225's function + base_map
-- row — so the definition is deferred to #225 and this file only ANNOTATES the existing map with its FindStat id
-- (Mp00155). The descents/major_index stats + shape/transpose maps are pre-existing; here they get their ids.

INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','standard_tableaux.descents',      'findstat','St000157','https://www.findstat.org/St000157',''),
  ('stat','standard_tableaux.major_index',   'findstat','St000330','https://www.findstat.org/St000330',''),
  ('map', 'standard_tableaux.shape',         'findstat','Mp00083','https://www.findstat.org/Mp00083',''),
  ('map', 'standard_tableaux.transpose',     'findstat','Mp00084','https://www.findstat.org/Mp00084',''),
  ('map', 'standard_tableaux.promotion',     'findstat','Mp00155','https://www.findstat.org/Mp00155','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('references','findstat ref resolves for standard_tableaux.descents (St000157)','eq','St000157','the identity strip pointer',$q$
    SELECT identity FROM base_reference WHERE subject_kind='stat' AND subject='standard_tableaux.descents' AND system='findstat' $q$),
  ('references','findstat ref resolves for standard_tableaux.promotion (Mp00155)','eq','Mp00155','the identity strip pointer for the promotion map',$q$
    SELECT identity FROM base_reference WHERE subject_kind='map' AND subject='standard_tableaux.promotion' AND system='findstat' $q$);
