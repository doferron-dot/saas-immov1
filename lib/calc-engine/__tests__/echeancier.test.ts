import { describe, expect, it } from "vitest";
import { genererEcheancierMensuel, capitalRestantDuAuMois } from "../echeancier";
import { calculerFinancement } from "../financement";
import type { EntreesFinancement } from "../financement";

describe("genererEcheancierMensuel — cohérence avec calculerFinancement", () => {
  it("le capital résiduel final de l'échéancier correspond à celui de calculerFinancement (sans différé)", () => {
    const entrees: EntreesFinancement = {
      montantEmprunte: 200_000,
      tauxAnnuel: 0.035,
      dureeMois: 240,
      tauxAssuranceAnnuel: 0.003,
    };
    const resume = calculerFinancement(entrees);
    const echeancier = genererEcheancierMensuel(entrees);

    expect(echeancier).toHaveLength(240);
    expect(echeancier[echeancier.length - 1].capitalFinMois).toBeCloseTo(resume.capitalResiduelFinal, 2);

    const interetsTotaux = echeancier.reduce((s, l) => s + l.interetMensuel, 0);
    expect(interetsTotaux).toBeCloseTo(resume.interetsTotaux, 2);
  });

  it("cohérence avec un différé partiel", () => {
    const entrees: EntreesFinancement = {
      montantEmprunte: 150_000,
      tauxAnnuel: 0.04,
      dureeMois: 180,
      tauxAssuranceAnnuel: 0,
      differeType: "partiel",
      differeMois: 12,
    };
    const resume = calculerFinancement(entrees);
    const echeancier = genererEcheancierMensuel(entrees);

    expect(echeancier).toHaveLength(180);
    // Pendant le différé partiel, le capital ne bouge pas.
    for (const ligne of echeancier.slice(0, 12)) {
      expect(ligne.capitalFinMois).toBeCloseTo(150_000, 6);
      expect(ligne.principalRembourse).toBe(0);
    }
    const interetsTotaux = echeancier.reduce((s, l) => s + l.interetMensuel, 0);
    expect(interetsTotaux).toBeCloseTo(resume.interetsTotaux, 2);
    expect(echeancier[echeancier.length - 1].capitalFinMois).toBeCloseTo(resume.capitalResiduelFinal, 2);
  });

  it("cohérence avec un différé total (intérêts capitalisés)", () => {
    const entrees: EntreesFinancement = {
      montantEmprunte: 180_000,
      tauxAnnuel: 0.045,
      dureeMois: 200,
      tauxAssuranceAnnuel: 0.002,
      differeType: "total",
      differeMois: 18,
    };
    const resume = calculerFinancement(entrees);
    const echeancier = genererEcheancierMensuel(entrees);

    // Le capital augmente strictement pendant le différé total.
    expect(echeancier[11].capitalFinMois).toBeGreaterThan(180_000);
    const interetsTotaux = echeancier.reduce((s, l) => s + l.interetMensuel, 0);
    expect(interetsTotaux).toBeCloseTo(resume.interetsTotaux, 2);
    expect(echeancier[echeancier.length - 1].capitalFinMois).toBeCloseTo(resume.capitalResiduelFinal, 2);
  });

  it("le prêt est soldé (capital ~0) au dernier mois, sans différé", () => {
    const echeancier = genererEcheancierMensuel({
      montantEmprunte: 100_000,
      tauxAnnuel: 0.03,
      dureeMois: 120,
      tauxAssuranceAnnuel: 0,
    });
    expect(echeancier[echeancier.length - 1].capitalFinMois).toBeCloseTo(0, 4);
  });

  it("rejette une durée nulle ou négative", () => {
    expect(() =>
      genererEcheancierMensuel({ montantEmprunte: 1000, tauxAnnuel: 0.03, dureeMois: 0, tauxAssuranceAnnuel: 0 })
    ).toThrow();
  });

  it("rejette un différé supérieur ou égal à la durée totale", () => {
    expect(() =>
      genererEcheancierMensuel({
        montantEmprunte: 1000,
        tauxAnnuel: 0.03,
        dureeMois: 12,
        tauxAssuranceAnnuel: 0,
        differeType: "partiel",
        differeMois: 12,
      })
    ).toThrow();
  });
});

describe("capitalRestantDuAuMois", () => {
  const echeancier = genererEcheancierMensuel({
    montantEmprunte: 100_000,
    tauxAnnuel: 0.03,
    dureeMois: 24,
    tauxAssuranceAnnuel: 0,
  });

  it("renvoie le capital initial au mois 0", () => {
    expect(capitalRestantDuAuMois(echeancier, 0)).toBeCloseTo(100_000, 4);
  });

  it("renvoie 0 une fois le prêt largement dépassé", () => {
    expect(capitalRestantDuAuMois(echeancier, 999)).toBe(0);
  });

  it("renvoie 0 pour un échéancier vide (achat cash)", () => {
    expect(capitalRestantDuAuMois([], 60)).toBe(0);
  });

  it("décroît de façon monotone dans le temps", () => {
    const auMois12 = capitalRestantDuAuMois(echeancier, 12);
    const auMois18 = capitalRestantDuAuMois(echeancier, 18);
    expect(auMois18).toBeLessThan(auMois12);
  });
});
