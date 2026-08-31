/**
 * Amortissement LMNP par composants (régime réel).
 * Décomposition et durées par défaut vérifiées en 2026, sources dans
 * docs/ADDENDUM_FISCALITE.md. Valeurs par défaut modifiables, jamais figées.
 */

export interface ComposantAmortissement {
  nom: string;
  /** Fraction de la valeur du bâti hors terrain (l'ensemble des composants doit sommer à 1). */
  partValeurBati: number;
  dureeAnnees: number;
}

export const COMPOSANTS_BATI_DEFAUT: ComposantAmortissement[] = [
  { nom: "gros_oeuvre", partValeurBati: 0.4, dureeAnnees: 50 },
  { nom: "toiture_etancheite", partValeurBati: 0.2, dureeAnnees: 25 },
  { nom: "installations_techniques", partValeurBati: 0.2, dureeAnnees: 20 },
  { nom: "agencements", partValeurBati: 0.2, dureeAnnees: 12 },
];

/** Part du prix total attribuée au terrain (non amortissable), défaut vérifié 2026. */
export const TAUX_TERRAIN_DEFAUT = 0.15;
export const DUREE_MOBILIER_DEFAUT = 7;

export interface EntreesAmortissement {
  /** Prix retenu pour l'amortissement du bâti (hors mobilier). */
  valeurBienTotal: number;
  valeurMobilier: number;
  tauxTerrain?: number;
  composantsBati?: ComposantAmortissement[];
  dureeMobilier?: number;
}

export interface LigneAmortissementAnnuel {
  nom: string;
  valeurAmortissable: number;
  dureeAnnees: number;
  amortissementAnnuel: number;
}

export interface DetailAmortissement {
  valeurTerrain: number;
  valeurBatiAmortissable: number;
  lignes: LigneAmortissementAnnuel[];
  amortissementAnnuelTotal: number;
}

export function calculerAmortissementAnnuel(
  entrees: EntreesAmortissement
): DetailAmortissement {
  if (entrees.valeurBienTotal < 0 || entrees.valeurMobilier < 0) {
    throw new Error("Les valeurs du bien et du mobilier ne peuvent pas être négatives.");
  }

  const tauxTerrain = entrees.tauxTerrain ?? TAUX_TERRAIN_DEFAUT;
  if (tauxTerrain < 0 || tauxTerrain >= 1) {
    throw new Error("Le taux terrain doit être compris entre 0 et 1 (exclu).");
  }

  const composants = entrees.composantsBati ?? COMPOSANTS_BATI_DEFAUT;
  const sommeParts = composants.reduce((s, c) => s + c.partValeurBati, 0);
  if (Math.abs(sommeParts - 1) > 0.001) {
    throw new Error(
      `La somme des parts des composants du bâti doit valoir 1 (actuellement ${sommeParts}).`
    );
  }

  const valeurTerrain = entrees.valeurBienTotal * tauxTerrain;
  const valeurBatiAmortissable = entrees.valeurBienTotal - valeurTerrain;

  const lignesBati: LigneAmortissementAnnuel[] = composants.map((c) => {
    const valeurAmortissable = valeurBatiAmortissable * c.partValeurBati;
    return {
      nom: c.nom,
      valeurAmortissable,
      dureeAnnees: c.dureeAnnees,
      amortissementAnnuel: valeurAmortissable / c.dureeAnnees,
    };
  });

  const dureeMobilier = entrees.dureeMobilier ?? DUREE_MOBILIER_DEFAUT;
  const ligneMobilier: LigneAmortissementAnnuel = {
    nom: "mobilier",
    valeurAmortissable: entrees.valeurMobilier,
    dureeAnnees: dureeMobilier,
    amortissementAnnuel: dureeMobilier > 0 ? entrees.valeurMobilier / dureeMobilier : 0,
  };

  const lignes = [...lignesBati, ligneMobilier];
  const amortissementAnnuelTotal = lignes.reduce((s, l) => s + l.amortissementAnnuel, 0);

  return { valeurTerrain, valeurBatiAmortissable, lignes, amortissementAnnuelTotal };
}
