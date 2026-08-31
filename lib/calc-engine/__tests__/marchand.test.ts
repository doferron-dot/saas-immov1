import { describe, expect, it } from "vitest";
import { calculerMarchand } from "../marchand";
import type { LotMarchand } from "../marchand";

const unLot: LotMarchand[] = [{ nomLot: "Lot unique", prixReventePrevu: 250_000 }];

describe("calculerMarchand", () => {
  it("calcule le chiffre d'affaires total comme la somme des prix de revente des lots", () => {
    const lots: LotMarchand[] = [
      { nomLot: "Lot A", prixReventePrevu: 150_000 },
      { nomLot: "Lot B", prixReventePrevu: 120_000 },
    ];
    const resultat = calculerMarchand({ lots, fraisRevente: 5_000 }, 180_000, 30_000, 8_000, 60_000);
    expect(resultat.chiffreAffairesTotal).toBe(270_000);
  });

  it("calcule le coût total de l'opération = acquisition + travaux + crédit + frais de revente", () => {
    const resultat = calculerMarchand({ lots: unLot, fraisRevente: 5_000 }, 180_000, 30_000, 8_000, 60_000);
    expect(resultat.coutTotalOperation).toBe(180_000 + 30_000 + 8_000 + 5_000);
  });

  it("calcule la marge = chiffre d'affaires - coût total de l'opération", () => {
    const resultat = calculerMarchand({ lots: unLot, fraisRevente: 5_000 }, 180_000, 30_000, 8_000, 60_000);
    const coutAttendu = 180_000 + 30_000 + 8_000 + 5_000;
    expect(resultat.marge).toBeCloseTo(250_000 - coutAttendu, 6);
  });

  it("calcule la marge en % du chiffre d'affaires", () => {
    const resultat = calculerMarchand({ lots: unLot, fraisRevente: 5_000 }, 180_000, 30_000, 8_000, 60_000);
    expect(resultat.margePct).toBeCloseTo(resultat.marge / resultat.chiffreAffairesTotal, 6);
  });

  it("calcule le ROI = marge / montant total investi", () => {
    const resultat = calculerMarchand({ lots: unLot, fraisRevente: 5_000 }, 180_000, 30_000, 8_000, 60_000);
    expect(resultat.roi).toBeCloseTo(resultat.marge / 60_000, 6);
  });

  it("additionne correctement plusieurs lots", () => {
    const lots: LotMarchand[] = [
      { nomLot: "T2", typeLot: "appartement", prixReventePrevu: 140_000 },
      { nomLot: "T3", typeLot: "appartement", prixReventePrevu: 175_000 },
      { nomLot: "Cave", typeLot: "annexe", prixReventePrevu: 8_000 },
    ];
    const resultat = calculerMarchand({ lots, fraisRevente: 10_000 }, 250_000, 40_000, 12_000, 90_000);
    expect(resultat.chiffreAffairesTotal).toBe(140_000 + 175_000 + 8_000);
  });

  it("renvoie une marge % et un ROI à 0 quand le chiffre d'affaires / montant investi est nul", () => {
    const resultat = calculerMarchand(
      { lots: [{ nomLot: "Lot gratuit", prixReventePrevu: 0 }], fraisRevente: 0 },
      0,
      0,
      0,
      0
    );
    expect(resultat.margePct).toBe(0);
    expect(resultat.roi).toBe(0);
  });

  it("gère une marge négative (opération déficitaire) sans erreur", () => {
    const resultat = calculerMarchand({ lots: unLot, fraisRevente: 5_000 }, 300_000, 50_000, 20_000, 100_000);
    expect(resultat.marge).toBeLessThan(0);
    expect(resultat.margePct).toBeLessThan(0);
    expect(resultat.roi).toBeLessThan(0);
  });

  it("rejette une opération sans aucun lot", () => {
    expect(() => calculerMarchand({ lots: [], fraisRevente: 0 }, 100_000, 0, 0, 50_000)).toThrow();
  });

  it("rejette un prix de revente prévu négatif", () => {
    expect(() =>
      calculerMarchand({ lots: [{ nomLot: "X", prixReventePrevu: -1 }], fraisRevente: 0 }, 100_000, 0, 0, 50_000)
    ).toThrow();
  });

  it("rejette des frais de revente négatifs", () => {
    expect(() => calculerMarchand({ lots: unLot, fraisRevente: -1 }, 100_000, 0, 0, 50_000)).toThrow();
  });

  it("rejette un coût total d'acquisition négatif", () => {
    expect(() => calculerMarchand({ lots: unLot, fraisRevente: 0 }, -1, 0, 0, 50_000)).toThrow();
  });

  it("rejette un total travaux négatif", () => {
    expect(() => calculerMarchand({ lots: unLot, fraisRevente: 0 }, 100_000, -1, 0, 50_000)).toThrow();
  });

  it("rejette un coût total de crédit négatif", () => {
    expect(() => calculerMarchand({ lots: unLot, fraisRevente: 0 }, 100_000, 0, -1, 50_000)).toThrow();
  });

  it("rejette un montant total investi négatif", () => {
    expect(() => calculerMarchand({ lots: unLot, fraisRevente: 0 }, 100_000, 0, 0, -1)).toThrow();
  });
});
