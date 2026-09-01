/**
 * Convertit les paramètres de requête (chaînes, en points de pourcentage — ex "1.5" pour
 * 1,5 %) en hypothèses de projection personnalisées, un profil à la fois. Renvoie
 * `undefined` si aucun paramètre pertinent n'est présent, pour que
 * calculerResultatsOperation retombe sur les valeurs par défaut (HYPOTHESES_PROJECTION).
 *
 * Centralisé ici (plutôt que dupliqué) car utilisé à deux endroits qui doivent rester
 * synchronisés : app/operations/[id]/page.tsx (formulaire GET sous les graphiques) et
 * app/operations/[id]/pdf/route.ts (export PDF, pour que le rapport téléchargé reflète
 * les hypothèses affichées à l'écran au moment du clic).
 *
 * Aucun calcul financier ici : uniquement du parsing/assemblage, même principe que le
 * reste de lib/operations/.
 */
import { HYPOTHESES_PROJECTION, type ProfilProjection, type HypothesesProjection } from "../calc-engine/projection";

export interface ParametresHypothesesProjection {
  pValo?: string;
  pLoyer?: string;
  pCharges?: string;
  pFrais?: string;
  oValo?: string;
  oLoyer?: string;
  oCharges?: string;
  oFrais?: string;
}

function nombreParam(valeur: string | undefined): number | undefined {
  if (valeur === undefined || valeur.trim() === "") return undefined;
  const n = Number(valeur);
  return Number.isFinite(n) ? n : undefined;
}

function construireProfilPersonnalise(
  defaut: HypothesesProjection,
  valo: string | undefined,
  loyer: string | undefined,
  charges: string | undefined,
  frais: string | undefined
): HypothesesProjection | null {
  const v = nombreParam(valo);
  const l = nombreParam(loyer);
  const c = nombreParam(charges);
  const f = nombreParam(frais);
  if (v === undefined && l === undefined && c === undefined && f === undefined) return null;
  return {
    tauxValorisationBienAnnuel: v !== undefined ? v / 100 : defaut.tauxValorisationBienAnnuel,
    tauxIndexationLoyerAnnuel: l !== undefined ? l / 100 : defaut.tauxIndexationLoyerAnnuel,
    tauxIndexationChargesAnnuel: c !== undefined ? c / 100 : defaut.tauxIndexationChargesAnnuel,
    tauxFraisReventeEstimes: f !== undefined ? f / 100 : defaut.tauxFraisReventeEstimes,
  };
}

export function construireHypothesesProjectionPersonnalisees(
  sp: ParametresHypothesesProjection
): Partial<Record<ProfilProjection, HypothesesProjection>> | undefined {
  const prudent = construireProfilPersonnalise(HYPOTHESES_PROJECTION.prudent, sp.pValo, sp.pLoyer, sp.pCharges, sp.pFrais);
  const optimiste = construireProfilPersonnalise(HYPOTHESES_PROJECTION.optimiste, sp.oValo, sp.oLoyer, sp.oCharges, sp.oFrais);
  if (!prudent && !optimiste) return undefined;
  const resultat: Partial<Record<ProfilProjection, HypothesesProjection>> = {};
  if (prudent) resultat.prudent = prudent;
  if (optimiste) resultat.optimiste = optimiste;
  return resultat;
}

/** Reconstruit la query string (sans "?") à partir des paramètres présents — pour propager
 * les hypothèses personnalisées vers un lien (ex : export PDF) sans repasser par un formulaire. */
export function serialiserParametresHypotheses(sp: ParametresHypothesesProjection): string {
  const params = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(sp)) {
    if (valeur !== undefined && valeur !== "") params.set(cle, valeur);
  }
  return params.toString();
}
