import { describe, expect, it } from "vitest";
import { validerEmail, validerFormulaireAuth, validerMotDePasse } from "../validation";

describe("validerEmail", () => {
  it("accepte un email valide", () => {
    expect(validerEmail("dorian@example.com")).toBeUndefined();
  });
  it("rejette un email vide", () => {
    expect(validerEmail("")).toBeDefined();
  });
  it("rejette un email sans arobase", () => {
    expect(validerEmail("dorian.example.com")).toBeDefined();
  });
  it("rejette un email sans domaine", () => {
    expect(validerEmail("dorian@")).toBeDefined();
  });
});

describe("validerMotDePasse", () => {
  it("accepte un mot de passe de 8 caractères ou plus", () => {
    expect(validerMotDePasse("motdepasse")).toBeUndefined();
  });
  it("rejette un mot de passe vide", () => {
    expect(validerMotDePasse("")).toBeDefined();
  });
  it("rejette un mot de passe de moins de 8 caractères", () => {
    expect(validerMotDePasse("abc123")).toBeDefined();
  });
});

describe("validerFormulaireAuth", () => {
  it("ne renvoie aucune erreur pour un formulaire valide", () => {
    expect(validerFormulaireAuth("dorian@example.com", "motdepasse")).toEqual({});
  });
  it("renvoie les deux erreurs pour un formulaire invalide", () => {
    const erreurs = validerFormulaireAuth("pas-un-email", "court");
    expect(erreurs.email).toBeDefined();
    expect(erreurs.password).toBeDefined();
  });
});
