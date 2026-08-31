import { describe, expect, it } from "vitest";
import {
  calculerScoreInvestisseur,
  calculerScoreMarchand,
  scoreLineaire,
  type EntreesScoreInvestisseur,
  type EntreesScoreMarchand,
} from "../score";

describe("scoreLineaire", () => {
  it("plafonne au max quand la valeur dépasse seuilMax (cas croissant)", () => {
    expect(scoreLineaire(0.1, { seuilMin: 0.04, seuilMax: 0.06 }, 25)).toBe(25);
  });
  it("renvoie 0 quand la valeur est sous seuilMin (cas croissant)", () => {
    expect(scoreLineaire(0.01, { seuilMin: 0.04, seuilMax: 0.06 }, 25)).toBe(0);
  });
  it("interpole linéairement entre les deux seuils (cas croissant)", () => {
    expect(scoreLineaire(0.05, { seuilMin: 0.04, seuilMax: 0.06 }, 25)).toBeCloseTo(12.5, 6);
  });
  it("plafonne au max quand la valeur est sous seuilMax (cas décroissant)", () => {
    expect(scoreLineaire(0.3, { seuilMin: 0.8, seuilMax: 0.5 }, 15)).toBe(15);
  });
  it("renvoie 0 quand la valeur dépasse seuilMin (cas décroissant)", () => {
    expect(scoreLineaire(0.9, { seuilMin: 0.8, seuilMax: 0.5 }, 15)).toBe(0);
  });
  it("interpole linéairement entre les deux seuils (cas décroissant)", () => {
    expect(scoreLineaire(0.65, { seuilMin: 0.8, seuilMax: 0.5 }, 15)).toBeCloseTo(7.5, 6);
  });
  it("rejette des seuils identiques", () => {
    expect(() => scoreLineaire(0.05, { seuilMin: 0.05, seuilMax: 0.05 }, 10)).toThrow();
  });
});

const entreesInvestisseurExcellent: EntreesScoreInvestisseur = {
  rendementNetNet: 0.08,
  cashFlowMensuel: 200,
  apport: 60_000,
  coutTotalAcquisition: 200_000,
  mensualiteCredit: 500,
  loyersAnnuelsEncaisses: 12_000, // 1000/mois
  totalTravaux: 10_000,
  prixAchat: 180_000,
  rendementNetNetRealiste: 0.08,
  rendementNetNetPessimiste: 0.07,
};

const entreesInvestisseurFaible: EntreesScoreInvestisseur = {
  rendementNetNet: 0.01,
  cashFlowMensuel: -150,
  apport: 0,
  coutTotalAcquisition: 200_000,
  mensualiteCredit: 900,
  loyersAnnuelsEncaisses: 9_600, // 800/mois
  totalTravaux: 90_000,
  prixAchat: 180_000,
  rendementNetNetRealiste: 0.01,
  rendementNetNetPessimiste: -0.03,
};

