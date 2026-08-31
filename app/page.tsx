import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <h1 className="max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">
        Analyse Immo
      </h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        Analysez vos opérations immobilières — investissement locatif ou marchand de biens —
        avec un moteur de calcul 100&nbsp;% déterministe.
      </p>
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="rounded bg-zinc-900 px-5 py-2.5 font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          Créer un compte
        </Link>
        <Link
          href="/login"
          className="rounded border border-zinc-300 px-5 py-2.5 font-medium dark:border-zinc-700"
        >
          Se connecter
        </Link>
      </div>
    </div>
  );
}
