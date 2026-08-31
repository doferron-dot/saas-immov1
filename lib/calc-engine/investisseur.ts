/**
 * Mode investisseur locatif (section 10 du cahier des charges).
 * Rendements brut/net, cash-flow. Le "net-net" (après fiscalité) se calcule en
 * combinant ce module avec lib/calc-engine/fiscalite.ts (voir calculerRendementNetNet).
 *
 * Simplification assumée : les charges récupérables (avancées par le propriétaire puis
 * refacturées au locataire) sont supposées intégralement récupérées, donc neutres sur le
 * rendement — seules les charges NON récupérables entrent dans le calcul.
 */
import type { ResultatFiscal } from "./fiscalite";

export interface EntreesInvestisseur {
  loyerMensuel: number;
  chargesNonRecuperablesAnnuelles: number;
  taxeFonciereAnnuelle: number;
  assurancePnoAnnuelle: number;
  /** Fraction du loyer encaissé (ex: 0.08 pour 8%). */
  fraisGestionPct: number;
  /** Fraction du loyer encaissé provisionnée pour l'entretien. */
  entretienPct: number;
  /** Fraction du loyer annuel brut perdue à la vacance locative. */
  vacanceLocativePct: number;
  autresChargesAnnuelles: number;
}

export interface DetailInvestisseur {
  loyersAnnuelsBruts: number;
  perteVacanceLocative: number;
  loyersAnnuelsEncaisses: number;
  fraisGestion: number;
  entretien: number;
  chargesAnnuelles: number;
  rendementBrut: number;
  rendementNet: number;
  cashFlowMensuel: number;
  cashFlowAnnuel: number;
}

function valider(entrees: EntreesInvestisseur): void {
  if (entrees.loyerMensuel < 0) throw new Error("Le loyer mensuel ne peut pas être négatif.");
  for (const [nom, valeur] of Object.entries({
    fraisGestionPct: entrees.fraisGestionPct,
    entretienPct: entrees.entretienPct,
    vacanceLocativePct: entrees.vacanceLocativePct,
  })) {
    if (valeur < 0 || valeur > 1) {
      throw new Error(`${nom} doit être une fraction entre 0 et 1.`);
    }
  }
}

export function calculerInvestisseur(
  entrees: EntreesInvestisseur,
  coutTotalAcquisition: number,
  mensualiteCredit: number
): DetailInvestisseur {
  valider(entrees);
  if (coutTotalAcquisition < 0) {
    throw new Error("Le coût total d'acquisition ne peut pas être négatif.");
  }

  const loyersAnnuelsBruts = entrees.loyerMensuel * 12;
  const perteVacanceLocative = loyersAnnuelsBruts * entrees.vacanceLocativePct;
  const loyersAnnuelsEncaisses = loyersAnnuelsBruts - perteVacanceLocative;

  const fraisGestion = loyersAnnuelsEncaisses * entrees.fraisGestionPct;
  const entretien = loyersAnnuelsEncaisses * entrees.entretienPct;

  const chargesAnnuelles =
    entrees.chargesNonRecuperablesAnnuelles +
    entrees.taxeFonciereAnnuelle +
    entrees.assurancePnoAnnuelle +
    fraisGestion +
    entretien +
    entrees.autresChargesAnnuelles;

  const rendementBrut = coutTotalAcquisition > 0 ? loyersAnnuelsBruts / coutTotalAcquisition : 0;
  const rendementNet =
    coutTotalAcquisition > 0
      ? (loyersAnnuelsEncaisses - chargesAnnuelles) / coutTotalAcquisition
      : 0;

  const cashFlowAnnuel = loyersAnnuelsEncaisses - chargesAnnuelles - mensualiteCredit * 12;
  const cashFlowMensuel = cashFlowAnnuel / 12;

  return {
    loyersAnnuelsBruts,
    perteVacanceLocative,
    loyersAnnuelsEncaisses,
    fraisGestion,
    entretien,
    chargesAnnuelles,
    rendementBrut,
    rendementNet,
    cashFlowMensuel,
    cashFlowAnnuel,
  };
}

/**
 * Rendement net-net = rendement net après fiscalité (résultat d'un des régimes de
 * lib/calc-engine/fiscalite.ts, calculé avec revenusLocatifsAnnuels = loyersAnnuelsEncaisses
 * et des charges déductibles cohérentes avec chargesAnnuelles ci-dessus).
 */
export function calculerRendementNetNet(
  detail: DetailInvestisseur,
  coutTotalAcquisition: number,
  resultatFiscal: ResultatFiscal
): { rendementNetNet: number; cashFlowNetNetAnnuel: number; cashFlowNetNetMensuel: number } {
  const cashFlowNetNetAnnuel = detail.cashFlowAnnuel - resultatFiscal.impotTotal;
  return {
    rendementNetNet:
      coutTotalAcquisition > 0
        ? (detail.loyersAnnuelsEncaisses - detail.chargesAnnuelles - resultatFiscal.impotTotal) /
          coutTotalAcquisition
        : 0,
    cashFlowNetNetAnnuel,
    cashFlowNetNetMensuel: cashFlowNetNetAnnuel / 12,
  };
}
