import { describe, expect, it } from "vitest";
import { calculerFinancement, calculerMensualite } from "../financement";

describe("calculerMensualite", () => {
  it("calcule une mensualité cohérente pour un prêt classique", () => {
    // 200 000 € à 3,5% sur 240 mois (20 ans) -> mensualité ≈ 1159,90 €
    const mensualite = calculerMensualite(200_000, 0.035, 240);
    expect(mensualite).toBeCloseTo(1_159.9, 0);
  });

  it("fait un amortissement linéaire si le taux est nul", () => {
    expect(calculerMensualite(120_000, 0, 120)).toBe(1_000);
  });

  it("rejette une durée nulle ou négative", () => {
    expect(() => calculerMensualite(100_000, 0.03, 0)).toThrow();
  });
});

describe("calculerFinancement — sans différé", () => {
  const base = {
    montantEmprunte: 200_000,
    tauxAnnuel: 0.035,
    dureeMois: 240,
    tauxAssuranceAnnuel: 0.0036,
  };

  it("amortit complètement le capital sur la durée du prêt", () => {
    const resultat = calculerFinancement(base);
    expect(resultat.capitalResiduelFinal).toBeCloseTo(0, 4);
  });

  it("calcule une assurance totale = mensualité assurance × durée totale", () => {
    const resultat = calculerFinancement(base);
    expect(resultat.assuranceTotale).toBeCloseTo(resultat.mensualiteAssurance * 240, 6);
  });

  it("inclut les frais bancaires dans le coût total mais pas dans les intérêts", () => {
    const sansFrais = calculerFinancement(base);
    const avecFrais = calculerFinancement({ ...base, fraisBancaires: 1_000 });
    expect(avecFrais.interetsTotaux).toBeCloseTo(sansFrais.interetsTotaux, 4);
    expect(avecFrais.coutTotalCredit).toBeCloseTo(sansFrais.coutTotalCredit + 1_000, 4);
  });
});

describe("calculerFinancement — différé partiel", () => {
  it("ne paie que les intérêts pendant le différé, le capital ne bouge pas", () => {
    const resultat = calculerFinancement({
      montantEmprunte: 200_000,
      tauxAnnuel: 0.035,
      dureeMois: 240,
      tauxAssuranceAnnuel: 0,
      differeType: "partiel",
      differeMois: 12,
    });
    const interetMensuelAttendu = 200_000 * (0.035 / 12);
    expect(resultat.mensualiteDiffere).toBeCloseTo(interetMensuelAttendu, 4);
    expect(resultat.capitalResiduelFinal).toBeCloseTo(0, 4);
  });
});

describe("calculerFinancement — différé total", () => {
  it("ne paie rien pendant le différé, les intérêts sont capitalisés (capital augmente)", () => {
    const resultat = calculerFinancement({
      montantEmprunte: 200_000,
      tauxAnnuel: 0.035,
      dureeMois: 240,
      tauxAssuranceAnnuel: 0,
      differeType: "total",
      differeMois: 12,
    });
    expect(resultat.mensualiteDiffere).toBe(0);
    expect(resultat.capitalResiduelFinal).toBeCloseTo(0, 4);
    // Un différé total coûte plus cher en intérêts totaux qu'un prêt sans différé
    const sansDiffere = calculerFinancement({
      montantEmprunte: 200_000,
      tauxAnnuel: 0.035,
      dureeMois: 240,
      tauxAssuranceAnnuel: 0,
    });
    expect(resultat.interetsTotaux).toBeGreaterThan(sansDiffere.interetsTotaux);
  });

  it("rejette un différé plus long ou égal à la durée totale du prêt", () => {
    expect(() =>
      calculerFinancement({
        montantEmprunte: 100_000,
        tauxAnnuel: 0.03,
        dureeMois: 120,
        tauxAssuranceAnnuel: 0,
        differeType: "total",
        differeMois: 120,
      })
    ).toThrow();
  });
});

describe("calculerFinancement — validations", () => {
  it("rejette un montant emprunté négatif", () => {
    expect(() =>
      calculerFinancement({
        montantEmprunte: -100,
        tauxAnnuel: 0.03,
        dureeMois: 120,
        tauxAssuranceAnnuel: 0,
      })
    ).toThrow();
  });

  it("rejette un taux d'assurance négatif", () => {
    expect(() =>
      calculerFinancement({
        montantEmprunte: 100_000,
        tauxAnnuel: 0.03,
        dureeMois: 120,
        tauxAssuranceAnnuel: -0.01,
      })
    ).toThrow();
  });
});
