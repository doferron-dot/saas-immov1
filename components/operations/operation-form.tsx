"use client";

import { useState } from "react";
import type { Operation } from "@/lib/db/operations";
import type { LigneTravauxDB, CategorieTravaux } from "@/lib/db/travaux-lignes";
import type { FinancementDB } from "@/lib/db/financement";
import type { OperationInvestisseurDB } from "@/lib/db/operation-investisseur";
import type { LotMarchandDB } from "@/lib/db/operation-marchand-lots";

const CHAMP =
  "rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";
const LABEL = "text-sm font-medium";
const GROUPE = "flex flex-col gap-1";

const LIBELLE_CATEGORIE_TRAVAUX: Record<CategorieTravaux, string> = {
  gros_oeuvre: "Gros œuvre",
  technique: "Technique (élec, plomberie, chauffage)",
  interieur: "Intérieur (second œuvre)",
  autre: "Autre",
};

interface LigneTravauxUI {
  categorie: CategorieTravaux;
  sousCategorie: string;
  montant: number;
}

interface LotUI {
  nomLot: string;
  typeLot: string;
  prixReventePrevu: number;
}

/** fraction (0.055) -> valeur lisible pour un champ pourcentage (5.5) */
function versPct(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined) return "";
  return String(Math.round(fraction * 10000) / 100);
}

function versValeur(valeur: number | null | undefined): string {
  return valeur === null || valeur === undefined ? "" : String(valeur);
}

