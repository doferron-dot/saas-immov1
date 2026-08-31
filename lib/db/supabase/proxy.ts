import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session Supabase à chaque requête (les tokens expirent et doivent
 * être renouvelés côté serveur) et renvoie l'utilisateur courant (ou null).
 * Appelé depuis proxy.ts (racine du projet) — voir node_modules/next/dist/docs/...
 * /03-file-conventions/proxy.md : "middleware.ts" est déprécié en Next.js 16,
 * remplacé par "proxy.ts" (même mécanique, fichier et export renommés).
 */
export async function rafraichirSessionSupabase(request: NextRequest) {
  let reponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          reponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            reponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Ne PAS remplacer par getSession() : getUser() revalide le token auprès du
  // serveur Supabase Auth à chaque appel (getSession() se contente de lire le
  // cookie, qui peut être falsifié côté client).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { reponse, user };
}
