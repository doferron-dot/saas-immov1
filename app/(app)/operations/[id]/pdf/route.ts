import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { verifierSession } from "@/lib/auth/dal";
import { obtenirOperation } from "@/lib/db/operations";
import { listerTravauxLignes } from "@/lib/db/travaux-lignes";
import { obtenirFinancement } from "@/lib/db/financement";
import { obtenirOperationInvestisseur } from "@/lib/db/operation-investisseur";
import { listerLotsMarchand } from "@/lib/db/operation-marchand-lots";
import { obtenirLocationMarchand } from "@/lib/db/operation-marchand-location";
import { createClient } from "@/lib/db/supabase/server";
import { calculerResultatsOperation } from "@/lib/operations/calculer-resultats";
import { calculerScenariosMarchand } from "@/lib/operations/calculer-scenarios-marchand";
import { construireHypothesesProjectionPersonnalisees } from "@/lib/operations/parametres-projection";
import { RapportOperation } from "@/lib/pdf/rapport";

/**
 * Export PDF d'une opération — GET /operations/[id]/pdf, déclenché par un simple lien
 * <a href> (pas de JS côté client nécessaire, le navigateur télécharge la réponse grâce à
 * Content-Disposition: attachment).
 *
 * verifierSession() est appelée en dehors de tout try/catch : c'est le comportement
 * documenté pour redirect() dans les Route Handlers (voir
 * node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md,
 * "In Server Actions and Route Handlers, redirect should be called outside the try
 * block when using try/catch statements") — même garde d'authentification que toutes
 * les pages de l'app (lib/auth/dal.ts).
 *
 * Aucun calcul financier ici : uniquement chargement des données + appel aux fonctions
 * de composition déjà testées (lib/operations/calculer-resultats.ts et
 * calculer-scenarios-marchand.ts), puis mise en page via lib/pdf/rapport.tsx.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await verifierSession();
  const { id } = await params;

  // Reprend les mêmes hypothèses de projection personnalisées que celles affichées à
  // l'écran (page de l'opération) au moment où le lien "Télécharger le rapport PDF" a été
  // construit — mêmes noms de paramètres, même fonction de parsing (voir
  // lib/operations/parametres-projection.ts). Absents -> valeurs par défaut, comme sur la page.
  const url = new URL(request.url);
  const hypothesesProjection = construireHypothesesProjectionPersonnalisees({
    pValo: url.searchParams.get("pValo") ?? undefined,
    pLoyer: url.searchParams.get("pLoyer") ?? undefined,
    pCharges: url.searchParams.get("pCharges") ?? undefined,
    pFrais: url.searchParams.get("pFrais") ?? undefined,
    oValo: url.searchParams.get("oValo") ?? undefined,
    oLoyer: url.searchParams.get("oLoyer") ?? undefined,
    oCharges: url.searchParams.get("oCharges") ?? undefined,
    oFrais: url.searchParams.get("oFrais") ?? undefined,
  });

  const supabase = await createClient();
  const operation = await obtenirOperation(supabase, id);

  if (!operation) {
    return NextResponse.json({ erreur: "Opération introuvable." }, { status: 404 });
  }

  const [travaux, financement, investisseur, lots, locationMarchand] = await Promise.all([
    listerTravauxLignes(supabase, id),
    obtenirFinancement(supabase, id),
    operation.mode === "investisseur" ? obtenirOperationInvestisseur(supabase, id) : Promise.resolve(null),
    operation.mode === "marchand" ? listerLotsMarchand(supabase, id) : Promise.resolve([]),
    operation.mode === "marchand" ? obtenirLocationMarchand(supabase, id) : Promise.resolve(null),
  ]);

  let resultats;
  try {
    resultats = calculerResultatsOperation(
      operation,
      travaux,
      financement,
      investisseur,
      lots,
      hypothesesProjection,
      locationMarchand
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de calcul inconnue.";
    return NextResponse.json({ erreur: message }, { status: 400 });
  }

  if (!resultats) {
    return NextResponse.json(
      { erreur: "Pas assez de données saisies pour générer un rapport (prix d'achat et loyer/revente requis)." },
      { status: 400 }
    );
  }

  const scenariosMarchand =
    operation.mode === "marchand"
      ? calculerScenariosMarchand(operation, travaux, financement, lots, locationMarchand)
      : null;
  const payeCash = !financement || financement.montant_emprunte <= 0;

  const buffer = await renderToBuffer(
    RapportOperation({ operation, resultats, scenariosMarchand, payeCash })
  );

  const nomFichier = `rapport-${operation.nom.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
      "Cache-Control": "no-store",
    },
  });
}
