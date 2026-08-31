"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/db/supabase/server";
import { validerFormulaireAuth, validerEmail, validerMotDePasse } from "./validation";

export interface EtatFormulaireAuth {
  errors?: { email?: string; password?: string };
  message?: string;
}

/**
 * Origine (https://mondomaine.com) déduite de la requête entrante plutôt que d'une
 * variable d'environnement à maintenir à jour — fonctionne automatiquement en local,
 * sur chaque preview Vercel, et en production, sans configuration supplémentaire.
 */
async function origineSite(): Promise<string> {
  const enTetes = await headers();
  const protocole = enTetes.get("x-forwarded-proto") ?? "https";
  const hote = enTetes.get("x-forwarded-host") ?? enTetes.get("host");
  return `${protocole}://${hote}`;
}

export async function inscription(
  _etatPrecedent: EtatFormulaireAuth | undefined,
  formData: FormData
): Promise<EtatFormulaireAuth> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const erreurs = validerFormulaireAuth(email, password);
  if (Object.keys(erreurs).length > 0) {
    return { errors: erreurs };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Doit correspondre à une "Redirect URL" autorisée dans les réglages Supabase Auth.
      emailRedirectTo: `${await origineSite()}/auth/callback`,
    },
  });

  if (error) {
    return { message: traduireErreurSupabase(error.message) };
  }

  return {
    message:
      "Compte créé — vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.",
  };
}

export async function connexion(
  _etatPrecedent: EtatFormulaireAuth | undefined,
  formData: FormData
): Promise<EtatFormulaireAuth> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const erreurs = validerFormulaireAuth(email, password);
  if (Object.keys(erreurs).length > 0) {
    return { errors: erreurs };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { message: traduireErreurSupabase(error.message) };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function deconnexion(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function demanderReinitialisationMotDePasse(
  _etatPrecedent: EtatFormulaireAuth | undefined,
  formData: FormData
): Promise<EtatFormulaireAuth> {
  const email = String(formData.get("email") ?? "");
  const erreurEmail = validerEmail(email);
  if (erreurEmail) {
    return { errors: { email: erreurEmail } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origineSite()}/auth/callback?next=/reset-password/confirmer`,
  });

  if (error) {
    return { message: traduireErreurSupabase(error.message) };
  }

  // Toujours le même message, que l'email existe ou non : ne jamais révéler
  // si une adresse est enregistrée (énumération de comptes).
  return { message: "Si un compte existe avec cette adresse, un email de réinitialisation a été envoyé." };
}

export async function definirNouveauMotDePasse(
  _etatPrecedent: EtatFormulaireAuth | undefined,
  formData: FormData
): Promise<EtatFormulaireAuth> {
  const password = String(formData.get("password") ?? "");
  const erreurPassword = validerMotDePasse(password);
  if (erreurPassword) {
    return { errors: { password: erreurPassword } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { message: traduireErreurSupabase(error.message) };
  }

  redirect("/dashboard");
}

/** Traduit les messages d'erreur Supabase Auth les plus courants en français. */
function traduireErreurSupabase(message: string): string {
  const traductions: Record<string, string> = {
    "Invalid login credentials": "Email ou mot de passe incorrect.",
    "User already registered": "Un compte existe déjà avec cette adresse email.",
    "Email not confirmed": "Adresse email non confirmée — vérifie ta boîte mail.",
  };
  return traductions[message] ?? message;
}
