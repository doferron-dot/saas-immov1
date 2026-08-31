import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Accès à `operation_investisseur` (une ligne par opération en mode investisseur). */

export interface OperationInvestisseurDB {
  id: string;
  operation_id: string;
  loyer_mensuel: number;
  charges_recuperables: number;
  charges_non_recuperables: number;
  taxe_fonciere: number;
  assurance_pno: number;
  frais_gestion_pct: number;
  entretien_pct: number;
  vacance_locative_pct: number;
  autres_charges: number;
}

export type NouvelleOperationInvestisseur = Omit<
  OperationInvestisseurDB,
  "id" | "operation_id"
>;

export async function obtenirOperationInvestisseur(
  supabase: SupabaseClient,
  operationId: string
): Promise<OperationInvestisseurDB | null> {
  const { data, error } = await supabase
    .from("operation_investisseur")
    .select("*")
    .eq("operation_id", operationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Impossible de charger les données investisseur : ${error.message}`);
  }
  return data as OperationInvestisseurDB | null;
}

export async function enregistrerOperationInvestisseur(
  supabase: SupabaseClient,
  operationId: string,
  donnees: NouvelleOperationInvestisseur
): Promise<void> {
  const { error } = await supabase
    .from("operation_investisseur")
    .upsert({ operation_id: operationId, ...donnees }, { onConflict: "operation_id" });

  if (error) {
    throw new Error(`Impossible d'enregistrer les données investisseur : ${error.message}`);
  }
}
