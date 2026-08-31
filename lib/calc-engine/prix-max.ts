/**
 * Prix d'achat maximum (section 6 et 13 du cahier des charges).
 *
 * Pas de résolution algébrique "à la main" (fragile : les frais de notaire dépendent
 * du prix, le financement peut en dépendre aussi...). Solveur par dichotomie à la
 * place : robuste, déterministe, testable, et continue de fonctionner quel que soit
 * le détail du pipeline appelé (acquisition → travaux → financement → investisseur ou
 * marchand) — ce module ne connaît d'ailleurs pas ce pipeline, il reçoit juste une
 * fonction `calculerIndicateur(prixAchat)` fournie par l'appelant.
 *
 * Hypothèse portée par tous les indicateurs de ce système (rendement, marge, cash-flow) :
 * à hypothèses égales par ailleurs, l'indicateur DÉCROÎT quand le prix d'achat AUGMENTE
 * (plus cher à l'achat = moins rentable). C'est vrai pour toutes les formules de
 * lib/calc-engine actuelles ; si un futur indicateur ne respecte pas cette hypothèse,
 * ce solveur ne s'applique pas tel quel.
 */

export interface OptionsRecherchePrixMax {
  /** Calcule l'indicateur choisi (rendement, marge %, cash-flow...) pour un prix d'achat donné. */
  calculerIndicateur: (prixAchat: number) => number;
  /** Valeur cible minimale de l'indicateur (ex: 0.15 pour "rendement net >= 15%"). */
  objectif: number;
  prixMin?: number;
  prixMax?: number;
  /** Tolérance d'arrêt, en euros (défaut : 50 €). */
  precision?: number;
  iterationsMax?: number;
}

export interface ResultatPrixMax {
  prixMaximum: number;
  indicateurAtteint: number;
  iterations: number;
  /**
   * false si aucune solution n'a pu être bornée dans [prixMin, prixMax] :
   * - l'objectif n'est déjà pas atteint à prixMin (aucun prix ne convient) ;
   * - ou l'objectif est encore atteint à prixMax (le plafond réel est au-delà de l'intervalle testé).
   * Dans les deux cas, prixMaximum et indicateurAtteint restent renseignés (bornes de l'intervalle).
   */
  convergé: boolean;
}

export function trouverPrixMaximum(options: OptionsRecherchePrixMax): ResultatPrixMax {
  const {
    calculerIndicateur,
    objectif,
    prixMin = 0,
    prixMax = 10_000_000,
    precision = 50,
    iterationsMax = 200,
  } = options;

  if (prixMin < 0) {
    throw new Error("prixMin ne peut pas être négatif.");
  }
  if (prixMax <= prixMin) {
    throw new Error("prixMax doit être strictement supérieur à prixMin.");
  }
  if (precision <= 0) {
    throw new Error("precision doit être strictement positive.");
  }

  const indicateurAuMin = calculerIndicateur(prixMin);
  if (indicateurAuMin < objectif) {
    // Même au prix le plus bas testé, l'objectif n'est pas atteint : pas de solution dans l'intervalle.
    return { prixMaximum: prixMin, indicateurAtteint: indicateurAuMin, iterations: 0, convergé: false };
  }

  const indicateurAuMax = calculerIndicateur(prixMax);
  if (indicateurAuMax >= objectif) {
    // L'objectif est encore respecté au prix le plus haut testé : le vrai plafond est hors intervalle.
    return { prixMaximum: prixMax, indicateurAtteint: indicateurAuMax, iterations: 0, convergé: false };
  }

  let bas = prixMin;
  let haut = prixMax;
  let iterations = 0;

  while (haut - bas > precision && iterations < iterationsMax) {
    const milieu = (bas + haut) / 2;
    const indicateur = calculerIndicateur(milieu);
    if (indicateur >= objectif) {
      bas = milieu;
    } else {
      haut = milieu;
    }
    iterations++;
  }

  return {
    prixMaximum: bas,
    indicateurAtteint: calculerIndicateur(bas),
    iterations,
    convergé: true,
  };
}

/** Génère une phrase d'explication en langage clair (doc section 13). */
export function expliquerResultatPrixMax(
  resultat: ResultatPrixMax,
  nomIndicateur: string,
  objectif: number,
  formatterValeur: (v: number) => string = (v) => v.toFixed(2)
): string {
  if (!resultat.convergé && resultat.indicateurAtteint < objectif) {
    return (
      `Aucun prix d'achat testé ne permet d'atteindre l'objectif de ${nomIndicateur} ` +
      `(${formatterValeur(objectif)}) : même au prix minimum testé (${formatterValeur(resultat.prixMaximum)} €), ` +
      `le ${nomIndicateur} n'est que de ${formatterValeur(resultat.indicateurAtteint)}.`
    );
  }
  if (!resultat.convergé) {
    return (
      `L'objectif de ${nomIndicateur} (${formatterValeur(objectif)}) reste atteint même au prix maximum testé ` +
      `(${formatterValeur(resultat.prixMaximum)} €) : le vrai plafond est plus élevé, essayez avec un intervalle de recherche plus large.`
    );
  }
  return (
    `Pour un objectif de ${nomIndicateur} de ${formatterValeur(objectif)}, le prix d'achat maximum ` +
    `est d'environ ${formatterValeur(resultat.prixMaximum)} € (${nomIndicateur} obtenu : ${formatterValeur(resultat.indicateurAtteint)}).`
  );
}
