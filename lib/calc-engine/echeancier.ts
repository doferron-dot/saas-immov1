/**
 * Échéancier mensuel détaillé d'un crédit (capital restant dû mois par mois).
 *
 * Réutilise exactement les mêmes formules que calculerFinancement (financement.ts) —
 * mensualité via calculerMensualite, même gestion du différé partiel/total — mais
 * expose l'état mois par mois plutôt qu'un résumé. Nécessaire pour les projections
 * pluriannuelles (lib/calc-engine/projection.ts).
 *
 * Fonction ADDITIVE : calculerFinancement n'est pas modifié ni réutilisé en interne,
 * pour ne prendre aucun risque sur un module déjà testé et en production (léger coût :
 * la logique d'amortissement est dupliquée entre les deux fichiers ; les tests de ce
 * fichier vérifient explicitement la cohérence avec calculerFinancement pour détecter
 * toute divergence).
 */
import { calculerMensualite, type EntreesFinancement, type TypeDiffere } from "./financement";

export interface LigneEcheancier {
  /** Mois 1-indexé depuis le début du prêt. */
  mois: number;
  phase: "differe" | "amortissement";
  capitalDebutMois: number;
  interetMensuel: number;
  /** Peut être négatif pendant un différé total (les intérêts sont capitalisés). */
  principalRembourse: number;
  capitalFinMois: number;
  /** Mensualité hors assurance payée ce mois (0 pendant un différé total). */
  mensualiteHorsAssurance: number;
}

export function genererEcheancierMensuel(entrees: EntreesFinancement): LigneEcheancier[] {
  if (entrees.montantEmprunte < 0) {
    throw new Error("Le montant emprunté ne peut pas être négatif.");
  }
  if (entrees.tauxAnnuel < 0) {
    throw new Error("Le taux ne peut pas être négatif.");
  }
  if (entrees.dureeMois <= 0) {
    throw new Error("La durée du prêt doit être positive.");
  }

  const differeType: TypeDiffere = entrees.differeType ?? "aucun";
  const differeMois = differeType === "aucun" ? 0 : entrees.differeMois ?? 0;
  if (differeMois < 0 || differeMois >= entrees.dureeMois) {
    throw new Error("Le différé doit durer moins longtemps que le prêt lui-même.");
  }

  const tauxMensuel = entrees.tauxAnnuel / 12;
  const lignes: LigneEcheancier[] = [];
  let capital = entrees.montantEmprunte;

  if (differeType === "partiel") {
    const interetMensuel = capital * tauxMensuel;
    for (let mois = 1; mois <= differeMois; mois++) {
      lignes.push({
        mois,
        phase: "differe",
        capitalDebutMois: capital,
        interetMensuel,
        principalRembourse: 0,
        capitalFinMois: capital,
        mensualiteHorsAssurance: interetMensuel,
      });
    }
  } else if (differeType === "total") {
    for (let mois = 1; mois <= differeMois; mois++) {
      const interetMensuel = capital * tauxMensuel;
      const capitalFin = capital + interetMensuel;
      lignes.push({
        mois,
        phase: "differe",
        capitalDebutMois: capital,
        interetMensuel,
        principalRembourse: -interetMensuel,
        capitalFinMois: capitalFin,
        mensualiteHorsAssurance: 0,
      });
      capital = capitalFin;
    }
  }

  const dureeAmortissement = entrees.dureeMois - differeMois;
  const mensualiteHorsAssurance = calculerMensualite(capital, entrees.tauxAnnuel, dureeAmortissement);
  for (let i = 1; i <= dureeAmortissement; i++) {
    const interetMensuel = capital * tauxMensuel;
    const principal = mensualiteHorsAssurance - interetMensuel;
    const capitalFin = capital - principal;
    lignes.push({
      mois: differeMois + i,
      phase: "amortissement",
      capitalDebutMois: capital,
      interetMensuel,
      principalRembourse: principal,
      capitalFinMois: capitalFin,
      mensualiteHorsAssurance,
    });
    capital = capitalFin;
  }

  return lignes;
}

/**
 * Capital restant dû juste après le mois `mois` (0 si le prêt est déjà soldé, ou si
 * `mois` dépasse la durée de l'échéancier ; capital initial si `mois` <= 0).
 */
export function capitalRestantDuAuMois(echeancier: LigneEcheancier[], mois: number): number {
  if (echeancier.length === 0) return 0;
  if (mois <= 0) return echeancier[0].capitalDebutMois;
  if (mois >= echeancier.length) return Math.max(0, echeancier[echeancier.length - 1].capitalFinMois);
  return Math.max(0, echeancier[mois - 1].capitalFinMois);
}
