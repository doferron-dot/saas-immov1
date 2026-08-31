/**
 * Score 0-100 (sections 6 et 14 du cahier des charges).
 *
 * ⚠️ Barème proposé par Claude dans docs/ANALYSE_ET_ARCHITECTURE_V1.md (section 6),
 * explicitement marqué "à valider ou ajuster" par Dorian. Les POIDS par critère
 * viennent du document ; les SEUILS numériques précis (à partir de quand un rendement
 * est "excellent" vs "faible") sont une première proposition raisonnable, documentée
 * ci-dessous critère par critère, mais pas encore confirmée. Facilement ajustable :
 * tout est piloté par les constantes SEUILS_* plus bas, aucune valeur en dur ailleurs.
 *
 * Ce module ne fait aucun calcul financier lui-même : il reçoit en entrée les résultats
 * déjà calculés par les autres modules (acquisition, financement, investisseur/marchand,
 * scenarios) et se contente de les noter.
 */

export interface SeuilLineaire {
  /** Valeur en dessous de laquelle le score est nul. */
  seuilMin: number;
  /** Valeur à partir de laquelle le score est maximal. */
  seuilMax: number;
}

export interface SousScore {
  critere: string;
  points: number;
  pointsMax: number;
}

export interface ResultatScore {
  /** Score total sur 100. */
  total: number;
  sousScores: SousScore[];
  pointsForts: string[];
  pointsVigilance: string[];
}

/**
 * Score linéaire entre seuilMin (0 point) et seuilMax (pointsMax), plafonné aux deux
 * bouts. seuilMax peut être inférieur à seuilMin pour noter un indicateur où "plus bas
 * = mieux" (ex : taux d'endettement).
 */
export function scoreLineaire(valeur: number, seuils: SeuilLineaire, pointsMax: number): number {
  const { seuilMin, seuilMax } = seuils;
  if (seuilMax === seuilMin) {
    throw new Error("seuilMax et seuilMin ne peuvent pas être égaux.");
  }
  const croissant = seuilMax > seuilMin;
  if (croissant) {
    if (valeur >= seuilMax) return pointsMax;
    if (valeur <= seuilMin) return 0;
  } else {
    if (valeur <= seuilMax) return pointsMax;
    if (valeur >= seuilMin) return 0;
  }
  const fraction = (valeur - seuilMin) / (seuilMax - seuilMin);
  return fraction * pointsMax;
}

/** Division protégée : renvoie `valeurSiZero` si le dénominateur est nul ou négatif. */
function ratioSecurise(numerateur: number, denominateur: number, valeurSiZero: number): number {
  return denominateur > 0 ? numerateur / denominateur : valeurSiZero;
}

/**
 * Dégradation relative entre le scénario réaliste et le scénario pessimiste
 * (utilisé pour noter la "sensibilité au scénario pessimiste").
 * Si l'indicateur réaliste est déjà <= 0, on considère la dégradation maximale (1 = 100%)
 * par convention : un dossier déjà mauvais en réaliste ne peut pas obtenir de bons points ici.
 */
function calculerDegradationPct(indicateurRealiste: number, indicateurPessimiste: number): number {
  if (indicateurRealiste <= 0) return 1;
  const degradation = (indicateurRealiste - indicateurPessimiste) / indicateurRealiste;
  return Math.max(0, degradation);
}

function genererAppreciations(sousScores: SousScore[]): { pointsForts: string[]; pointsVigilance: string[] } {
  const pointsForts: string[] = [];
  const pointsVigilance: string[] = [];
  for (const s of sousScores) {
    const ratio = s.pointsMax > 0 ? s.points / s.pointsMax : 0;
    if (ratio >= 0.8) pointsForts.push(s.critere);
    else if (ratio <= 0.3) pointsVigilance.push(s.critere);
  }
  return { pointsForts, pointsVigilance };
}

function totaliser(sousScores: SousScore[]): ResultatScore {
  const total = sousScores.reduce((somme, s) => somme + s.points, 0);
  const { pointsForts, pointsVigilance } = genererAppreciations(sousScores);
  return { total, sousScores, pointsForts, pointsVigilance };
}

