-- Location du bien avant sa revente, en mode marchand de biens (un marchand a jusqu'à
-- ~5 ans pour revendre — Dorian, 2026-09-01 : "il a 5 ans pour vendre donc il peut mettre
-- en location avant la vente"). Mêmes champs que operation_investisseur (validé avec
-- Dorian : "mêmes champs détaillés qu'en mode investisseur"), plus une durée en mois.
-- Table séparée, une ligne par opération, sur le même modèle que operation_investisseur :
-- optionnelle (0 ou 1 ligne — pas de location si absente ou durée à 0), pas de contrainte
-- de mode ici (comme operation_investisseur, filtré côté application par operations.mode).
create table public.operation_marchand_location (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique references public.operations (id) on delete cascade,
  duree_location_mois integer not null default 0,
  loyer_mensuel numeric not null default 0,
  charges_recuperables numeric not null default 0,
  charges_non_recuperables numeric not null default 0,
  taxe_fonciere numeric not null default 0,
  assurance_pno numeric not null default 0,
  frais_gestion_pct numeric not null default 0,
  entretien_pct numeric not null default 0,
  vacance_locative_pct numeric not null default 0,
  autres_charges numeric not null default 0
);

alter table public.operation_marchand_location enable row level security;

create policy "operation_marchand_location_all_own"
  on public.operation_marchand_location for all
  using (public.owns_operation(operation_id))
  with check (public.owns_operation(operation_id));
