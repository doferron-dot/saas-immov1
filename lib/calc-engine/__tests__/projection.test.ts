import { describe, expect, it } from "vitest";
import { calculerProjection, ANNEES_PROJECTION_DEFAUT, HYPOTHESES_PROJECTION } from "../projection";
import type { EntreesProjection } from "../projection";

describe("calculerProjection — validations", () => {
  it("rejette une valeur de bien négative", () => {
    expect(() =>
      calculerProjection({ valeurBienInitiale: -1, loyerMensuelInitial: 0, chargesMensuellesInitiales: 0, apportInitial: 0 })
    ).toThrow();
  });

  it("rejette un loyer négatif", () => {
    expect(() =>
      calculerProjection({
        valeurBienInitiale: 100_000,
        loyerMensuelInitial: -10,
        chargesMensuellesInitiales: 0,
        apportInitial: 0,
      })
    ).toThrow();
  });
});

describe("calculerProjection — achat cash (sans financement)", () => {
  const entrees: EntreesProjection = {
    valeurBienInitiale: 200_000,
    loyerMensuelInitial: 900,
    chargesMensuellesInitiales: 200,
    apportInitial: 200_000,
  };

  it("renvoie un point par année demandée, pour les deux profils", () => {
    const resultat = calculerProjection(entrees);
    expect(resultat.prudent).toHaveLength(ANNEES_PROJECTION_DEFAUT.length);
    expect(resultat.optimiste).toHaveLength(ANNEES_PROJECTION_DEFAUT.length);
    expect(resultat.prudent.map((p) => p.annee)).toEqual(ANNEES_PROJECTION_DEFAUT);
  });

  it("le capital restant dû est toujours 0 sans financement", () => {
    const resultat = calculerProjection(entrees);
    for (const point of resultat.prudent) {
      expect(point.capitalRestantDu).toBe(0);
    }
  });

  it("le profil optimiste vaut au moins autant que le prudent sur la valeur du bien à chaque échéance", () => {
    const resultat = calculerProjection(entrees);
    for (let i = 0; i < resultat.prudent.length; i++) {
      expect(resultat.optimiste[i].valeurBien).toBeGreaterThanOrEqual(resultat.prudent[i].valeurBien);
    }
  });

  it("la valeur du bien à l'année 0 implicite (1 an) est proche de la valeur initiale", () => {
    const resultat = calculerProjection(entrees);
    const an1 = resultat.prudent[0];
    expect(an1.annee).toBe(1);
    expect(an1.valeurBien).toBeCloseTo(200_000 * 1.015, 2);
  });

  it("le cash-flow cumulé croît avec le temps si le loyer dépasse les charges", () => {
    const resultat = calculerProjection(entrees);
    const cashFlows = resultat.prudent.map((p) => p.cashFlowCumule);
    for (let i = 1; i < cashFlows.length; i++) {
      expect(cashFlows[i]).toBeGreaterThan(cashFlows[i - 1]);
    }
  });

  it("le produit net de revente est cohérent avec la valeur du bien moins les frais de transaction (pas de crédit)", () => {
    const resultat = calculerProjection(entrees);
    const point = resultat.prudent[0];
    expect(point.produitNetRevente).toBeCloseTo(point.valeurBien * 0.94, 2);
  });
});

