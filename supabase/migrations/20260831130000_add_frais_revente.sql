-- Ajoute le champ "frais de revente" (commission d'agence, diagnostics...) utilisé par
-- le mode marchand de biens (lib/calc-engine/marchand.ts, EntreesMarchand.fraisRevente).
-- Placé directement sur `operations` plutôt que dans une table séparée : c'est une valeur
-- unique par opération, comme prix_achat ou frais_agence, pas une liste.
alter table public.operations
  add column frais_revente numeric not null default 0;
