import { notFound } from "next/navigation";
import Link from "next/link";
import { verifierSession } from "@/lib/auth/dal";
import { obtenirOperation } from "@/lib/db/operations";
import { listerTravauxLignes } from "@/lib/db/travaux-lignes";
import { obtenirFinancement } from "@/lib/db/financement";
import { obtenirOperationInvestisseur } from "@/lib/db/operation-investisseur";
import { listerLotsMarchand } from "@/lib/db/operation-marchand-lots";
import { obtenirLocationMarchand } from "@/lib/db/operation-marchand-location";
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
import {
  construireHypothesesProjectionPersonnalisees,
  serialiserParametresHypotheses,
  type ParametresHypothesesProjection,
} from "@/lib/operations/parametres-projection";

function formaterEuro(valeur: number): string {
  return valeur.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
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
    <div className="flex flex-col gap-0.5 rounded-md bg-surface px-3 py-2">
      <span className="text-xs text-zinc-500">{libelle}</span>
      <span className={`text-base font-semibold ${couleur}`}>{valeur}</span>
    </div>
  );
}

/** Couleur du badge de score selon la plage — mêmes seuils que les points forts/vigilance
 * du moteur de calcul (voir lib/calc-engine/score.ts), juste traduits en couleur ici. */
function styleScore(total: number): string {
  if (total >= 70) return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
  if (total >= 40) return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
}

function ResultatsCard({
  operation,
  resultats,
  payeCash,
}: {
  operation: Operation;
  resultats: ResultatsOperation;
  /** Aucun financement saisi (pas de ligne financement, ou montant emprunté à 0) : achat
   * comptant — affiche "Payé cash" plutôt qu'un "0 €" qui pourrait passer pour une donnée
   * manquante. */
  payeCash: boolean;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Résultats</h2>
        <span className={`rounded-full px-3 py-1 text-lg font-bold ${styleScore(resultats.score.total)}`}>
          {Math.round(resultats.score.total)} / 100
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Chiffre libelle="Coût total d'acquisition" valeur={formaterEuro(resultats.coutTotalAcquisition)} />
        <Chiffre libelle="Total travaux (avec imprévus)" valeur={formaterEuro(resultats.totalTravaux)} />
        <Chiffre
          libelle="Mensualité crédit"
          valeur={payeCash ? "Payé cash" : formaterEuro(resultats.mensualiteCredit)}
        />
        <Chiffre
          libelle="Coût total du crédit"
          valeur={payeCash ? "Payé cash" : formaterEuro(resultats.coutTotalCredit)}
        />
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
            {resultats.marchand.revenuLocatifNet > 0 && (
              <Chiffre
                libelle="Revenu locatif net (avant revente)"
                valeur={formaterEuro(resultats.marchand.revenuLocatifNet)}
                accent="positif"
              />
            )}
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
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:gap-6">
          {resultats.score.pointsForts.length > 0 && (
            <div className="flex-1">
              <p className="mb-1.5 text-xs font-medium text-green-700 dark:text-green-400">Points forts</p>
              <div className="flex flex-wrap gap-1.5">
                {resultats.score.pointsForts.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
          {resultats.score.pointsVigilance.length > 0 && (
            <div className="flex-1">
              <p className="mb-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">Points de vigilance</p>
              <div className="flex flex-wrap gap-1.5">
                {resultats.score.pointsVigilance.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  >
                    {p}
                  </span>
                ))}
              </div>
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
    <div className="flex flex-col gap-5 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div>
        <h2 className="text-base font-semibold">Projection dans le temps</h2>
        <p className="text-xs text-zinc-500">
          Deux profils comparés : prudent (bien +1,5 %/an, loyers +1 %/an) et optimiste (bien +2 %/an,
          loyers +1,5 %/an) — hypothèses par défaut, pas encore modifiables depuis le formulaire.
        </p>
      </div>

      <GraphiqueLignes
        titre="Valeur du bien vs capital restant dû"
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
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
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
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
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
  searchParams: Promise<{ enregistre?: string; erreur?: string } & ParametresHypothesesProjection>;
}) {
  await verifierSession();
  const { id } = await params;
  const { enregistre, erreur, ...parametresHypotheses } = await searchParams;
  const supabase = await createClient();
  const operation = await obtenirOperation(supabase, id);

  if (!operation) {
    notFound();
  }

  const [travaux, financement, investisseur, lots, locationMarchand] = await Promise.all([
    listerTravauxLignes(supabase, id),
    obtenirFinancement(supabase, id),
    operation.mode === "investisseur" ? obtenirOperationInvestisseur(supabase, id) : Promise.resolve(null),
    operation.mode === "marchand" ? listerLotsMarchand(supabase, id) : Promise.resolve([]),
    operation.mode === "marchand" ? obtenirLocationMarchand(supabase, id) : Promise.resolve(null),
  ]);

  const hypothesesPersonnalisees = construireHypothesesProjectionPersonnalisees(parametresHypotheses);
  const requeteHypotheses = serialiserParametresHypotheses(parametresHypotheses);
  const hrefPdf = `/operations/${id}/pdf${requeteHypotheses ? `?${requeteHypotheses}` : ""}`;

  let resultats: ResultatsOperation | null = null;
  let erreurCalcul: string | null = null;
  try {
    resultats = calculerResultatsOperation(
      operation,
      travaux,
      financement,
      investisseur,
      lots,
      hypothesesPersonnalisees,
      locationMarchand
    );
  } catch (err) {
    erreurCalcul = err instanceof Error ? err.message : "Erreur de calcul inconnue.";
  }

  const enregistrerAction = enregistrerDetailOperation.bind(null, id);

  const estInvestisseur = operation.mode === "investisseur";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-8">
      <Link href="/dashboard" className="w-fit text-sm text-zinc-500 hover:text-accent">
        ← Retour au tableau de bord
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{operation.nom}</h1>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            estInvestisseur
              ? "bg-accent/10 text-accent"
              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
          }`}
        >
          {estInvestisseur ? "Investisseur locatif" : "Marchand de biens"}
        </span>
        <span className="text-xs text-zinc-500">{operation.statut}</span>
      </div>

      {enregistre && (
        <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          Enregistré.
        </p>
      )}
      {erreur && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          Erreur lors de l&apos;enregistrement : {decodeURIComponent(erreur)}
        </p>
      )}

      {resultats ? (
        <>
          <ResultatsCard
            operation={operation}
            resultats={resultats}
            payeCash={!financement || financement.montant_emprunte <= 0}
          />
          {resultats.projection && <ProjectionSection projection={resultats.projection} />}
          {resultats.projection && (
            <FormulaireHypotheses
              hypotheses={{
                prudent: hypothesesPersonnalisees?.prudent ?? HYPOTHESES_PROJECTION.prudent,
                optimiste: hypothesesPersonnalisees?.optimiste ?? HYPOTHESES_PROJECTION.optimiste,
              }}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/operations/${id}/prix-max`}
              className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Prix d&apos;achat maximum →
            </Link>
            {operation.mode === "marchand" && (
              <Link
                href={`/operations/${id}/scenarios`}
                className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Scénarios →
              </Link>
            )}
            <a
              href={hrefPdf}
              className="w-fit rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Télécharger le rapport PDF ↓
            </a>
          </div>
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
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
        locationMarchand={locationMarchand}
        action={enregistrerAction}
      />
    </div>
  );
}
