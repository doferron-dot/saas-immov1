/**
 * Compose les modules du moteur de calcul (lib/calc-engine/, fonctions pures) à partir
 * des lignes stockées en base pour une opération donnée. Aucun calcul financier n'est
 * fait ICI : ce fichier ne fait qu'adapter la forme des données DB vers les types
 * attendus par le moteur de calcul, puis assemble les résultats. Pas de "server-only" :
 * ce module ne touche jamais la base, il est testable comme le reste du moteur de calcul.
 *
 * Périmètre de cette étape : coût d'acquisition, travaux, financement, et le résultat
 * du mode (investisseur : rendement/cash-flow ; marchand : marge/ROI), avec un score, et
 * pour le mode investisseur une projection pluriannuelle (lib/calc-engine/projection.ts).
 * Le "rendement net-net" du score utilise pour l'instant le rendement NET (hors
 * fiscalité) : la fiscalité (lib/calc-engine/fiscalite.ts, déjà codée et testée) n'est
 * pas encore branchée sur le formulaire (TMI, régime fiscal, amortissement — étape
 * suivante).
 *
 * Sensibilité "pessimiste" du score — décidé avec Dorian (2026-08-31) : en l'absence
 * d'une vraie page Scénarios, applique directement les deltas par défaut de
 * lib/calc-engine/scenarios.ts au loyer ET aux charges combinés (pas de "revente" en
 * mode investisseur, contrairement au mode marchand — voir le détail dans la branche
 * investisseur ci-dessous).
 */
// Imports relatifs (pas d'alias "@/") : ce fichier est importé aussi bien par l'app
// Next.js que par Vitest, qui ne résout pas l'alias de chemin TypeScript (voir
// vitest.config.ts — aucun plugin tsconfig-paths installé pour Vite/Vitest).
import { calculerAcquisition, type TypeBien } from "../calc-engine/acquisition";
import { calculerTravaux } from "../calc-engine/travaux";
import { calculerFinancement, type DetailFinancement } from "../calc-engine/financement";
import { calculerInvestisseur, type DetailInvestisseur } from "../calc-engine/investisseur";
import { calculerMarchand, type DetailMarchand } from "../calc-engine/marchand";
import { calculerScoreInvestisseur, calculerScoreMarchand, type ResultatScore } from "../calc-engine/score";
import { appliquerDeltaPct, DELTAS_DEFAUT } from "../calc-engine/scenarios";
import {
  calculerProjection,
  type ProjectionParProfil,
  type ProfilProjection,
  type HypothesesProjection,
} from "../calc-engine/projection";
import type { Operation } from "../db/operations";
import type { LigneTravauxDB } from "../db/travaux-lignes";
import type { FinancementDB } from "../db/financement";
import type { OperationInvestisseurDB } from "../db/operation-investisseur";
import type { LotMarchandDB } from "../db/operation-marchand-lots";

export interface ResultatsOperation {
  coutTotalAcquisition: number;
  totalTravaux: number;
  mensualiteCredit: number;
  coutTotalCredit: number;
  montantTotalInvesti: number;
  score: ResultatScore;
  investisseur?: DetailInvestisseur;
  marchand?: DetailMarchand;
  /** Mode investisseur uniquement — voir lib/calc-engine/projection.ts. */
  projection?: ProjectionParProfil;
}

const FINANCEMENT_NUL: DetailFinancement = {
  mensualiteHorsAssurance: 0,
  mensualiteAssurance: 0,
  mensualiteTotale: 0,
  mensualiteDiffere: 0,
  interetsTotaux: 0,
  assuranceTotale: 0,
  fraisBancaires: 0,
  coutTotalCredit: 0,
  montantTotalDu: 0,
  capitalResiduelFinal: 0,
};

/**
 * Renvoie null tant que les données minimales pour donner un résultat qui a du sens ne
 * sont pas encore saisies (prix d'achat, et loyer / au moins un lot selon le mode) —
 * plutôt que d'afficher des résultats à 0 trompeurs.
 */
