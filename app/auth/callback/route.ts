import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";

/**
 * Point d'entrée des liens envoyés par email (confirmation d'inscription,
 * réinitialisation de mot de passe) — Supabase Auth redirige ici avec un
 * paramètre "code" à échanger contre une session (flow PKCE).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?erreur=lien_invalide`);
}
