/**
 * Rapport PDF d'une opération — export via app/operations/[id]/pdf/route.ts
 * (Route Handler Next.js 16, renderToBuffer de @react-pdf/renderer).
 *
 * Ce module ne fait AUCUN calcul financier : il reçoit en entrée le résultat déjà
 * calculé par lib/operations/calculer-resultats.ts (et, en mode marchand,
 * lib/operations/calculer-scenarios-marchand.ts) et se contente de le mettre en page.
 * Même principe que les pages Server Components : composition, pas de calcul.
 *
 * Imports relatifs (pas d'alias "@/") : même convention que le reste de lib/, pour que
 * ce fichier reste importable depuis un futur test Vitest sans dépendre de la résolution
 * d'alias de chemin (voir vitest.config.ts).
 *
 * La projection pluriannuelle inclut les mêmes 3 graphiques que la page de l'opération
 * (lib/pdf/graphique-pdf.tsx, primitives Svg/Polyline/Circle de @react-pdf/renderer — pas
 * un <svg> HTML, react-pdf ne sait pas le rendre directement), suivis des tableaux
 * détaillés (mêmes chiffres, pour la lecture précise à l'impression).
 */
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { GraphiquePdf } from "./graphique-pdf";
// Formatage (euros, %, date) extrait dans lib/pdf/formatage.ts -- fichier .ts pur (sans
// JSX ni dépendance à @react-pdf/renderer) pour rester testable par Vitest. Voir ce
// fichier pour le détail du contournement de police (espace fine insécable non rendue).
import { formaterEuro, formaterPct, formaterEuroCompact, formaterDate } from "./formatage";
import type { Operation } from "../db/operations";
import type { ResultatsOperation } from "../operations/calculer-resultats";
import type { ResultatScenarioMarchand, TypeScenarioMarchand } from "../operations/calculer-scenarios-marchand";
import type { PointProjection, ProfilProjection, ProjectionParProfil } from "../calc-engine/projection";

export { formaterEuro, formaterPct, formaterEuroCompact, formaterDate } from "./formatage";

const COULEUR_PRUDENT = "#71717a";
const COULEUR_OPTIMISTE = "#16a34a";
const COULEUR_CREDIT = "#dc2626";

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, fontSize: 10, color: "#18181b" },
  enTete: { marginBottom: 18, borderBottom: 1, borderColor: "#e4e4e7", paddingBottom: 12 },
  titre: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  sousTitre: { fontSize: 10, color: "#71717a" },
  section: { marginBottom: 16 },
  titreSection: { fontSize: 12, fontWeight: 700, marginBottom: 8, color: "#18181b" },
  grille: { flexDirection: "row", flexWrap: "wrap" },
  chiffre: { width: "33%", marginBottom: 8, paddingRight: 8 },
  chiffreLibelle: { fontSize: 8, color: "#71717a", marginBottom: 2 },
  chiffreValeur: { fontSize: 12, fontWeight: 700 },
  scoreLigne: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  scoreTotal: { fontSize: 20, fontWeight: 700 },
  listeItem: { fontSize: 9, marginBottom: 2 },
  table: { width: "100%", marginTop: 4 },
  ligneTableau: { flexDirection: "row", borderBottom: 1, borderColor: "#f0f0f0", paddingVertical: 4 },
  enTeteTableau: { flexDirection: "row", borderBottom: 1, borderColor: "#d4d4d8", paddingBottom: 4, marginBottom: 2 },
  celluleTexte: { flex: 2, fontSize: 9, color: "#3f3f46" },
  celluleTexteEnTete: { flex: 2, fontSize: 8, color: "#71717a", fontWeight: 700 },
  celluleNombre: { flex: 1, fontSize: 9, textAlign: "right" },
  celluleNombreEnTete: { flex: 1, fontSize: 8, color: "#71717a", fontWeight: 700, textAlign: "right" },
  note: { fontSize: 8, color: "#a1a1aa", marginTop: 4, lineHeight: 1.4 },
  piedDePage: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#a1a1aa",
    textAlign: "center",
    borderTop: 1,
    borderColor: "#f0f0f0",
    paddingTop: 6,
  },
});

function Chiffre({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <View style={styles.chiffre}>
      <Text style={styles.chiffreLibelle}>{libelle}</Text>
      <Text style={styles.chiffreValeur}>{valeur}</Text>
    </View>
  );
}

function PiedDePage() {
  return (
    <Text style={styles.piedDePage} fixed>
      Rapport généré automatiquement le {formaterDate(new Date())} — document indicatif à usage
      d&apos;aide à la décision, ne constitue pas un conseil financier, fiscal ou juridique.
    </Text>
  );
}

const LIBELLE_SCENARIO: Record<TypeScenarioMarchand, string> = {
  pessimiste: "Pessimiste",
  "réaliste": "Réaliste",
  optimiste: "Optimiste",
};

