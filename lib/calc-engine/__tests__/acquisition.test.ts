import { describe, expect, it } from "vitest";
import { calculerAcquisition, calculerEmolumentsHT } from "../acquisition";

describe("calculerEmolumentsHT", () => {
  it("applique le taux de la première tranche sous 6 500 €", () => {
    expect(calculerEmolumentsHT(5_000)).toBeCloseTo(5_000 * 0.0387, 6);
  });

  it("applique le barème dégressif par tranches successives", () => {
    // 6500*3.87% + 10500*1.596% + 43000*1.064% + 40000*0.799%
    const attendu =
      6_500 * 0.0387 + 10_500 * 0.01596 + 43_000 * 0.01064 + 40_000 * 0.00799;
    expect(calculerEmolumentsHT(100_000)).toBeCloseTo(attendu, 6);
  });

  it("retourne 0 pour un prix nul ou négatif", () => {
    expect(calculerEmolumentsHT(0)).toBe(0);
    expect(calculerEmolumentsHT(-1000)).toBe(0);
  });
});

describe("calculerAcquisition", () => {
  it("calcule un coût total cohérent dans l'ancien, frais d'agence exclus", () => {
    const resultat = calculerAcquisition({
      prixAchat: 200_000,
      typeBien: "ancien",
      fraisAgence: 10_000,
      fraisAgenceInclus: false,
    });

    expect(resultat.dmto).toBeCloseTo(200_000 * 0.0580665, 6);
    expect(resultat.fraisAgence).toBe(10_000);
    // coût total = prix + frais notaire + frais agence (non inclus)
    expect(resultat.coutTotalAcquisition).toBeCloseTo(
      200_000 + resultat.fraisNotaireTotal + 10_000,
      6
    );
  });

  it("n'ajoute pas les frais d'agence une deuxième fois s'ils sont déjà inclus dans le prix", () => {
    const resultat = calculerAcquisition({
      prixAchat: 200_000,
      typeBien: "ancien",
      fraisAgence: 10_000,
      fraisAgenceInclus: true,
    });
    expect(resultat.coutTotalAcquisition).toBeCloseTo(
      200_000 + resultat.fraisNotaireTotal,
      6
    );
  });

  it("applique des frais de notaire nettement plus bas dans le neuf que dans l'ancien", () => {
    const ancien = calculerAcquisition({
      prixAchat: 200_000,
      typeBien: "ancien",
      fraisAgence: 0,
      fraisAgenceInclus: true,
    });
    const neuf = calculerAcquisition({
      prixAchat: 200_000,
      typeBien: "neuf",
      fraisAgence: 0,
      fraisAgenceInclus: true,
    });
    expect(neuf.fraisNotaireTotal).toBeLessThan(ancien.fraisNotaireTotal);
    // Écart attendu de l'ordre de grandeur documenté (7-8% vs 2-3%)
    expect(ancien.fraisNotaireTotal / 200_000).toBeGreaterThan(0.06);
    expect(neuf.fraisNotaireTotal / 200_000).toBeLessThan(0.03);
  });

  it("permet de surcharger les hypothèses par défaut (ex: département différent)", () => {
    const resultat = calculerAcquisition({
      prixAchat: 200_000,
      typeBien: "ancien",
      fraisAgence: 0,
      fraisAgenceInclus: true,
      hypotheses: { tauxDmto: 0.05 },
    });
    expect(resultat.dmto).toBeCloseTo(200_000 * 0.05, 6);
  });

  it("inclut les frais de dossier, de garantie et autres frais dans le coût total", () => {
    const resultat = calculerAcquisition({
      prixAchat: 200_000,
      typeBien: "ancien",
      fraisAgence: 0,
      fraisAgenceInclus: true,
      fraisDossier: 1_000,
      fraisGarantie: 1_500,
      autresFrais: 500,
    });
    expect(resultat.coutTotalAcquisition).toBeCloseTo(
      200_000 + resultat.fraisNotaireTotal + 1_000 + 1_500 + 500,
      6
    );
  });

  it("rejette un prix d'achat négatif", () => {
    expect(() =>
      calculerAcquisition({
        prixAchat: -100,
        typeBien: "ancien",
        fraisAgence: 0,
        fraisAgenceInclus: true,
      })
    ).toThrow();
  });
});
