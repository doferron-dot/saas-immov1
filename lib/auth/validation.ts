/**
 * Validation des formulaires d'authentification. Fonctions pures, aucune dépendance
 * externe — cohérent avec le reste du projet (voir lib/calc-engine) plutôt que
 * d'ajouter une librairie de schéma pour un besoin aussi simple.
 */

export interface ErreursValidation {
  email?: string;
  password?: string;
}

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validerEmail(email: string): string | undefined {
  if (!email || email.trim().length === 0) {
    return "L'adresse email est requise.";
  }
  if (!REGEX_EMAIL.test(email.trim())) {
    return "Adresse email invalide.";
  }
  return undefined;
}

/** Règle V1 : 8 caractères minimum (cohérent avec les recommandations Supabase Auth). */
export function validerMotDePasse(password: string): string | undefined {
  if (!password || password.length === 0) {
    return "Le mot de passe est requis.";
  }
  if (password.length < 8) {
    return "Le mot de passe doit contenir au moins 8 caractères.";
  }
  return undefined;
}

export function validerFormulaireAuth(email: string, password: string): ErreursValidation {
  const erreurs: ErreursValidation = {};
  const erreurEmail = validerEmail(email);
  const erreurPassword = validerMotDePasse(password);
  if (erreurEmail) erreurs.email = erreurEmail;
  if (erreurPassword) erreurs.password = erreurPassword;
  return erreurs;
}
