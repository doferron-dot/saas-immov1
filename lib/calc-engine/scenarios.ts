/**
 * Scénarios pessimiste / réaliste / optimiste (sections 6 et 9 du cahier des charges).
 *
 * Ce module ne recalcule PAS une opération complète lui-même : il fournit les deltas
 * par défaut (modifiables) et des fonctions pures pour les appliquer à une valeur de
 * base. Le recalcul complet (acquisition → travaux → financement → investisseur ou
 * marchand) reste la responsabilité de l'appelant, qui réutilise telles quelles les
 * fonctions des autres modules de lib/calc-engine — "les trois scénarios réutilisent
 * exactement les mêmes fonctions de calcul, juste avec des entrées différentes : aucune
 * duplication de logique" (doc section 6).
 *
 * Le scénario "réaliste" n'a pas de delta par défaut : ce sont les valeurs saisies par
 * l'utilisateur telles quelles (doc section 6).
 *
 * ⚠️ Deltas explicitement spécifiés dans le cahier des charges : travaux et durée
 * (les deux modes), et revente (mode marchand uniquement — chiffre_affaires_total).
 * Le cahier des charges ne précise PAS de levier équivalent pour le mode investisseur
 * (loyer ? vacance locative ? les deux ?) — ce point est à valider avec Dorian avant de
 * câbler la page "Scénarios" en mode investisseur. Ne pas inventer d'hypothèse ici.
 */

export type TypeScenario = "pessimiste" | "réaliste" | "optimiste";

export interface DeltasScenario {
  /** Delta appliqué au total des travaux, en fraction (ex: 0.15 pour +15%). */
  travauxDeltaPct: number;
  /** Delta appliqué au(x) prix de revente prévu(s) — mode marchand uniquement. */
  reventeDeltaPct: number;
  /** Mois supplémentaires (positif) ou en moins (négatif) sur la durée de l'opération. */
  dureeDeltaMois: number;
}

/** Deltas par défaut du cahier des charges (doc section 6) — modifiables par l'utilisateur. */
export const DELTAS_DEFAUT: Record<"pessimiste" | "optimiste", DeltasScenario> = {
  pessimiste: { travauxDeltaPct: 0.15, reventeDeltaPct: -0.1, dureeDeltaMois: 6 },
  optimiste: { travauxDeltaPct: -0.05, reventeDeltaPct: 0.05, dureeDeltaMois: -3 },
};

/** Applique un delta en fraction à un montant de base (ex: 100 000 € avec +0.15 → 115 000 €). */
export function appliquerDeltaPct(valeurBase: number, deltaPct: number): number {
  return valeurBase * (1 + deltaPct);
}

/**
 * Applique un delta en mois (positif ou négatif) à une durée de base, sans jamais
 * descendre sous 1 mois (une opération ne peut pas durer 0 ou moins).
 */
export function appliquerDeltaDureeMois(dureeBaseMois: number, deltaMois: number): number {
  if (dureeBaseMois <= 0) {
    throw new Error("La durée de base doit être positive.");
  }
  return Math.max(1, Math.round(dureeBaseMois + deltaMois));
}

/**
 * Construit les paramètres des 3 scénarios pour une opération, à partir des deltas
 * par défaut (ou personnalisés) et des valeurs "réalistes" saisies par l'utilisateur.
 * Ne fait aucun calcul financier — uniquement de la construction de paramètres, que
 * l'appelant transmettra ensuite au moteur de calcul (acquisition/travaux/financement/
 * investisseur/marchand) pour obtenir les 3 jeux de résultats.
 */
export function construireParametresScenarios(
  deltasPersonnalises?: Partial<Record<"pessimiste" | "optimiste", Partial<DeltasScenario>>>
): Record<TypeScenario, DeltasScenario | null> {
  return {
    pessimiste: { ...DELTAS_DEFAUT.pessimiste, ...deltasPersonnalises?.pessimiste },
    réaliste: null,
    optimiste: { ...DELTAS_DEFAUT.optimiste, ...deltasPersonnalises?.optimiste },
  };
}