// ============================================================================
// Mode investisseur — poids du cahier des charges (section 6) :
// rendement net-net (25), cash-flow (25), marge de sécurité/apport (15),
// niveau d'endettement (15), montant travaux vs budget (10), sensibilité
// au scénario pessimiste (10). Total 100.
// ============================================================================

export const SEUILS_INVESTISSEUR = {
  // Exemple donné dans le cahier des charges : "rendement net-net >= 6% -> 25/25, entre 4-6% -> linéaire, <4% -> 0".
  rendementNetNet: { seuilMin: 0.04, seuilMax: 0.06 } satisfies SeuilLineaire,
  // Cash-flow mensuel : positif et confortable (>= 100€) -> plein, négatif -> 0.
  cashFlowMensuel: { seuilMin: 0, seuilMax: 100 } satisfies SeuilLineaire,
  // Apport / coût total d'acquisition : >= 20% d'apport -> plein, aucun apport -> 0.
  apportPct: { seuilMin: 0, seuilMax: 0.2 } satisfies SeuilLineaire,
  // Taux d'effort (mensualité / loyers encaissés) : <= 50% -> plein, >= 80% -> 0 (décroissant).
  tauxEndettement: { seuilMin: 0.8, seuilMax: 0.5 } satisfies SeuilLineaire,
  // Travaux / prix d'achat : <= 15% -> plein, >= 40% -> 0 (décroissant).
  travauxVsPrix: { seuilMin: 0.4, seuilMax: 0.15 } satisfies SeuilLineaire,
  // Dégradation du rendement net-net entre réaliste et pessimiste : <= 20% -> plein, >= 50% -> 0 (décroissant).
  degradationPessimiste: { seuilMin: 0.5, seuilMax: 0.2 } satisfies SeuilLineaire,
};

export interface EntreesScoreInvestisseur {
  rendementNetNet: number;
  cashFlowMensuel: number;
  apport: number;
  coutTotalAcquisition: number;
  mensualiteCredit: number;
  loyersAnnuelsEncaisses: number;
  totalTravaux: number;
  prixAchat: number;
  /** Rendement net-net du scénario réaliste (référence pour la sensibilité pessimiste). */
  rendementNetNetRealiste: number;
  /** Rendement net-net du scénario pessimiste. */
  rendementNetNetPessimiste: number;
}

export function calculerScoreInvestisseur(entrees: EntreesScoreInvestisseur): ResultatScore {
  const loyerMensuelEncaisse = entrees.loyersAnnuelsEncaisses / 12;
  const degradationPct = calculerDegradationPct(
    entrees.rendementNetNetRealiste,
    entrees.rendementNetNetPessimiste
  );

  const sousScores: SousScore[] = [
    {
      critere: "Rendement net-net",
      points: scoreLineaire(entrees.rendementNetNet, SEUILS_INVESTISSEUR.rendementNetNet, 25),
      pointsMax: 25,
    },
    {
      critere: "Cash-flow",
      points: scoreLineaire(entrees.cashFlowMensuel, SEUILS_INVESTISSEUR.cashFlowMensuel, 25),
      pointsMax: 25,
    },
    {
      critere: "Marge de sécurité / apport",
      points: scoreLineaire(
        ratioSecurise(entrees.apport, entrees.coutTotalAcquisition, 0),
        SEUILS_INVESTISSEUR.apportPct,
        15
      ),
      pointsMax: 15,
    },
    {
      critere: "Niveau d'endettement",
      points: scoreLineaire(
        ratioSecurise(entrees.mensualiteCredit, loyerMensuelEncaisse, 1),
        SEUILS_INVESTISSEUR.tauxEndettement,
        15
      ),
      pointsMax: 15,
    },
    {
      critere: "Montant travaux vs prix d'achat",
      points: scoreLineaire(
        ratioSecurise(entrees.totalTravaux, entrees.prixAchat, 1),
        SEUILS_INVESTISSEUR.travauxVsPrix,
        10
      ),
      pointsMax: 10,
    },
    {
      critere: "Sensibilité au scénario pessimiste",
      points: scoreLineaire(degradationPct, SEUILS_INVESTISSEUR.degradationPessimiste, 10),
      pointsMax: 10,
    },
  ];

  return totaliser(sousScores);
}

