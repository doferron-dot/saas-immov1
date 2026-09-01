"use client";

/**
 * Petit graphique en lignes en SVG pur, sans dépendance externe (pas de librairie de
 * graphiques ajoutée pour un affichage simple à 9 points par série).
 *
 * "use client" + useState : ajouté à la demande de Dorian pour un curseur interactif qui
 * se balade sur les points et affiche la valeur exacte de chaque série à l'année survolée
 * (auparavant, seuls le min et le max de l'axe Y étaient lisibles). Les données ne sont
 * connues qu'aux années échantillonnées (ANNEES_PROJECTION_DEFAUT, ex: 1/5/10/15/20/25/
 * 30/35/40 ans) — pas de valeur réelle entre deux points — donc le curseur "aimante" sur
 * l'année la plus proche plutôt que d'interpoler une valeur qui n'existe pas.
 * Fonctionne à la souris (survol) et au tactile (appui), pas de dépendance externe.
 */
import { useState, type PointerEvent as ReactPointerEvent } from "react";

export interface PointGraphique {
  x: number;
  y: number;
}

export interface SerieGraphique {
  label: string;
  couleur: string;
  points: PointGraphique[];
}

// Formatage euro compact (ex: "441,6 k €") — identique à formaterEuroCompact() de la page
// serveur qui affiche ces graphiques. Dupliqué ici plutôt que reçu en prop : une fonction ne
// peut pas être passée d'un Server Component à un Client Component en Next.js App Router
// (seules les valeurs sérialisables traversent la frontière), et les 3 usages actuels de ce
// composant utilisent tous ce même formatage — cf. grep "formaterY={" sur page.tsx.
function formaterEuroCompact(valeur: number): string {
  return valeur.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

export function GraphiqueLignes({
  titre,
  series,
  hauteur = 220,
}: {
  titre: string;
  series: SerieGraphique[];
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

  // Toutes les séries partagent le même jeu d'années (voir les appelants) — on prend la
  // première série non vide comme référence pour la liste des "x" cliquables/survolables.
  const anneesDisponibles = (series.find((s) => s.points.length > 0)?.points ?? []).map((p) => p.x);

  const [indexSurvole, setIndexSurvole] = useState<number | null>(null);

  function gererPointer(evenement: ReactPointerEvent<SVGSVGElement>) {
    if (anneesDisponibles.length === 0) return;
    const rect = evenement.currentTarget.getBoundingClientRect();
    // Position du pointeur en coordonnées du viewBox (le SVG est redimensionné en CSS,
    // il faut donc remettre à l'échelle par rapport à sa taille réelle affichée).
    const xViewBox = ((evenement.clientX - rect.left) / rect.width) * largeur;
    // Aimante sur l'année la plus proche du pointeur.
    let meilleurIndex = 0;
    let meilleureDistance = Infinity;
    anneesDisponibles.forEach((annee, i) => {
      const distance = Math.abs(xEch(annee) - xViewBox);
      if (distance < meilleureDistance) {
        meilleureDistance = distance;
        meilleurIndex = i;
      }
    });
    setIndexSurvole(meilleurIndex);
  }

  const anneeSurvolee = indexSurvole !== null ? anneesDisponibles[indexSurvole] : null;
  const xSurvole = anneeSurvolee !== null ? xEch(anneeSurvolee) : null;

  // Tooltip : positionné à droite du curseur, ou à gauche si trop proche du bord droit
  // du graphique pour ne pas sortir du cadre.
  const largeurTooltip = 150;
  const hauteurTooltip = 14 + series.length * 12;
  const tooltipADroite = xSurvole !== null && xSurvole + 10 + largeurTooltip <= largeur - marge.droite;
  const tooltipX =
    xSurvole !== null ? (tooltipADroite ? xSurvole + 10 : xSurvole - 10 - largeurTooltip) : 0;
  const tooltipY = marge.haut;

  return (
    <div className="flex flex-col gap-2 text-zinc-700 dark:text-zinc-300">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{titre}</p>
      <svg
        viewBox={`0 0 ${largeur} ${hauteur}`}
        className="w-full touch-none"
        role="img"
        aria-label={titre}
        onPointerMove={gererPointer}
        onPointerDown={gererPointer}
        onPointerLeave={() => setIndexSurvole(null)}
      >
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
          {formaterEuroCompact(yMax)}
        </text>
        <text x={2} y={yEch(yMin) + 4} fontSize={10} fill="currentColor" opacity={0.7}>
          {formaterEuroCompact(yMin)}
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

        {xSurvole !== null && anneeSurvolee !== null && (
          <>
            <line
              x1={xSurvole}
              y1={marge.haut}
              x2={xSurvole}
              y2={hauteur - marge.bas}
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeDasharray="3 3"
            />
            {series.map((s) => {
              const point = s.points[indexSurvole!];
              if (!point) return null;
              return (
                <circle
                  key={`survol-${s.label}`}
                  cx={xEch(point.x)}
                  cy={yEch(point.y)}
                  r={4.5}
                  fill={s.couleur}
                  stroke="white"
                  strokeWidth={1.5}
                />
              );
            })}

            <g transform={`translate(${tooltipX}, ${tooltipY})`}>
              <rect
                width={largeurTooltip}
                height={hauteurTooltip}
                rx={4}
                fill="currentColor"
                className="text-white dark:text-zinc-900"
                fillOpacity={0.95}
                stroke="currentColor"
                strokeOpacity={0.15}
              />
              <text x={8} y={13} fontSize={10} fontWeight={600} className="fill-zinc-900 dark:fill-zinc-100">
                Année {anneeSurvolee}
              </text>
              {series.map((s, i) => {
                const point = s.points[indexSurvole!];
                if (!point) return null;
                return (
                  <text key={s.label} x={8} y={13 + (i + 1) * 12} fontSize={9} fill={s.couleur} fontWeight={600}>
                    {s.label} : {formaterEuroCompact(point.y)}
                  </text>
                );
              })}
            </g>
          </>
        )}
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
