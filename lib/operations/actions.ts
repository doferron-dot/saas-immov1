"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/supabase/server";
import { creerOperation, type ModeOperation } from "@/lib/db/operations";
import { verifierSession } from "@/lib/auth/dal";

/** Crée une opération vide dans le mode choisi et redirige vers son édition. */
export async function creerNouvelleOperation(formData: FormData): Promise<void> {
  const { user } = await verifierSession();
  const mode = String(formData.get("mode") ?? "") as ModeOperation;

  if (mode !== "investisseur" && mode !== "marchand") {
    throw new Error("Mode d'opération invalide.");
  }

  const supabase = await createClient();
  const operation = await creerOperation(supabase, user.id, { mode });

  // La page d'édition détaillée (formulaire multi-étapes) arrive dans une prochaine
  // étape — pour l'instant on retourne au dashboard, qui affichera la nouvelle ligne.
  redirect(`/dashboard?creee=${operation.id}`);
}
