/**
 * Calcul des frais d'acquisition (frais de notaire + frais annexes).
 *
 * Barème des émoluments du notaire et taux de DMTO vérifiés en 2026
 * (voir docs/ANALYSE_ET_ARCHITECTURE_V1.md, section 7, pour les sources).
 * Ces taux sont des HYPOTHÈSES PAR DÉFAUT, modifiables par l'utilisateur —
 * ils varient légalement par département et par décret.
 */

export type TypeBien = "ancien" | "neuf";

export interface HypothesesAcquisition {
  /** Taux de droits de mutation (DMTO), en fraction (ex: 0.0580665 pour 5,80665%) */
  tauxDmto: number;
  /** Frais de débours/formalités du notaire, en fraction du prix d'achat */
  tauxDebours: number;
  /** TVA appliquée aux émoluments du notaire (20% par défaut) */
  tauxTvaEmoluments: number;
}

// Valeurs par défaut vérifiées au 2026-08-25 — modifiables par hypothesesAcquisition en paramètre.
export const HYPOTHESES_DEFAUT: Record<TypeBien, HypothesesAcquisition> = {
  ancien: { tauxDmto: 0.0580665, tauxDebours: 0.01, tauxTvaEmoluments: 0.2 },
  neuf: { tauxDmto: 0.00715, tauxDebours: 0.01, tauxTvaEmoluments: 0.2 },
};

/** Barème dégressif 2026 des émoluments du notaire (identique ancien/neuf), en HT. */
const BAREME_EMOLUMENTS = [
  { plafond: 6_500, taux: 0.0387 },
  { plafond: 17_000, taux: 0.01596 },
  { plafond: 60_000, taux: 0.01064 },
  { plafond: Infinity, taux: 0.00799 },
];

/** Émoluments HT du notaire, calculés par tranches dégressives sur le prix d'achat. */
export function calculerEmolumentsHT(prixAchat: number): number {
  if (prixAchat <= 0) return 0;
  let reste = prixAchat;
  let precedent = 0;
  let total = 0;

  for (const tranche of BAREME_EMOLUMENTS) {
    const largeurTranche = tranche.plafond - precedent;
    const montantDansTranche = Math.min(reste, largeurTranche);
    if (montantDansTranche <= 0) break;
    total += montantDansTranche * tranche.taux;
    reste -= montantDansTranche;
    precedent = tranche.plafond;
    if (reste <= 0) break;
  }
  return total;
}

export interface DetailAcquisition {
  prixAchat: number;
  fraisAgence: number;
  emolumentsHT: number;
  emolumentsTTC: number;
  dmto: number;
  debours: number;
  fraisNotaireTotal: number;
  fraisDossier: number;
  fraisGarantie: number;
  autresFrais: number;
  coutTotalAcquisition: number;
}

export interface EntreesAcquisition {
  prixAchat: number;
  typeBien: TypeBien;
  fraisAgence: number;
  fraisAgenceInclus: boolean;
  fraisDossier?: number;
  fraisGarantie?: number;
  autresFrais?: number;
  hypotheses?: Partial<HypothesesAcquisition>;
}

export function calculerAcquisition(entrees: EntreesAcquisition): DetailAcquisition {
  if (entrees.prixAchat < 0) {
    throw new Error("Le prix d'achat ne peut pas être négatif.");
  }

  const hypothesesDefaut = HYPOTHESES_DEFAUT[entrees.typeBien];
  const hypotheses: HypothesesAcquisition = {
    ...hypothesesDefaut,
    ...entrees.hypotheses,
  };

  const emolumentsHT = calculerEmolumentsHT(entrees.prixAchat);
  const emolumentsTTC = emolumentsHT * (1 + hypotheses.tauxTvaEmoluments);
  const dmto = entrees.prixAchat * hypotheses.tauxDmto;
  const debours = entrees.prixAchat * hypotheses.tauxDebours;
  const fraisNotaireTotal = emolumentsTTC + dmto + debours;

  const fraisDossier = entrees.fraisDossier ?? 0;
  const fraisGarantie = entrees.fraisGarantie ?? 0;
  const autresFrais = entrees.autresFrais ?? 0;
  // Si les frais d'agence sont déjà inclus dans le prix d'achat affiché, on ne les
  // rajoute pas une seconde fois dans le coût total (mais on les affiche quand même,
  // section 6 : "statut des frais d'agence (inclus/exclus)").
  const fraisAgenceAAjouter = entrees.fraisAgenceInclus ? 0 : entrees.fraisAgence;

  const coutTotalAcquisition =
    entrees.prixAchat +
    fraisNotaireTotal +
    fraisAgenceAAjouter +
    fraisDossier +
    fraisGarantie +
    autresFrais;

  return {
    prixAchat: entrees.prixAchat,
    fraisAgence: entrees.fraisAgence,
    emolumentsHT,
    emolumentsTTC,
    dmto,
    debours,
    fraisNotaireTotal,
    fraisDossier,
    fraisGarantie,
    autresFrais,
    coutTotalAcquisition,
  };
}
