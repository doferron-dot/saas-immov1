# Moteur de calcul

Règle absolue (section 9 et 22 du cahier des charges) : **aucune dépendance à l'IA ici**.
Uniquement des fonctions pures, déterministes, testées. Aucun import de composant React,
aucun accès réseau ou base de données dans ce dossier.

Modules prévus (voir `docs/ANALYSE_ET_ARCHITECTURE_V1.md` section 6 pour les formules) :

- `acquisition.ts` — frais de notaire (DMTO + émoluments + débours), coût total d'acquisition
- `travaux.ts` — total travaux + imprévus
- `financement.ts` — mensualité, coût du crédit, gestion du différé
- `fiscalite.ts` — régimes (micro-foncier, réel-foncier, LMNP micro-BIC, LMNP réel) — **à cadrer avec Dorian avant implémentation** (voir addendum fiscalité)
- `investisseur.ts` — rendement brut/net/net-net, cash-flow
- `marchand.ts` — marge, ROI, multi-lots
- `scenarios.ts` — pessimiste / réaliste / optimiste (réutilise les modules ci-dessus)
- `prix-max.ts` — solveur par dichotomie
- `score.ts` — score 0-100 documenté et transparent

Chaque module a son fichier de test associé dans `__tests__/`.
