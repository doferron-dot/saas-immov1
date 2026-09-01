/**
 * Prix d'achat maximum pour une opération — compose lib/calc-engine/prix-max.ts (solveur
 * générique par dichotomie) avec le reste du moteur de calcul, exactement comme
 * lib/operations/calculer-resultats.ts. Aucun calcul financier ici, uniquement de
 * l'assemblage : prix-max.ts ne connaît pas le pipeline (acquisition → financement →
 * investisseur/marchand), il reçoit juste une fonction `calculerIndicateur(prixAchat)`.
 *
 * Choix retenu pour ce qui varie avec le prix testé, et ce qui reste fixe (cohérent avec
 * l'ambiguïté #5 de docs/ANALYSE_ET_ARCHITECTURE_V1.md, section 1) :
 * - L'apport reste FIXE (c'est le cash disponible, indépendant du prix négocié).
 * - Le montant emprunté S'AJUSTE avec le prix : coût total d'acquisition(prix) + travaux
 *   − apport (le crédit couvre ce que l'apport ne couvre pas), taux/durée/assurance/
 *   différé du crédit restent ceux déjà saisis.
 * - Les travaux et (marchand) les prix de revente des lots restent FIXES : on cherche le
 *   prix d'ACHAT maximum pour un projet donné, pas un projet différent.
 *
 * Chaque indicateur disponible (rendement net, cash-flow, marge %, ROI) décroît bien
 * quand le prix d'achat augmente — condition requise par trouverPrixMaximum (voir son
 * en-tête) — puisque le coût total d'acquisition (et donc le crédit nécessaire) augmente
 * avec le prix alors que loyers/revente restent fixes.
 */
import { calculerAcquisition, type TypeBien } from "../calc-engine/acquisition";
import { calculerFinancement } from "../calc-engine/financement";
import { calculerInvestisseur } from "../calc-engine/investisseur";
import { calculerMarchand, type EntreesLocationMarchand } from "../calc-engine/marchand";
import { trouverPrixMaximum, type ResultatPrixMax } from "../calc-engine/prix-max";
import type { Operation } from "../db/operations";
import type { FinancementDB } from "../db/financement";
import type { OperationInvestisseurDB } from "../db/operation-investisseur";
import type { LotMarchandDB } from "../db/operation-marchand-lots";
import type { OperationMarchandLocationDB } from "../db/operation-marchand-location";

export type ObjectifInvestisseur = "rendementNet" | "cashFlowMensuel";
export type ObjectifMarchand = "margePct" | "roi";

function calculerAcquisitionEtCredit(
  operation: Operation,
  prixAchat: number,
  totalTravaux: number,
  apport: number,
  financement: FinancementDB | null
) {
  const acquisition = calculerAcquisition({
    prixAchat,
    typeBien: (operation.ancien_ou_neuf ?? "ancien") as TypeBien,
    fraisAgence: operation.frais_agence,
    fraisAgenceInclus: operation.frais_agence_inclus,
    fraisDossier: operation.frais_dossier,
    fraisGarantie: operation.frais_garantie,
    autresFrais: operation.autres_frais_acquisition,
    hypotheses: operation.taux_dmto != null ? { tauxDmto: operation.taux_dmto } : undefined,
  });

  const montantEmprunte = Math.max(0, acquisition.coutTotalAcquisition + totalTravaux - apport);
  const detailFinancement =
    montantEmprunte > 0 && financement
      ? calculerFinancement({
          montantEmprunte,
          tauxAnnuel: financement.taux,
          dureeMois: financement.duree_mois || 1,
          tauxAssuranceAnnuel: financement.assurance_taux,
          fraisBancaires: financement.frais_bancaires,
          differeType: financement.differe_type,
          differeMois: financement.differe_mois,
        })
      : null;

  return { acquisition, detailFinancement };
}

export interface EntreesPrixMaxInvestisseur {
  operation: Operation;
  totalTravaux: number;
  financement: FinancementDB | null;
  investisseur: OperationInvestisseurDB;
  objectif: ObjectifInvestisseur;
  /** Fraction (0.04 pour 4%) pour rendementNet, montant en euros pour cashFlowMensuel. */
  valeurObjectif: number;
}

