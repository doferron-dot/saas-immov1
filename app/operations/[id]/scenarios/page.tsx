import { notFound } from "next/navigation";
import Link from "next/link";
import { verifierSession } from "@/lib/auth/dal";
import { obtenirOperation } from "@/lib/db/operations";
import { listerTravauxLignes } from "@/lib/db/travaux-lignes";
import { obtenirFinancement } from "@/lib/db/financement";
import { listerLotsMarchand } from "@/lib/db/operation-marchand-lots";
import { createClient } from "@/lib/db/supabase/server";
import {
  calculerScenariosMarchand,
  type ResultatScenarioMarchand,
  type TypeScenarioMarchand,
} from "@/lib/operations/calculer-scenarios-marchand";

function formaterEuro(valeur: number): string {
  return valeur.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}
function formaterPct(valeur: number): string {
  return `${(valeur * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

const LIBELLE_SCENARIO: Record<TypeScenarioMarchand, string> = {
  pessimiste: "Pessimiste",
  "réaliste": "Réaliste",
  optimiste: "Optimiste",
};

export default async function ScenariosPage({ params }: { params: Promise<{ id: string }> }) {
  await verifierSession();
  const { id } = await params;
  const supabase = await createClient();
  const operation = await obtenirOperation(supabase, id);

  if (!operation) {
    notFound();
  }

  const retour = (
    <Link href={`/operations/${id}`} className="text-sm underline">
      ← Retour à l&apos;opération
    </Link>
  );

  if (operation.mode !== "marchand") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16">
        {retour}
        <h1 className="text-2xl font-semibold">Scénarios</h1>
        <p className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Cette page n&apos;est disponible que pour le mode marchand de biens pour l&apos;instant (le
          mode investisseur locatif n&apos;a pas de « revente » à faire varier de la même façon —
          la projection pluriannuelle sur la page de l&apos;opération couvre déjà une partie de ce
          besoin pour ce mode).
        </p>
      </div>
    );
  }

  const [travaux, financement, lots] = await Promise.all([
    listerTravauxLignes(supabase, id),
    obtenirFinancement(supabase, id),
    listerLotsMarchand(supabase, id),
  ]);

  let scenarios: ResultatScenarioMarchand[] | null;
  try {
    scenarios = calculerScenariosMarchand(operation, travaux, financement, lots);
  } catch {
    scenarios = null;
  }

  if (!scenarios) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16">
        {retour}
        <h1 className="text-2xl font-semibold">Scénarios</h1>
        <p className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Renseigne d&apos;abord le prix d&apos;achat et au moins un lot avec son prix de revente sur
          la page précédente.
        </p>
      </div>
    );
  }

  const lignes: { libelle: string; valeurs: (s: ResultatScenarioMarchand) => string }[] = [
    { libelle: "Chiffre d'affaires total", valeurs: (s) => formaterEuro(s.detail.chiffreAffairesTotal) },
    { libelle: "Total travaux", valeurs: (s) => formaterEuro(s.totalTravaux) },
    { libelle: "Coût total de l'opération", valeurs: (s) => formaterEuro(s.detail.coutTotalOperation) },
    { libelle: "Marge", valeurs: (s) => formaterEuro(s.detail.marge) },
    { libelle: "Marge %", valeurs: (s) => formaterPct(s.detail.margePct) },
    { libelle: "ROI", valeurs: (s) => formaterPct(s.detail.roi) },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-16">
      {retour}
      <div>
        <h1 className="text-2xl font-semibold">Scénarios</h1>
        <p className="text-sm text-zinc-500">{operation.nom}</p>
      </div>

      <p className="text-xs text-zinc-500">
        Pessimiste : travaux +15 %, revente −10 %, durée du chantier +6 mois (plus d&apos;intérêts).
        Optimiste : travaux −5 %, revente +5 %, durée −3 mois. Deltas par défaut, pas encore
        modifiables depuis l&apos;interface. Le prix d&apos;achat et les frais d&apos;acquisition
        restent constants dans les 3 scénarios.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-2 pr-4 text-left font-medium text-zinc-500">Indicateur</th>
              {scenarios.map((s) => (
                <th key={s.type} className="py-2 px-4 text-right font-medium">
                  {LIBELLE_SCENARIO[s.type]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne) => (
              <tr key={ligne.libelle} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-4 text-zinc-500">{ligne.libelle}</td>
                {scenarios.map((s) => (
                  <td key={s.type} className="py-2 px-4 text-right font-medium">
                    {ligne.valeurs(s)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
