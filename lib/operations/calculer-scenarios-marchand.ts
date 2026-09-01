/**
 * Scénarios pessimiste / réaliste / optimiste — mode marchand de biens uniquement pour
 * l'instant (le mode investisseur utilise déjà une approximation simple pour la
 * sensibilité du score, voir lib/operations/calculer-resultats.ts ; une vraie page dédiée
 * pour ce mode reste à faire, cf. README).
 *
 * Compose lib/calc-engine/scenarios.ts (deltas par défaut, déjà testé) avec le reste du
 * moteur de calcul, même principe que calculer-resultats.ts et calculer-prix-max.ts :
 * aucun calcul financier ici, uniquement de l'assemblage.
 *
 * Ce qui varie selon le scénario : le total travaux (delta %), le prix de revente de
 * chaque lot (delta %), et la durée du crédit (delta en mois — un chantier qui dérape
 * coûte aussi plus cher en intérêts). Le prix d'achat et les frais d'acquisition restent
 * fixes : contrairement au prix d'achat maximum, on ne renégocie pas l'achat, on mesure
 * la sensibilité du même projet à des aléas de réalisation.
 */
import { calculerAcquisition, type TypeBien } from "../calc-engine/acquisition";
import { calculerTravaux } from "../calc-engine/travaux";
import { calculerFinancement } from "../calc-engine/financement";
import { calculerMarchand, type DetailMarchand, type EntreesLocationMarchand } from "../calc-engine/marchand";
import { appliquerDeltaPct, appliquerDeltaDureeMois, DELTAS_DEFAUT, type DeltasScenario } from "../calc-engine/scenarios";
import type { Operation } from "../db/operations";
import type { LigneTravauxDB } from "../db/travaux-lignes";
import type { FinancementDB } from "../db/financement";
import type { LotMarchandDB } from "../db/operation-marchand-lots";
import type { OperationMarchandLocationDB } from "../db/operation-marchand-location";

export type TypeScenarioMarchand = "pessimiste" | "réaliste" | "optimiste";

export interface ResultatScenarioMarchand {
  type: TypeScenarioMarchand;
  totalTravaux: number;
  detail: DetailMarchand;
}

export function calculerScenariosMarchand(
  operation: Operation,
  travaux: LigneTravauxDB[],
  financement: FinancementDB | null,
  lots: LotMarchandDB[],
  /**
   * Location du bien avant la revente (cf. lib/calc-engine/marchand.ts) — identique dans
   * les 3 scénarios (pas de delta appliqué dessus, pas plus que le prix d'achat ou les
   * frais d'acquisition, cf. commentaire en tête de fichier).
   */
  locationMarchand?: OperationMarchandLocationDB | null
): ResultatScenarioMarchand[] | null {
  if (operation.prix_achat <= 0) return null;
  if (!lots.some((l) => l.prix_revente_prevu > 0)) return null;

  const location: EntreesLocationMarchand | undefined = locationMarchand
    ? {
        dureeLocationMois: locationMarchand.duree_location_mois,
        entreesLocatives: {
          loyerMensuel: locationMarchand.loyer_mensuel,
          chargesNonRecuperablesAnnuelles: locationMarchand.charges_non_recuperables,
          taxeFonciereAnnuelle: locationMarchand.taxe_fonciere,
          assurancePnoAnnuelle: locationMarchand.assurance_pno,
          fraisGestionPct: locationMarchand.frais_gestion_pct,
          entretienPct: locationMarchand.entretien_pct,
          vacanceLocativePct: locationMarchand.vacance_locative_pct,
          autresChargesAnnuelles: locationMarchand.autres_charges,
        },
      }
    : undefined;

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

  const totalTravauxBase = calculerTravaux(
    travaux.map((l) => ({ categorie: l.categorie, sousCategorie: l.sous_categorie ?? "", montant: l.montant }))
  ).totalTravauxAvecImprevus;

  const apport = financement?.apport ?? 0;
  const montantEmprunte = financement?.montant_emprunte ?? 0;
  const dureeMoisBase = financement?.duree_mois || 1;

  function calculerPourDeltas(deltas: DeltasScenario | null): { totalTravaux: number; detail: DetailMarchand } {
    const totalTravaux = deltas ? appliquerDeltaPct(totalTravauxBase, deltas.travauxDeltaPct) : totalTravauxBase;
    const lotsAjustes = lots.map((l) => ({
      nomLot: l.nom_lot,
      typeLot: l.type_lot ?? undefined,
      prixReventePrevu: deltas ? appliquerDeltaPct(l.prix_revente_prevu, deltas.reventeDeltaPct) : l.prix_revente_prevu,
    }));

    const dureeMoisAjustee = deltas
      ? appliquerDeltaDureeMois(dureeMoisBase, deltas.dureeDeltaMois)
      : dureeMoisBase;
    // Le différé ne peut jamais durer aussi longtemps que le prêt lui-même (contrainte du
    // moteur de calcul) : on le raccourcit si besoin quand la durée du scénario diminue.
    const differeMoisAjuste = financement
      ? Math.min(financement.differe_mois, Math.max(0, dureeMoisAjustee - 1))
      : 0;

    const detailFinancement =
      montantEmprunte > 0 && financement
        ? calculerFinancement({
            montantEmprunte,
            tauxAnnuel: financement.taux,
            dureeMois: dureeMoisAjustee,
            tauxAssuranceAnnuel: financement.assurance_taux,
            fraisBancaires: financement.frais_bancaires,
            differeType: financement.differe_type,
            differeMois: differeMoisAjuste,
          })
        : null;

    const coutTotalCredit = detailFinancement?.coutTotalCredit ?? 0;
    const montantTotalInvesti = apport + coutTotalCredit;

    const detail = calculerMarchand(
      { lots: lotsAjustes, fraisRevente: operation.frais_revente, location },
      acquisition.coutTotalAcquisition,
      totalTravaux,
      coutTotalCredit,
      montantTotalInvesti
    );

    return { totalTravaux, detail };
  }

  return (["pessimiste", "réaliste", "optimiste"] as const).map((type) => {
    const deltas = type === "réaliste" ? null : DELTAS_DEFAUT[type];
    const { totalTravaux, detail } = calculerPourDeltas(deltas);
    return { type, totalTravaux, detail };
  });
}
