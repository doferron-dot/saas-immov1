import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/supabase/server";

/**
 * Data Access Layer — vérification de session pour les Server Components /
 * Server Actions. Le proxy (proxy.ts) fait une vérification "optimiste" (cookie
 * présent) pour les redirections de navigation ; cette fonction revérifie
 * réellement auprès de Supabase Auth avant tout accès aux données (cf. doc
 * Next.js "Authorization" : le proxy ne doit jamais être la seule ligne de défense).
 * Mise en cache par rendu React (cache()) pour éviter les appels réseau dupliqués.
 */
export const verifierSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { user };
});
