import { describe, expect, it } from "vitest";
import {
  calculerLmnpMicroBic,
  calculerLmnpReel,
  calculerMicroFoncier,
  calculerReelFoncier,
  PLAFOND_DEFICIT_FONCIER_IMPUTABLE,
  TAUX_PRELEVEMENTS_SOCIAUX,
} from "../fiscalite";

describe("calculerMicroFoncier", () => {
  it("applique un abattement de 30%", () => {
    const resultat = calculerMicroFoncier({ revenusLocatifsAnnuels: 10_000, tmi: 0.3 });
    expect(resultat.resultatImposable).toBe(7_000);
    expect(resultat.impotRevenu).toBeCloseTo(7_000 * 0.3, 6);
    expect(resultat.prelevementsSociaux).toBeCloseTo(7_000 * TAUX_PRELEVEMENTS_SOCIAUX, 6);
  });
});

describe("calculerLmnpMicroBic", () => {
  it("applique un abattement de 50%", () => {
    const resultat = calculerLmnpMicroBic({ revenusLocatifsAnnuels: 10_000, tmi: 0.3 });
    expect(resultat.resultatImposable).toBe(5_000);
  });
});

describe("calculerReelFoncier", () => {
  it("impose le résultat net quand il est positif (revenus - charges - intérêts)", () => {
    const resultat = calculerReelFoncier({
      revenusLocatifsAnnuels: 12_000,
      chargesDeductiblesHorsInterets: 2_000,
      interetsEmprunt: 3_000,
      tmi: 0.3,
    });
    expect(resultat.resultatImposable).toBe(7_000); // 12000 - 2000 - 3000
    expect(resultat.report).toBe(0);
  });

  it("plafonne le déficit (hors intérêts) imputable sur le revenu global à 10 700 €", () => {
    const resultat = calculerReelFoncier({
      revenusLocatifsAnnuels: 5_000,
      chargesDeductiblesHorsInterets: 20_000, // déficit hors intérêts de 15 000
      interetsEmprunt: 0,
      tmi: 0.3,
    });
    expect(resultat.resultatImposable).toBe(0);
    // économie d'impôt sur le plafond de 10700, reste (15000-10700=4300) reportable
    expect(resultat.impotTotal).toBeCloseTo(-PLAFOND_DEFICIT_FONCIER_IMPUTABLE * 0.3, 6);
    expect(resultat.report).toBeCloseTo(4_300, 6);
  });

  it("rend le déficit dû aux intérêts intégralement reportable, jamais imputable sur le revenu global", () => {
    const resultat = calculerReelFoncier({
      revenusLocatifsAnnuels: 10_000,
      chargesDeductiblesHorsInterets: 2_000, // résultat hors intérêts = +8000, positif
      interetsEmprunt: 12_000, // déficit final entièrement dû aux intérêts
      tmi: 0.3,
    });
    expect(resultat.resultatImposable).toBe(0);
    expect(resultat.impotTotal).toBe(0); // pas d'économie d'impôt, pas d'imposition
    expect(resultat.report).toBe(4_000); // 8000 - 12000 = -4000 -> reporté intégralement
  });
});

describe("calculerLmnpReel", () => {
  it("réduit le résultat imposable par l'amortissement sans créer de déficit (amortissement > résultat)", () => {
    const resultat = calculerLmnpReel({
      revenusLocatifsAnnuels: 12_000,
      chargesDeductibles: 2_000,
      tmi: 0.3,
      // amortissement annuel total très supérieur au résultat avant amortissement (10 000)
      amortissement: { valeurBienTotal: 800_000, valeurMobilier: 20_000 },
    });
    expect(resultat.resultatImposable).toBe(0);
    expect(resultat.impotTotal).toBe(0);
    expect(resultat.report).toBeGreaterThan(0); // amortissement non consommé, reporté
  });

  it("n'utilise que l'amortissement nécessaire pour ramener le résultat à 0, reporte le reste", () => {
    // bâti amortissable = 200000*0.85=170000 ; amortissement total ≈ 8 253,33 (calcul détaillé
    // dans le test amortissement.test.ts) + mobilier 1000 = 8 253,33 < résultat avant amortissement (10 000)
    const resultat = calculerLmnpReel({
      revenusLocatifsAnnuels: 12_000,
      chargesDeductibles: 2_000,
      tmi: 0.3,
      amortissement: { valeurBienTotal: 200_000, valeurMobilier: 7_000 },
    });
    expect(resultat.resultatImposable).toBeCloseTo(10_000 - 8_253.333333, 3);
    expect(resultat.report).toBe(0); // amortissement entièrement consommé cette année
  });

  it("reporte aussi le déficit de charges (hors amortissement), jamais imputable sur le revenu global", () => {
    const resultat = calculerLmnpReel({
      revenusLocatifsAnnuels: 5_000,
      chargesDeductibles: 8_000, // déficit de 3000 avant même l'amortissement
      tmi: 0.3,
      amortissement: { valeurBienTotal: 100_000, valeurMobilier: 0 },
    });
    expect(resultat.resultatImposable).toBe(0);
    expect(resultat.impotTotal).toBe(0);
    expect(resultat.report).toBeGreaterThanOrEqual(3_000);
  });
});
