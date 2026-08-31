import { describe, expect, it } from "vitest";
import {
  abattementIR,
  abattementPrelevementsSociaux,
  calculerPlusValueImmobiliere,
} from "../plus-value";

describe("abattementIR", () => {
  it("est nul avant 6 ans de détention", () => {
    expect(abattementIR(0)).toBe(0);
    expect(abattementIR(5)).toBe(0);
  });
  it("progresse de 6% par an entre 6 et 21 ans", () => {
    expect(abattementIR(6)).toBeCloseTo(0.06, 6);
    expect(abattementIR(10)).toBeCloseTo(0.3, 6);
    expect(abattementIR(21)).toBeCloseTo(0.96, 6);
  });
  it("atteint l'exonération totale à 22 ans", () => {
    expect(abattementIR(22)).toBe(1);
    expect(abattementIR(40)).toBe(1);
  });
});

describe("abattementPrelevementsSociaux", () => {
  it("est nul avant 6 ans de détention", () => {
    expect(abattementPrelevementsSociaux(5)).toBe(0);
  });
  it("progresse de 1,65% par an entre 6 et 21 ans", () => {
    expect(abattementPrelevementsSociaux(6)).toBeCloseTo(0.0165, 6);
    expect(abattementPrelevementsSociaux(21)).toBeCloseTo(16 * 0.0165, 6);
  });
  it("atteint l'exonération totale à 30 ans, pas avant", () => {
    expect(abattementPrelevementsSociaux(29)).toBeLessThan(1);
    expect(abattementPrelevementsSociaux(30)).toBe(1);
  });
});

describe("calculerPlusValueImmobiliere", () => {
  it("aucun impôt si le prix de cession est inférieur ou égal à la base d'acquisition", () => {
    const resultat = calculerPlusValueImmobiliere({
      prixAcquisition: 200_000,
      prixCession: 190_000,
      dureeDetentionAnnees: 3,
    });
    expect(resultat.plusValueBrute).toBe(0);
    expect(resultat.impotTotal).toBe(0);
    expect(resultat.produitNetApresImpot).toBe(190_000);
  });

  it("calcule un impôt positif pour une revente rapide avec plus-value (aucun abattement)", () => {
    const resultat = calculerPlusValueImmobiliere({
      prixAcquisition: 200_000,
      prixCession: 260_000,
      dureeDetentionAnnees: 2,
      fraisAcquisitionReels: 15_000,
      travauxReels: 0,
    });
    // base = 200000 + 15000 = 215000 ; plus-value brute = 45000
    expect(resultat.plusValueBrute).toBeCloseTo(45_000, 2);
    expect(resultat.impotIR).toBeCloseTo(45_000 * 0.19, 2);
    expect(resultat.prelevementsSociaux).toBeCloseTo(45_000 * 0.172, 2);
  });

  it("exonération totale après 30 ans de détention (IR et prélèvements sociaux)", () => {
    const resultat = calculerPlusValueImmobiliere({
      prixAcquisition: 200_000,
      prixCession: 400_000,
      dureeDetentionAnnees: 30,
    });
    expect(resultat.impotTotal).toBeCloseTo(0, 6);
    expect(resultat.produitNetApresImpot).toBeCloseTo(400_000, 6);
  });

  it("utilise le forfait de 15% travaux seulement après 5 ans de détention", () => {
    const avant = calculerPlusValueImmobiliere({
      prixAcquisition: 100_000,
      prixCession: 130_000,
      dureeDetentionAnnees: 3,
    });
    const apres = calculerPlusValueImmobiliere({
      prixAcquisition: 100_000,
      prixCession: 130_000,
      dureeDetentionAnnees: 6,
    });
    // Avant 5 ans : pas de forfait travaux -> base plus faible -> plus-value brute plus élevée.
    expect(avant.plusValueBrute).toBeGreaterThan(apres.plusValueBrute);
  });

  it("rejette une durée de détention négative", () => {
    expect(() =>
      calculerPlusValueImmobiliere({ prixAcquisition: 100_000, prixCession: 120_000, dureeDetentionAnnees: -1 })
    ).toThrow();
  });
});