function TableauScenarios({ scenarios }: { scenarios: ResultatScenarioMarchand[] }) {
  const lignes: { libelle: string; valeurs: (s: ResultatScenarioMarchand) => string }[] = [
    { libelle: "Chiffre d'affaires total", valeurs: (s) => formaterEuro(s.detail.chiffreAffairesTotal) },
    { libelle: "Total travaux", valeurs: (s) => formaterEuro(s.totalTravaux) },
    ...(scenarios.some((s) => s.detail.revenuLocatifNet > 0)
      ? [
          {
            libelle: "Revenu locatif net (avant revente)",
            valeurs: (s: ResultatScenarioMarchand) => formaterEuro(s.detail.revenuLocatifNet),
          },
        ]
      : []),
    { libelle: "Coût total de l'opération", valeurs: (s) => formaterEuro(s.detail.coutTotalOperation) },
    { libelle: "Marge", valeurs: (s) => formaterEuro(s.detail.marge) },
    { libelle: "Marge %", valeurs: (s) => formaterPct(s.detail.margePct) },
    { libelle: "ROI", valeurs: (s) => formaterPct(s.detail.roi) },
  ];
  return (
    <View style={styles.table}>
      <View style={styles.enTeteTableau}>
        <Text style={styles.celluleTexteEnTete}>Indicateur</Text>
        {scenarios.map((s) => (
          <Text key={s.type} style={styles.celluleNombreEnTete}>
            {LIBELLE_SCENARIO[s.type]}
          </Text>
        ))}
      </View>
      {lignes.map((ligne) => (
        <View key={ligne.libelle} style={styles.ligneTableau}>
          <Text style={styles.celluleTexte}>{ligne.libelle}</Text>
          {scenarios.map((s) => (
            <Text key={s.type} style={styles.celluleNombre}>
              {ligne.valeurs(s)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const LIBELLE_PROFIL: Record<ProfilProjection, string> = { prudent: "Prudent", optimiste: "Optimiste" };

function TableauProjection({ profil, points }: { profil: ProfilProjection; points: PointProjection[] }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 9, fontWeight: 700, marginBottom: 4 }}>Profil {LIBELLE_PROFIL[profil]}</Text>
      <View style={styles.table}>
        <View style={styles.enTeteTableau}>
          <Text style={styles.celluleNombreEnTete}>Année</Text>
          <Text style={styles.celluleNombreEnTete}>Valeur du bien</Text>
          <Text style={styles.celluleNombreEnTete}>Capital restant dû</Text>
          <Text style={styles.celluleNombreEnTete}>Cash-flow cumulé</Text>
          <Text style={styles.celluleNombreEnTete}>Impôt plus-value est.</Text>
          <Text style={styles.celluleNombreEnTete}>Patrimoine net</Text>
        </View>
        {points.map((p) => (
          <View key={p.annee} style={styles.ligneTableau}>
            <Text style={styles.celluleNombre}>{p.annee} ans</Text>
            <Text style={styles.celluleNombre}>{formaterEuro(p.valeurBien)}</Text>
            <Text style={styles.celluleNombre}>{formaterEuro(p.capitalRestantDu)}</Text>
            <Text style={styles.celluleNombre}>{formaterEuro(p.cashFlowCumule)}</Text>
            <Text style={styles.celluleNombre}>{formaterEuro(p.impotPlusValueEstime)}</Text>
            <Text style={styles.celluleNombre}>{formaterEuro(p.patrimoineNet)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Mêmes 3 graphiques que ProjectionSection sur la page de l'opération (mêmes séries,
 * mêmes couleurs), rendus avec les primitives SVG de @react-pdf/renderer plutôt que du
 * SVG HTML — voir lib/pdf/graphique-pdf.tsx. */
function ProjectionGraphiquesPdf({ projection }: { projection: ProjectionParProfil }) {
  return (
    <View style={{ marginBottom: 6 }}>
      <GraphiquePdf
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
      <GraphiquePdf
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
      <GraphiquePdf
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
    </View>
  );
}

export interface RapportOperationProps {
  operation: Operation;
  resultats: ResultatsOperation;
  scenariosMarchand?: ResultatScenarioMarchand[] | null;
  /** Aucun financement saisi (pas de ligne financement, ou montant emprunté à 0) : achat
   * comptant — affiche "Payé cash" plutôt qu'un "0 €", même traitement que la page de
   * l'opération (app/operations/[id]/page.tsx). */
  payeCash: boolean;
}

export function RapportOperation({ operation, resultats, scenariosMarchand, payeCash }: RapportOperationProps) {
  const adresseLigne = [operation.adresse, operation.code_postal, operation.ville].filter(Boolean).join(" ");

  return (
    <Document
      title={`Rapport — ${operation.nom}`}
      author="Analyse Immo"
      subject="Rapport d'analyse d'opération immobilière"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.enTete}>
          <Text style={styles.titre}>{operation.nom}</Text>
          <Text style={styles.sousTitre}>
            Mode {operation.mode === "investisseur" ? "investisseur locatif" : "marchand de biens"}
            {adresseLigne ? ` · ${adresseLigne}` : ""} · Rapport généré le {formaterDate(new Date())}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.titreSection}>Résumé financier</Text>
          <View style={styles.grille}>
            <Chiffre libelle="Prix d'achat" valeur={formaterEuro(operation.prix_achat)} />
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
                <Chiffre libelle="Cash-flow mensuel" valeur={formaterEuro(resultats.investisseur.cashFlowMensuel)} />
              </>
            )}
            {resultats.marchand && (
              <>
                <Chiffre libelle="Chiffre d'affaires total" valeur={formaterEuro(resultats.marchand.chiffreAffairesTotal)} />
                {resultats.marchand.revenuLocatifNet > 0 && (
                  <Chiffre
                    libelle="Revenu locatif net (avant revente)"
                    valeur={formaterEuro(resultats.marchand.revenuLocatifNet)}
                  />
                )}
                <Chiffre libelle="Marge" valeur={formaterEuro(resultats.marchand.marge)} />
                <Chiffre libelle="Marge %" valeur={formaterPct(resultats.marchand.margePct)} />
                <Chiffre libelle="ROI" valeur={formaterPct(resultats.marchand.roi)} />
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.titreSection}>Score</Text>
          <View style={styles.scoreLigne}>
            <Text style={styles.scoreTotal}>{Math.round(resultats.score.total)} / 100</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.enTeteTableau}>
              <Text style={styles.celluleTexteEnTete}>Critère</Text>
              <Text style={styles.celluleNombreEnTete}>Points</Text>
            </View>
            {resultats.score.sousScores.map((s) => (
              <View key={s.critere} style={styles.ligneTableau}>
                <Text style={styles.celluleTexte}>{s.critere}</Text>
                <Text style={styles.celluleNombre}>
                  {Math.round(s.points * 10) / 10} / {s.pointsMax}
                </Text>
              </View>
            ))}
          </View>
          {resultats.score.pointsForts.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 9, fontWeight: 700, color: "#15803d", marginBottom: 2 }}>Points forts</Text>
              {resultats.score.pointsForts.map((p) => (
                <Text key={p} style={styles.listeItem}>
                  • {p}
                </Text>
              ))}
            </View>
          )}
          {resultats.score.pointsVigilance.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 9, fontWeight: 700, color: "#b45309", marginBottom: 2 }}>
                Points de vigilance
              </Text>
              {resultats.score.pointsVigilance.map((p) => (
                <Text key={p} style={styles.listeItem}>
                  • {p}
                </Text>
              ))}
            </View>
          )}
          <Text style={styles.note}>
            Barème proposé par défaut ({operation.mode === "investisseur" ? "6" : "6"} critères pondérés), seuils
            encore à affiner. {operation.mode === "investisseur" &&
              "Rendement calculé hors fiscalité des loyers pour l'instant (LMNP, micro-foncier... arrivera dans une prochaine étape). "}
            La sensibilité « scénario pessimiste » compare le réalisé saisi à une dégradation par
            défaut des hypothèses (loyer/revente −10 %, charges/travaux +15 %).
          </Text>
        </View>

        {scenariosMarchand && scenariosMarchand.length > 0 && (
          <View style={styles.section} break={false}>
            <Text style={styles.titreSection}>Scénarios (pessimiste / réaliste / optimiste)</Text>
            <TableauScenarios scenarios={scenariosMarchand} />
            <Text style={styles.note}>
              Pessimiste : travaux +15 %, revente −10 %, durée du chantier +6 mois. Optimiste : travaux
              −5 %, revente +5 %, durée −3 mois. Le prix d&apos;achat et les frais d&apos;acquisition
              restent constants dans les 3 scénarios.
            </Text>
          </View>
        )}

        {resultats.projection && (
          <View style={styles.section} break>
            <Text style={styles.titreSection}>Projection pluriannuelle</Text>
            <Text style={styles.note}>
              Deux profils : prudent (bien +1,5 %/an, loyers +1 %/an) et optimiste (bien +2 %/an,
              loyers +1,5 %/an). Le patrimoine net inclut une estimation indicative de l&apos;impôt sur
              la plus-value (barème standard, hors surtaxe &gt; 50 000 € et exonérations personnelles) et
              les frais de revente estimés (6 %).
            </Text>
            <View style={{ marginTop: 8 }}>
              <ProjectionGraphiquesPdf projection={resultats.projection} />
              <TableauProjection profil="prudent" points={resultats.projection.prudent} />
              <TableauProjection profil="optimiste" points={resultats.projection.optimiste} />
            </View>
          </View>
        )}

        <PiedDePage />
      </Page>
    </Document>
  );
}
