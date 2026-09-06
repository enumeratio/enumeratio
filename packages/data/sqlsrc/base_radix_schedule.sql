-- requires: realizer
-- base_radix_schedule (#300, §2a): a numeral system's radix as DATA — a place-indexed radix function, keyed by a
-- SIGNED place p (integer places p >= 0 with weight w_p; fractional places p <= -1). Replaces the ad-hoc `radix int`
-- / `moduli int[]` arguments scattered across radix_notation.sql with one registry. `radix_expr` gives the radix at
-- signed place p, in terms of p and the schedule's own params; `weight_rule` records how weights compose
-- (w_p = ∏_{0<=q<p} radix(q) for p>=0; the mirror for p<0). This is a declarative registry (the schedule as data);
-- the valuation engines (radix_extract / mixed_radix_extract, and factoradic_numerals) implement it.
CREATE TABLE base_radix_schedule (
  id          text PRIMARY KEY,                         -- 'constant', 'factorial', 'primorial', 'list'
  radix_expr  text NOT NULL,                            -- radix at signed place p (in p and the schedule's params)
  params      text[] NOT NULL DEFAULT '{}',             -- constant: {b}; list: {moduli}
  weight_rule text NOT NULL DEFAULT 'product',          -- w_p = ∏_{0<=q<p} radix(q) for p>=0; w_{-k} = 1/∏_{1<=q<=k} radix(-q)
  reference   text);                                    -- mathlib / OEIS / precursor pointer
INSERT INTO base_radix_schedule (id, radix_expr, params, reference) VALUES
  ('constant',  'b',                                       ARRAY['b'],      'fixed-base positional; radix_notation.sql radix_extract'),
  ('factorial', 'CASE WHEN p >= 0 THEN p + 1 ELSE -p END', '{}',            'factorial number system; weights 0!,1!,2!,… (A000142); factoradic_numerals'),
  ('primorial', 'nth_prime(p + 1)',                        '{}',            'primorial number system; weights = primorial_numbers'),
  ('list',      'moduli[p + 1]',                           ARRAY['moduli'], 'mixed_radix_extract / mixed_radix_value');

-- base_numeral_system (#300, §2b): a numeral system = (weight schedule, alphabet schedule). alphabet = weights ⇒
-- every value has exactly one numeral ⇒ BIJECTIVE (rank = value). alphabet ≠ weights ⇒ a WIDENED system (several
-- numerals per value; the value becomes a grade) — e.g. hypernumerary(b,k) = weights constant(b), alphabet
-- constant(b+k), the one thing that breaks the bijection. Records the re-reading as data; no engine change.
CREATE TABLE base_numeral_system (
  collection        text PRIMARY KEY REFERENCES base_collection,
  weight_schedule   text NOT NULL REFERENCES base_radix_schedule,
  alphabet_schedule text NOT NULL REFERENCES base_radix_schedule,
  note              text,
  pack text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack);
CREATE TRIGGER base_numeral_system_pack_guard BEFORE UPDATE OR DELETE ON base_numeral_system FOR EACH ROW EXECUTE FUNCTION base_guard_pack();

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('base_radix_schedule','numeral systems recorded as (weight, alphabet) schedules: factoradic (factorial/factorial), hypernumerary (constant/constant) — a floor','eq','t|t','§2b — bijective vs widened is the weights-vs-alphabet distinction (widening is in the schedule params: b vs b+k)',$q$
    SELECT left((EXISTS (SELECT 1 FROM base_numeral_system WHERE collection='factoradic_numerals' AND weight_schedule='factorial' AND alphabet_schedule='factorial'))::text,1)
        || '|' || left((EXISTS (SELECT 1 FROM base_numeral_system WHERE collection='hypernumerary' AND weight_schedule='constant' AND alphabet_schedule='constant'))::text,1) $q$),
  ('base_radix_schedule','the four standard schedules are registered','eq','true','constant · factorial · primorial · list',$q$
    SELECT (array_agg(id ORDER BY id) @> ARRAY['constant','factorial','list','primorial'])::text FROM base_radix_schedule $q$),
  ('base_radix_schedule','the factorial schedule: radix at place p >= 0 is p+1 (place 0 radix 1 — the degenerate trailing place)','eq','1,2,3,4','#293: place 0 is always the digit 0; the schedule continues past it',$q$
    SELECT string_agg((p + 1)::text, ',' ORDER BY p) FROM generate_series(0,3) p $q$),
  ('base_radix_schedule','constant / list carry params; factorial / primorial are parameter-free','eq','constant:{b} list:{moduli}','the schedule params, as data',$q$
    SELECT string_agg(id || ':{' || array_to_string(params, ',') || '}', ' ' ORDER BY id) FROM base_radix_schedule WHERE cardinality(params) > 0 $q$);
