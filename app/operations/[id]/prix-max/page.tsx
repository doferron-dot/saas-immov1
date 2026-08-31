import { notFound } from "next/navigation";
import Link from "next/link";
import { verifierSession } from "@/lib/auth/dal";
import { obtenirOperation } from "@/lib/db/operations";
import { listerTravauxLignes } from "@/lib/db/travaux-lignes";
import { obtenirFinancement } from "@/lib/db/financement";
import { obtenirOperationInvestisseur } from "@/lib/db/operation-investisseur";
import { listerLotsMarchand } from "@/lib/db/operation-marchand-lots";
import { createClient } from "@/lib/db/supabase/server";
import { calculerResultatsOperation } from "@/lib/operations/calculer-resultats";
import {
  calculerPrixMaxInvestisseur,
  calculerPrixMaxMarchand,
  type ObjectifInvestisseur,
  type ObjectifMarchand,
} from "@/lib/operations/calculer-prix-max";
import { expliquerResultatPrixMax } from "@/lib/calc-engine/prix-max";

const CHAMP = "rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

const LIBELLE_OBJECTIF_INVESTISSEUR: Record<ObjectifInvestisseur, string> = {
  rendementNet: "Rendement net minimum",
  cashFlowMensuel: "Cash-flow mensuel minimum",
};
const LIBELLE_OBJECTIF_MARCHAND: Record<ObjectifMarchand, string> = {
  margePct: "Marge % minimum",
  roi: "ROI minimum",
};

function formaterEuro(valeur: number): string {
  return valeur.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export default async function PrixMaxPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ objectif?: string; valeur?: string }>;
}) {
  await verifierSession();
  const { id } = await params;
  const { objectif: objectifParam, valeur: valeurParam } = await searchParams;
  const supabase = await createClient();
  const operation = await obtenirOperation(supabase, id);

  if (!operation) {
    notFound();
  }

  const [travaux, financement, investisseur, lots] = await Promise.all([
    listerTravauxLignes(supabase, id),
    obtenirFinancement(supabase, id),
    operation.mode === "investisseur" ? obtenirOperationInvestisseur(supabase, id) : Promise.resolve(null),
    operation.mode === "marchand" ? listerLotsMarchand(supabase, id) : Promise.resolve([]),
  ]);

  let resultats;
  try {
    resultats = calculerResultatsOperation(operation, travaux, financement, investisseur, lots);
  } catch {
    resultats = null;
  }

  const retour = (
    <Link href={`/operations/${id}`} className="text-sm underline">
      ← Retour à l&apos;opération
    </Link>
  );

  if (!resultats) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16">
        {retour}
        <h1 className="text-2xl font-semibold">Prix d&apos;achat maximum</h1>
        <p className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Renseigne d&apos;abord les données de l&apos;opération (prix d&apos;achat, et loyer ou lots)
          sur la page précédente pour utiliser ce calculateur.
        </p>
      </div>
    );
  }

  const estInvestisseur = operation.mode === "investisseur";
  const objectifsDisponibles: string[] = estInvestisseur
    ? Object.keys(LIBELLE_OBJECTIF_INVESTISSEUR)
    : Object.keys(LIBELLE_OBJECTIF_MARCHAND);
  const objectif = objectifsDisponibles.includes(objectifParam ?? "") ? objectifParam! : objectifsDisponibles[0];
  const estObjectifEnPourcentage = objectif !== "cashFlowMensuel";

  let resultatSolveur = null;
  let explication = "";
  if (valeurParam) {
    const valeurSaisie = Number(valeurParam);
    if (Number.isFinite(valeurSaisie)) {
      const valeurObjectif = estObjectifEnPourcentage ? valeurSaisie / 100 : valeurSaisie;
      const nomIndicateur = estInvestisseur
        ? LIBELLE_OBJECTIF_INVESTISSEUR[objectif as ObjectifInvestisseur]
        : LIBELLE_OBJECTIF_MARCHAND[objectif as ObjectifMarchand];
      const formatterValeur = (v: number) => (estObjectifEnPourcentage ? `${(v * 100).toFixed(1)} %` : formaterEuro(v));

      try {
        resultatSolveur =
          estInvestisseur && investisseur
            ? calculerPrixMaxInvestisseur({
                operation,
                totalTravaux: resultats.totalTravaux,
                financement,
                investisseur,
                objectif: objectif as ObjectifInvestisseur,
                valeurObjectif,
              })
            : !estInvestisseur
              ? calculerPrixMaxMarchand({
                  operation,
                  totalTravaux: resultats.totalTravaux,
                  financement,
                  lots,
                  objectif: objectif as ObjectifMarchand,
                  valeurObjectif,
                })
              : null;
        if (resultatSolveur) {
          explication = expliquerResultatPrixMax(resultatSolveur, nomIndicateur, valeurObjectif, formatterValeur);
        }
      } catch (err) {
        explication = err instanceof Error ? err.message : "Erreur de calcul.";
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16">
      {retour}
      <div>
        <h1 className="text-2xl font-semibold">Prix d&apos;achat maximum</h1>
        <p className="text-sm text-zinc-500">{operation.nom}</p>
      </div>

      <p className="text-xs text-zinc-500">
        À apport, taux, durée d&apos;emprunt, travaux{estInvestisseur ? ", loyer et charges" : " et prix de revente des lots"}{" "}
        constants, quel est le prix d&apos;achat le plus élevé qui respecte encore ton objectif ? Le crédit
        s&apos;ajuste avec le prix testé (apport fixe), le reste ne bouge pas.
      </p>

      <form method="GET" className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="objectif" className="text-sm font-medium">
            Objectif
          </label>
          <select id="objectif" name="objectif" defaultValue={objectif} className={CHAMP}>
            {estInvestisseur
              ? Object.entries(LIBELLE_OBJECTIF_INVESTISSEUR).map(([valeur, libelle]) => (
                  <option key={valeur} value={valeur}>
                    {libelle}
                  </option>
                ))
              : Object.entries(LIBELLE_OBJECTIF_MARCHAND).map(([valeur, libelle]) => (
                  <option key={valeur} value={valeur}>
                    {libelle}
                  </option>
                ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="valeur" className="text-sm font-medium">
            Valeur cible (% ou €)
          </label>
          <input
            id="valeur"
            name="valeur"
            type="number"
            step="0.1"
            defaultValue={valeurParam ?? ""}
            placeholder={estObjectifEnPourcentage ? "ex: 5" : "ex: 100"}
            className={CHAMP}
            required
          />
        </div>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-6 py-2 font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          Calculer
        </button>
      </form>

      {resultatSolveur && (
        <div className="flex flex-col gap-3 rounded border border-zinc-200 p-5 dark:border-zinc-800">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-zinc-500">Prix d&apos;achat maximum</span>
            <span className="text-2xl font-bold">{formaterEuro(resultatSolveur.prixMaximum)}</span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{explication}</p>
          {!resultatSolveur.convergé && (
            <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Le résultat ci-dessus est une borne de l&apos;intervalle testé (0 € à 10 000 000 €), pas une
              vraie convergence — relis l&apos;explication ci-dessus.
            </p>
          )}
        </div>
      )}
      {!resultatSolveur && explication && (
        <p className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {explication}
        </p>
      )}
    </div>
  );
}
