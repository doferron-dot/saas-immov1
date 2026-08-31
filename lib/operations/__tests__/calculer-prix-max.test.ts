import { describe, expect, it } from "vitest";
import { calculerPrixMaxInvestisseur, calculerPrixMaxMarchand } from "../calculer-prix-max";
import type { Operation } from "../../db/operations";
import type { FinancementDB } from "../../db/financement";
import type { OperationInvestisseurDB } from "../../db/operation-investisseur";
import type { LotMarchandDB } from "../../db/operation-marchand-lots";

function operationDeBase(mode: "investisseur" | "marchand"): Operation {
  return {
    id: "op-1",
    user_id: "user-1",
    mode,
    nom: "Test",
    statut: "brouillon",
    favori: false,
    adresse: null,
    ville: null,
    code_postal: null,
    type_bien: null,
    ancien_ou_neuf: "ancien",
    surface: null,
    pieces: null,
    chambres: null,
    etage: null,
    ascenseur: null,
    parking: null,
    cave: null,
    dpe: null,
    prix_achat: 200_000,
    frais_agence: 0,
    frais_agence_inclus: false,
    taux_dmto: null,
    taux_emoluments_config: null,
    frais_dossier: 0,
    frais_garantie: 0,
    autres_frais_acquisition: 0,
    frais_revente: 5_000,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const FINANCEMENT: FinancementDB = {
  id: "f1",
  operation_id: "op-1",
  apport: 40_000,
  montant_emprunte: 0, // ignoré par le solveur : recalculé pour chaque prix testé
  taux: 0.035,
  duree_mois: 240,
  assurance_taux: 0.003,
  differe_type: "aucun",
  differe_mois: 0,
  frais_bancaires: 0,
};

describe("calculerPrixMaxInvestisseur", () => {
  const investisseur: OperationInvestisseurDB = {
    id: "inv-1",
    operation_id: "op-1",
    loyer_mensuel: 900,
    charges_recuperables: 0,
    charges_non_recuperables: 300,
    taxe_fonciere: 800,
    assurance_pno: 120,
    frais_gestion_pct: 0.07,
    entretien_pct: 0.03,
    vacance_locative_pct: 0.05,
    autres_charges: 0,
  };

  it("converge vers un prix dont le rendement net est proche de l'objectif", () => {
    const resultat = calculerPrixMaxInvestisseur({
      operation: operationDeBase("investisseur"),
      totalTravaux: 5_000,
      financement: FINANCEMENT,
      investisseur,
      objectif: "rendementNet",
      valeurObjectif: 0.05,
    });

    expect(resultat.convergé).toBe(true);
    expect(resultat.prixMaximum).toBeGreaterThan(0);
    expect(resultat.indicateurAtteint).toBeCloseTo(0.05, 2);
  });

  it("un objectif de rendement plus exigeant donne un prix maximum plus bas", () => {
    const base = {
      operation: operationDeBase("investisseur"),
      totalTravaux: 5_000,
      financement: FINANCEMENT,
      investisseur,
      objectif: "rendementNet" as const,
    };
    const exigeant = calculerPrixMaxInvestisseur({ ...base, valeurObjectif: 0.08 });
    const souple = calculerPrixMaxInvestisseur({ ...base, valeurObjectif: 0.03 });

    expect(exigeant.prixMaximum).toBeLessThan(souple.prixMaximum);
  });

  it("fonctionne aussi avec l'objectif cash-flow mensuel", () => {
    const resultat = calculerPrixMaxInvestisseur({
      operation: operationDeBase("investisseur"),
      totalTravaux: 0,
      financement: FINANCEMENT,
      investisseur,
      objectif: "cashFlowMensuel",
      valeurObjectif: 50,
    });
    expect(resultat.prixMaximum).toBeGreaterThan(0);
  });

  it("fonctionne sans financement (achat cash)", () => {
    const resultat = calculerPrixMaxInvestisseur({
      operation: operationDeBase("investisseur"),
      totalTravaux: 0,
      financement: null,
      investisseur,
      objectif: "rendementNet",
      valeurObjectif: 0.05,
    });
    expect(resultat.prixMaximum).toBeGreaterThan(0);
  });
});

describe("calculerPrixMaxMarchand", () => {
  const lots: LotMarchandDB[] = [
    { id: "l1", operation_id: "op-1", nom_lot: "Lot 1", type_lot: "T2", prix_revente_prevu: 150_000 },
    { id: "l2", operation_id: "op-1", nom_lot: "Lot 2", type_lot: "T3", prix_revente_prevu: 170_000 },
  ];

  it("converge vers un prix dont la marge % est proche de l'objectif", () => {
    const resultat = calculerPrixMaxMarchand({
      operation: operationDeBase("marchand"),
      totalTravaux: 20_000,
      financement: FINANCEMENT,
      lots,
      objectif: "margePct",
      valeurObjectif: 0.15,
    });

    expect(resultat.convergé).toBe(true);
    expect(resultat.indicateurAtteint).toBeCloseTo(0.15, 2);
  });

  it("un objectif de marge plus exigeant donne un prix maximum plus bas", () => {
    const base = {
      operation: operationDeBase("marchand"),
      totalTravaux: 20_000,
      financement: FINANCEMENT,
      lots,
      objectif: "margePct" as const,
    };
    const exigeant = calculerPrixMaxMarchand({ ...base, valeurObjectif: 0.25 });
    const souple = calculerPrixMaxMarchand({ ...base, valeurObjectif: 0.1 });

    expect(exigeant.prixMaximum).toBeLessThan(souple.prixMaximum);
  });

  it("fonctionne aussi avec l'objectif ROI", () => {
    const resultat = calculerPrixMaxMarchand({
      operation: operationDeBase("marchand"),
      totalTravaux: 20_000,
      financement: FINANCEMENT,
      lots,
      objectif: "roi",
      valeurObjectif: 0.2,
    });
    expect(resultat.prixMaximum).toBeGreaterThan(0);
  });
});
