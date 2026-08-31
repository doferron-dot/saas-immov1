import { describe, expect, it } from "vitest";
import {
  DELTAS_DEFAUT,
  appliquerDeltaDureeMois,
  appliquerDeltaPct,
  construireParametresScenarios,
} from "../scenarios";

describe("appliquerDeltaPct", () => {
  it("applique un delta positif", () => {
    expect(appliquerDeltaPct(100_000, 0.15)).toBeCloseTo(115_000, 6);
  });
  it("applique un delta négatif", () => {
    expect(appliquerDeltaPct(100_000, -0.1)).toBeCloseTo(90_000, 6);
  });
  it("delta nul renvoie la valeur de base inchangée", () => {
    expect(appliquerDeltaPct(42_000, 0)).toBe(42_000);
  });
});

describe("appliquerDeltaDureeMois", () => {
  it("ajoute des mois", () => {
    expect(appliquerDeltaDureeMois(24, 6)).toBe(30);
  });
  it("retire des mois", () => {
    expect(appliquerDeltaDureeMois(24, -3)).toBe(21);
  });
  it("ne descend jamais sous 1 mois même avec un delta négatif important", () => {
    expect(appliquerDeltaDureeMois(3, -10)).toBe(1);
  });
  it("arrondit à l'entier le plus proche", () => {
    expect(appliquerDeltaDureeMois(24, 0.6)).toBe(25);
  });
  it("rejette une durée de base nulle ou négative", () => {
    expect(() => appliquerDeltaDureeMois(0, 6)).toThrow();
    expect(() => appliquerDeltaDureeMois(-1, 6)).toThrow();
  });
});

describe("DELTAS_DEFAUT", () => {
  it("correspond exactement aux valeurs du cahier des charges", () => {
    expect(DELTAS_DEFAUT.pessimiste).toEqual({
      travauxDeltaPct: 0.15,
      reventeDeltaPct: -0.1,
      dureeDeltaMois: 6,
    });
    expect(DELTAS_DEFAUT.optimiste).toEqual({
      travauxDeltaPct: -0.05,
      reventeDeltaPct: 0.05,
      dureeDeltaMois: -3,
    });
  });
});

describe("construireParametresScenarios", () => {
  it("renvoie les 3 scénarios, réaliste = null (valeurs saisies par l'utilisateur)", () => {
    const parametres = construireParametresScenarios();
    expect(parametres.pessimiste).toEqual(DELTAS_DEFAUT.pessimiste);
    expect(parametres.optimiste).toEqual(DELTAS_DEFAUT.optimiste);
    expect(parametres.réaliste).toBeNull();
  });

  it("permet de personnaliser un delta tout en gardant les autres par défaut", () => {
    const parametres = construireParametresScenarios({ pessimiste: { travauxDeltaPct: 0.25 } });
    expect(parametres.pessimiste).toEqual({
      travauxDeltaPct: 0.25,
      reventeDeltaPct: -0.1,
      dureeDeltaMois: 6,
    });
    // l'optimiste n'est pas affecté par la personnalisation du pessimiste
    expect(parametres.optimiste).toEqual(DELTAS_DEFAUT.optimiste);
  });
});
