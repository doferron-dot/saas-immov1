"use client";

import { useActionState } from "react";
import Link from "next/link";
import { inscription, type EtatFormulaireAuth } from "@/lib/auth/actions";

const ETAT_INITIAL: EtatFormulaireAuth = {};

export function SignupForm() {
  const [etat, action, enCours] = useActionState(inscription, ETAT_INITIAL);

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {etat?.errors?.email && <p className="text-sm text-red-600">{etat.errors.email}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <p className="text-xs text-zinc-500">8 caractères minimum.</p>
        {etat?.errors?.password && <p className="text-sm text-red-600">{etat.errors.password}</p>}
      </div>

      {etat?.message && (
        <p
          className={
            etat.message.startsWith("Compte créé")
              ? "text-sm text-green-700 dark:text-green-500"
              : "text-sm text-red-600"
          }
        >
          {etat.message}
        </p>
      )}

      <button
        type="submit"
        disabled={enCours}
        className="rounded bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {enCours ? "Création..." : "Créer mon compte"}
      </button>

      <div className="text-sm">
        <Link href="/login" className="underline">
          Déjà un compte ? Se connecter
        </Link>
      </div>
    </form>
  );
}
