import { notFound } from "next/navigation";
import Link from "next/link";
import { verifierSession } from "@/lib/auth/dal";
import { obtenirOperation } from "@/lib/db/operations";
import { createClient } from "@/lib/db/supabase/server";

export default async function OperationPage({ params }: { params: Promise<{ id: string }> }) {
  await verifierSession();
  const { id } = await params;
  const supabase = await createClient();
  const operation = await obtenirOperation(supabase, id);

  if (!operation) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-16">
      <Link href="/dashboard" className="text-sm underline">
        ← Retour au tableau de bord
      </Link>
      <h1 className="text-2xl font-semibold">{operation.nom}</h1>
      <p className="text-sm text-zinc-500">
        Mode {operation.mode} · {operation.statut}
      </p>
      <p className="max-w-md text-sm text-zinc-500">
        Le formulaire détaillé (informations du bien, acquisition, travaux, financement...)
        arrive dans une prochaine étape.
      </p>
    </div>
  );
}
