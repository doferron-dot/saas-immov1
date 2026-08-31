-- Schéma initial — voir docs/ANALYSE_ET_ARCHITECTURE_V1.md section 3.
-- Isolation multi-tenant stricte : chaque table métier est protégée par Row Level Security,
-- un utilisateur ne peut jamais lire/écrire les données d'un autre utilisateur.

-- ============================================================================
-- 1. profiles — un profil par utilisateur Supabase Auth
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid());

-- Création automatique du profil à l'inscription (auth.users est géré par Supabase Auth,
-- on ne peut pas y ajouter de colonnes — d'où la table séparée synchronisée par trigger).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- 2. operations — une opération immobilière analysée
-- ============================================================================
create table public.operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null check (mode in ('investisseur', 'marchand')),
  nom text not null default 'Nouvelle opération',
  statut text not null default 'brouillon' check (statut in ('brouillon', 'actif', 'archivé')),
  favori boolean not null default false,

  -- informations du bien
  adresse text,
  ville text,
  code_postal text,
  type_bien text,
  ancien_ou_neuf text check (ancien_ou_neuf in ('ancien', 'neuf')),
  surface numeric,
  pieces integer,
  chambres integer,
  etage integer,
  ascenseur boolean,
  parking boolean,
  cave boolean,
  dpe text,

  -- acquisition
  prix_achat numeric not null default 0,
  frais_agence numeric not null default 0,
  frais_agence_inclus boolean not null default false,
  taux_dmto numeric,
  taux_emoluments_config jsonb,
  frais_dossier numeric not null default 0,
  frais_garantie numeric not null default 0,
  autres_frais_acquisition numeric not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index operations_user_id_idx on public.operations (user_id);

alter table public.operations enable row level security;

create policy "operations_all_own"
  on public.operations for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- updated_at automatique
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger operations_set_updated_at
  before update on public.operations
  for each row execute procedure public.set_updated_at();

-- ============================================================================
-- Fonction utilitaire RLS : l'utilisateur courant possède-t-il cette opération ?
-- (utilisée par toutes les tables enfants ci-dessous)
-- ============================================================================
create function public.owns_operation(op_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.operations
    where id = op_id and user_id = auth.uid()
  );
$$;

-- ============================================================================
-- 3. travaux_lignes
-- ============================================================================
create table public.travaux_lignes (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations (id) on delete cascade,
  categorie text not null check (categorie in ('gros_oeuvre', 'technique', 'interieur', 'autre')),
  sous_categorie text,
  montant numeric not null default 0
);

create index travaux_lignes_operation_id_idx on public.travaux_lignes (operation_id);

alter table public.travaux_lignes enable row level security;

create policy "travaux_lignes_all_own"
  on public.travaux_lignes for all
  using (public.owns_operation(operation_id))
  with check (public.owns_operation(operation_id));

-- ============================================================================
-- 4. financement — une ligne par opération
-- ============================================================================
create table public.financement (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique references public.operations (id) on delete cascade,
  apport numeric not null default 0,
  montant_emprunte numeric not null default 0,
  taux numeric not null default 0,
  duree_mois integer not null default 0,
  assurance_taux numeric not null default 0,
  differe_type text not null default 'aucun' check (differe_type in ('aucun', 'partiel', 'total')),
  differe_mois integer not null default 0,
  frais_bancaires numeric not null default 0
);

alter table public.financement enable row level security;

create policy "financement_all_own"
  on public.financement for all
  using (public.owns_operation(operation_id))
  with check (public.owns_operation(operation_id));

-- ============================================================================
-- 5. operation_investisseur — présent seulement si operations.mode = 'investisseur'
-- ============================================================================
create table public.operation_investisseur (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique references public.operations (id) on delete cascade,
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

alter table public.operation_investisseur enable row level security;

create policy "operation_investisseur_all_own"
  on public.operation_investisseur for all
  using (public.owns_operation(operation_id))
  with check (public.owns_operation(operation_id));

-- ============================================================================
-- 6. operation_marchand_lots — 0..n lignes si operations.mode = 'marchand'
-- ============================================================================
create table public.operation_marchand_lots (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations (id) on delete cascade,
  nom_lot text not null,
  type_lot text,
  prix_revente_prevu numeric not null default 0
);

create index operation_marchand_lots_operation_id_idx on public.operation_marchand_lots (operation_id);

alter table public.operation_marchand_lots enable row level security;

create policy "operation_marchand_lots_all_own"
  on public.operation_marchand_lots for all
  using (public.owns_operation(operation_id))
  with check (public.owns_operation(operation_id));

-- ============================================================================
-- 7. scenarios — 3 lignes générées par opération (pessimiste/réaliste/optimiste)
-- ============================================================================
create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations (id) on delete cascade,
  type text not null check (type in ('pessimiste', 'réaliste', 'optimiste')),
  parametres jsonb not null default '{}'::jsonb,
  resultats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (operation_id, type)
);

create index scenarios_operation_id_idx on public.scenarios (operation_id);

alter table public.scenarios enable row level security;

create policy "scenarios_all_own"
  on public.scenarios for all
  using (public.owns_operation(operation_id))
  with check (public.owns_operation(operation_id));

-- ============================================================================
-- 8. plans — config des offres, jamais de prix en dur dans le code
-- ============================================================================
create table public.plans (
  id text primary key,
  nom text not null,
  prix_mensuel numeric not null default 0,
  prix_annuel numeric not null default 0,
  limites jsonb not null default '{}'::jsonb
);

alter table public.plans enable row level security;

-- Lecture publique (nécessaire pour afficher les offres avant connexion) ;
-- écriture réservée au service_role (dashboard interne / admin), jamais via l'API publique.
create policy "plans_select_public"
  on public.plans for select
  using (true);

insert into public.plans (id, nom, prix_mensuel, prix_annuel, limites) values
  ('free', 'Free', 0, 0, '{"operations_max": 3}'::jsonb),
  ('pro', 'Pro', 19, 190, '{"operations_max": null}'::jsonb),
  ('business', 'Business', 49, 490, '{"operations_max": null}'::jsonb);
