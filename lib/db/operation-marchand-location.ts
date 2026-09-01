import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Accès à `operation_marchand_location` (0..1 ligne par opération en mode marchand —
 * location du bien pendant la période de détention avant la revente, cf. migration
 * 20260901090000_add_operation_marchand_location.sql). Mêmes champs que
 * operation_investisseur, plus duree_location_mois.
 */

export interface OperationMarchandLocationDB {
  id: string;
  operation_id: string;
  duree_location_mois: number;
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

export type NouvelleOperationMarchandLocation = Omit<
  OperationMarchandLocationDB,
  "id" | "operation_id"
>;

export async function obtenirLocationMarchand(
  supabase: SupabaseClient,
  operationId: string
): Promise<OperationMarchandLocationDB | null> {
  const { data, error } = await supabase
    .from("operation_marchand_location")
    .select("*")
    .eq("operation_id", operationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Impossible de charger les données de location : ${error.message}`);
  }
  return data as OperationMarchandLocationDB | null;
}

export async function enregistrerLocationMarchand(
  supabase: SupabaseClient,
  operationId: string,
  donnees: NouvelleOperationMarchandLocation
): Promise<void> {
  const { error } = await supabase
    .from("operation_marchand_location")
    .upsert({ operation_id: operationId, ...donnees }, { onConflict: "operation_id" });

  if (error) {
    throw new Error(`Impossible d'enregistrer les données de location : ${error.message}`);
  }
}