export function OperationForm({
  operation,
  travaux,
  financement,
  investisseur,
  lots,
  action,
}: {
  operation: Operation;
  travaux: LigneTravauxDB[];
  financement: FinancementDB | null;
  investisseur: OperationInvestisseurDB | null;
  lots: LotMarchandDB[];
  action: (formData: FormData) => void;
}) {
  const [lignesTravaux, setLignesTravaux] = useState<LigneTravauxUI[]>(
    travaux.length > 0
      ? travaux.map((l) => ({
          categorie: l.categorie,
          sousCategorie: l.sous_categorie ?? "",
          montant: l.montant,
        }))
      : [{ categorie: "gros_oeuvre", sousCategorie: "", montant: 0 }]
  );

  const [lignesLots, setLignesLots] = useState<LotUI[]>(
    lots.length > 0
      ? lots.map((l) => ({
          nomLot: l.nom_lot,
          typeLot: l.type_lot ?? "",
          prixReventePrevu: l.prix_revente_prevu,
        }))
      : [{ nomLot: "Lot 1", typeLot: "", prixReventePrevu: 0 }]
  );

  function ajouterLigneTravaux() {
    setLignesTravaux((l) => [...l, { categorie: "gros_oeuvre", sousCategorie: "", montant: 0 }]);
  }
  function retirerLigneTravaux(index: number) {
    setLignesTravaux((l) => l.filter((_, i) => i !== index));
  }
  function majLigneTravaux(index: number, changement: Partial<LigneTravauxUI>) {
    setLignesTravaux((l) => l.map((ligne, i) => (i === index ? { ...ligne, ...changement } : ligne)));
  }

  function ajouterLot() {
    setLignesLots((l) => [...l, { nomLot: `Lot ${l.length + 1}`, typeLot: "", prixReventePrevu: 0 }]);
  }
  function retirerLot(index: number) {
    setLignesLots((l) => l.filter((_, i) => i !== index));
  }
  function majLot(index: number, changement: Partial<LotUI>) {
    setLignesLots((l) => l.map((lot, i) => (i === index ? { ...lot, ...changement } : lot)));
  }

  return (
    <form action={action} className="flex flex-col gap-10">
      <input type="hidden" name="travauxJSON" value={JSON.stringify(lignesTravaux)} />
      {operation.mode === "marchand" && (
        <input type="hidden" name="lotsJSON" value={JSON.stringify(lignesLots)} />
      )}

      <div className={GROUPE}>
        <label htmlFor="nom" className={LABEL}>
          Nom de l&apos;opération
        </label>
        <input
          id="nom"
          name="nom"
          defaultValue={operation.nom}
          className={CHAMP}
          required
        />
      </div>

      {/* Informations du bien */}
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold">Informations du bien</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={GROUPE}>
            <label htmlFor="adresse" className={LABEL}>Adresse</label>
            <input id="adresse" name="adresse" defaultValue={operation.adresse ?? ""} className={CHAMP} />
          </div>
          <div className={GROUPE}>
            <label htmlFor="ville" className={LABEL}>Ville</label>
            <input id="ville" name="ville" defaultValue={operation.ville ?? ""} className={CHAMP} />
          </div>
          <div className={GROUPE}>
            <label htmlFor="code_postal" className={LABEL}>Code postal</label>
            <input id="code_postal" name="code_postal" defaultValue={operation.code_postal ?? ""} className={CHAMP} />
          </div>
          <div className={GROUPE}>
            <label htmlFor="type_bien" className={LABEL}>Type de bien</label>
            <input
              id="type_bien"
              name="type_bien"
              placeholder="Appartement, maison..."
              defaultValue={operation.type_bien ?? ""}
              className={CHAMP}
            />
          </div>
          <div className={GROUPE}>
            <label htmlFor="ancien_ou_neuf" className={LABEL}>Ancien / neuf</label>
            <select
              id="ancien_ou_neuf"
              name="ancien_ou_neuf"
              defaultValue={operation.ancien_ou_neuf ?? "ancien"}
              className={CHAMP}
            >
              <option value="ancien">Ancien</option>
              <option value="neuf">Neuf</option>
            </select>
            <p className="text-xs text-zinc-500">
              Détermine les frais de notaire par défaut (modifiables ci-dessous).
            </p>
          </div>
          <div className={GROUPE}>
            <label htmlFor="dpe" className={LABEL}>DPE</label>
            <select id="dpe" name="dpe" defaultValue={operation.dpe ?? ""} className={CHAMP}>
              <option value="">Non renseigné</option>
              {["A", "B", "C", "D", "E", "F", "G"].map((lettre) => (
                <option key={lettre} value={lettre}>{lettre}</option>
              ))}
            </select>
          </div>
          <div className={GROUPE}>
            <label htmlFor="surface" className={LABEL}>Surface (m²)</label>
            <input id="surface" name="surface" type="number" step="0.01" min="0" defaultValue={versValeur(operation.surface)} className={CHAMP} />
          </div>
          <div className={GROUPE}>
            <label htmlFor="pieces" className={LABEL}>Pièces</label>
            <input id="pieces" name="pieces" type="number" min="0" defaultValue={versValeur(operation.pieces)} className={CHAMP} />
          </div>
          <div className={GROUPE}>
            <label htmlFor="chambres" className={LABEL}>Chambres</label>
            <input id="chambres" name="chambres" type="number" min="0" defaultValue={versValeur(operation.chambres)} className={CHAMP} />
          </div>
          <div className={GROUPE}>
            <label htmlFor="etage" className={LABEL}>Étage</label>
            <input id="etage" name="etage" type="number" defaultValue={versValeur(operation.etage)} className={CHAMP} />
          </div>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="ascenseur" defaultChecked={operation.ascenseur ?? false} />
            Ascenseur
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="parking" defaultChecked={operation.parking ?? false} />
            Parking
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="cave" defaultChecked={operation.cave ?? false} />
            Cave
          </label>
        </div>
      </fieldset>

      {/* Acquisition */}
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold">Acquisition</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={GROUPE}>
            <label htmlFor="prix_achat" className={LABEL}>Prix d&apos;achat (€)</label>
            <input id="prix_achat" name="prix_achat" type="number" min="0" step="0.01" defaultValue={operation.prix_achat} className={CHAMP} required />
          </div>
          <div className={GROUPE}>
            <label htmlFor="frais_agence" className={LABEL}>Frais d&apos;agence (€)</label>
            <input id="frais_agence" name="frais_agence" type="number" min="0" step="0.01" defaultValue={operation.frais_agence} className={CHAMP} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="frais_agence_inclus" defaultChecked={operation.frais_agence_inclus} />
            Les frais d&apos;agence sont déjà inclus dans le prix d&apos;achat ci-dessus
          </label>
          <div className={GROUPE}>
            <label htmlFor="frais_dossier" className={LABEL}>Frais de dossier (€)</label>
            <input id="frais_dossier" name="frais_dossier" type="number" min="0" step="0.01" defaultValue={operation.frais_dossier} className={CHAMP} />
          </div>
          <div className={GROUPE}>
            <label htmlFor="frais_garantie" className={LABEL}>Frais de garantie (€)</label>
            <input id="frais_garantie" name="frais_garantie" type="number" min="0" step="0.01" defaultValue={operation.frais_garantie} className={CHAMP} />
          </div>
          <div className={GROUPE}>
            <label htmlFor="autres_frais_acquisition" className={LABEL}>Autres frais d&apos;acquisition (€)</label>
            <input id="autres_frais_acquisition" name="autres_frais_acquisition" type="number" min="0" step="0.01" defaultValue={operation.autres_frais_acquisition} className={CHAMP} />
          </div>
          {operation.mode === "marchand" && (
            <div className={GROUPE}>
              <label htmlFor="frais_revente" className={LABEL}>Frais de revente prévus (€)</label>
              <input id="frais_revente" name="frais_revente" type="number" min="0" step="0.01" defaultValue={operation.frais_revente} className={CHAMP} />
              <p className="text-xs text-zinc-500">Commission d&apos;agence, diagnostics... au moment de la revente.</p>
            </div>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          Les frais de notaire (DMTO + émoluments) sont calculés automatiquement à partir du prix
          d&apos;achat et du type de bien (barème 2026, hypothèse par défaut).
        </p>
      </fieldset>

      {/* Travaux */}
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold">Travaux</legend>
        <div className="flex flex-col gap-3">
          {lignesTravaux.map((ligne, index) => (
            <div key={index} className="flex flex-col gap-2 rounded border border-zinc-200 p-3 dark:border-zinc-800 sm:flex-row sm:items-end">
              <div className={`${GROUPE} sm:w-56`}>
                <label className={LABEL}>Catégorie</label>
                <select
                  className={CHAMP}
                  value={ligne.categorie}
                  onChange={(e) => majLigneTravaux(index, { categorie: e.target.value as CategorieTravaux })}
                >
                  {Object.entries(LIBELLE_CATEGORIE_TRAVAUX).map(([valeur, libelle]) => (
                    <option key={valeur} value={valeur}>{libelle}</option>
                  ))}
                </select>
              </div>
              <div className={`${GROUPE} flex-1`}>
                <label className={LABEL}>Description</label>
                <input
                  className={CHAMP}
                  placeholder="Ex: peinture, cuisine, toiture..."
                  value={ligne.sousCategorie}
                  onChange={(e) => majLigneTravaux(index, { sousCategorie: e.target.value })}
                />
              </div>
              <div className={`${GROUPE} sm:w-40`}>
                <label className={LABEL}>Montant (€)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={CHAMP}
                  value={ligne.montant}
                  onChange={(e) => majLigneTravaux(index, { montant: Number(e.target.value) })}
                />
              </div>
              <button
                type="button"
                onClick={() => retirerLigneTravaux(index)}
                className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={ajouterLigneTravaux}
          className="w-fit rounded border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
        >
          + Ajouter une ligne de travaux
        </button>
        <p className="text-xs text-zinc-500">
          Une marge pour imprévus de 10 % est ajoutée automatiquement au total (modifiable dans une
          prochaine étape).
        </p>
      </fieldset>

      {/* Financement */}
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold">Financement</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={GROUPE}>
            <label htmlFor="apport" className={LABEL}>Apport (€)</label>
            <input id="apport" name="apport" type="number" min="0" step="0.01" defaultValue={financement?.apport ?? 0} className={CHAMP} />
          </div>
          <div className={GROUPE}>
            <label htmlFor="montant_emprunte" className={LABEL}>Montant emprunté (€)</label>
            <input id="montant_emprunte" name="montant_emprunte" type="number" min="0" step="0.01" defaultValue={financement?.montant_emprunte ?? 0} className={CHAMP} />
          </div>
          <div className={GROUPE}>
            <label htmlFor="taux" className={LABEL}>Taux d&apos;intérêt annuel (%)</label>
            <input id="taux" name="taux" type="number" min="0" step="0.01" defaultValue={versPct(financement?.taux)} className={CHAMP} />
          </div>
          <div className={GROUPE}>
            <label htmlFor="duree_mois" className={LABEL}>Durée (mois)</label>
            <input id="duree_mois" name="duree_mois" type="number" min="1" defaultValue={financement?.duree_mois || 240} className={CHAMP} />
          </div>
          <div className={GROUPE}>
            <label htmlFor="assurance_taux" className={LABEL}>Taux d&apos;assurance annuel (%)</label>
            <input id="assurance_taux" name="assurance_taux" type="number" min="0" step="0.001" defaultValue={versPct(financement?.assurance_taux)} className={CHAMP} />
          </div>
          <div className={GROUPE}>
            <label htmlFor="frais_bancaires" className={LABEL}>Frais bancaires (€)</label>
            <input id="frais_bancaires" name="frais_bancaires" type="number" min="0" step="0.01" defaultValue={financement?.frais_bancaires ?? 0} className={CHAMP} />
          </div>
          <div className={GROUPE}>
            <label htmlFor="differe_type" className={LABEL}>Différé</label>
            <select id="differe_type" name="differe_type" defaultValue={financement?.differe_type ?? "aucun"} className={CHAMP}>
              <option value="aucun">Aucun</option>
              <option value="partiel">Partiel (intérêts payés)</option>
              <option value="total">Total (intérêts capitalisés)</option>
            </select>
          </div>
          <div className={GROUPE}>
            <label htmlFor="differe_mois" className={LABEL}>Durée du différé (mois)</label>
            <input id="differe_mois" name="differe_mois" type="number" min="0" defaultValue={financement?.differe_mois ?? 0} className={CHAMP} />
          </div>
        </div>
      </fieldset>

      {/* Spécifique au mode */}
      {operation.mode === "investisseur" ? (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 text-lg font-semibold">Location (mode investisseur)</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={GROUPE}>
              <label htmlFor="loyer_mensuel" className={LABEL}>Loyer mensuel (€, hors charges)</label>
              <input id="loyer_mensuel" name="loyer_mensuel" type="number" min="0" step="0.01" defaultValue={investisseur?.loyer_mensuel ?? 0} className={CHAMP} />
            </div>
            <div className={GROUPE}>
              <label htmlFor="charges_recuperables" className={LABEL}>Charges récupérables mensuelles (€)</label>
              <input id="charges_recuperables" name="charges_recuperables" type="number" min="0" step="0.01" defaultValue={investisseur?.charges_recuperables ?? 0} className={CHAMP} />
            </div>
            <div className={GROUPE}>
              <label htmlFor="charges_non_recuperables" className={LABEL}>Charges non récupérables (€/an)</label>
              <input id="charges_non_recuperables" name="charges_non_recuperables" type="number" min="0" step="0.01" defaultValue={investisseur?.charges_non_recuperables ?? 0} className={CHAMP} />
            </div>
            <div className={GROUPE}>
              <label htmlFor="taxe_fonciere" className={LABEL}>Taxe foncière (€/an)</label>
              <input id="taxe_fonciere" name="taxe_fonciere" type="number" min="0" step="0.01" defaultValue={investisseur?.taxe_fonciere ?? 0} className={CHAMP} />
            </div>
            <div className={GROUPE}>
              <label htmlFor="assurance_pno" className={LABEL}>Assurance PNO (€/an)</label>
              <input id="assurance_pno" name="assurance_pno" type="number" min="0" step="0.01" defaultValue={investisseur?.assurance_pno ?? 0} className={CHAMP} />
            </div>
            <div className={GROUPE}>
              <label htmlFor="autres_charges" className={LABEL}>Autres charges (€/an)</label>
              <input id="autres_charges" name="autres_charges" type="number" min="0" step="0.01" defaultValue={investisseur?.autres_charges ?? 0} className={CHAMP} />
            </div>
            <div className={GROUPE}>
              <label htmlFor="frais_gestion_pct" className={LABEL}>Frais de gestion locative (% des loyers)</label>
              <input id="frais_gestion_pct" name="frais_gestion_pct" type="number" min="0" step="0.01" defaultValue={versPct(investisseur?.frais_gestion_pct)} className={CHAMP} />
            </div>
            <div className={GROUPE}>
              <label htmlFor="entretien_pct" className={LABEL}>Provision entretien (% des loyers)</label>
              <input id="entretien_pct" name="entretien_pct" type="number" min="0" step="0.01" defaultValue={versPct(investisseur?.entretien_pct)} className={CHAMP} />
            </div>
            <div className={GROUPE}>
              <label htmlFor="vacance_locative_pct" className={LABEL}>Vacance locative (% des loyers)</label>
              <input id="vacance_locative_pct" name="vacance_locative_pct" type="number" min="0" step="0.01" defaultValue={versPct(investisseur?.vacance_locative_pct)} className={CHAMP} />
            </div>
          </div>
        </fieldset>
      ) : (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 text-lg font-semibold">Lots à revendre (mode marchand de biens)</legend>
          <div className="flex flex-col gap-3">
            {lignesLots.map((lot, index) => (
              <div key={index} className="flex flex-col gap-2 rounded border border-zinc-200 p-3 dark:border-zinc-800 sm:flex-row sm:items-end">
                <div className={`${GROUPE} flex-1`}>
                  <label className={LABEL}>Nom du lot</label>
                  <input className={CHAMP} value={lot.nomLot} onChange={(e) => majLot(index, { nomLot: e.target.value })} />
                </div>
                <div className={`${GROUPE} sm:w-48`}>
                  <label className={LABEL}>Type</label>
                  <input className={CHAMP} placeholder="Studio, T2..." value={lot.typeLot} onChange={(e) => majLot(index, { typeLot: e.target.value })} />
                </div>
                <div className={`${GROUPE} sm:w-40`}>
                  <label className={LABEL}>Prix de revente prévu (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={CHAMP}
                    value={lot.prixReventePrevu}
                    onChange={(e) => majLot(index, { prixReventePrevu: Number(e.target.value) })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => retirerLot(index)}
                  className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={ajouterLot}
            className="w-fit rounded border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
          >
            + Ajouter un lot
          </button>
        </fieldset>
      )}

      <button
        type="submit"
        className="w-fit rounded bg-zinc-900 px-6 py-3 font-medium text-white dark:bg-white dark:text-zinc-900"
      >
        Enregistrer
      </button>
    </form>
  );
}