describe("calculerProjection — avec financement", () => {
  const entrees: EntreesProjection = {
    valeurBienInitiale: 220_000,
    loyerMensuelInitial: 1000,
    chargesMensuellesInitiales: 250,
    apportInitial: 30_000,
    financement: {
      montantEmprunte: 200_000,
      tauxAnnuel: 0.035,
      dureeMois: 240,
      tauxAssuranceAnnuel: 0.003,
    },
  };

  it("le capital restant dû décroît avec le temps puis atteint 0 après la fin du prêt (240 mois = 20 ans)", () => {
    const resultat = calculerProjection(entrees);
    const parAnnee = Object.fromEntries(resultat.prudent.map((p) => [p.annee, p.capitalRestantDu]));
    expect(parAnnee[1]).toBeGreaterThan(0);
    expect(parAnnee[15]).toBeGreaterThan(0);
    expect(parAnnee[15]).toBeLessThan(parAnnee[1]);
    // Le prêt dure 20 ans : à 25 ans il est soldé (résidu flottant négligeable près de 0).
    expect(parAnnee[25]).toBeCloseTo(0, 4);
    expect(parAnnee[40]).toBeCloseTo(0, 4);
  });

  it("patrimoineNet = produitNetReventeApresImpot + cashFlowCumule - apportInitial (identité)", () => {
    const resultat = calculerProjection(entrees);
    for (const point of resultat.prudent) {
      expect(point.patrimoineNet).toBeCloseTo(
        point.produitNetReventeApresImpot + point.cashFlowCumule - 30_000,
        6
      );
      expect(point.produitNetReventeApresImpot).toBeCloseTo(
        point.produitNetRevente - point.impotPlusValueEstime,
        6
      );
    }
  });

  it("le patrimoine net progresse globalement entre l'année 1 et l'année 40", () => {
    const resultat = calculerProjection(entrees);
    const an1 = resultat.prudent.find((p) => p.annee === 1)!;
    const an40 = resultat.prudent.find((p) => p.annee === 40)!;
    expect(an40.patrimoineNet).toBeGreaterThan(an1.patrimoineNet);
  });

  it("l'impôt sur la plus-value est nul ou positif, et nul après 30 ans (exonération totale)", () => {
    const resultat = calculerProjection(entrees);
    for (const point of resultat.prudent) {
      expect(point.impotPlusValueEstime).toBeGreaterThanOrEqual(0);
    }
    const an40 = resultat.prudent.find((p) => p.annee === 40)!;
    expect(an40.impotPlusValueEstime).toBeCloseTo(0, 4);
    expect(an40.produitNetReventeApresImpot).toBeCloseTo(an40.produitNetRevente, 4);
  });
});

describe("calculerProjection — hypothèses personnalisées", () => {
  const entreesBase: EntreesProjection = {
    valeurBienInitiale: 200_000,
    loyerMensuelInitial: 900,
    chargesMensuellesInitiales: 200,
    apportInitial: 30_000,
  };

  it("sans hypothèses personnalisées, se comporte comme avant (HYPOTHESES_PROJECTION)", () => {
    const resultat = calculerProjection(entreesBase);
    const attendu = calculerProjection({
      ...entreesBase,
      hypotheses: { prudent: HYPOTHESES_PROJECTION.prudent, optimiste: HYPOTHESES_PROJECTION.optimiste },
    });
    expect(resultat).toEqual(attendu);
  });

  it("une hypothèse personnalisée pour un seul profil ne change que ce profil", () => {
    const resultat = calculerProjection({
      ...entreesBase,
      hypotheses: {
        prudent: { ...HYPOTHESES_PROJECTION.prudent, tauxValorisationBienAnnuel: 0 },
      },
    });
    const an10Prudent = resultat.prudent.find((p) => p.annee === 10)!;
    const an10Optimiste = resultat.optimiste.find((p) => p.annee === 10)!;
    // Valorisation prudent forcée à 0% -> la valeur du bien ne bouge pas.
    expect(an10Prudent.valeurBien).toBeCloseTo(200_000, 6);
    // Le profil optimiste garde son comportement par défaut (valorisation > 0).
    expect(an10Optimiste.valeurBien).toBeGreaterThan(200_000);
  });

  it("un taux de valorisation personnalisé plus élevé donne une valeur du bien plus élevée", () => {
    const bas = calculerProjection({
      ...entreesBase,
      hypotheses: { prudent: { ...HYPOTHESES_PROJECTION.prudent, tauxValorisationBienAnnuel: 0.01 } },
    });
    const haut = calculerProjection({
      ...entreesBase,
      hypotheses: { prudent: { ...HYPOTHESES_PROJECTION.prudent, tauxValorisationBienAnnuel: 0.05 } },
    });
    const anneeTest = 20;
    const valeurBasse = bas.prudent.find((p) => p.annee === anneeTest)!.valeurBien;
    const valeurHaute = haut.prudent.find((p) => p.annee === anneeTest)!.valeurBien;
    expect(valeurHaute).toBeGreaterThan(valeurBasse);
  });
});
