/**
 * Projection pluriannuelle — mode investisseur locatif uniquement (le mode marchand de
 * biens est une opération courte, sans hold multi-décennies, donc une projection à 40
 * ans n'a pas de sens pour lui).
 *
 * Simule mois par mois le loyer indexé, les charges indexées et l'échéancier de crédit
 * (lib/calc-engine/echeancier.ts), puis extrait des points annuels pour les graphiques.
 *
 * Décisions validées avec Dorian (2026-08-31) :
 * - Deux profils affichés côte à côte, "prudent" et "optimiste", plutôt qu'une seule
 *   hypothèse — pour comparer visuellement plutôt que trancher un seul chiffre.
 * - Le levier pessimiste/optimiste du score (calculerResultatsOperation) combine loyer
 *   ET charges, réutilisant les mêmes deltas — voir lib/operations/calculer-resultats.ts.
 * - "Ne pas oublier la revente, elle détermine la rentabilité" : chaque point de
 *   projection inclut `produitNetRevente`, ce qui serait réellement perçu en revendant à
 *   cette échéance (valeur du bien − frais de transaction estimés − capital restant dû),
 *   pas seulement la valeur brute du bien. `patrimoineNet` = ce produit net de revente +
 *   le cash-flow cumulé encaissé jusque-là − l'apport initial.
 *
 * - "Fais-en une estimation indicative de la plus-value" : chaque point inclut aussi
 *   `impotPlusValueEstime` (lib/calc-engine/plus-value.ts, barème standard 2026) et
 *   `produitNetReventeApresImpot`. `patrimoineNet` est calculé APRÈS cet impôt estimé.
 *   Reste volontairement hors périmètre : la surtaxe sur les plus-values > 50 000 € et
 *   toute exonération liée à la situation personnelle du vendeur — voir plus-value.ts.
 *   `produitNetRevente` (sans "ApresImpot") reste disponible à titre de comparaison.
 */
import { genererEcheancierMensuel, capitalRestantDuAuMois } from "./echeancier";
import { calculerPlusValueImmobiliere } from "./plus-value";
import type { EntreesFinancement } from "./financement";

export const ANNEES_PROJECTION_DEFAUT = [1, 5, 10, 15, 20, 25, 30, 35, 40];

export type ProfilProjection = "prudent" | "optimiste";

export interface HypothesesProjection {
  /** Valorisation annuelle du bien, en fraction (ex: 0.015 pour 1,5%/an). */
  tauxValorisationBienAnnuel: number;
  /** Indexation annuelle du loyer. */
  tauxIndexationLoyerAnnuel: number;
  /** Indexation annuelle des charges (hors mensualité crédit, qui ne change jamais). */
  tauxIndexationChargesAnnuel: number;
  /** Frais de transaction estimés à la revente (agence, diagnostics), en fraction de la valeur du bien à cette date. */
  tauxFraisReventeEstimes: number;
}

export const HYPOTHESES_PROJECTION: Record<ProfilProjection, HypothesesProjection> = {
  prudent: {
    tauxValorisationBienAnnuel: 0.015,
    tauxIndexationLoyerAnnuel: 0.01,
    tauxIndexationChargesAnnuel: 0.01,
    tauxFraisReventeEstimes: 0.06,
  },
  optimiste: {
    tauxValorisationBienAnnuel: 0.02,
    tauxIndexationLoyerAnnuel: 0.015,
    tauxIndexationChargesAnnuel: 0.015,
    tauxFraisReventeEstimes: 0.06,
  },
};

export interface EntreesProjection {
  valeurBienInitiale: number;
  loyerMensuelInitial: number;
  /** Charges mensuelles hors mensualité de crédit (taxe foncière, assurance, gestion, entretien, vacance...). */
  chargesMensuellesInitiales: number;
  /** Omis (ou montantEmprunte à 0) pour un achat cash : pas d'échéancier de crédit. */
  financement?: EntreesFinancement;
  apportInitial: number;
  annees?: number[];
  /** Frais d'acquisition réels (frais de notaire...), pour un calcul de plus-value plus précis que le forfait légal. */
  fraisAcquisitionReels?: number;
  /** Travaux réels réalisés à l'achat, pour un calcul de plus-value plus précis que le forfait légal. */
  travauxReels?: number;
  /**
   * Permet de remplacer les hypothèses par défaut (HYPOTHESES_PROJECTION) par des valeurs
   * choisies par l'utilisateur, profil par profil — ajouté à la demande de Dorian pour que
   * les taux de valorisation/indexation/frais de revente soient modifiables depuis
   * l'interface plutôt que figés en dur. Un profil omis garde ses valeurs par défaut.
   */
  hypotheses?: Partial<Record<ProfilProjection, HypothesesProjection>>;
}

