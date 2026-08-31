import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Accès à `operation_marchand_lots` (0..n lots par opération en mode marchand). */

export interface LotMarchandDB {
  id: string;
  operation_id: string;
  nom_lot: string;
  type_lot: string | null;
  prix_revente_prevu: number;
}

export interface NouveauLotMarchand {
  nomLot: string;
  typeLot: string;
  prixReventePrevu: number;
}

export async function listerLotsMarchand(
  supabase: SupabaseClient,
  operationId: string
): Promise<LotMarchandDB[]> {
  const { data, error } = await supabase
    .from("operation_marchand_lots")
    .select("*")
    .eq("operation_id", operationId)
    .order("id", { ascending: true });

  if (error) throw new Error(`Impossible de charger les lots : ${error.message}`);
  return data as LotMarchandDB[];
}

/** Remplace tous les lots d'une opération (même logique que remplacerTravauxLignes). */
export async function remplacerLotsMarchand(
  supabase: SupabaseClient,
  operationId: string,
  lots: NouveauLotMarchand[]
): Promise<void> {
  const { error: erreurSuppression } = await supabase
    .from("operation_marchand_lots")
    .delete()
    .eq("operation_id", operationId);
  if (erreurSuppression) {
    throw new Error(`Impossible de mettre à jour les lots : ${erreurSuppression.message}`);
  }

  const lotsValides = lots.filter((l) => l.nomLot.trim() !== "");
  if (lotsValides.length === 0) return;

  const { error: erreurInsertion } = await supabase.from("operation_marchand_lots").insert(
    lotsValides.map((l) => ({
      operation_id: operationId,
      nom_lot: l.nomLot.trim(),
      type_lot: l.typeLot.trim() || null,
      prix_revente_prevu: l.prixReventePrevu,
    }))
  );
  if (erreurInsertion) {
    throw new Error(`Impossible d'enregistrer les lots : ${erreurInsertion.message}`);
  }
}
