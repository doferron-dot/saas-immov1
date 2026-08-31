import { describe, expect, it } from "vitest";
import { calculerInvestisseur, calculerRendementNetNet } from "../investisseur";
import type { ResultatFiscal } from "../fiscalite";

const entreesBase = {
  loyerMensuel: 1_000,
  chargesNonRecuperablesAnnuelles: 500,
  taxeFonciereAnnuelle: 1_200,
  assurancePnoAnnuelle: 200,
  fraisGestionPct: 0.08,
  entretienPct: 0.05,
  vacanceLocativePct: 0.05,
  autresChargesAnnuelles: 100,
};

describe("calculerInvestisseur", () => {
  it("calcule les loyers bruts, la perte de vacance locative et les loyers encaissés", () => {
    const resultat = calculerInvestisseur(entreesBase, 200_000, 900);
    expect(resultat.loyersAnnuelsBruts).toBe(12_000);
    expect(resultat.perteVacanceLocative).toBeCloseTo(600, 6); // 12000 * 0.05
    expect(resultat.loyersAnnuelsEncaisses).toBeCloseTo(11_400, 6);
  });

  it("calcule les frais de gestion et l'entretien sur les loyers encaissés (pas bruts)", () => {
    const resultat = calculerInvestisseur(entreesBase, 200_000, 900);
    expect(resultat.fraisGestion).toBeCloseTo(11_400 * 0.08, 6);
    expect(resultat.entretien).toBeCloseTo(11_400 * 0.05, 6);
  });

  it("additionne toutes les charges non récupérables dans chargesAnnuelles", () => {
    const resultat = calculerInvestisseur(entreesBase, 200_000, 900);
    const chargesAttendues =
      500 + 1_200 + 200 + 11_400 * 0.08 + 11_400 * 0.05 + 100;
    expect(resultat.chargesAnnuelles).toBeCloseTo(chargesAttendues, 6);
  });

  it("calcule le rendement brut = loyers bruts / coût total d'acquisition", () => {
    const resultat = calculerInvestisseur(entreesBase, 200_000, 900);
    expect(resultat.rendementBrut).toBeCloseTo(12_000 / 200_000, 6);
  });

  it("calcule le rendement net = (loyers encaissés - charges) / coût total d'acquisition", () => {
    const resultat = calculerInvestisseur(entreesBase, 200_000, 900);
    expect(resultat.rendementNet).toBeCloseTo(
      (resultat.loyersAnnuelsEncaisses - resultat.chargesAnnuelles) / 200_000,
      6
    );
  });

  it("calcule le cash-flow annuel/mensuel après mensualité de crédit", () => {
    const resultat = calculerInvestisseur(entreesBase, 200_000, 900);
    const cashFlowAttendu =
      resultat.loyersAnnuelsEncaisses - resultat.chargesAnnuelles - 900 * 12;
    expect(resultat.cashFlowAnnuel).toBeCloseTo(cashFlowAttendu, 6);
    expect(resultat.cashFlowMensuel).toBeCloseTo(cashFlowAttendu / 12, 6);
  });

  it("renvoie des rendements à 0 si le coût total d'acquisition est nul", () => {
    const resultat = calculerInvestisseur(entreesBase, 0, 0);
    expect(resultat.rendementBrut).toBe(0);
    expect(resultat.rendementNet).toBe(0);
  });

  it("gère une vacance locative nulle sans perte", () => {
    const resultat = calculerInvestisseur(
      { ...entreesBase, vacanceLocativePct: 0 },
      200_000,
      900
    );
    expect(resultat.perteVacanceLocative).toBe(0);
    expect(resultat.loyersAnnuelsEncaisses).toBe(resultat.loyersAnnuelsBruts);
  });

  it("rejette un loyer mensuel négatif", () => {
    expect(() =>
      calculerInvestisseur({ ...entreesBase, loyerMensuel: -100 }, 200_000, 900)
    ).toThrow();
  });

  it("rejette un coût total d'acquisition négatif", () => {
    expect(() => calculerInvestisseur(entreesBase, -1, 900)).toThrow();
  });

  it("rejette des pourcentages hors de [0,1]", () => {
    expect(() =>
      calculerInvestisseur({ ...entreesBase, fraisGestionPct: 1.5 }, 200_000, 900)
    ).toThrow();
    expect(() =>
      calculerInvestisseur({ ...entreesBase, entretienPct: -0.1 }, 200_000, 900)
    ).toThrow();
    expect(() =>
      calculerInvestisseur({ ...entreesBase, vacanceLocativePct: -0.1 }, 200_000, 900)
    ).toThrow();
  });
});

describe("calculerRendementNetNet", () => {
  it("soustrait l'impôt total du cash-flow et du rendement net", () => {
    const detail = calculerInvestisseur(entreesBase, 200_000, 900);
    const resultatFiscal: ResultatFiscal = {
      regime: "reel-foncier",
      resultatImposable: 3_000,
      impotRevenu: 900,
      prelevementsSociaux: 516,
      impotTotal: 1_416,
      report: 0,
      revenuNetApresImpot: 3_000 - 1_416,
    };
    const netNet = calculerRendementNetNet(detail, 200_000, resultatFiscal);

    expect(netNet.cashFlowNetNetAnnuel).toBeCloseTo(
      detail.cashFlowAnnuel - 1_416,
      6
    );
    expect(netNet.cashFlowNetNetMensuel).toBeCloseTo(
      netNet.cashFlowNetNetAnnuel / 12,
      6
    );
    expect(netNet.rendementNetNet).toBeCloseTo(
      (detail.loyersAnnuelsEncaisses - detail.chargesAnnuelles - 1_416) / 200_000,
      6
    );
  });

  it("renvoie un rendement net-net à 0 si le coût total d'acquisition est nul", () => {
    const detail = calculerInvestisseur(entreesBase, 0, 0);
    const resultatFiscal: ResultatFiscal = {
      regime: "reel-foncier",
      resultatImposable: 0,
      impotRevenu: 0,
      prelevementsSociaux: 0,
      impotTotal: 0,
      report: 0,
      revenuNetApresImpot: 0,
    };
    const netNet = calculerRendementNetNet(detail, 0, resultatFiscal);
    expect(netNet.rendementNetNet).toBe(0);
  });
});