export function calculerResultatsOperation(
  operation: Operation,
  travaux: LigneTravauxDB[],
  financement: FinancementDB | null,
  investisseur: OperationInvestisseurDB | null,
  lots: LotMarchandDB[],
  /**
   * Permet de remplacer les hypothèses par défaut de la projection (valorisation,
   * indexation loyer/charges, frais de revente estimés), profil par profil — voir
   * lib/calc-engine/projection.ts. Ignoré en mode marchand (pas de projection).
   */
  hypothesesProjection?: Partial<Record<ProfilProjection, HypothesesProjection>>
): ResultatsOperation | null {
  if (operation.prix_achat <= 0) return null;
  if (operation.mode === "investisseur" && (investisseur?.loyer_mensuel ?? 0) <= 0) return null;
  if (operation.mode === "marchand" && !lots.some((l) => l.prix_revente_prevu > 0)) return null;

  const acquisition = calculerAcquisition({
    prixAchat: operation.prix_achat,
    typeBien: (operation.ancien_ou_neuf ?? "ancien") as TypeBien,
    fraisAgence: operation.frais_agence,
    fraisAgenceInclus: operation.frais_agence_inclus,
    fraisDossier: operation.frais_dossier,
    fraisGarantie: operation.frais_garantie,
    autresFrais: operation.autres_frais_acquisition,
    hypotheses: operation.taux_dmto != null ? { tauxDmto: operation.taux_dmto } : undefined,
  });

  const detailTravaux = calculerTravaux(
    travaux.map((l) => ({
      categorie: l.categorie,
      sousCategorie: l.sous_categorie ?? "",
      montant: l.montant,
    }))
  );

  const montantEmprunte = financement?.montant_emprunte ?? 0;
  const detailFinancement: DetailFinancement =
    montantEmprunte > 0
      ? calculerFinancement({
          montantEmprunte,
          tauxAnnuel: financement?.taux ?? 0,
          dureeMois: financement?.duree_mois || 1,
          tauxAssuranceAnnuel: financement?.assurance_taux ?? 0,
          fraisBancaires: financement?.frais_bancaires ?? 0,
          differeType: financement?.differe_type ?? "aucun",
          differeMois: financement?.differe_mois ?? 0,
        })
      : { ...FINANCEMENT_NUL, fraisBancaires: financement?.frais_bancaires ?? 0 };

  const apport = financement?.apport ?? 0;
  const montantTotalInvesti = apport + detailFinancement.coutTotalCredit;

  const base = {
    coutTotalAcquisition: acquisition.coutTotalAcquisition,
    totalTravaux: detailTravaux.totalTravauxAvecImprevus,
    mensualiteCredit: detailFinancement.mensualiteTotale,
    coutTotalCredit: detailFinancement.coutTotalCredit,
    montantTotalInvesti,
  };

  if (operation.mode === "investisseur") {
    const entrees = {
      loyerMensuel: investisseur?.loyer_mensuel ?? 0,
      chargesNonRecuperablesAnnuelles: investisseur?.charges_non_recuperables ?? 0,
      taxeFonciereAnnuelle: investisseur?.taxe_fonciere ?? 0,
      assurancePnoAnnuelle: investisseur?.assurance_pno ?? 0,
      fraisGestionPct: investisseur?.frais_gestion_pct ?? 0,
      entretienPct: investisseur?.entretien_pct ?? 0,
      vacanceLocativePct: investisseur?.vacance_locative_pct ?? 0,
      autresChargesAnnuelles: investisseur?.autres_charges ?? 0,
    };
    const detail = calculerInvestisseur(entrees, acquisition.coutTotalAcquisition, detailFinancement.mensualiteTotale);

    // Scénario pessimiste du mode investisseur — décidé avec Dorian (2026-08-31) : loyer
    // ET charges bougent ensemble (pas de "revente" en mode locatif, contrairement au
    // mode marchand). Réutilise les mêmes deltas par défaut que lib/calc-engine/scenarios.ts
    // (reventeDeltaPct pour le loyer, travauxDeltaPct pour les charges "dures" — celles qui
    // ne sont pas déjà un % du loyer, qui suivent le loyer automatiquement).
    const loyerPessimiste = appliquerDeltaPct(entrees.loyerMensuel, DELTAS_DEFAUT.pessimiste.reventeDeltaPct);
    const deltaChargesPessimiste = DELTAS_DEFAUT.pessimiste.travauxDeltaPct;
    const detailPessimiste = calculerInvestisseur(
      {
        ...entrees,
        loyerMensuel: loyerPessimiste,
        chargesNonRecuperablesAnnuelles: appliquerDeltaPct(entrees.chargesNonRecuperablesAnnuelles, deltaChargesPessimiste),
        taxeFonciereAnnuelle: appliquerDeltaPct(entrees.taxeFonciereAnnuelle, deltaChargesPessimiste),
        assurancePnoAnnuelle: appliquerDeltaPct(entrees.assurancePnoAnnuelle, deltaChargesPessimiste),
        autresChargesAnnuelles: appliquerDeltaPct(entrees.autresChargesAnnuelles, deltaChargesPessimiste),
      },
      acquisition.coutTotalAcquisition,
      detailFinancement.mensualiteTotale
    );

    const score = calculerScoreInvestisseur({
      rendementNetNet: detail.rendementNet,
      cashFlowMensuel: detail.cashFlowMensuel,
      apport,
      coutTotalAcquisition: acquisition.coutTotalAcquisition,
      mensualiteCredit: detailFinancement.mensualiteTotale,
      loyersAnnuelsEncaisses: detail.loyersAnnuelsEncaisses,
      totalTravaux: detailTravaux.totalTravauxAvecImprevus,
      prixAchat: operation.prix_achat,
      rendementNetNetRealiste: detail.rendementNet,
      rendementNetNetPessimiste: detailPessimiste.rendementNet,
    });

    const projection = calculerProjection({
      valeurBienInitiale: operation.prix_achat,
      loyerMensuelInitial: entrees.loyerMensuel,
      chargesMensuellesInitiales: detail.chargesAnnuelles / 12,
      apportInitial: apport,
      fraisAcquisitionReels: acquisition.coutTotalAcquisition - operation.prix_achat,
      travauxReels: detailTravaux.totalTravauxAvecImprevus,
      financement:
        montantEmprunte > 0
          ? {
              montantEmprunte,
              tauxAnnuel: financement?.taux ?? 0,
              dureeMois: financement?.duree_mois || 1,
              tauxAssuranceAnnuel: financement?.assurance_taux ?? 0,
              fraisBancaires: financement?.frais_bancaires ?? 0,
              differeType: financement?.differe_type ?? "aucun",
              differeMois: financement?.differe_mois ?? 0,
            }
          : undefined,
      hypotheses: hypothesesProjection,
    });

    return { ...base, investisseur: detail, score, projection };
  }

  const lotsCalc = lots.map((l) => ({
    nomLot: l.nom_lot,
    typeLot: l.type_lot ?? undefined,
    prixReventePrevu: l.prix_revente_prevu,
  }));
  const entreesMarchand = { lots: lotsCalc, fraisRevente: operation.frais_revente };
  const detail = calculerMarchand(
    entreesMarchand,
    acquisition.coutTotalAcquisition,
    detailTravaux.totalTravauxAvecImprevus,
    detailFinancement.coutTotalCredit,
    montantTotalInvesti
  );

  const lotsPessimistes = lotsCalc.map((l) => ({
    ...l,
    prixReventePrevu: appliquerDeltaPct(l.prixReventePrevu, DELTAS_DEFAUT.pessimiste.reventeDeltaPct),
  }));
  const travauxPessimistes = appliquerDeltaPct(
    detailTravaux.totalTravauxAvecImprevus,
    DELTAS_DEFAUT.pessimiste.travauxDeltaPct
  );
  const detailPessimiste = calculerMarchand(
    { lots: lotsPessimistes, fraisRevente: entreesMarchand.fraisRevente },
    acquisition.coutTotalAcquisition,
    travauxPessimistes,
    detailFinancement.coutTotalCredit,
    montantTotalInvesti
  );

  const score = calculerScoreMarchand({
    margePct: detail.margePct,
    roi: detail.roi,
    apport,
    coutTotalOperation: detail.coutTotalOperation,
    montantEmprunte,
    totalTravaux: detailTravaux.totalTravauxAvecImprevus,
    prixAchat: operation.prix_achat,
    margePctRealiste: detail.margePct,
    margePctPessimiste: detailPessimiste.margePct,
  });

  return { ...base, marchand: detail, score };
}
