import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Accès aux données de la table `operations` — jamais de calcul financier ici
 * (voir lib/calc-engine/), uniquement des requêtes CRUD. Chaque fonction reçoit
 * le client Supabase en paramètre (jamais importé directement) : ça permet de
 * réutiliser exactement le client déjà authentifié du Server Component / Server
 * Action appelant, et rend ces fonctions testables avec n'importe quel client.
 * RLS (policy "operations_all_own") garantit côté base que l'utilisateur ne
 * voit/modifie jamais que ses propres opérations — ces fonctions ne dupliquent
 * pas ce contrôle, elles s'appuient dessus.
 */

export type ModeOperation = "investisseur" | "marchand";
export type StatutOperation = "brouillon" | "actif" | "archivé";
export type TypeBien = "ancien" | "neuf";

export interface Operation {
  id: string;
  user_id: string;
  mode: ModeOperation;
  nom: string;
  statut: StatutOperation;
  favori: boolean;
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
  type_bien: string | null;
  ancien_ou_neuf: TypeBien | null;
  surface: number | null;
  pieces: number | null;
  chambres: number | null;
  etage: number | null;
  ascenseur: boolean | null;
  parking: boolean | null;
  cave: boolean | null;
  dpe: string | null;
  prix_achat: number;
  frais_agence: number;
  frais_agence_inclus: boolean;
  taux_dmto: number | null;
  taux_emoluments_config: unknown;
  frais_dossier: number;
  frais_garantie: number;
  autres_frais_acquisition: number;
  frais_revente: number;
  created_at: string;
  updated_at: string;
}

export interface NouvelleOperation {
  mode: ModeOperation;
  nom?: string;
}

/** Liste des opérations de l'utilisateur courant, les plus récemment modifiées en premier. */
export async function listerOperations(supabase: SupabaseClient): Promise<Operation[]> {
  const { data, error } = await supabase
    .from("operations")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Impossible de charger les opérations : ${error.message}`);
  return data as Operation[];
}

/** Crée une opération vide (mode choisi, reste à compléter par étapes). */
export async function creerOperation(
  supabase: SupabaseClient,
  userId: string,
  entree: NouvelleOperation
): Promise<Operation> {
  const { data, error } = await supabase
    .from("operations")
    .insert({
      user_id: userId,
      mode: entree.mode,
      nom: entree.nom ?? "Nouvelle opération",
    })
    .select("*")
    .single();

  if (error) throw new Error(`Impossible de créer l'opération : ${error.message}`);
  return data as Operation;
}

/** Renvoie une opération par id, ou null si elle n'existe pas / n'appartient pas à l'utilisateur. */
export async function obtenirOperation(
  supabase: SupabaseClient,
  id: string
): Promise<Operation | null> {
  const { data, error } = await supabase.from("operations").select("*").eq("id", id).maybeSingle();

  if (error) throw new Error(`Impossible de charger l'opération : ${error.message}`);
  return data as Operation | null;
}

/** Met à jour partiellement une opération (n'importe quel sous-ensemble de colonnes). */
export async function mettreAJourOperation(
  supabase: SupabaseClient,
  id: string,
  changements: Partial<Omit<Operation, "id" | "user_id" | "created_at" | "updated_at">>
): Promise<Operation> {
  const { data, error } = await supabase
    .from("operations")
    .update(changements)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(`Impossible de mettre à jour l'opération : ${error.message}`);
  return data as Operation;
}

export async function supprimerOperation(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("operations").delete().eq("id", id);
  if (error) throw new Error(`Impossible de supprimer l'opération : ${error.message}`);
}
