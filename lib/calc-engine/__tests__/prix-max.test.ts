import { describe, expect, it } from "vitest";
import { expliquerResultatPrixMax, trouverPrixMaximum } from "../prix-max";

// Indicateur synthétique simple, strictement décroissant avec le prix, résoluble
// algébriquement : rendement(prix) = 12000 / prix (rendement brut à loyer fixe).
// rendement(prix) >= objectif  <=>  prix <= 12000 / objectif
const rendementSynthetique = (prixAchat: number): number => (prixAchat > 0 ? 12_000 / prixAchat : Infinity);

describe("trouverPrixMaximum", () => {
  it("converge vers la solution algébrique connue (rendement >= 6%)", () => {
    const resultat = trouverPrixMaximum({
      calculerIndicateur: rendementSynthetique,
      objectif: 0.06,
      prixMin: 1,
      prixMax: 1_000_000,
      precision: 10,
    });
    const solutionAttendue = 12_000 / 0.06; // = 200 000
    expect(resultat.convergé).toBe(true);
    expect(resultat.prixMaximum).toBeCloseTo(solutionAttendue, -1); // à 10€ près
    expect(resultat.indicateurAtteint).toBeGreaterThanOrEqual(0.06);
  });

  it("converge vers une autre solution algébrique connue (rendement >= 4%)", () => {
    const resultat = trouverPrixMaximum({
      calculerIndicateur: rendementSynthetique,
      objectif: 0.04,
      prixMin: 1,
      prixMax: 1_000_000,
      precision: 10,
    });
    const solutionAttendue = 12_000 / 0.04; // = 300 000
    expect(resultat.prixMaximum).toBeCloseTo(solutionAttendue, -1);
  });

  it("le prix trouvé respecte toujours l'objectif (jamais au-dessus du vrai plafond)", () => {
    const resultat = trouverPrixMaximum({
      calculerIndicateur: rendementSynthetique,
      objectif: 0.08,
      prixMin: 1,
      prixMax: 1_000_000,
      precision: 10,
    });
    expect(rendementSynthetique(resultat.prixMaximum)).toBeGreaterThanOrEqual(0.08);
    // et juste au-dessus (avec la précision), l'objectif n'est plus respecté
    expect(rendementSynthetique(resultat.prixMaximum + 20)).toBeLessThan(0.08);
  });

  it("renvoie convergé=false quand même prixMin ne respecte pas l'objectif", () => {
    const resultat = trouverPrixMaximum({
      calculerIndicateur: rendementSynthetique,
      objectif: 0.5, // rendement de 50% même à prixMin=1 -> 12000/1 = 12000 >= 0.5, donc objectif trop élevé pour prixMin élevé
      prixMin: 500_000,
      prixMax: 1_000_000,
    });
    expect(resultat.convergé).toBe(false);
    expect(resultat.prixMaximum).toBe(500_000);
  });

  it("renvoie convergé=false quand l'objectif est encore respecté à prixMax (plafond hors intervalle)", () => {
    const resultat = trouverPrixMaximum({
      calculerIndicateur: rendementSynthetique,
      objectif: 0.001, // très facile à atteindre, même à prixMax
      prixMin: 1,
      prixMax: 1_000,
    });
    expect(resultat.convergé).toBe(false);
    expect(resultat.prixMaximum).toBe(1_000);
  });

  it("rejette prixMin négatif", () => {
    expect(() =>
      trouverPrixMaximum({ calculerIndicateur: rendementSynthetique, objectif: 0.06, prixMin: -1 })
    ).toThrow();
  });

  it("rejette prixMax <= prixMin", () => {
    expect(() =>
      trouverPrixMaximum({
        calculerIndicateur: rendementSynthetique,
        objectif: 0.06,
        prixMin: 100,
        prixMax: 100,
      })
    ).toThrow();
  });

  it("rejette une precision négative ou nulle", () => {
    expect(() =>
      trouverPrixMaximum({ calculerIndicateur: rendementSynthetique, objectif: 0.06, precision: 0 })
    ).toThrow();
  });
});

describe("expliquerResultatPrixMax", () => {
  it("génère une phrase avec le prix trouvé quand convergé", () => {
    const resultat = trouverPrixMaximum({
      calculerIndicateur: rendementSynthetique,
      objectif: 0.06,
      prixMin: 1,
      prixMax: 1_000_000,
      precision: 10,
    });
    const phrase = expliquerResultatPrixMax(resultat, "rendement brut", 0.06);
    expect(phrase).toContain("prix d'achat maximum");
    expect(phrase.length).toBeGreaterThan(10);
  });

  it("génère une phrase différente quand l'objectif n'est pas atteignable", () => {
    const resultat = trouverPrixMaximum({
      calculerIndicateur: rendementSynthetique,
      objectif: 0.5,
      prixMin: 500_000,
      prixMax: 1_000_000,
    });
    const phrase = expliquerResultatPrixMax(resultat, "rendement brut", 0.5);
    expect(phrase).toContain("Aucun prix");
  });
});