describe("calculerScoreInvestisseur", () => {
  it("un dossier excellent sur tous les critères obtient un score proche de 100", () => {
    const resultat = calculerScoreInvestisseur(entreesInvestisseurExcellent);
    expect(resultat.total).toBeGreaterThan(90);
    expect(resultat.sousScores).toHaveLength(6);
  });

  it("un dossier faible sur tous les critères obtient un score proche de 0", () => {
    const resultat = calculerScoreInvestisseur(entreesInvestisseurFaible);
    expect(resultat.total).toBeLessThan(15);
  });

  it("la somme des sous-scores égale le total", () => {
    const resultat = calculerScoreInvestisseur(entreesInvestisseurExcellent);
    const sommeSousScores = resultat.sousScores.reduce((s, x) => s + x.points, 0);
    expect(resultat.total).toBeCloseTo(sommeSousScores, 6);
  });

  it("le total ne dépasse jamais 100 (somme des pointsMax)", () => {
    const resultat = calculerScoreInvestisseur(entreesInvestisseurExcellent);
    const pointsMaxTotal = resultat.sousScores.reduce((s, x) => s + x.pointsMax, 0);
    expect(pointsMaxTotal).toBe(100);
    expect(resultat.total).toBeLessThanOrEqual(100);
  });

  it("identifie les points forts (ratio >= 0.8) et points de vigilance (ratio <= 0.3)", () => {
    const resultat = calculerScoreInvestisseur(entreesInvestisseurExcellent);
    expect(resultat.pointsForts.length).toBeGreaterThan(0);
    const faible = calculerScoreInvestisseur(entreesInvestisseurFaible);
    expect(faible.pointsVigilance.length).toBeGreaterThan(0);
  });

  it("ne plante pas si les loyers encaissés sont nuls (division protégée)", () => {
    const resultat = calculerScoreInvestisseur({ ...entreesInvestisseurFaible, loyersAnnuelsEncaisses: 0 });
    expect(Number.isFinite(resultat.total)).toBe(true);
  });

  it("ne plante pas si le coût total d'acquisition est nul (division protégée)", () => {
    const resultat = calculerScoreInvestisseur({ ...entreesInvestisseurFaible, coutTotalAcquisition: 0 });
    expect(Number.isFinite(resultat.total)).toBe(true);
  });

  it("pénalise fortement une forte dégradation en scénario pessimiste", () => {
    const stable = calculerScoreInvestisseur(entreesInvestisseurExcellent);
    const instable = calculerScoreInvestisseur({
      ...entreesInvestisseurExcellent,
      rendementNetNetPessimiste: -0.02, // rendement réaliste 0.08 -> pessimiste négatif : forte dégradation
    });
    const sousScoreStable = stable.sousScores.find((s) => s.critere.includes("Sensibilité"))!;
    const sousScoreInstable = instable.sousScores.find((s) => s.critere.includes("Sensibilité"))!;
    expect(sousScoreInstable.points).toBeLessThan(sousScoreStable.points);
  });
});

const entreesMarchandExcellent: EntreesScoreMarchand = {
  margePct: 0.25,
  roi: 0.2,
  apport: 60_000,
  coutTotalOperation: 250_000,
  montantEmprunte: 100_000,
  totalTravaux: 20_000,
  prixAchat: 180_000,
  margePctRealiste: 0.25,
  margePctPessimiste: 0.22,
};

const entreesMarchandFaible: EntreesScoreMarchand = {
  margePct: 0.02,
  roi: 0.01,
  apport: 0,
  coutTotalOperation: 250_000,
  montantEmprunte: 230_000,
  totalTravaux: 90_000,
  prixAchat: 180_000,
  margePctRealiste: 0.02,
  margePctPessimiste: -0.08,
};

describe("calculerScoreMarchand", () => {
  it("un dossier excellent sur tous les critères obtient un score proche de 100", () => {
    const resultat = calculerScoreMarchand(entreesMarchandExcellent);
    expect(resultat.total).toBeGreaterThan(90);
    expect(resultat.sousScores).toHaveLength(6);
  });

  it("un dossier faible sur tous les critères obtient un score proche de 0", () => {
    const resultat = calculerScoreMarchand(entreesMarchandFaible);
    expect(resultat.total).toBeLessThan(15);
  });

  it("les poids des sous-critères correspondent au cahier des charges (30/25/15/15/5/10)", () => {
    const resultat = calculerScoreMarchand(entreesMarchandExcellent);
    const poids = resultat.sousScores.map((s) => s.pointsMax);
    expect(poids).toEqual([30, 25, 15, 15, 5, 10]);
  });

  it("ne plante pas si le coût total de l'opération est nul (division protégée)", () => {
    const resultat = calculerScoreMarchand({ ...entreesMarchandFaible, coutTotalOperation: 0 });
    expect(Number.isFinite(resultat.total)).toBe(true);
  });

  it("une marge réaliste déjà négative ou nulle donne une dégradation maximale (0 point de sensibilité)", () => {
    const resultat = calculerScoreMarchand({
      ...entreesMarchandFaible,
      margePctRealiste: 0,
      margePctPessimiste: -0.05,
    });
    const sousScoreSensibilite = resultat.sousScores.find((s) => s.critere.includes("Sensibilité"))!;
    expect(sousScoreSensibilite.points).toBe(0);
  });
});
