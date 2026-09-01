/**
 * Mode marchand de biens (section 6 du cahier des charges, "Mode marchand de biens").
 * Marge, marge en %, ROI — sur une opération à un ou plusieurs lots revendus.
 *
 * Contrairement au mode investisseur (rendement locatif), il n'y a pas de notion de
 * loyer : l'opération se solde par la revente des lots, comparée au coût total engagé.
 *
 * Exception, à la demande de Dorian (2026-09-01) : un marchand de biens a jusqu'à ~5 ans
 * pour revendre, et peut donc mettre le bien en location pendant cette période de
 * détention. `EntreesMarchand.location` (optionnel) modélise ce revenu locatif — mêmes
 * champs que le mode investisseur (validé avec Dorian : "mêmes champs détaillés qu'en
 * mode investisseur"), plus une durée de location en mois. Réutilise calculerInvestisseur
 * (déjà testé) pour le calcul loyers encaissés - charges ; le coût du crédit n'est PAS
 * déduit ici (mensualiteCredit=0 passé à calculerInvestisseur) car il est déjà compté à
 * part dans coutTotalOperation — pas question de le déduire deux fois.
 */
import { calculerInvestisseur, type EntreesInvestisseur } from "./investisseur";

export interface LotMarchand {
  nomLot: string;
  typeLot?: string;
  prixReventePrevu: number;
}

export interface EntreesLocationMarchand {
  /** Durée pendant laquelle le bien est loué avant sa revente, en mois. */
  dureeLocationMois: number;
  /** Mêmes champs que le mode investisseur locatif (loyer, charges...). */
  entreesLocatives: EntreesInvestisseur;
}

export interface EntreesMarchand {
  lots: LotMarchand[];
  /** Frais liés à la revente (commission d'agence, diagnostics, etc.), en montant. */
  fraisRevente: number;
  /** Location du bien pendant la période de détention avant la revente — optionnelle. */
  location?: EntreesLocationMarchand;
}

export interface DetailMarchand {
  chiffreAffairesTotal: number;
  coutTotalOperation: number;
  /** Revenu locatif net (loyers encaissés - charges) sur la durée de location — 0 si pas de location. */
  revenuLocatifNet: number;
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
  if (entrees.location && entrees.location.dureeLocationMois < 0) {
    throw new Error("La durée de location ne peut pas être négative.");
  }
}

/**
 * Revenu locatif net (loyers encaissés - charges, hors coût du crédit) sur la durée de
 * location. 0 si aucune location n'est renseignée ou si la durée est nulle.
 */
function calculerRevenuLocatifNet(location: EntreesLocationMarchand | undefined): number {
  if (!location || location.dureeLocationMois <= 0) return 0;
  // coutTotalAcquisition à 0 : seul cashFlowAnnuel (loyers encaissés - charges, mensualité
  // de crédit à 0) nous intéresse ici, pas rendementBrut/rendementNet.
  const detail = calculerInvestisseur(location.entreesLocatives, 0, 0);
  return (detail.cashFlowAnnuel / 12) * location.dureeLocationMois;
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
  const revenuLocatifNet = calculerRevenuLocatifNet(entrees.location);
  const marge = chiffreAffairesTotal + revenuLocatifNet - coutTotalOperation;
  const margePct = chiffreAffairesTotal > 0 ? marge / chiffreAffairesTotal : 0;
  const roi = montantTotalInvesti > 0 ? marge / montantTotalInvesti : 0;

  return {
    chiffreAffairesTotal,
    coutTotalOperation,
    revenuLocatifNet,
    marge,
    margePct,
    roi,
  };
}
