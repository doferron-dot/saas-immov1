import { describe, expect, it } from "vitest";
import { calculerTravaux } from "../travaux";

describe("calculerTravaux", () => {
  it("additionne les lignes par catégorie", () => {
    const resultat = calculerTravaux([
      { categorie: "gros_oeuvre", sousCategorie: "toiture", montant: 10_000 },
      { categorie: "gros_oeuvre", sousCategorie: "facade", montant: 5_000 },
      { categorie: "interieur", sousCategorie: "peinture", montant: 3_000 },
    ]);
    expect(resultat.totalParCategorie.gros_oeuvre).toBe(15_000);
    expect(resultat.totalParCategorie.interieur).toBe(3_000);
    expect(resultat.totalTravaux).toBe(18_000);
  });

  it("applique 10% d'imprévus par défaut", () => {
    const resultat = calculerTravaux([
      { categorie: "technique", sousCategorie: "electricite", montant: 10_000 },
    ]);
    expect(resultat.imprevus).toBe(1_000);
    expect(resultat.totalTravauxAvecImprevus).toBe(11_000);
  });

  it("permet de modifier le taux d'imprévus", () => {
    const resultat = calculerTravaux(
      [{ categorie: "technique", sousCategorie: "electricite", montant: 10_000 }],
      0.2
    );
    expect(resultat.imprevus).toBe(2_000);
  });

  it("gère une liste de travaux vide", () => {
    const resultat = calculerTravaux([]);
    expect(resultat.totalTravaux).toBe(0);
    expect(resultat.totalTravauxAvecImprevus).toBe(0);
  });

  it("rejette un montant de ligne négatif", () => {
    expect(() =>
      calculerTravaux([{ categorie: "autre", sousCategorie: "test", montant: -100 }])
    ).toThrow();
  });

  it("rejette un taux d'imprévus négatif", () => {
    expect(() =>
      calculerTravaux(
        [{ categorie: "autre", sousCategorie: "test", montant: 100 }],
        -0.1
      )
    ).toThrow();
  });
});
