import { NextResponse, type NextRequest } from "next/server";
import { rafraichirSessionSupabase } from "@/lib/db/supabase/proxy";

// Routes publiques : accessibles sans être connecté. Tout le reste sous /dashboard
// et /operations exige une session valide (vérification "optimiste" ici — chaque
// Server Action / Server Component revérifie la session, cf. doc Next.js
// "Authorization" : le proxy ne doit jamais être la seule ligne de défense).
const ROUTES_PUBLIQUES = ["/login", "/signup", "/reset-password", "/auth"];

// Sous-ensemble des routes publiques où un utilisateur déjà connecté ne doit PAS
// être renvoyé vers /dashboard : /reset-password/confirmer exige justement une
// session (celle créée par le lien de récupération) pour poser le nouveau mot de
// passe, et /auth/callback doit pouvoir terminer sa redirection en interne.
const ROUTES_PUBLIQUES_SANS_REDIRECTION = ["/reset-password/confirmer", "/auth"];

export async function proxy(request: NextRequest) {
  const { reponse, user } = await rafraichirSessionSupabase(request);
  const { pathname } = request.nextUrl;

  const estRoutePublique = ROUTES_PUBLIQUES.some((route) => pathname.startsWith(route));
  const estRouteSansRedirection = ROUTES_PUBLIQUES_SANS_REDIRECTION.some((route) =>
    pathname.startsWith(route)
  );

  if (!user && !estRoutePublique && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && estRoutePublique && !estRouteSansRedirection) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return reponse;
}

export const config = {
  matcher: [
    // Exclut les fichiers statiques, les images optimisées et les assets —
    // sinon le proxy peut bloquer le chargement du CSS/JS (cf. doc Next.js proxy.md).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
