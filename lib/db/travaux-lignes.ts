import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Accès à `travaux_lignes` (lignes de budget travaux d'une opération).
 * Même principe que lib/db/operations.ts : aucun calcul ici, uniquement du CRUD,
 * RLS ("travaux_lignes_all_own") garantit l'isolation par utilisateur.
 */

export type CategorieTravaux = "gros_oeuvre" | "technique" | "interieur" | "autre";

export interface LigneTravauxDB {
  id: string;
  operation_id: string;
  categorie: CategorieTravaux;
  sous_categorie: string | null;
  montant: number;
}

export interface NouvelleLigneTravaux {
  categorie: CategorieTravaux;
  sousCategorie: string;
  montant: number;
}

export async function listerTravauxLignes(
  supabase: SupabaseClient,
  operationId: string
): Promise<LigneTravauxDB[]> {
  const { data, error } = await supabase
    .from("travaux_lignes")
    .select("*")
    .eq("operation_id", operationId)
    .order("id", { ascending: true });

  if (error) throw new Error(`Impossible de charger les lignes de travaux : ${error.message}`);
  return data as LigneTravauxDB[];
}

/**
 * Remplace toutes les lignes de travaux d'une opération par la nouvelle liste fournie.
 * Plus simple et plus sûr qu'un diff ligne par ligne pour un formulaire où l'utilisateur
 * peut librement ajouter/retirer des lignes côté client (voir components/operations/operation-form.tsx).
 */
export async function remplacerTravauxLignes(
  supabase: SupabaseClient,
  operationId: string,
  lignes: NouvelleLigneTravaux[]
): Promise<void> {
  const { error: erreurSuppression } = await supabase
    .from("travaux_lignes")
    .delete()
    .eq("operation_id", operationId);
  if (erreurSuppression) {
    throw new Error(`Impossible de mettre à jour les travaux : ${erreurSuppression.message}`);
  }

  const lignesValides = lignes.filter((l) => l.sousCategorie.trim() !== "" || l.montant !== 0);
  if (lignesValides.length === 0) return;

  const { error: erreurInsertion } = await supabase.from("travaux_lignes").insert(
    lignesValides.map((l) => ({
      operation_id: operationId,
      categorie: l.categorie,
      sous_categorie: l.sousCategorie.trim(),
      montant: l.montant,
    }))
  );
  if (erreurInsertion) {
    throw new Error(`Impossible d'enregistrer les travaux : ${erreurInsertion.message}`);
  }
}
