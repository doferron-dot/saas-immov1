/**
 * Impôt sur les revenus locatifs selon le régime fiscal choisi.
 * Périmètre V1 validé avec Dorian, documenté dans docs/ADDENDUM_FISCALITE.md.
 *
 * Simplification assumée et assumée explicitement : calcul "en régime de croisière"
 * (une année type), pas de simulation pluriannuelle des reports de déficit/amortissement
 * d'une année sur l'autre — les montants reportables sont calculés et affichés, mais pas
 * réinjectés automatiquement dans une "année suivante" (ça demanderait une simulation
 * pluriannuelle complète, hors périmètre V1).
 */
import { calculerAmortissementAnnuel, EntreesAmortissement } from "./amortissement";

export type RegimeFiscal = "micro-foncier" | "reel-foncier" | "lmnp-micro-bic" | "lmnp-reel";

/** Taux de prélèvements sociaux en vigueur. */
export const TAUX_PRELEVEMENTS_SOCIAUX = 0.172;
/** Plafond annuel d'imputation du déficit foncier (hors intérêts) sur le revenu global. */
export const PLAFOND_DEFICIT_FONCIER_IMPUTABLE = 10_700;

export interface ResultatFiscal {
  regime: RegimeFiscal;
  /** Base effectivement soumise à l'impôt sur le revenu + prélèvements sociaux (toujours >= 0). */
  resultatImposable: number;
  /** Déficit ou amortissement non utilisé cette année, reportable sur les années suivantes. */
  report: number;
  impotRevenu: number;
  prelevementsSociaux: number;
  /** Peut être négatif : une économie d'impôt nette (cas du déficit foncier imputé sur le revenu global). */
  impotTotal: number;
  revenuNetApresImpot: number;
}

interface EntreesCommunes {
  revenusLocatifsAnnuels: number;
  /** Tranche marginale d'imposition du foyer, ex. 0.30 pour 30%. Saisie manuelle (section "Ta décision" de l'addendum). */
  tmi: number;
}

function validerEntreesCommunes(entrees: EntreesCommunes): void {
  if (entrees.revenusLocatifsAnnuels < 0) {
    throw new Error("Les revenus locatifs ne peuvent pas être négatifs.");
  }
  if (entrees.tmi < 0 || entrees.tmi > 1) {
    throw new Error("La TMI doit être comprise entre 0 et 1.");
  }
}

function imposerResultatPositif(
  regime: RegimeFiscal,
  resultatImposable: number,
  report: number,
  entrees: EntreesCommunes
): ResultatFiscal {
  const impotRevenu = resultatImposable * entrees.tmi;
  const prelevementsSociaux = resultatImposable * TAUX_PRELEVEMENTS_SOCIAUX;
  const impotTotal = impotRevenu + prelevementsSociaux;
  return {
    regime,
    resultatImposable,
    report,
    impotRevenu,
    prelevementsSociaux,
    impotTotal,
    revenuNetApresImpot: entrees.revenusLocatifsAnnuels - impotTotal,
  };
}

/** Location nue, micro-foncier : abattement forfaitaire de 30%. */
export function calculerMicroFoncier(entrees: EntreesCommunes): ResultatFiscal {
  validerEntreesCommunes(entrees);
  const resultatImposable = entrees.revenusLocatifsAnnuels * 0.7;
  return imposerResultatPositif("micro-foncier", resultatImposable, 0, entrees);
}

/**
 * Location nue, régime réel : charges réelles déductibles, avec la distinction fiscale
 * entre déficit dû aux intérêts d'emprunt (jamais imputable sur le revenu global, seulement
 * reportable sur les revenus fonciers futurs) et déficit dû aux autres charges (imputable
 * sur le revenu global dans la limite de 10 700 €/an, le surplus étant reportable 10 ans).
 */
