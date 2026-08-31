import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase pour les Client Components ("use client").
 * Utilise la clé publique (anon) — protégée par les policies RLS côté base de données,
 * jamais par la confidentialité de cette clé.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
