import { describe, expect, it } from "vitest";
import { calculerAmortissementAnnuel, COMPOSANTS_BATI_DEFAUT } from "../amortissement";

describe("calculerAmortissementAnnuel", () => {
  it("exclut le terrain (15% par défaut) de la base amortissable", () => {
    const resultat = calculerAmortissementAnnuel({
      valeurBienTotal: 200_000,
      valeurMobilier: 0,
    });
    expect(resultat.valeurTerrain).toBe(30_000);
    expect(resultat.valeurBatiAmortissable).toBe(170_000);
  });

  it("répartit le bâti sur les 4 composants par défaut, qui somment à la valeur du bâti", () => {
    const resultat = calculerAmortissementAnnuel({
      valeurBienTotal: 200_000,
      valeurMobilier: 0,
    });
    const lignesBati = resultat.lignes.filter((l) => l.nom !== "mobilier");
    const sommeValeurs = lignesBati.reduce((s, l) => s + l.valeurAmortissable, 0);
    expect(sommeValeurs).toBeCloseTo(resultat.valeurBatiAmortissable, 6);
    expect(lignesBati).toHaveLength(4);
  });

  it("calcule un amortissement annuel = valeur / durée pour chaque composant", () => {
    const resultat = calculerAmortissementAnnuel({
      valeurBienTotal: 200_000,
      valeurMobilier: 0,
    });
    const grosOeuvre = resultat.lignes.find((l) => l.nom === "gros_oeuvre")!;
    // 200000 * 0.85 (hors terrain) * 0.40 / 50 ans
    expect(grosOeuvre.amortissementAnnuel).toBeCloseTo((200_000 * 0.85 * 0.4) / 50, 6);
  });

  it("ajoute une ligne mobilier séparée, amortie sur 7 ans par défaut", () => {
    const resultat = calculerAmortissementAnnuel({
      valeurBienTotal: 200_000,
      valeurMobilier: 7_000,
    });
    const mobilier = resultat.lignes.find((l) => l.nom === "mobilier")!;
    expect(mobilier.amortissementAnnuel).toBeCloseTo(1_000, 6);
  });

  it("permet de personnaliser le taux terrain et la durée du mobilier", () => {
    const resultat = calculerAmortissementAnnuel({
      valeurBienTotal: 200_000,
      valeurMobilier: 10_000,
      tauxTerrain: 0.2,
      dureeMobilier: 5,
    });
    expect(resultat.valeurTerrain).toBe(40_000);
    expect(resultat.lignes.find((l) => l.nom === "mobilier")!.amortissementAnnuel).toBe(2_000);
  });

  it("rejette une décomposition de composants dont les parts ne somment pas à 1", () => {
    expect(() =>
      calculerAmortissementAnnuel({
        valeurBienTotal: 200_000,
        valeurMobilier: 0,
        composantsBati: [
          { nom: "gros_oeuvre", partValeurBati: 0.5, dureeAnnees: 50 },
          { nom: "toiture", partValeurBati: 0.3, dureeAnnees: 25 },
        ],
      })
    ).toThrow();
  });

  it("rejette un taux terrain hors de [0,1)", () => {
    expect(() =>
      calculerAmortissementAnnuel({ valeurBienTotal: 200_000, valeurMobilier: 0, tauxTerrain: 1 })
    ).toThrow();
  });

  it("expose la décomposition par défaut telle que documentée", () => {
    expect(COMPOSANTS_BATI_DEFAUT.reduce((s, c) => s + c.partValeurBati, 0)).toBeCloseTo(1, 6);
  });
});