export function calculerReelFoncier(
  entrees: EntreesCommunes & {
    chargesDeductiblesHorsInterets: number;
    interetsEmprunt: number;
  }
): ResultatFiscal {
  validerEntreesCommunes(entrees);
  if (entrees.chargesDeductiblesHorsInterets < 0 || entrees.interetsEmprunt < 0) {
    throw new Error("Les charges et intérêts ne peuvent pas être négatifs.");
  }

  const resultatHorsInterets =
    entrees.revenusLocatifsAnnuels - entrees.chargesDeductiblesHorsInterets;

  let deficitImputableRevenuGlobal = 0;
  let report = 0;
  let resultatFoncierPositif = 0;

  if (resultatHorsInterets < 0) {
    const deficitHorsInterets = -resultatHorsInterets;
    deficitImputableRevenuGlobal = Math.min(
      deficitHorsInterets,
      PLAFOND_DEFICIT_FONCIER_IMPUTABLE
    );
    report += deficitHorsInterets - deficitImputableRevenuGlobal;
    // Les intérêts d'emprunt ne sont jamais imputables sur le revenu global.
    report += entrees.interetsEmprunt;
  } else {
    const resultatApresInterets = resultatHorsInterets - entrees.interetsEmprunt;
    if (resultatApresInterets >= 0) {
      resultatFoncierPositif = resultatApresInterets;
    } else {
      report = -resultatApresInterets;
    }
  }

  const economieImpotDeficitGlobal = deficitImputableRevenuGlobal * entrees.tmi;
  const impotSurResultatPositif = resultatFoncierPositif * entrees.tmi;
  const prelevementsSociaux = resultatFoncierPositif * TAUX_PRELEVEMENTS_SOCIAUX;
  const impotTotal = impotSurResultatPositif + prelevementsSociaux - economieImpotDeficitGlobal;

  return {
    regime: "reel-foncier",
    resultatImposable: resultatFoncierPositif,
    report,
    impotRevenu: impotSurResultatPositif - economieImpotDeficitGlobal,
    prelevementsSociaux,
    impotTotal,
    revenuNetApresImpot: entrees.revenusLocatifsAnnuels - impotTotal,
  };
}

/** LMNP, micro-BIC : abattement forfaitaire de 50%. */
export function calculerLmnpMicroBic(entrees: EntreesCommunes): ResultatFiscal {
  validerEntreesCommunes(entrees);
  const resultatImposable = entrees.revenusLocatifsAnnuels * 0.5;
  return imposerResultatPositif("lmnp-micro-bic", resultatImposable, 0, entrees);
}

/**
 * LMNP, régime réel avec amortissement décomposé par composant.
 * Règle clé : l'amortissement (comme les charges) ne peut jamais créer ni aggraver
 * un déficit BIC non professionnel — tout excédent est reporté sans limite de durée
 * sur les revenus BIC des années suivantes (jamais imputable sur le revenu global).
 */
export function calculerLmnpReel(
  entrees: EntreesCommunes & {
    chargesDeductibles: number;
    amortissement: EntreesAmortissement;
  }
): ResultatFiscal {
  validerEntreesCommunes(entrees);
  if (entrees.chargesDeductibles < 0) {
    throw new Error("Les charges déductibles ne peuvent pas être négatives.");
  }

  const resultatAvantAmortissement = entrees.revenusLocatifsAnnuels - entrees.chargesDeductibles;
  const deficitChargesNonImpute = Math.max(-resultatAvantAmortissement, 0);
  const baseAvantAmortissement = Math.max(resultatAvantAmortissement, 0);

  const amortissement = calculerAmortissementAnnuel(entrees.amortissement);
  const amortissementDeductible = Math.min(
    baseAvantAmortissement,
    amortissement.amortissementAnnuelTotal
  );
  const amortissementNonDeduit = amortissement.amortissementAnnuelTotal - amortissementDeductible;
  const resultatImposable = baseAvantAmortissement - amortissementDeductible;

  const report = deficitChargesNonImpute + amortissementNonDeduit;

  return imposerResultatPositif("lmnp-reel", resultatImposable, report, entrees);
}
