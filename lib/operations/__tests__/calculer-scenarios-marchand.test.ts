import { describe, expect, it } from "vitest";
import { calculerScenariosMarchand } from "../calculer-scenarios-marchand";
import type { Operation } from "../../db/operations";
import type { LigneTravauxDB } from "../../db/travaux-lignes";
import type { FinancementDB } from "../../db/financement";
import type { LotMarchandDB } from "../../db/operation-marchand-lots";

function operationDeBase(): Operation {
  return {
    id: "op-1",
    user_id: "user-1",
    mode: "marchand",
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

const LOTS: LotMarchandDB[] = [
  { id: "l1", operation_id: "op-1", nom_lot: "Lot 1", type_lot: "T2", prix_revente_prevu: 150_000 },
  { id: "l2", operation_id: "op-1", nom_lot: "Lot 2", type_lot: "T3", prix_revente_prevu: 170_000 },
];

const TRAVAUX: LigneTravauxDB[] = [
  { id: "t1", operation_id: "op-1", categorie: "interieur", sous_categorie: "Rénovation", montant: 30_000 },
];

const FINANCEMENT: FinancementDB = {
  id: "f1",
  operation_id: "op-1",
  apport: 40_000,
  montant_emprunte: 180_000,
  taux: 0.04,
  duree_mois: 18,
  assurance_taux: 0,
  differe_type: "total",
  differe_mois: 15,
  frais_bancaires: 500,
};

describe("calculerScenariosMarchand — données insuffisantes", () => {
  it("renvoie null si le prix d'achat est à 0", () => {
    const operation = { ...operationDeBase(), prix_achat: 0 };
    expect(calculerScenariosMarchand(operation, [], null, LOTS)).toBeNull();
  });

  it("renvoie null sans lot avec un prix de revente positif", () => {
    const operation = operationDeBase();
    const lotsVides: LotMarchandDB[] = [
      { id: "l1", operation_id: "op-1", nom_lot: "Lot 1", type_lot: null, prix_revente_prevu: 0 },
    ];
    expect(calculerScenariosMarchand(operation, [], null, lotsVides)).toBeNull();
  });
});

describe("calculerScenariosMarchand — cas complet", () => {
  it("renvoie les 3 scénarios dans l'ordre pessimiste / réaliste / optimiste", () => {
    const resultats = calculerScenariosMarchand(operationDeBase(), TRAVAUX, FINANCEMENT, LOTS);
    expect(resultats).not.toBeNull();
    expect(resultats!.map((r) => r.type)).toEqual(["pessimiste", "réaliste", "optimiste"]);
  });

  it("le scénario pessimiste a une marge inférieure ou égale au réaliste, lui-même <= optimiste", () => {
    const resultats = calculerScenariosMarchand(operationDeBase(), TRAVAUX, FINANCEMENT, LOTS)!;
    const [pessimiste, realiste, optimiste] = resultats;
    expect(pessimiste.detail.marge).toBeLessThan(realiste.detail.marge);
    expect(realiste.detail.marge).toBeLessThan(optimiste.detail.marge);
  });

  it("le scénario pessimiste a des travaux plus élevés que le réaliste, l'optimiste moins élevés", () => {
    const resultats = calculerScenariosMarchand(operationDeBase(), TRAVAUX, FINANCEMENT, LOTS)!;
    const [pessimiste, realiste, optimiste] = resultats;
    expect(pessimiste.totalTravaux).toBeGreaterThan(realiste.totalTravaux);
    expect(optimiste.totalTravaux).toBeLessThan(realiste.totalTravaux);
  });

  it("le réaliste correspond aux montants saisis sans aucun delta", () => {
    const resultats = calculerScenariosMarchand(operationDeBase(), TRAVAUX, FINANCEMENT, LOTS)!;
    const realiste = resultats.find((r) => r.type === "réaliste")!;
    expect(realiste.totalTravaux).toBeCloseTo(30_000 * 1.1, 2); // +10% d'imprévus par défaut de calculerTravaux
    expect(realiste.detail.chiffreAffairesTotal).toBe(320_000);
  });

  it("ne plante pas quand le différé du scénario optimiste dépasserait la nouvelle durée raccourcie", () => {
    // durée de base 18 mois, delta optimiste -3 mois -> 15 mois ; différé de base 15 mois,
    // devrait être automatiquement raccourci plutôt que de faire planter le calcul.
    expect(() => calculerScenariosMarchand(operationDeBase(), TRAVAUX, FINANCEMENT, LOTS)).not.toThrow();
  });

  it("fonctionne sans financement (achat cash)", () => {
    const resultats = calculerScenariosMarchand(operationDeBase(), TRAVAUX, null, LOTS);
    expect(resultats).not.toBeNull();
    expect(resultats!.every((r) => Number.isFinite(r.detail.roi))).toBe(true);
  });
});
