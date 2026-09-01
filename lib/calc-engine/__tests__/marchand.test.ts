import { describe, expect, it } from "vitest";
import { calculerMarchand } from "../marchand";
import type { EntreesLocationMarchand, LotMarchand } from "../marchand";

const unLot: LotMarchand[] = [{ nomLot: "Lot unique", prixReventePrevu: 250_000 }];

const entreesLocativesDeBase = {
  loyerMensuel: 900,
  chargesNonRecuperablesAnnuelles: 0,
  taxeFonciereAnnuelle: 0,
  assurancePnoAnnuelle: 0,
  fraisGestionPct: 0,
  entretienPct: 0,
  vacanceLocativePct: 0,
  autresChargesAnnuelles: 0,
};

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

describe("calculerMarchand — location avant revente (marchand qui loue pendant sa période de détention)", () => {
  it("revenuLocatifNet vaut 0 quand aucune location n'est renseignée", () => {
    const resultat = calculerMarchand({ lots: unLot, fraisRevente: 5_000 }, 180_000, 30_000, 8_000, 60_000);
    expect(resultat.revenuLocatifNet).toBe(0);
  });

  it("revenuLocatifNet vaut 0 quand la durée de location est nulle, même avec un loyer renseigné", () => {
    const location: EntreesLocationMarchand = {
      dureeLocationMois: 0,
      entreesLocatives: entreesLocativesDeBase,
    };
    const resultat = calculerMarchand(
      { lots: unLot, fraisRevente: 5_000, location },
      180_000,
      30_000,
      8_000,
      60_000
    );
    expect(resultat.revenuLocatifNet).toBe(0);
  });

  it("calcule le revenu locatif net = (loyers encaissés - charges) proraté sur la durée de location", () => {
    const location: EntreesLocationMarchand = {
      dureeLocationMois: 6,
      entreesLocatives: { ...entreesLocativesDeBase, loyerMensuel: 1_000, chargesNonRecuperablesAnnuelles: 1_200 },
    };
    const resultat = calculerMarchand(
      { lots: unLot, fraisRevente: 5_000, location },
      180_000,
      30_000,
      8_000,
      60_000
    );
    // Loyers annuels bruts 12 000 - charges 1 200 = 10 800 net/an, soit 900/mois, sur 6 mois = 5 400.
    expect(resultat.revenuLocatifNet).toBeCloseTo(5_400, 6);
  });

  it("le revenu locatif net augmente la marge d'autant (sans affecter le chiffre d'affaires ni le coût de l'opération)", () => {
    const sansLocation = calculerMarchand({ lots: unLot, fraisRevente: 5_000 }, 180_000, 30_000, 8_000, 60_000);
    const location: EntreesLocationMarchand = {
      dureeLocationMois: 12,
      entreesLocatives: entreesLocativesDeBase,
    };
    const avecLocation = calculerMarchand(
      { lots: unLot, fraisRevente: 5_000, location },
      180_000,
      30_000,
      8_000,
      60_000
    );
    expect(avecLocation.chiffreAffairesTotal).toBe(sansLocation.chiffreAffairesTotal);
    expect(avecLocation.coutTotalOperation).toBe(sansLocation.coutTotalOperation);
    expect(avecLocation.marge).toBeCloseTo(sansLocation.marge + avecLocation.revenuLocatifNet, 6);
  });

  it("prend en compte la vacance locative et les frais de gestion/entretien comme en mode investisseur", () => {
    const location: EntreesLocationMarchand = {
      dureeLocationMois: 12,
      entreesLocatives: {
        ...entreesLocativesDeBase,
        loyerMensuel: 1_000,
        vacanceLocativePct: 0.1,
        fraisGestionPct: 0.08,
      },
    };
    const resultat = calculerMarchand(
      { lots: unLot, fraisRevente: 5_000, location },
      180_000,
      30_000,
      8_000,
      60_000
    );
    // 12 000 bruts - 10% vacance = 10 800 encaissés ; - 8% gestion (864) = 9 936 net/an.
    expect(resultat.revenuLocatifNet).toBeCloseTo(9_936, 6);
  });

  it("rejette une durée de location négative", () => {
    const location: EntreesLocationMarchand = {
      dureeLocationMois: -1,
      entreesLocatives: entreesLocativesDeBase,
    };
    expect(() =>
      calculerMarchand({ lots: unLot, fraisRevente: 5_000, location }, 180_000, 30_000, 8_000, 60_000)
    ).toThrow();
  });

  it("propage la validation des champs locatifs (ex: pourcentage hors [0,1])", () => {
    const location: EntreesLocationMarchand = {
      dureeLocationMois: 6,
      entreesLocatives: { ...entreesLocativesDeBase, fraisGestionPct: 1.5 },
    };
    expect(() =>
      calculerMarchand({ lots: unLot, fraisRevente: 5_000, location }, 180_000, 30_000, 8_000, 60_000)
    ).toThrow();
  });
});
