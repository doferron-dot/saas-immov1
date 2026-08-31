/**
 * Test d'intégration MANUEL (pas dans la suite Vitest — celle-ci reste 100% hors
 * réseau) contre le vrai projet Supabase, pour vérifier ce qu'un test unitaire ne
 * peut pas prouver : que les policies RLS appliquées en base isolent réellement
 * les données entre deux utilisateurs différents.
 *
 * N'importe PAS lib/db/operations.ts : ce module démarre par `import "server-only"`,
 * un garde-fou qui lève volontairement une erreur en dehors du bundler Next.js (son
 * rôle est justement d'empêcher d'importer ce module côté client). Ce script fait
 * donc les mêmes requêtes "à la main" avec le client Supabase brut, uniquement pour
 * prouver le comportement des policies RLS au niveau base de données — indépendant
 * de l'implémentation exacte de operations.ts, qui est lui vérifié par `npm run build`
 * (compilé avec succès dans le contexte Next.js) et par relecture.
 *
 * Usage : npx tsx scripts/test-operations-integration.ts
 * Nécessite .env.local (URL + clé service_role + clé publique).
 *
 * Crée deux utilisateurs jetables, vérifie l'isolation RLS, puis supprime tout ce
 * qu'il a créé (utilisateurs + opérations, cascade via FK).
 *
 * ⚠️ NE PEUT PAS TOURNER depuis l'environnement cloud de Claude : le réseau sortant y
 * est limité à une liste d'hôtes autorisés (GitHub, npm, PyPI...) et *.supabase.co n'en
 * fait pas partie (confirmé : la requête est bloquée en 403 par le proxy sortant, avant
 * même d'atteindre Supabase). À exécuter depuis une machine avec accès réseau normal
 * (ta machine, ou une CI). Le typage a été vérifié (tsc --noEmit) mais l'exécution réelle
 * ne l'a pas été depuis cet environnement.
 */
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Chargement minimal de .env.local (pas de dépendance dotenv pour un script jetable).
for (const ligne of readFileSync(".env.local", "utf-8").split("\n")) {
  const correspondance = ligne.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (correspondance) process.env[correspondance[1]] ??= correspondance[2];
}

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const CLE_PUBLIQUE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const CLE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let echecs = 0;

function verifier(condition: boolean, description: string): void {
  if (condition) {
    console.log(`  ✓ ${description}`);
  } else {
    console.error(`  ✗ ${description}`);
    echecs++;
  }
}

async function creerUtilisateurDeTest(
  admin: SupabaseClient,
  email: string,
  password: string
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Échec création utilisateur de test ${email} : ${error?.message}`);
  }
  return data.user.id;
}

async function connecterUtilisateur(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(URL_SUPABASE, CLE_PUBLIQUE);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Échec connexion ${email} : ${error.message}`);
  return client;
}

async function main() {
  const admin = createClient(URL_SUPABASE, CLE_SERVICE_ROLE);
  const suffixe = Date.now();
  const emailA = `test-integration-a-${suffixe}@example.com`;
  const emailB = `test-integration-b-${suffixe}@example.com`;
  const password = "MotDePasseTest123!";

  let idUtilisateurA: string | undefined;
  let idUtilisateurB: string | undefined;

  try {
    console.log("--- Préparation : création de 2 utilisateurs jetables ---");
    idUtilisateurA = await creerUtilisateurDeTest(admin, emailA, password);
    idUtilisateurB = await creerUtilisateurDeTest(admin, emailB, password);
    console.log(`  utilisateur A: ${idUtilisateurA}`);
    console.log(`  utilisateur B: ${idUtilisateurB}`);

    const clientA = await connecterUtilisateur(emailA, password);
    const clientB = await connecterUtilisateur(emailB, password);

    console.log("\n--- CRUD de base (utilisateur A) ---");
    const { data: initiales } = await clientA.from("operations").select("*");
    verifier((initiales?.length ?? -1) === 0, "aucune opération au départ pour A");

    const { data: creee, error: erreurCreation } = await clientA
      .from("operations")
      .insert({ user_id: idUtilisateurA, mode: "investisseur", nom: "Appartement test intégration" })
      .select("*")
      .single();
    verifier(!erreurCreation && creee?.mode === "investisseur", "l'opération créée a le bon mode");
    verifier(creee?.nom === "Appartement test intégration", "l'opération créée a le bon nom");
    verifier(creee?.statut === "brouillon", "statut par défaut = brouillon");

    const { data: lue } = await clientA.from("operations").select("*").eq("id", creee.id).maybeSingle();
    verifier(lue?.id === creee.id, "on relit bien l'opération créée par A");

    const { data: misAJour } = await clientA
      .from("operations")
      .update({ prix_achat: 250_000 })
      .eq("id", creee.id)
      .select("*")
      .single();
    verifier(misAJour?.prix_achat === 250_000, "la mise à jour est bien persistée");

    const { data: apresCreation } = await clientA.from("operations").select("*");
    verifier(apresCreation?.length === 1, "la liste de A contient bien l'opération créée");

    console.log("\n--- Isolation RLS (utilisateur B ne doit RIEN voir de A) ---");
    const { data: vuesParB } = await clientB.from("operations").select("*");
    verifier((vuesParB?.length ?? -1) === 0, "B ne voit aucune opération de A dans sa propre liste");

    const { data: lueParB } = await clientB
      .from("operations")
      .select("*")
      .eq("id", creee.id)
      .maybeSingle();
    verifier(lueParB === null, "B ne peut pas lire directement l'opération de A par son id");

    // Tentative de modification par B sur l'opération de A : RLS doit filtrer la ligne
    // (0 ligne affectée -> .single() renvoie une erreur "no rows returned").
    const { error: erreurUpdateParB } = await clientB
      .from("operations")
      .update({ prix_achat: 1 })
      .eq("id", creee.id)
      .select("*")
      .single();
    verifier(!!erreurUpdateParB, "B ne peut pas modifier l'opération de A (RLS bloque l'update)");

    const { data: relueApresTentativeB } = await clientA
      .from("operations")
      .select("*")
      .eq("id", creee.id)
      .maybeSingle();
    verifier(
      relueApresTentativeB?.prix_achat === 250_000,
      "le prix d'achat de A est inchangé après la tentative de B"
    );

    console.log("\n--- Suppression ---");
    await clientA.from("operations").delete().eq("id", creee.id);
    const { data: apresSuppression } = await clientA.from("operations").select("*");
    verifier((apresSuppression?.length ?? -1) === 0, "la liste de A est vide après suppression");
  } finally {
    console.log("\n--- Nettoyage : suppression des utilisateurs de test ---");
    if (idUtilisateurA) await admin.auth.admin.deleteUser(idUtilisateurA);
    if (idUtilisateurB) await admin.auth.admin.deleteUser(idUtilisateurB);
    console.log("  utilisateurs de test supprimés");
  }

  console.log(echecs === 0 ? "\n✅ Tous les tests d'intégration sont passés." : `\n❌ ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Erreur inattendue :", err);
  process.exit(1);
});
