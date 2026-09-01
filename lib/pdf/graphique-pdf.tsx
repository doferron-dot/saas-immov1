/**
 * Équivalent, en primitives SVG de @react-pdf/renderer, du graphique en lignes de
 * components/operations/graphique-lignes.tsx (rendu HTML/navigateur). Même mathématique
 * de mise à l'échelle (linéaire, mêmes marges relatives) pour que le PDF ressemble
 * visuellement à ce qui est affiché à l'écran — mais react-pdf ne sait pas rendre un
 * <svg> HTML directement, d'où ce composant séparé utilisant les primitives Svg/
 * Polyline/Circle/Text de @react-pdf/renderer plutôt que du SVG natif.
 *
 * Aucun calcul financier ici : uniquement de la mise à l'échelle géométrique de points
 * déjà calculés (lib/calc-engine/projection.ts).
 */
import { Svg, Polyline, Circle, Line, Text, View } from "@react-pdf/renderer";

export interface PointGraphiquePdf {
  x: number;
  y: number;
}

export interface SerieGraphiquePdf {
  label: string;
  couleur: string;
  points: PointGraphiquePdf[];
}

const COULEUR_TEXTE = "#71717a";

export function GraphiquePdf({
  titre,
  series,
  formaterY,
  hauteur = 130,
}: {
  titre: string;
  series: SerieGraphiquePdf[];
  formaterY: (valeur: number) => string;
  hauteur?: number;
}) {
  const largeur = 500;
  const marge = { haut: 10, bas: 18, gauche: 46, droite: 8 };
  const zoneL = largeur - marge.gauche - marge.droite;
  const zoneH = hauteur - marge.haut - marge.bas;

  const tousXs = series.flatMap((s) => s.points.map((p) => p.x));
  const tousYs = series.flatMap((s) => s.points.map((p) => p.y));
  const xMin = tousXs.length > 0 ? Math.min(...tousXs) : 0;
  const xMax = tousXs.length > 0 ? Math.max(...tousXs) : 1;
  let yMin = Math.min(0, ...(tousYs.length > 0 ? tousYs : [0]));
  let yMax = Math.max(0, ...(tousYs.length > 0 ? tousYs : [1]));
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }

  const xEch = (x: number) => marge.gauche + ((x - xMin) / (xMax - xMin || 1)) * zoneL;
  const yEch = (y: number) => marge.haut + zoneH - ((y - yMin) / (yMax - yMin || 1)) * zoneH;

  return (
    <View style={{ marginBottom: 10 }} wrap={false}>
      <Text style={{ fontSize: 9, fontWeight: 700, marginBottom: 3 }}>{titre}</Text>
      <Svg width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`}>
        {yMin < 0 && (
          <Line
            x1={marge.gauche}
            y1={yEch(0)}
            x2={largeur - marge.droite}
            y2={yEch(0)}
            stroke={COULEUR_TEXTE}
            strokeOpacity={0.3}
            strokeWidth={0.5}
          />
        )}
        <Text x={2} y={yEch(yMax) + 3} style={{ fontSize: 6, fill: COULEUR_TEXTE }}>
          {formaterY(yMax)}
        </Text>
        <Text x={2} y={yEch(yMin) + 3} style={{ fontSize: 6, fill: COULEUR_TEXTE }}>
          {formaterY(yMin)}
        </Text>

        {series.map((s) => (
          <Polyline
            key={s.label}
            fill="none"
            stroke={s.couleur}
            strokeWidth={1.5}
            points={s.points.map((p) => `${xEch(p.x)},${yEch(p.y)}`).join(" ")}
          />
        ))}
        {series.flatMap((s) =>
          s.points.map((p) => (
            <Circle key={`${s.label}-${p.x}`} cx={xEch(p.x)} cy={yEch(p.y)} r={1.5} fill={s.couleur} />
          ))
        )}

        {(series[0]?.points ?? []).map((p) => (
          <Text
            key={`x-${p.x}`}
            x={xEch(p.x)}
            y={hauteur - 4}
            textAnchor="middle"
            style={{ fontSize: 6, fill: COULEUR_TEXTE }}
          >
            {p.x}
          </Text>
        ))}
      </Svg>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 2 }}>
        {series.map((s) => (
          <View key={s.label} style={{ flexDirection: "row", alignItems: "center", marginRight: 10 }}>
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: s.couleur, marginRight: 3 }} />
            <Text style={{ fontSize: 7, color: COULEUR_TEXTE }}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
