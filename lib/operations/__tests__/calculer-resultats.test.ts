import { describe, expect, it } from "vitest";
import { calculerResultatsOperation } from "../calculer-resultats";
import type { Operation } from "../../db/operations";
import type { LigneTravauxDB } from "../../db/travaux-lignes";
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

const AUCUN_TRAVAUX: LigneTravauxDB[] = [];
const AUCUN_FINANCEMENT: FinancementDB | null = null;

describe("calculerResultatsOperation — données insuffisantes", () => {
  it("renvoie null si le prix d'achat est à 0", () => {
    const operation = { ...operationDeBase("investisseur"), prix_achat: 0 };
    expect(calculerResultatsOperation(operation, [], null, null, [])).toBeNull();
  });

  it("renvoie null en mode investisseur sans loyer", () => {
    const operation = operationDeBase("investisseur");
    expect(calculerResultatsOperation(operation, [], null, null, [])).toBeNull();
  });

  it("renvoie null en mode marchand sans lot avec un prix de revente positif", () => {
    const operation = operationDeBase("marchand");
    const lots: LotMarchandDB[] = [
      { id: "l1", operation_id: "op-1", nom_lot: "Lot 1", type_lot: null, prix_revente_prevu: 0 },
    ];
    expect(calculerResultatsOperation(operation, [], null, null, lots)).toBeNull();
  });
});

describe("calculerResultatsOperation — mode investisseur", () => {
  it("calcule un résultat cohérent avec un loyer positif, sans crédit", () => {
    const operation = operationDeBase("investisseur");
    const investisseur: OperationInvestisseurDB = {
      id: "inv-1",
      operation_id: "op-1",
      loyer_mensuel: 900,
      charges_recuperables: 0,
      charges_non_recuperables: 500,
      taxe_fonciere: 1000,
      assurance_pno: 150,
      frais_gestion_pct: 0.08,
      entretien_pct: 0.05,
      vacance_locative_pct: 0.05,
      autres_charges: 0,
    };

    const resultats = calculerResultatsOperation(operation, AUCUN_TRAVAUX, AUCUN_FINANCEMENT, investisseur, []);

    expect(resultats).not.toBeNull();
    expect(resultats!.investisseur).toBeDefined();
    expect(resultats!.marchand).toBeUndefined();
    // Coût d'acquisition doit être strictement supérieur au prix d'achat (frais de notaire).
    expect(resultats!.coutTotalAcquisition).toBeGreaterThan(operation.prix_achat);
    // Sans crédit : mensualité et coût du crédit nuls, montant investi = apport (0 ici).
    expect(resultats!.mensualiteCredit).toBe(0);
    expect(resultats!.montantTotalInvesti).toBe(0);
    expect(resultats!.investisseur!.loyersAnnuelsBruts).toBe(900 * 12);
    expect(resultats!.score.total).toBeGreaterThanOrEqual(0);
    expect(resultats!.score.total).toBeLessThanOrEqual(100);
  });

  it("des hypothèses de projection personnalisées sont bien répercutées sur le résultat", () => {
    const operation = operationDeBase("investisseur");
    const investisseur: OperationInvestisseurDB = {
      id: "inv-1",
      operation_id: "op-1",
      loyer_mensuel: 900,
      charges_recuperables: 0,
      charges_non_recuperables: 500,
      taxe_fonciere: 1000,
      assurance_pno: 150,
      frais_gestion_pct: 0.08,
      entretien_pct: 0.05,
      vacance_locative_pct: 0.05,
      autres_charges: 0,
    };

    const resultatsParDefaut = calculerResultatsOperation(
      operation,
      AUCUN_TRAVAUX,
      AUCUN_FINANCEMENT,
      investisseur,
      []
    );
    const resultatsPersonnalises = calculerResultatsOperation(
      operation,
      AUCUN_TRAVAUX,
      AUCUN_FINANCEMENT,
      investisseur,
      [],
      { prudent: { tauxValorisationBienAnnuel: 0, tauxIndexationLoyerAnnuel: 0, tauxIndexationChargesAnnuel: 0, tauxFraisReventeEstimes: 0.06 } }
    );

    const valeurBienAn20Defaut = resultatsParDefaut!.projection!.prudent.find((p) => p.annee === 20)!.valeurBien;
    const valeurBienAn20Personnalise = resultatsPersonnalises!.projection!.prudent.find((p) => p.annee === 20)!
      .valeurBien;
    expect(valeurBienAn20Personnalise).toBeCloseTo(operation.prix_achat, 6);
    expect(valeurBienAn20Defaut).toBeGreaterThan(valeurBienAn20Personnalise);
    // Le profil optimiste n'a pas été personnalisé : reste au comportement par défaut.
    expect(resultatsPersonnalises!.projection!.optimiste).toEqual(resultatsParDefaut!.projection!.optimiste);
  });

  it("un cash-flow mensuel négatif dégrade le score par rapport à un cash-flow positif", () => {
    const operation = { ...operationDeBase("investisseur"), prix_achat: 150_000 };
    const investisseurConfortable: OperationInvestisseurDB = {
      id: "inv-1",
      operation_id: "op-1",
      loyer_mensuel: 1200,
      charges_recuperables: 0,
      charges_non_recuperables: 100,
      taxe_fonciere: 500,
      assurance_pno: 100,
      frais_gestion_pct: 0,
      entretien_pct: 0,
      vacance_locative_pct: 0,
      autres_charges: 0,
    };
    const investisseurSerre: OperationInvestisseurDB = { ...investisseurConfortable, loyer_mensuel: 400 };

    const financement: FinancementDB = {
      id: "f1",
      operation_id: "op-1",
      apport: 20_000,
      montant_emprunte: 150_000,
      taux: 0.035,
      duree_mois: 240,
      assurance_taux: 0.003,
      differe_type: "aucun",
      differe_mois: 0,
      frais_bancaires: 0,
    };

    const resultatConfortable = calculerResultatsOperation(
      operation,
      AUCUN_TRAVAUX,
      financement,
      investisseurConfortable,
      []
    );
    const resultatSerre = calculerResultatsOperation(operation, AUCUN_TRAVAUX, financement, investisseurSerre, []);

    expect(resultatConfortable!.investisseur!.cashFlowMensuel).toBeGreaterThan(
      resultatSerre!.investisseur!.cashFlowMensuel
    );
    expect(resultatConfortable!.score.total).toBeGreaterThan(resultatSerre!.score.total);
  });
});

