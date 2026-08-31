/**
 * Impôt sur la plus-value immobilière à la revente — cas STANDARD d'un bien locatif
 * détenu par un particulier (hors résidence principale — non applicable à un bien loué —
 * et hors exonérations spécifiques : premier achat, retraité/invalide sous conditions de
 * ressources, expropriation, montant de cession < 15 000 €...).
 *
 * Ajouté à la demande de Dorian ("juste à titre indicatif") après une première version où
 * la fiscalité de la revente était totalement exclue (voir docs/ADDENDUM_FISCALITE.md) :
 * le barème et les abattements pour durée de détention sont des règles publiques fixes
 * (pas dépendantes de la situation personnelle, contrairement à l'IR sur les loyers), donc
 * raisonnables à calculer par défaut — même logique que les frais de notaire : hypothèses
 * vérifiées à ce jour, jamais figées en dur ailleurs, et clairement présentées comme une
 * ESTIMATION INDICATIVE partout où ce module est utilisé dans l'UI.
 *
 * Volontairement HORS PÉRIMÈTRE (à ne jamais présenter comme inclus) :
 * - la surtaxe sur les plus-values > 50 000 € (barème progressif 2 % à 6 %) ;
 * - toute exonération liée à la situation personnelle du vendeur.
 *
 * Sources vérifiées 2026 : service-public.fr et impots.gouv.fr, barème des abattements
 * pour durée de détention sur les plus-values immobilières des particuliers.
 */

export const TAUX_IR_PLUS_VALUE = 0.19;
export const TAUX_PRELEVEMENTS_SOCIAUX_PLUS_VALUE = 0.172;
/** Forfait "frais d'acquisition" utilisable sans justificatif, en fraction du prix d'acquisition. */
export const TAUX_FORFAIT_FRAIS_ACQUISITION = 0.075;
/** Forfait "travaux", utilisable sans justificatif au-delà de 5 ans de détention. */
export const TAUX_FORFAIT_TRAVAUX = 0.15;
export const DUREE_MIN_FORFAIT_TRAVAUX_ANNEES = 5;

/** Abattement cumulé sur la base imposable à l'IR (19%) selon la durée de détention. Exonération totale à 22 ans. */
export function abattementIR(dureeDetentionAnnees: number): number {
  if (dureeDetentionAnnees >= 22) return 1;
  if (dureeDetentionAnnees <= 5) return 0;
  return Math.min(1, (dureeDetentionAnnees - 5) * 0.06);
}

/** Abattement cumulé sur la base imposable aux prélèvements sociaux (17,2%). Exonération totale à 30 ans. */
export function abattementPrelevementsSociaux(dureeDetentionAnnees: number): number {
  if (dureeDetentionAnnees >= 30) return 1;
  if (dureeDetentionAnnees <= 5) return 0;
  if (dureeDetentionAnnees <= 21) return (dureeDetentionAnnees - 5) * 0.0165;
  // 16 ans à 1,65 %/an (années 6 à 21) = 26,4 %, puis 1,60 % l'année 22, puis 9 %/an (années 23 à 30).
  const baseAvant22 = 16 * 0.0165 + 0.016;
  return Math.min(1, baseAvant22 + (dureeDetentionAnnees - 22) * 0.09);
}

export interface EntreesPlusValue {
  prixAcquisition: number;
  /** Prix de cession net des frais de vente (agence, diagnostics) — ils sont déductibles du prix de cession. */
  prixCession: number;
  dureeDetentionAnnees: number;
  /** Frais d'acquisition réels et justifiés (frais de notaire...) ; sinon le forfait de 7,5% est utilisé. */
  fraisAcquisitionReels?: number;
  /** Travaux réels et justifiés ; sinon le forfait de 15% est utilisé si détention >= 5 ans. */
  travauxReels?: number;
}

export interface ResultatPlusValue {
  plusValueBrute: number;
  baseImposableIR: number;
  baseImposablePrelevementsSociaux: number;
  impotIR: number;
  prelevementsSociaux: number;
  impotTotal: number;
  produitNetApresImpot: number;
}

export function calculerPlusValueImmobiliere(entrees: EntreesPlusValue): ResultatPlusValue {
  if (entrees.prixAcquisition < 0 || entrees.prixCession < 0) {
    throw new Error("Les prix ne peuvent pas être négatifs.");
  }
  if (entrees.dureeDetentionAnnees < 0) {
    throw new Error("La durée de détention ne peut pas être négative.");
  }

  const fraisAcquisition =
    entrees.fraisAcquisitionReels ?? entrees.prixAcquisition * TAUX_FORFAIT_FRAIS_ACQUISITION;
  const travaux =
    entrees.travauxReels ??
    (entrees.dureeDetentionAnnees >= DUREE_MIN_FORFAIT_TRAVAUX_ANNEES
      ? entrees.prixAcquisition * TAUX_FORFAIT_TRAVAUX
      : 0);

  const baseAcquisition = entrees.prixAcquisition + fraisAcquisition + travaux;
  const plusValueBrute = Math.max(0, entrees.prixCession - baseAcquisition);

  const baseImposableIR = plusValueBrute * (1 - abattementIR(entrees.dureeDetentionAnnees));
  const baseImposablePrelevementsSociaux =
    plusValueBrute * (1 - abattementPrelevementsSociaux(entrees.dureeDetentionAnnees));

  const impotIR = baseImposableIR * TAUX_IR_PLUS_VALUE;
  const prelevementsSociaux = baseImposablePrelevementsSociaux * TAUX_PRELEVEMENTS_SOCIAUX_PLUS_VALUE;
  const impotTotal = impotIR + prelevementsSociaux;

  return {
    plusValueBrute,
    baseImposableIR,
    baseImposablePrelevementsSociaux,
    impotIR,
    prelevementsSociaux,
    impotTotal,
    produitNetApresImpot: entrees.prixCession - impotTotal,
  };
}
