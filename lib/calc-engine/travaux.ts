/**
 * Calcul du budget travaux (section 8 du cahier des charges).
 * Catégories : gros_oeuvre, technique, interieur, autre — chacune avec ses lignes.
 */

export interface LigneTravaux {
  categorie: "gros_oeuvre" | "technique" | "interieur" | "autre";
  sousCategorie: string;
  montant: number;
}

export interface DetailTravaux {
  totalParCategorie: Record<string, number>;
  totalTravaux: number;
  imprevus: number;
  totalTravauxAvecImprevus: number;
}

const TAUX_IMPREVUS_DEFAUT = 0.1;

export function calculerTravaux(
  lignes: LigneTravaux[],
  tauxImprevus: number = TAUX_IMPREVUS_DEFAUT
): DetailTravaux {
  if (tauxImprevus < 0) {
    throw new Error("Le taux d'imprévus ne peut pas être négatif.");
  }

  const totalParCategorie: Record<string, number> = {};
  let totalTravaux = 0;

  for (const ligne of lignes) {
    if (ligne.montant < 0) {
      throw new Error(`Montant négatif pour la ligne "${ligne.sousCategorie}".`);
    }
    totalParCategorie[ligne.categorie] =
      (totalParCategorie[ligne.categorie] ?? 0) + ligne.montant;
    totalTravaux += ligne.montant;
  }

  const imprevus = totalTravaux * tauxImprevus;

  return {
    totalParCategorie,
    totalTravaux,
    imprevus,
    totalTravauxAvecImprevus: totalTravaux + imprevus,
  };
}
