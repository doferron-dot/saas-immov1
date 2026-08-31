"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/supabase/server";
import { creerOperation, mettreAJourOperation, obtenirOperation, type ModeOperation } from "@/lib/db/operations";
import { remplacerTravauxLignes, type CategorieTravaux } from "@/lib/db/travaux-lignes";
import { enregistrerFinancement, type TypeDiffereDB } from "@/lib/db/financement";
import { enregistrerOperationInvestisseur } from "@/lib/db/operation-investisseur";
import { remplacerLotsMarchand } from "@/lib/db/operation-marchand-lots";
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

  redirect(`/operations/${operation.id}`);
}

// ============================================================================
// Enregistrement du formulaire détaillé d'une opération (informations du bien,
// acquisition, travaux, financement, données spécifiques au mode).
// ============================================================================

function nombre(formData: FormData, cle: string, defaut = 0): number {
  const brut = formData.get(cle);
  if (brut === null || brut === "") return defaut;
  const valeur = Number(brut);
  return Number.isFinite(valeur) ? valeur : defaut;
}

/** Comme `nombre`, mais renvoie null (pas 0) pour un champ optionnel laissé vide. */
function nombreOuNull(formData: FormData, cle: string): number | null {
  const brut = formData.get(cle);
  if (brut === null || brut === "") return null;
  const valeur = Number(brut);
  return Number.isFinite(valeur) ? valeur : null;
}

/** Champ saisi en pourcentage lisible (ex: 5.5 pour 5,5%), stocké en fraction (0.055). */
function pourcentageEnFraction(formData: FormData, cle: string, defautPct = 0): number {
  return nombre(formData, cle, defautPct) / 100;
}

function texte(formData: FormData, cle: string): string | null {
  const brut = formData.get(cle);
  if (typeof brut !== "string" || brut.trim() === "") return null;
  return brut.trim();
}

function coche(formData: FormData, cle: string): boolean {
  return formData.get(cle) === "on";
}

function parserJSON<T>(formData: FormData, cle: string): T[] {
  const brut = formData.get(cle);
  if (typeof brut !== "string" || brut.trim() === "") return [];
  try {
    const valeur = JSON.parse(brut);
    return Array.isArray(valeur) ? (valeur as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * Enregistre l'intégralité du formulaire détaillé d'une opération : informations du
 * bien + acquisition (table operations), travaux (travaux_lignes), financement
 * (financement), et les données spécifiques au mode (operation_investisseur ou
 * operation_marchand_lots). Un seul bouton "Enregistrer" pour tout le formulaire —
 * plus simple à utiliser qu'un enregistrement par section, quitte à réécrire des
 * lignes déjà à jour (remplacerTravauxLignes / remplacerLotsMarchand).
 */
export async function enregistrerDetailOperation(
  operationId: string,
  formData: FormData
): Promise<void> {
  const { user } = await verifierSession();
  const supabase = await createClient();

  const operationExistante = await obtenirOperation(supabase, operationId);
  if (!operationExistante || operationExistante.user_id !== user.id) {
    throw new Error("Opération introuvable.");
  }

  try {
    await mettreAJourOperation(supabase, operationId, {
      nom: texte(formData, "nom") ?? operationExistante.nom,
      adresse: texte(formData, "adresse"),
      ville: texte(formData, "ville"),
      code_postal: texte(formData, "code_postal"),
      type_bien: texte(formData, "type_bien"),
      ancien_ou_neuf: (texte(formData, "ancien_ou_neuf") as "ancien" | "neuf" | null) ?? "ancien",
      surface: nombreOuNull(formData, "surface"),
      pieces: nombreOuNull(formData, "pieces"),
      chambres: nombreOuNull(formData, "chambres"),
      etage: nombreOuNull(formData, "etage"),
      ascenseur: coche(formData, "ascenseur"),
      parking: coche(formData, "parking"),
      cave: coche(formData, "cave"),
      dpe: texte(formData, "dpe"),
      prix_achat: nombre(formData, "prix_achat"),
      frais_agence: nombre(formData, "frais_agence"),
      frais_agence_inclus: coche(formData, "frais_agence_inclus"),
      frais_dossier: nombre(formData, "frais_dossier"),
      frais_garantie: nombre(formData, "frais_garantie"),
      autres_frais_acquisition: nombre(formData, "autres_frais_acquisition"),
      frais_revente: nombre(formData, "frais_revente"),
    });

    const lignesTravaux = parserJSON<{ categorie: CategorieTravaux; sousCategorie: string; montant: number }>(
      formData,
      "travauxJSON"
    );
    await remplacerTravauxLignes(supabase, operationId, lignesTravaux);

    await enregistrerFinancement(supabase, operationId, {
      apport: nombre(formData, "apport"),
      montant_emprunte: nombre(formData, "montant_emprunte"),
      taux: pourcentageEnFraction(formData, "taux"),
      duree_mois: nombre(formData, "duree_mois"),
      assurance_taux: pourcentageEnFraction(formData, "assurance_taux"),
      differe_type: (texte(formData, "differe_type") as TypeDiffereDB | null) ?? "aucun",
      differe_mois: nombre(formData, "differe_mois"),
      frais_bancaires: nombre(formData, "frais_bancaires"),
    });

    if (operationExistante.mode === "investisseur") {
      await enregistrerOperationInvestisseur(supabase, operationId, {
        loyer_mensuel: nombre(formData, "loyer_mensuel"),
        charges_recuperables: nombre(formData, "charges_recuperables"),
        charges_non_recuperables: nombre(formData, "charges_non_recuperables"),
        taxe_fonciere: nombre(formData, "taxe_fonciere"),
        assurance_pno: nombre(formData, "assurance_pno"),
        frais_gestion_pct: pourcentageEnFraction(formData, "frais_gestion_pct"),
        entretien_pct: pourcentageEnFraction(formData, "entretien_pct"),
        vacance_locative_pct: pourcentageEnFraction(formData, "vacance_locative_pct"),
        autres_charges: nombre(formData, "autres_charges"),
      });
    } else {
      const lots = parserJSON<{ nomLot: string; typeLot: string; prixReventePrevu: number }>(
        formData,
        "lotsJSON"
      );
      await remplacerLotsMarchand(supabase, operationId, lots);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue lors de l'enregistrement.";
    redirect(`/operations/${operationId}?erreur=${encodeURIComponent(message)}`);
  }

  redirect(`/operations/${operationId}?enregistre=1`);
}