describe("calculerResultatsOperation — mode marchand", () => {
  it("calcule une marge et un ROI cohérents sur plusieurs lots", () => {
    const operation = operationDeBase("marchand");
    const lots: LotMarchandDB[] = [
      { id: "l1", operation_id: "op-1", nom_lot: "Lot 1", type_lot: "T2", prix_revente_prevu: 140_000 },
      { id: "l2", operation_id: "op-1", nom_lot: "Lot 2", type_lot: "T3", prix_revente_prevu: 160_000 },
    ];
    const financement: FinancementDB = {
      id: "f1",
      operation_id: "op-1",
      apport: 50_000,
      montant_emprunte: 180_000,
      taux: 0.04,
      duree_mois: 24,
      assurance_taux: 0,
      differe_type: "total",
      differe_mois: 18,
      frais_bancaires: 1000,
    };
    const travaux: LigneTravauxDB[] = [
      { id: "t1", operation_id: "op-1", categorie: "interieur", sous_categorie: "Rénovation", montant: 30_000 },
    ];

    const resultats = calculerResultatsOperation(operation, travaux, financement, null, lots);

    expect(resultats).not.toBeNull();
    expect(resultats!.marchand).toBeDefined();
    expect(resultats!.investisseur).toBeUndefined();
    expect(resultats!.marchand!.chiffreAffairesTotal).toBe(300_000);
    // marge = CA - (acquisition + travaux(+imprévus) + coût crédit + frais revente)
    expect(resultats!.marchand!.coutTotalOperation).toBeGreaterThan(
      operation.prix_achat + 30_000 + operation.frais_revente
    );
    expect(resultats!.score.total).toBeGreaterThanOrEqual(0);
    expect(resultats!.score.total).toBeLessThanOrEqual(100);
  });

  it("ne plante pas avec un seul lot dont le prix de revente est positif", () => {
    const operation = operationDeBase("marchand");
    const lots: LotMarchandDB[] = [
      { id: "l1", operation_id: "op-1", nom_lot: "Lot unique", type_lot: null, prix_revente_prevu: 250_000 },
    ];
    expect(() => calculerResultatsOperation(operation, [], null, null, lots)).not.toThrow();
  });
});
