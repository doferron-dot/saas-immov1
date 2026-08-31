import { notFound } from "next/navigation";
import Link from "next/link";
import { verifierSession } from "@/lib/auth/dal";
import { obtenirOperation } from "@/lib/db/operations";
import { listerTravauxLignes } from "@/lib/db/travaux-lignes";
import { obtenirFinancement } from "@/lib/db/financement";
import { obtenirOperationInvestisseur } from "@/lib/db/operation-investisseur";
import { listerLotsMarchand } from "@/lib/db/operation-marchand-lots";
import { createClient } from "@/lib/db/supabase/server";
import { OperationForm } from "@/components/operations/operation-form";
import { GraphiqueLignes } from "@/components/operations/graphique-lignes";
import { enregistrerDetailOperation } from "@/lib/operations/actions";
import { calculerResultatsOperation, type ResultatsOperation } from "@/lib/operations/calculer-resultats";
import type { Operation } from "@/lib/db/operations";
import {
  HYPOTHESES_PROJECTION,
  type ProjectionParProfil,
  type ProfilProjection,
  type HypothesesProjection,
} from "@/lib/calc-engine/projection";

function formaterEuro(valeur: number): string {
  return valeur.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function formaterEuroCompact(valeur: number): string {
  return valeur.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

function formaterPct(valeur: number): string {
  return `${(valeur * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function Chiffre({ libelle, valeur, accent }: { libelle: string; valeur: string; accent?: "positif" | "negatif" }) {
  const couleur =
    accent === "positif"
      ? "text-green-700 dark:text-green-400"
      : accent === "negatif"
        ? "text-red-700 dark:text-red-400"
        : "";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-zinc-500">{libelle}</span>
      <span className={`text-lg font-semibold ${couleur}`}>{valeur}</span>
    </div>
  );
}

function ResultatsCard({ operation, resultats }: { operation: Operation; resultats: ResultatsOperation }) {
  return (
    <div className="flex flex-col gap-6 rounded border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Résultats</h2>
        <span className="text-2xl font-bold">{Math.round(resultats.score.total)} / 100</span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Chiffre libelle="Coût total d'acquisition" valeur={formaterEuro(resultats.coutTotalAcquisition)} />
        <Chiffre libelle="Total travaux (avec imprévus)" valeur={formaterEuro(resultats.totalTravaux)} />
        <Chiffre libelle="Mensualité crédit" valeur={formaterEuro(resultats.mensualiteCredit)} />
        <Chiffre libelle="Coût total du crédit" valeur={formaterEuro(resultats.coutTotalCredit)} />
        <Chiffre libelle="Montant total investi" valeur={formaterEuro(resultats.montantTotalInvesti)} />

        {resultats.investisseur && (
          <>
            <Chiffre libelle="Rendement brut" valeur={formaterPct(resultats.investisseur.rendementBrut)} />
            <Chiffre libelle="Rendement net" valeur={formaterPct(resultats.investisseur.rendementNet)} />
            <Chiffre
              libelle="Cash-flow mensuel"
              valeur={formaterEuro(resultats.investisseur.cashFlowMensuel)}
              accent={resultats.investisseur.cashFlowMensuel >= 0 ? "positif" : "negatif"}
            />
          </>
        )}

        {resultats.marchand && (
          <>
            <Chiffre libelle="Chiffre d'affaires total" valeur={formaterEuro(resultats.marchand.chiffreAffairesTotal)} />
            <Chiffre
              libelle="Marge"
              valeur={formaterEuro(resultats.marchand.marge)}
              accent={resultats.marchand.marge >= 0 ? "positif" : "negatif"}
            />
            <Chiffre libelle="Marge %" valeur={formaterPct(resultats.marchand.margePct)} />
            <Chiffre libelle="ROI" valeur={formaterPct(resultats.marchand.roi)} />
          </>
        )}
      </div>

      {(resultats.score.pointsForts.length > 0 || resultats.score.pointsVigilance.length > 0) && (
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          {resultats.score.pointsForts.length > 0 && (
            <div>
              <p className="font-medium text-green-700 dark:text-green-400">Points forts</p>
              <ul className="list-inside list-disc text-zinc-600 dark:text-zinc-400">
                {resultats.score.pointsForts.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {resultats.score.pointsVigilance.length > 0 && (
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400">Points de vigilance</p>
              <ul className="list-inside list-disc text-zinc-600 dark:text-zinc-400">
                {resultats.score.pointsVigilance.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-zinc-500">
        {operation.mode === "investisseur"
          ? "Rendement calculé hors fiscalité pour l'instant (la fiscalité — LMNP, micro-foncier... — arrive dans une prochaine étape). "
          : ""}
        Score sur 100 : barème proposé par défaut, seuils encore à affiner avec toi. La sensibilité
        « scénario pessimiste » du score combine loyer et charges (voir le code pour le détail).
      </p>
    </div>
  );
}

const COULEUR_PRUDENT = "#71717a";
const COULEUR_OPTIMISTE = "#16a34a";
const COULEUR_CREDIT = "#dc2626";

function ProjectionSection({ projection }: { projection: ProjectionParProfil }) {
  const annees = projection.prudent.map((p) => p.annee);

  return (
    <div className="flex flex-col gap-6 rounded border border-zinc-200 p-5 dark:border-zinc-800">
      <div>
        <h2 className="text-lg font-semibold">Projection dans le temps</h2>
        <p className="text-xs text-zinc-500">
          Deux profils comparés : prudent (bien +1,5 %/an, loyers +1 %/an) et optimiste (bien +2 %/an,
          loyers +1,5 %/an) — hypothèses par défaut, pas encore modifiables depuis le formulaire.
        </p>
      </div>

      <GraphiqueLignes
        titre="Valeur du bien vs capital restant dû"
        formaterY={formaterEuroCompact}
        series={[
          {
            label: "Valeur du bien (prudent)",
            couleur: COULEUR_PRUDENT,
            points: projection.prudent.map((p) => ({ x: p.annee, y: p.valeurBien })),
          },
          {
            label: "Valeur du bien (optimiste)",
            couleur: COULEUR_OPTIMISTE,
            points: projection.optimiste.map((p) => ({ x: p.annee, y: p.valeurBien })),
          },
          {
            label: "Capital restant dû",
            couleur: COULEUR_CREDIT,
            points: projection.prudent.map((p) => ({ x: p.annee, y: p.capitalRestantDu })),
          },
        ]}
      />

      <GraphiqueLignes
        titre="Cash-flow cumulé"
        formaterY={formaterEuroCompact}
        series={[
          {
            label: "Prudent",
            couleur: COULEUR_PRUDENT,
            points: projection.prudent.map((p) => ({ x: p.annee, y: p.cashFlowCumule })),
          },
          {
            label: "Optimiste",
            couleur: COULEUR_OPTIMISTE,
            points: projection.optimiste.map((p) => ({ x: p.annee, y: p.cashFlowCumule })),
          },
        ]}
      />

      <GraphiqueLignes
        titre="Patrimoine net (si revente à cette échéance)"
        formaterY={formaterEuroCompact}
        series={[
          {
            label: "Prudent",
            couleur: COULEUR_PRUDENT,
            points: projection.prudent.map((p) => ({ x: p.annee, y: p.patrimoineNet })),
          },
          {
            label: "Optimiste",
            couleur: COULEUR_OPTIMISTE,
            points: projection.optimiste.map((p) => ({ x: p.annee, y: p.patrimoineNet })),
          },
        ]}
      />

      <p className="text-xs text-zinc-500">
        Années affichées : {annees.join(", ")}. Le patrimoine net = valeur du bien − frais de revente
        estimés (6 %) − capital restant dû − impôt sur la plus-value immobilière ESTIMÉ (barème
        standard 2026, abattement selon durée de détention) + cash-flow cumulé encaissé − apport
        initial. L&apos;estimation de plus-value est indicative : elle ne couvre pas la surtaxe sur les
        plus-values supérieures à 50 000 €, ni les exonérations liées à ta situation personnelle.
      </p>
    </div>
  );
}

/**
 * Convertit les paramètres de requête (chaînes, en points de pourcentage — ex "1.5" pour
 * 1,5 %) en hypothèses de projection personnalisées, un profil à la fois. Renvoie
 * `undefined` si aucun paramètre pertinent n'est présent, pour que
 * calculerResultatsOperation retombe sur les valeurs par défaut (HYPOTHESES_PROJECTION).
 * Ajouté à la demande implicite de rendre les hypothèses modifiables depuis l'interface
 * (cf. README, "pas encore" de la version précédente) — aucune migration nécessaire,
 * même principe GET + searchParams que la page prix-max.
 */
function nombreParam(valeur: string | undefined): number | undefined {
  if (valeur === undefined || valeur.trim() === "") return undefined;
  const n = Number(valeur);
  return Number.isFinite(n) ? n : undefined;
}

interface ParametresHypotheses {
  pValo?: string;
  pLoyer?: string;
  pCharges?: string;
  pFrais?: string;
  oValo?: string;
  oLoyer?: string;
  oCharges?: string;
  oFrais?: string;
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

function construireHypothesesPersonnalisees(
  sp: ParametresHypotheses
): Partial<Record<ProfilProjection, HypothesesProjection>> | undefined {
  const prudent = construireProfilPersonnalise(HYPOTHESES_PROJECTION.prudent, sp.pValo, sp.pLoyer, sp.pCharges, sp.pFrais);
  const optimiste = construireProfilPersonnalise(HYPOTHESES_PROJECTION.optimiste, sp.oValo, sp.oLoyer, sp.oCharges, sp.oFrais);
  if (!prudent && !optimiste) return undefined;
  const resultat: Partial<Record<ProfilProjection, HypothesesProjection>> = {};
  if (prudent) resultat.prudent = prudent;
  if (optimiste) resultat.optimiste = optimiste;
  return resultat;
}

const CHAMP_HYP = "w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";

function ChampHypothese({
  id,
  label,
  name,
  valeurParDefaut,
}: {
  id: string;
  label: string;
  name: string;
  valeurParDefaut: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-zinc-500">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="number"
        step="0.1"
        defaultValue={Math.round(valeurParDefaut * 1000) / 10}
        className={CHAMP_HYP}
      />
    </div>
  );
}

function FormulaireHypotheses({ hypotheses }: { hypotheses: Record<ProfilProjection, HypothesesProjection> }) {
  return (
    <div className="flex flex-col gap-4 rounded border border-zinc-200 p-5 dark:border-zinc-800">
      <div>
        <h3 className="text-sm font-semibold">Hypothèses de la projection</h3>
        <p className="text-xs text-zinc-500">
          Valeurs en % par an (frais de revente : % de la valeur du bien à la revente). Modifie et
          clique sur « Recalculer » pour mettre à jour les graphiques et tableaux ci-dessus.
        </p>
      </div>
      <form method="GET" className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Profil prudent</span>
          <ChampHypothese
            id="pValo"
            name="pValo"
            label="Valorisation du bien"
            valeurParDefaut={hypotheses.prudent.tauxValorisationBienAnnuel}
          />
          <ChampHypothese
            id="pLoyer"
            name="pLoyer"
            label="Indexation du loyer"
            valeurParDefaut={hypotheses.prudent.tauxIndexationLoyerAnnuel}
          />
          <ChampHypothese
            id="pCharges"
            name="pCharges"
            label="Indexation des charges"
            valeurParDefaut={hypotheses.prudent.tauxIndexationChargesAnnuel}
          />
          <ChampHypothese
            id="pFrais"
            name="pFrais"
            label="Frais de revente estimés"
            valeurParDefaut={hypotheses.prudent.tauxFraisReventeEstimes}
          />
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Profil optimiste</span>
          <ChampHypothese
            id="oValo"
            name="oValo"
            label="Valorisation du bien"
            valeurParDefaut={hypotheses.optimiste.tauxValorisationBienAnnuel}
          />
          <ChampHypothese
            id="oLoyer"
            name="oLoyer"
            label="Indexation du loyer"
            valeurParDefaut={hypotheses.optimiste.tauxIndexationLoyerAnnuel}
          />
          <ChampHypothese
            id="oCharges"
            name="oCharges"
            label="Indexation des charges"
            valeurParDefaut={hypotheses.optimiste.tauxIndexationChargesAnnuel}
          />
          <ChampHypothese
            id="oFrais"
            name="oFrais"
            label="Frais de revente estimés"
            valeurParDefaut={hypotheses.optimiste.tauxFraisReventeEstimes}
          />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            className="rounded bg-zinc-900 px-6 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            Recalculer
          </button>
          <a href="?" className="text-sm underline">
            Réinitialiser aux valeurs par défaut
          </a>
        </div>
      </form>
    </div>
  );
}

export default async function OperationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enregistre?: string; erreur?: string } & ParametresHypotheses>;
}) {
  await verifierSession();
  const { id } = await params;
  const { enregistre, erreur, ...parametresHypotheses } = await searchParams;
  const supabase = await createClient();
  const operation = await obtenirOperation(supabase, id);

  if (!operation) {
    notFound();
  }

  const [travaux, financement, investisseur, lots] = await Promise.all([
    listerTravauxLignes(supabase, id),
    obtenirFinancement(supabase, id),
    operation.mode === "investisseur" ? obtenirOperationInvestisseur(supabase, id) : Promise.resolve(null),
    operation.mode === "marchand" ? listerLotsMarchand(supabase, id) : Promise.resolve([]),
  ]);

  const hypothesesPersonnalisees = construireHypothesesPersonnalisees(parametresHypotheses);

  let resultats: ResultatsOperation | null = null;
  let erreurCalcul: string | null = null;
  try {
    resultats = calculerResultatsOperation(
      operation,
      travaux,
      financement,
      investisseur,
      lots,
      hypothesesPersonnalisees
    );
  } catch (err) {
    erreurCalcul = err instanceof Error ? err.message : "Erreur de calcul inconnue.";
  }

  const enregistrerAction = enregistrerDetailOperation.bind(null, id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16">
      <Link href="/dashboard" className="text-sm underline">
        ← Retour au tableau de bord
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{operation.nom}</h1>
        <p className="text-sm text-zinc-500">
          Mode {operation.mode === "investisseur" ? "investisseur locatif" : "marchand de biens"} ·{" "}
          {operation.statut}
        </p>
      </div>

      {enregistre && (
        <p className="rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          Enregistré.
        </p>
      )}
      {erreur && (
        <p className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          Erreur lors de l&apos;enregistrement : {decodeURIComponent(erreur)}
        </p>
      )}

      {resultats ? (
        <>
          <ResultatsCard operation={operation} resultats={resultats} />
          {resultats.projection && <ProjectionSection projection={resultats.projection} />}
          {resultats.projection && (
            <FormulaireHypotheses
              hypotheses={{
                prudent: hypothesesPersonnalisees?.prudent ?? HYPOTHESES_PROJECTION.prudent,
                optimiste: hypothesesPersonnalisees?.optimiste ?? HYPOTHESES_PROJECTION.optimiste,
              }}
            />
          )}
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/operations/${id}/prix-max`}
              className="w-fit rounded border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
            >
              Calculer le prix d&apos;achat maximum →
            </Link>
            {operation.mode === "marchand" && (
              <Link
                href={`/operations/${id}/scenarios`}
                className="w-fit rounded border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
              >
                Voir les scénarios →
              </Link>
            )}
            <a
              href={`/operations/${id}/pdf`}
              className="w-fit rounded border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
            >
              Télécharger le rapport PDF ↓
            </a>
          </div>
        </>
      ) : (
        <p className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          {erreurCalcul
            ? `Impossible de calculer les résultats pour l'instant : ${erreurCalcul}`
            : operation.mode === "investisseur"
              ? "Renseigne au moins le prix d'achat et le loyer mensuel ci-dessous pour voir les résultats."
              : "Renseigne au moins le prix d'achat et un lot avec son prix de revente ci-dessous pour voir les résultats."}
        </p>
      )}

      <OperationForm
        operation={operation}
        travaux={travaux}
        financement={financement}
        investisseur={investisseur}
        lots={lots}
        action={enregistrerAction}
      />
    </div>
  );
}
