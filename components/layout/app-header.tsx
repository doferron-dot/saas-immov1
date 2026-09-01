import Link from "next/link";
import { deconnexion } from "@/lib/auth/actions";

/**
 * Barre de navigation commune aux pages authentifiées (dashboard + opérations) — voir
 * app/(app)/layout.tsx. N'existait pas avant (chaque page avait son propre bloc "email +
 * déconnexion" dupliqué) — factorisée ici à l'occasion du passage à une identité visuelle
 * commune ("pro dense mais coloré", demande de Dorian 2026-09-01).
 */
export function AppHeader({ email }: { email: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/85 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/85">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-accent text-xs font-bold text-accent-foreground">
            A
          </span>
          <span className="hidden sm:inline">Analyse Immo</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-zinc-500 sm:inline">{email}</span>
          <form action={deconnexion}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