export interface PointProjection {
  annee: number;
  valeurBien: number;
  capitalRestantDu: number;
  /** Ce qui serait réellement perçu en revendant à cette échéance, AVANT impôt sur la plus-value. */
  produitNetRevente: number;
  /** Estimation INDICATIVE de l'impôt sur la plus-value immobilière (cas standard, voir plus-value.ts). */
  impotPlusValueEstime: number;
  /** produitNetRevente − impotPlusValueEstime. */
  produitNetReventeApresImpot: number;
  cashFlowCumule: number;
  /** produitNetReventeApresImpot + cashFlowCumule − apportInitial. */
  patrimoineNet: number;
}

export interface ProjectionParProfil {
  prudent: PointProjection[];
  optimiste: PointProjection[];
}

function validerEntrees(entrees: EntreesProjection): void {
  if (entrees.valeurBienInitiale < 0) throw new Error("La valeur du bien ne peut pas être négative.");
  if (entrees.loyerMensuelInitial < 0) throw new Error("Le loyer ne peut pas être négatif.");
  if (entrees.chargesMensuellesInitiales < 0) throw new Error("Les charges ne peuvent pas être négatives.");
}

function calculerUnProfil(entrees: EntreesProjection, hypotheses: HypothesesProjection): PointProjection[] {
  const annees = entrees.annees ?? ANNEES_PROJECTION_DEFAUT;
  const moisMax = Math.max(...annees) * 12;

  const echeancier =
    entrees.financement && entrees.financement.montantEmprunte > 0
      ? genererEcheancierMensuel(entrees.financement)
      : [];

  const cashFlowParMois: number[] = [];
  let cumul = 0;
  for (let mois = 1; mois <= moisMax; mois++) {
    const anneesEcoulees = Math.ceil(mois / 12) - 1;
    const loyerDuMois =
      entrees.loyerMensuelInitial * Math.pow(1 + hypotheses.tauxIndexationLoyerAnnuel, anneesEcoulees);
    const chargesDuMois =
      entrees.chargesMensuellesInitiales * Math.pow(1 + hypotheses.tauxIndexationChargesAnnuel, anneesEcoulees);
    const ligneCredit = echeancier[mois - 1];
    const mensualiteDuMois = ligneCredit ? ligneCredit.mensualiteHorsAssurance : 0;
    cumul += loyerDuMois - chargesDuMois - mensualiteDuMois;
    cashFlowParMois.push(cumul);
  }

  return annees.map((annee) => {
    const mois = annee * 12;
    const valeurBien = entrees.valeurBienInitiale * Math.pow(1 + hypotheses.tauxValorisationBienAnnuel, annee);
    const capitalRestantDu = capitalRestantDuAuMois(echeancier, mois);
    const cashFlowCumule = cashFlowParMois[mois - 1] ?? 0;
    const prixCessionNetFrais = valeurBien * (1 - hypotheses.tauxFraisReventeEstimes);
    const produitNetRevente = prixCessionNetFrais - capitalRestantDu;

    const plusValue = calculerPlusValueImmobiliere({
      prixAcquisition: entrees.valeurBienInitiale,
      prixCession: prixCessionNetFrais,
      dureeDetentionAnnees: annee,
      fraisAcquisitionReels: entrees.fraisAcquisitionReels,
      travauxReels: entrees.travauxReels,
    });
    const impotPlusValueEstime = plusValue.impotTotal;
    const produitNetReventeApresImpot = produitNetRevente - impotPlusValueEstime;

    return {
      annee,
      valeurBien,
      capitalRestantDu,
      produitNetRevente,
      impotPlusValueEstime,
      produitNetReventeApresImpot,
      cashFlowCumule,
      patrimoineNet: produitNetReventeApresImpot + cashFlowCumule - entrees.apportInitial,
    };
  });
}

export function calculerProjection(entrees: EntreesProjection): ProjectionParProfil {
  validerEntrees(entrees);
  return {
    prudent: calculerUnProfil(entrees, entrees.hypotheses?.prudent ?? HYPOTHESES_PROJECTION.prudent),
    optimiste: calculerUnProfil(entrees, entrees.hypotheses?.optimiste ?? HYPOTHESES_PROJECTION.optimiste),
  };
}
