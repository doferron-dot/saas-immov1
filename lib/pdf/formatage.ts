/**
 * Formatage de nombres/dates pour le rapport PDF (lib/pdf/rapport.tsx). Extrait dans un
 * fichier .ts séparé (sans JSX, sans dépendance à @react-pdf/renderer) pour rester
 * testable facilement par Vitest : vitest.config.ts ne cible que lib/**\/__tests__/**\/*.test.ts
 * et ce projet n'a pas de plugin de transformation JSX configuré pour Vitest — importer un
 * .tsx dans un test serait un terrain non éprouvé, alors que ces fonctions pures n'ont
 * elles-mêmes aucun besoin de JSX.
 *
 * toLocaleString("fr-FR") insère une espace fine insécable (U+202F) comme séparateur de
 * milliers — un caractère absent de la police par défaut de @react-pdf/renderer
 * (Helvetica, encodage WinAnsi/Latin-1), qui s'affiche alors comme un caractère cassé
 * (repéré visuellement en relisant un PDF de test : "200/000 €" au lieu de "200 000 €").
 * On la remplace par une espace normale uniquement dans ces formatteurs PDF — les
 * formatteurs équivalents de la page web (app/operations/[id]/page.tsx) n'ont pas ce
 * problème, un navigateur ayant une police complète.
 */
function espaceCompatiblePdf(texte: string): string {
  // U+202F (espace fine insécable) et U+00A0 (espace insécable) -> espace normale (U+0020) :
  // absentes de la police PDF par défaut (Helvetica/WinAnsi), voir le commentaire ci-dessus.
  return texte.replace(/[  ]/g, " ");
}

export function formaterEuro(valeur: number): string {
  return espaceCompatiblePdf(
    valeur.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
  );
}

export function formaterPct(valeur: number): string {
  return espaceCompatiblePdf(`${(valeur * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`);
}

export function formaterEuroCompact(valeur: number): string {
  return espaceCompatiblePdf(
    valeur.toLocaleString("fr-FR", {
      style: "currency",
      currency: "EUR",
      notation: "compact",
      maximumFractionDigits: 1,
    })
  );
}

export function formaterDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