export function calculerPrixMaxInvestisseur(entrees: EntreesPrixMaxInvestisseur): ResultatPrixMax {
  const apport = entrees.financement?.apport ?? 0;

  return trouverPrixMaximum({
    objectif: entrees.valeurObjectif,
    // prixMin à 1 € (pas 0) : à coût total d'acquisition exactement nul, les indicateurs
    // du moteur de calcul renvoient 0 par convention (garde-fou division par zéro), ce qui
    // casserait à tort l'hypothèse "l'indicateur décroît quand le prix augmente" tout au
    // début de l'intervalle.
    prixMin: 1,
    calculerIndicateur: (prixAchat: number) => {
      const { acquisition, detailFinancement } = calculerAcquisitionEtCredit(
        entrees.operation,
        prixAchat,
        entrees.totalTravaux,
        apport,
        entrees.financement
      );
      const detail = calculerInvestisseur(
        {
          loyerMensuel: entrees.investisseur.loyer_mensuel,
          chargesNonRecuperablesAnnuelles: entrees.investisseur.charges_non_recuperables,
          taxeFonciereAnnuelle: entrees.investisseur.taxe_fonciere,
          assurancePnoAnnuelle: entrees.investisseur.assurance_pno,
          fraisGestionPct: entrees.investisseur.frais_gestion_pct,
          entretienPct: entrees.investisseur.entretien_pct,
          vacanceLocativePct: entrees.investisseur.vacance_locative_pct,
          autresChargesAnnuelles: entrees.investisseur.autres_charges,
        },
        acquisition.coutTotalAcquisition,
        detailFinancement?.mensualiteTotale ?? 0
      );
      return entrees.objectif === "rendementNet" ? detail.rendementNet : detail.cashFlowMensuel;
    },
  });
}

export interface EntreesPrixMaxMarchand {
  operation: Operation;
  totalTravaux: number;
  financement: FinancementDB | null;
  lots: LotMarchandDB[];
  objectif: ObjectifMarchand;
  /** Fraction (0.15 pour 15%) pour margePct et roi. */
  valeurObjectif: number;
  /** Location du bien avant la revente (cf. lib/calc-engine/marchand.ts) — fixe, comme les
   *  travaux et les prix de revente des lots (voir l'en-tête de ce fichier). */
  locationMarchand?: OperationMarchandLocationDB | null;
}

export function calculerPrixMaxMarchand(entrees: EntreesPrixMaxMarchand): ResultatPrixMax {
  const apport = entrees.financement?.apport ?? 0;
  const lotsCalc = entrees.lots.map((l) => ({
    nomLot: l.nom_lot,
    typeLot: l.type_lot ?? undefined,
    prixReventePrevu: l.prix_revente_prevu,
  }));
  const location: EntreesLocationMarchand | undefined = entrees.locationMarchand
    ? {
        dureeLocationMois: entrees.locationMarchand.duree_location_mois,
        entreesLocatives: {
          loyerMensuel: entrees.locationMarchand.loyer_mensuel,
          chargesNonRecuperablesAnnuelles: entrees.locationMarchand.charges_non_recuperables,
          taxeFonciereAnnuelle: entrees.locationMarchand.taxe_fonciere,
          assurancePnoAnnuelle: entrees.locationMarchand.assurance_pno,
          fraisGestionPct: entrees.locationMarchand.frais_gestion_pct,
          entretienPct: entrees.locationMarchand.entretien_pct,
          vacanceLocativePct: entrees.locationMarchand.vacance_locative_pct,
          autresChargesAnnuelles: entrees.locationMarchand.autres_charges,
        },
      }
    : undefined;

  return trouverPrixMaximum({
    objectif: entrees.valeurObjectif,
    // prixMin à 1 € (pas 0) : à coût total d'acquisition exactement nul, les indicateurs
    // du moteur de calcul renvoient 0 par convention (garde-fou division par zéro), ce qui
    // casserait à tort l'hypothèse "l'indicateur décroît quand le prix augmente" tout au
    // début de l'intervalle.
    prixMin: 1,
    calculerIndicateur: (prixAchat: number) => {
      const { acquisition, detailFinancement } = calculerAcquisitionEtCredit(
        entrees.operation,
        prixAchat,
        entrees.totalTravaux,
        apport,
        entrees.financement
      );
      const coutTotalCredit = detailFinancement?.coutTotalCredit ?? 0;
      const montantTotalInvesti = apport + coutTotalCredit;
      const detail = calculerMarchand(
        { lots: lotsCalc, fraisRevente: entrees.operation.frais_revente, location },
        acquisition.coutTotalAcquisition,
        entrees.totalTravaux,
        coutTotalCredit,
        montantTotalInvesti
      );
      return entrees.objectif === "margePct" ? detail.margePct : detail.roi;
    },
  });
}
