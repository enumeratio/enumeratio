-- requires: standard_tableaux.promotion, standard_tableaux.evacuation, references, realizer
-- Integration fix (reconcile of #237's maps self-test with #225's tableau maps): #225 declared promotion and
-- evacuation as bijections but registered no `inverse`, which trips map_compose.sql's "every declared bijection
-- names its inverse map" self-test. Evacuation is an involution (inverse = itself). Promotion's inverse is
-- DEMOTION; via the classical relation e∘p∘e = p⁻¹ (evacuation conjugates promotion to its inverse), demotion is
-- just the composition of the two existing maps — no new geometry, and it completes the promotion/evacuation trio.
CREATE FUNCTION standard_tableau_demotion(x standard_tableau) RETURNS standard_tableau LANGUAGE sql IMMUTABLE AS $$
  SELECT standard_tableau_evacuation(standard_tableau_promotion(standard_tableau_evacuation(x))) $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat, is_bijection) VALUES
  ('standard_tableaux','demotion','standard_tableau_demotion','standard_tableaux','Demotion (inverse promotion)',NULL,true);

-- name the inverses (satisfies the self-test; all three are genuine)
UPDATE base_map SET inverse = 'demotion'   WHERE collection = 'standard_tableaux' AND map_id = 'promotion';
UPDATE base_map SET inverse = 'promotion'  WHERE collection = 'standard_tableaux' AND map_id = 'demotion';
UPDATE base_map SET inverse = 'evacuation' WHERE collection = 'standard_tableaux' AND map_id = 'evacuation';

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('standard_tableaux','demotion is promotion''s two-sided inverse over SYT n≤5 (e∘p∘e = p⁻¹)','eq','true','demotion∘promotion = id AND promotion∘demotion = id',$q$
    SELECT (bool_and((standard_tableau_demotion(standard_tableau_promotion((e).value))).row_word = ((e).value).row_word)
        AND bool_and((standard_tableau_promotion(standard_tableau_demotion((e).value))).row_word = ((e).value).row_word))::text
    FROM generate_series(0,5) n, LATERAL elements(standard_tableaux(n)) e $q$),
  ('standard_tableaux','the three tableau bijections now all name an inverse','eq','true','evacuation↔self, promotion↔demotion',$q$
    SELECT bool_and(inverse IS NOT NULL)::text FROM base_map
     WHERE collection = 'standard_tableaux' AND map_id IN ('promotion','demotion','evacuation') AND is_bijection $q$);
