import { describe, expect, it } from "vitest";
import {
  construireHypothesesProjectionPersonnalisees,
  serialiserParametresHypotheses,
} from "../parametres-projection";
import { HYPOTHESES_PROJECTION } from "../../calc-engine/projection";

describe("construireHypothesesProjectionPersonnalisees", () => {
  it("renvoie undefined sans aucun paramètre", () => {
    expect(construireHypothesesProjectionPersonnalisees({})).toBeUndefined();
  });

  it("renvoie undefined si tous les paramètres sont des chaînes vides", () => {
    expect(construireHypothesesProjectionPersonnalisees({ pValo: "", oFrais: "  " })).toBeUndefined();
  });

  it("ignore les valeurs non numériques", () => {
    expect(construireHypothesesProjectionPersonnalisees({ pValo: "abc" })).toBeUndefined();
  });

  it("un seul champ renseigné construit le profil entier (autres valeurs par défaut)", () => {
    const resultat = construireHypothesesProjectionPersonnalisees({ pValo: "3" });
    expect(resultat).toBeDefined();
    expect(resultat!.prudent).toEqual({
      tauxValorisationBienAnnuel: 0.03,
      tauxIndexationLoyerAnnuel: HYPOTHESES_PROJECTION.prudent.tauxIndexationLoyerAnnuel,
      tauxIndexationChargesAnnuel: HYPOTHESES_PROJECTION.prudent.tauxIndexationChargesAnnuel,
      tauxFraisReventeEstimes: HYPOTHESES_PROJECTION.prudent.tauxFraisReventeEstimes,
    });
    expect(resultat!.optimiste).toBeUndefined();
  });

  it("les deux profils peuvent être personnalisés indépendamment", () => {
    const resultat = construireHypothesesProjectionPersonnalisees({
      pValo: "1",
      pLoyer: "0.5",
      pCharges: "0.5",
      pFrais: "7",
      oValo: "4",
      oLoyer: "2",
      oCharges: "2",
      oFrais: "5",
    });
    expect(resultat!.prudent).toEqual({
      tauxValorisationBienAnnuel: 0.01,
      tauxIndexationLoyerAnnuel: 0.005,
      tauxIndexationChargesAnnuel: 0.005,
      tauxFraisReventeEstimes: 0.07,
    });
    expect(resultat!.optimiste).toEqual({
      tauxValorisationBienAnnuel: 0.04,
      tauxIndexationLoyerAnnuel: 0.02,
      tauxIndexationChargesAnnuel: 0.02,
      tauxFraisReventeEstimes: 0.05,
    });
  });
});

describe("serialiserParametresHypotheses", () => {
  it("renvoie une chaîne vide sans paramètre", () => {
    expect(serialiserParametresHypotheses({})).toBe("");
  });

  it("n'inclut que les paramètres présents et non vides", () => {
    const resultat = serialiserParametresHypotheses({ pValo: "3", oFrais: "", pLoyer: "1" });
    const params = new URLSearchParams(resultat);
    expect(params.get("pValo")).toBe("3");
    expect(params.get("pLoyer")).toBe("1");
    expect(params.has("oFrais")).toBe(false);
  });
});
