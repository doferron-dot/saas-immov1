/**
 * Petit graphique en lignes en SVG pur, sans dépendance externe (pas de librairie de
 * graphiques ajoutée pour un affichage simple à 9 points par série) — entièrement
 * rendu côté serveur, pas de JS nécessaire côté client.
 */
export interface PointGraphique {
  x: number;
  y: number;
}

export interface SerieGraphique {
  label: string;
  couleur: string;
  points: PointGraphique[];
}

export function GraphiqueLignes({
  titre,
  series,
  formaterY,
  hauteur = 220,
}: {
  titre: string;
  series: SerieGraphique[];
  formaterY: (valeur: number) => string;
  hauteur?: number;
}) {
  const largeur = 640;
  const marge = { haut: 16, bas: 26, gauche: 68, droite: 12 };
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
    <div className="flex flex-col gap-2 text-zinc-700 dark:text-zinc-300">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{titre}</p>
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} className="w-full" role="img" aria-label={titre}>
        {yMin < 0 && (
          <line
            x1={marge.gauche}
            y1={yEch(0)}
            x2={largeur - marge.droite}
            y2={yEch(0)}
            stroke="currentColor"
            strokeOpacity={0.25}
          />
        )}
        <text x={2} y={yEch(yMax) + 4} fontSize={10} fill="currentColor" opacity={0.7}>
          {formaterY(yMax)}
        </text>
        <text x={2} y={yEch(yMin) + 4} fontSize={10} fill="currentColor" opacity={0.7}>
          {formaterY(yMin)}
        </text>

        {series.map((s) => (
          <polyline
            key={s.label}
            fill="none"
            stroke={s.couleur}
            strokeWidth={2}
            points={s.points.map((p) => `${xEch(p.x)},${yEch(p.y)}`).join(" ")}
          />
        ))}
        {series.flatMap((s) =>
          s.points.map((p) => (
            <circle key={`${s.label}-${p.x}`} cx={xEch(p.x)} cy={yEch(p.y)} r={2.5} fill={s.couleur} />
          ))
        )}

        {(series[0]?.points ?? []).map((p) => (
          <text
            key={`x-${p.x}`}
            x={xEch(p.x)}
            y={hauteur - 6}
            fontSize={10}
            textAnchor="middle"
            fill="currentColor"
            opacity={0.7}
          >
            {p.x}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap gap-4 text-xs">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.couleur }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