// ============================================================================
// Mode marchand de biens — poids du cahier des charges (section 6) :
// marge % (30), ROI (25), marge de sécurité (15), niveau d'endettement (15),
// montant travaux vs budget (5), sensibilité au scénario pessimiste (10). Total 100.
// ============================================================================

export const SEUILS_MARCHAND = {
  // Marge % : >= 20% -> plein (cible usuelle marchand de biens), <= 10% -> 0.
  margePct: { seuilMin: 0.1, seuilMax: 0.2 } satisfies SeuilLineaire,
  // ROI : >= 15% -> plein, <= 5% -> 0.
  roi: { seuilMin: 0.05, seuilMax: 0.15 } satisfies SeuilLineaire,
  // Apport / coût total de l'opération : >= 20% -> plein, 0% -> 0.
  apportPct: { seuilMin: 0, seuilMax: 0.2 } satisfies SeuilLineaire,
  // Montant emprunté / coût total de l'opération : <= 50% -> plein, >= 80% -> 0 (décroissant).
  tauxEndettement: { seuilMin: 0.8, seuilMax: 0.5 } satisfies SeuilLineaire,
  // Travaux / prix d'achat : <= 15% -> plein, >= 40% -> 0 (décroissant).
  travauxVsPrix: { seuilMin: 0.4, seuilMax: 0.15 } satisfies SeuilLineaire,
  // Dégradation de la marge % entre réaliste et pessimiste : <= 20% -> plein, >= 50% -> 0 (décroissant).
  degradationPessimiste: { seuilMin: 0.5, seuilMax: 0.2 } satisfies SeuilLineaire,
};

export interface EntreesScoreMarchand {
  margePct: number;
  roi: number;
  apport: number;
  coutTotalOperation: number;
  montantEmprunte: number;
  totalTravaux: number;
  prixAchat: number;
  /** Marge % du scénario réaliste (référence pour la sensibilité pessimiste). */
  margePctRealiste: number;
  /** Marge % du scénario pessimiste. */
  margePctPessimiste: number;
}

export function calculerScoreMarchand(entrees: EntreesScoreMarchand): ResultatScore {
  const degradationPct = calculerDegradationPct(entrees.margePctRealiste, entrees.margePctPessimiste);

  const sousScores: SousScore[] = [
    {
      critere: "Marge %",
      points: scoreLineaire(entrees.margePct, SEUILS_MARCHAND.margePct, 30),
      pointsMax: 30,
    },
    {
      critere: "ROI",
      points: scoreLineaire(entrees.roi, SEUILS_MARCHAND.roi, 25),
      pointsMax: 25,
    },
    {
      critere: "Marge de sécurité",
      points: scoreLineaire(
        ratioSecurise(entrees.apport, entrees.coutTotalOperation, 0),
        SEUILS_MARCHAND.apportPct,
        15
      ),
      pointsMax: 15,
    },
    {
      critere: "Niveau d'endettement",
      points: scoreLineaire(
        ratioSecurise(entrees.montantEmprunte, entrees.coutTotalOperation, 1),
        SEUILS_MARCHAND.tauxEndettement,
        15
      ),
      pointsMax: 15,
    },
    {
      critere: "Montant travaux vs prix d'achat",
      points: scoreLineaire(
        ratioSecurise(entrees.totalTravaux, entrees.prixAchat, 1),
        SEUILS_MARCHAND.travauxVsPrix,
        5
      ),
      pointsMax: 5,
    },
    {
      critere: "Sensibilité au scénario pessimiste",
      points: scoreLineaire(degradationPct, SEUILS_MARCHAND.degradationPessimiste, 10),
      pointsMax: 10,
    },
  ];

  return totaliser(sousScores);
}
