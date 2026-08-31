import Link from "next/link";
import { verifierSession } from "@/lib/auth/dal";
import { deconnexion } from "@/lib/auth/actions";
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

export default async function DashboardPage() {
  const { user } = await verifierSession();
  const supabase = await createClient();
  const operations = await listerOperations(supabase);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tableau de bord</h1>
          <p className="text-sm text-zinc-500">{user.email}</p>
        </div>
        <form action={deconnexion}>
          <button
            type="submit"
            className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
          >
            Se déconnecter
          </button>
        </form>
      </div>

      <div className="flex gap-3">
        <form action={creerNouvelleOperation}>
          <input type="hidden" name="mode" value="investisseur" />
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            + Nouvelle opération (investisseur)
          </button>
        </form>
        <form action={creerNouvelleOperation}>
          <input type="hidden" name="mode" value="marchand" />
          <button
            type="submit"
            className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
          >
            + Nouvelle opération (marchand de biens)
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-3">
        {operations.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Aucune opération pour l&apos;instant — crée la première ci-dessus.
          </p>
        ) : (
          operations.map((operation) => (
            <Link
              key={operation.id}
              href={`/operations/${operation.id}`}
              className="flex items-center justify-between rounded border border-zinc-200 px-4 py-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <div>
                <p className="font-medium">{operation.nom}</p>
                <p className="text-sm text-zinc-500">
                  {LIBELLE_MODE[operation.mode] ?? operation.mode}
                  {operation.prix_achat > 0 &&
                    ` · ${operation.prix_achat.toLocaleString("fr-FR")} €`}
                </p>
              </div>
              <span className="text-sm text-zinc-500">
                {LIBELLE_STATUT[operation.statut] ?? operation.statut}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
