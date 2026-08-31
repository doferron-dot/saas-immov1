"use client";

import { useActionState } from "react";
import { definirNouveauMotDePasse, type EtatFormulaireAuth } from "@/lib/auth/actions";

const ETAT_INITIAL: EtatFormulaireAuth = {};

export function DefinirNouveauMotDePasseForm() {
  const [etat, action, enCours] = useActionState(definirNouveauMotDePasse, ETAT_INITIAL);

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          Nouveau mot de passe
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

      {etat?.message && <p className="text-sm text-red-600">{etat.message}</p>}

      <button
        type="submit"
        disabled={enCours}
        className="rounded bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {enCours ? "Enregistrement..." : "Définir le mot de passe"}
      </button>
    </form>
  );
}
