import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Accès à `financement` (une ligne par opération, contrainte unique sur operation_id). */

export type TypeDiffereDB = "aucun" | "partiel" | "total";

export interface FinancementDB {
  id: string;
  operation_id: string;
  apport: number;
  montant_emprunte: number;
  taux: number;
  duree_mois: number;
  assurance_taux: number;
  differe_type: TypeDiffereDB;
  differe_mois: number;
  frais_bancaires: number;
}

export type NouveauFinancement = Omit<FinancementDB, "id" | "operation_id">;

export async function obtenirFinancement(
  supabase: SupabaseClient,
  operationId: string
): Promise<FinancementDB | null> {
  const { data, error } = await supabase
    .from("financement")
    .select("*")
    .eq("operation_id", operationId)
    .maybeSingle();

  if (error) throw new Error(`Impossible de charger le financement : ${error.message}`);
  return data as FinancementDB | null;
}

/** Crée ou met à jour la ligne de financement de l'opération (upsert sur operation_id). */
export async function enregistrerFinancement(
  supabase: SupabaseClient,
  operationId: string,
  financement: NouveauFinancement
): Promise<void> {
  const { error } = await supabase
    .from("financement")
    .upsert({ operation_id: operationId, ...financement }, { onConflict: "operation_id" });

  if (error) throw new Error(`Impossible d'enregistrer le financement : ${error.message}`);
}
