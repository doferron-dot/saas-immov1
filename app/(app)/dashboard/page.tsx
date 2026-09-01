import Link from "next/link";
import { verifierSession } from "@/lib/auth/dal";
import { creerNouvelleOperation } from "@/lib/operations/actions";
import { listerOperations } from "@/lib/db/operations";
import { createClient } from "@/lib/db/supabase/server";

const LIBELLE_MODE: Record<string, string> = {
  investisseur: "Investisseur locatif",
  marchand: "Marchand de biens",
};

const LIBELLE_STATUT: Record<string, string> = {
  brouillon: "Brouillon",
  actif: "Actif",
  "archivé": "Archivé",
};

// Une teinte par mode — reprise sur la puce de la liste et sur le bouton de création
// correspondant, pour repérer le mode d'un coup d'œil dans une liste dense.
const STYLE_PUCE_MODE: Record<string, string> = {
  investisseur: "bg-accent",
  marchand: "bg-amber-500",
};

export default async function DashboardPage() {
  await verifierSession();
  const supabase = await createClient();
  const operations = await listerOperations(supabase);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Tableau de bord</h1>
        <div className="flex gap-2">
          <form action={creerNouvelleOperation}>
            <input type="hidden" name="mode" value="investisseur" />
            <button
              type="submit"
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              + Investisseur locatif
            </button>
          </form>
          <form action={creerNouvelleOperation}>
            <input type="hidden" name="mode" value="marchand" />
            <button
              type="submit"
              className="rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              + Marchand de biens
            </button>
          </form>
        </div>
      </div>

      {operations.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Aucune opération pour l&apos;instant — crée la première ci-dessus.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          {operations.map((operation, index) => (
            <Link
              key={operation.id}
              href={`/operations/${operation.id}`}
              className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                index > 0 ? "border-t border-zinc-200 dark:border-zinc-800" : ""
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${STYLE_PUCE_MODE[operation.mode] ?? "bg-zinc-400"}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{operation.nom}</p>
                <p className="text-sm text-zinc-500">
                  {LIBELLE_MODE[operation.mode] ?? operation.mode}
                  {operation.prix_achat > 0 &&
                    ` · ${operation.prix_achat.toLocaleString("fr-FR")} €`}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {LIBELLE_STATUT[operation.statut] ?? operation.statut}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
