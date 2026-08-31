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
 * Choix volontaire : pas de graphiques dans le PDF. @react-pdf/renderer ne sait pas
 * facilement rendre un <svg> arbitraire comme components/operations/graphique-lignes.tsx
 * (fait pour le rendu HTML/navigateur) — le rapport présente donc la projection sous
 * forme de tableaux (mêmes chiffres, lisibles à l'impression). À revoir si Dorian préfère
 * de vrais graphiques dans le PDF plus tard (composants <Svg>/<Path> dédiés à écrire).
 */
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { Operation } from "../db/operations";
import type { ResultatsOperation } from "../operations/calculer-resultats";
import type { ResultatScenarioMarchand, TypeScenarioMarchand } from "../operations/calculer-scenarios-marchand";
import type { PointProjection, ProfilProjection } from "../calc-engine/projection";

function formaterEuro(valeur: number): string {
  return valeur.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function formaterPct(valeur: number): string {
  return `${(valeur * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function formaterDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

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

export interface RapportOperationProps {
  operation: Operation;
  resultats: ResultatsOperation;
  scenariosMarchand?: ResultatScenarioMarchand[] | null;
}

export function RapportOperation({ operation, resultats, scenariosMarchand }: RapportOperationProps) {
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
            <Chiffre libelle="Mensualité crédit" valeur={formaterEuro(resultats.mensualiteCredit)} />
            <Chiffre libelle="Coût total du crédit" valeur={formaterEuro(resultats.coutTotalCredit)} />
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
