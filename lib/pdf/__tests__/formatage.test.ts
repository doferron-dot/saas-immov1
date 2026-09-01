import { describe, expect, it } from "vitest";
import { formaterEuro, formaterPct, formaterEuroCompact, formaterDate } from "../formatage";

// U+202F (espace fine insécable) et U+00A0 (espace insécable) : caractères que la police
// PDF par défaut (Helvetica/WinAnsi) ne sait pas rendre — voir lib/pdf/formatage.ts.
// Repéré en relisant visuellement un PDF de test généré en conditions réelles ("200/000 €"
// au lieu de "200 000 €"). Ce test verrouille le correctif pour ne pas régresser.
const ESPACES_INCOMPATIBLES_PDF = /[  ]/;

describe("formaterEuro", () => {
  it("formate un montant en euros, sans espace fine insécable", () => {
    const resultat = formaterEuro(200_000);
    expect(resultat).toBe("200 000 €");
    expect(resultat).not.toMatch(ESPACES_INCOMPATIBLES_PDF);
  });

  it("arrondit à l'euro près", () => {
    expect(formaterEuro(1234.56)).toBe("1 235 €");
  });

  it("gère les montants négatifs", () => {
    const resultat = formaterEuro(-17_235);
    expect(resultat).toContain("17 235");
    expect(resultat).not.toMatch(ESPACES_INCOMPATIBLES_PDF);
  });
});

describe("formaterPct", () => {
  it("formate une fraction en pourcentage avec une décimale", () => {
    expect(formaterPct(0.045)).toBe("4,5 %");
  });

  it("ne contient pas d'espace incompatible avec la police PDF", () => {
    expect(formaterPct(0.1)).not.toMatch(ESPACES_INCOMPATIBLES_PDF);
  });
});

describe("formaterEuroCompact", () => {
  it("formate un grand montant en notation compacte, sans espace incompatible", () => {
    const resultat = formaterEuroCompact(441_600);
    expect(resultat).not.toMatch(ESPACES_INCOMPATIBLES_PDF);
    expect(resultat).toContain("k");
  });
});

describe("formaterDate", () => {
  it("formate une date en français, jour mois année", () => {
    expect(formaterDate(new Date("2026-08-31T12:00:00Z"))).toBe("31 août 2026");
  });
});
