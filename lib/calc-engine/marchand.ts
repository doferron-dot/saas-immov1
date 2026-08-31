/**
 * Mode marchand de biens (section 6 du cahier des charges, "Mode marchand de biens").
 * Marge, marge en %, ROI — sur une opération à un ou plusieurs lots revendus.
 *
 * Contrairement au mode investisseur (rendement locatif), il n'y a pas de notion de
 * loyer : l'opération se solde par la revente des lots, comparée au coût total engagé.
 */

export interface LotMarchand {
  nomLot: string;
  typeLot?: string;
  prixReventePrevu: number;
}

export interface EntreesMarchand {
  lots: LotMarchand[];
  /** Frais liés à la revente (commission d'agence, diagnostics, etc.), en montant. */
  fraisRevente: number;
}

export interface DetailMarchand {
  chiffreAffairesTotal: number;
  coutTotalOperation: number;
  marge: number;
  margePct: number;
  roi: number;
}

function valider(entrees: EntreesMarchand): void {
  if (entrees.lots.length === 0) {
    throw new Error("Au moins un lot est requis pour le calcul du mode marchand de biens.");
  }
  for (const lot of entrees.lots) {
    if (lot.prixReventePrevu < 0) {
      throw new Error(`Le prix de revente prévu du lot "${lot.nomLot}" ne peut pas être négatif.`);
    }
  }
  if (entrees.fraisRevente < 0) {
    throw new Error("Les frais de revente ne peuvent pas être négatifs.");
  }
}

/**
 * @param coutTotalAcquisition Résultat de calculerAcquisition(...).coutTotalAcquisition
 * @param totalTravaux Résultat de calculerTravaux(...).totalTravauxAvecImprevus
 * @param coutTotalCredit Résultat de calculerFinancement(...).coutTotalCredit
 * @param montantTotalInvesti Apport + coût total du crédit (voir section 6, "Financement")
 */
export function calculerMarchand(
  entrees: EntreesMarchand,
  coutTotalAcquisition: number,
  totalTravaux: number,
  coutTotalCredit: number,
  montantTotalInvesti: number
): DetailMarchand {
  valider(entrees);
  if (coutTotalAcquisition < 0) {
    throw new Error("Le coût total d'acquisition ne peut pas être négatif.");
  }
  if (totalTravaux < 0) {
    throw new Error("Le total des travaux ne peut pas être négatif.");
  }
  if (coutTotalCredit < 0) {
    throw new Error("Le coût total du crédit ne peut pas être négatif.");
  }
  if (montantTotalInvesti < 0) {
    throw new Error("Le montant total investi ne peut pas être négatif.");
  }

  const chiffreAffairesTotal = entrees.lots.reduce((somme, lot) => somme + lot.prixReventePrevu, 0);
  const coutTotalOperation = coutTotalAcquisition + totalTravaux + coutTotalCredit + entrees.fraisRevente;
  const marge = chiffreAffairesTotal - coutTotalOperation;
  const margePct = chiffreAffairesTotal > 0 ? marge / chiffreAffairesTotal : 0;
  const roi = montantTotalInvesti > 0 ? marge / montantTotalInvesti : 0;

  return {
    chiffreAffairesTotal,
    coutTotalOperation,
    marge,
    margePct,
    roi,
  };
}
