# Analyse Immo — SaaS d'analyse d'opérations immobilières

Outil d'aide à la décision pour investisseurs locatifs et marchands de biens.
Voir `docs/ANALYSE_ET_ARCHITECTURE_V1.md` pour l'architecture complète et les décisions déjà validées.

## État actuel (Étape 7 : formulaire détaillé d'une opération + résultats)

- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind CSS — déployé sur Vercel, base de données Supabase (région EU)
- Moteur de calcul (`lib/calc-engine/`) **complet** pour la V1 : acquisition, travaux, financement,
  échéancier de crédit mois par mois, fiscalité des loyers, mode investisseur, mode marchand de
  biens, scénarios, solveur de prix d'achat maximum, score 0-100, projection pluriannuelle,
  estimation indicative de l'impôt sur la plus-value immobilière à la revente. 100% déterministe
  (aucune IA), 203 tests unitaires.
- Authentification Supabase Auth (email + mot de passe) : inscription, connexion, déconnexion,
  réinitialisation de mot de passe. Protection des routes via `proxy.ts` (le fichier `middleware.ts`
  est déprécié en Next.js 16, remplacé par `proxy.ts`).
- Dashboard : liste des opérations de l'utilisateur + création (mode investisseur/marchand). RLS
  multi-tenant strict (chaque utilisateur ne voit que ses propres données).
- Page d'une opération (`/operations/[id]`) : formulaire complet (informations du bien, acquisition,
  travaux par lignes, financement, données spécifiques investisseur/marchand) + carte de résultats
  calculée en direct (coût total, mensualité, rendement/cash-flow ou marge/ROI, score sur 100).
  Quand l'opération n'a pas de financement (achat comptant), la mensualité et le coût total du
  crédit affichent « Payé cash » plutôt qu'un « 0 € » ambigu — même traitement sur le rapport PDF.
  En mode investisseur : graphiques de projection sur 1/5/10/15/20/25/30/35/40 ans (valeur du bien,
  capital restant dû, cash-flow cumulé, patrimoine net en cas de revente — deux profils "prudent" et
  "optimiste"), incluant une estimation indicative de l'impôt sur la plus-value. Curseur interactif
  (souris ou tactile) sur chaque graphique : un survol/appui affiche un repère vertical et une
  info-bulle avec la valeur exacte de chaque série à l'année la plus proche (`components/operations/
  graphique-lignes.tsx`, composant client) — vérifié en conditions réelles (page de test jetable +
  Playwright : capture avant/après survol, bord droit du graphique, relâchement du curseur).
  Nécessite une petite migration SQL supplémentaire (`frais_revente` sur `operations`, voir
  `supabase/migrations/`) à appliquer manuellement dans Supabase.
- Le rendement "net-net" du score n'utilise pas encore la fiscalité des loyers en cours de bail
  (module `fiscalite.ts` déjà codé et testé, mais pas encore branché sur le formulaire — TMI, régime
  fiscal, amortissement). L'estimation de plus-value à la revente, elle, est déjà active dans la
  projection (barème standard, hors surtaxe > 50 000 € et exonérations personnelles).
- Page `/operations/[id]/prix-max` : prix d'achat maximum pour respecter un objectif choisi
  (rendement net ou cash-flow en investisseur ; marge % ou ROI en marchand), à apport, crédit,
  travaux et loyer/revente constants — solveur par dichotomie (`lib/calc-engine/prix-max.ts`),
  déjà codé et testé, maintenant relié à une vraie page.
- Page `/operations/[id]/scenarios` (mode marchand de biens uniquement pour l'instant) : tableau
  comparant pessimiste / réaliste / optimiste (travaux, prix de revente, durée du chantier) sur
  chiffre d'affaires, marge, marge %, ROI — réutilise `lib/calc-engine/scenarios.ts`.
- Export PDF (`/operations/[id]/pdf`, lien « Télécharger le rapport PDF » sur la page de
  l'opération) : rapport A4 (résumé financier, score détaillé, scénarios en mode marchand,
  tableaux de projection prudent/optimiste en mode investisseur) généré côté serveur avec
  `@react-pdf/renderer` (`renderToBuffer` dans un Route Handler). Aucun calcul dans
  `lib/pdf/rapport.tsx` : uniquement de la mise en page à partir des résultats déjà calculés.
  Pas de graphiques dans le PDF pour l'instant (tableaux à la place) — react-pdf ne rend pas
  facilement le SVG utilisé pour les graphiques HTML de la page de l'opération. Vérifié en
  conditions réelles (build de production + serveur `next start` local, PDF généré et son
  en-tête `%PDF-1.3` contrôlé) — la génération elle-même ne dépend pas de Supabase, seul le
  chargement des données de l'opération en amont en dépend (non testable depuis cet
  environnement, voir plus bas).
- Hypothèses de la projection (valorisation du bien, indexation loyer/charges, frais de revente
  estimés) modifiables directement sur la page de l'opération, profil par profil (prudent /
  optimiste) — formulaire GET sous les graphiques, aucune migration nécessaire
  (`lib/calc-engine/projection.ts` accepte maintenant des hypothèses personnalisées en plus des
  valeurs par défaut). Le lien « Télécharger le rapport PDF » reprend automatiquement les mêmes
  hypothèses personnalisées que celles affichées à l'écran (paramètres de requête partagés via
  `lib/operations/parametres-projection.ts`, testé indépendamment).
- Le rapport PDF inclut maintenant les mêmes 3 graphiques de projection que la page de
  l'opération (`lib/pdf/graphique-pdf.tsx`, primitives Svg de `@react-pdf/renderer`), vérifiés
  visuellement (relecture de PDF générés en conditions réelles). Cette vérification a permis de
  repérer et corriger un bug de police : `toLocaleString("fr-FR")` insère une espace fine
  insécable que la police PDF par défaut ne sait pas afficher (elle apparaissait comme un « / »
  cassé, ex. « 200/000 € ») — corrigé dans `lib/pdf/formatage.ts`, testé.
- Mode marchand de biens : le bien peut être mis en location pendant la période de détention
  avant la revente (un marchand a jusqu'à ~5 ans pour vendre — demande de Dorian, 2026-09-01).
  Section « Location avant revente » facultative sur le formulaire de l'opération (mêmes champs
  que le mode investisseur : loyer, charges, taxe foncière, assurance PNO, frais de gestion,
  entretien, vacance locative — plus une durée en mois), stockée dans
  `operation_marchand_location` (migration `20260901090000_add_operation_marchand_location.sql`,
  à appliquer manuellement dans Supabase comme les migrations précédentes). Le revenu locatif net
  (loyers encaissés − charges, hors coût du crédit déjà compté à part) est ajouté à la marge —
  `lib/calc-engine/marchand.ts`, réutilise `calculerInvestisseur` déjà testé, visible partout où
  la marge apparaît (page de l'opération, page Scénarios, rapport PDF, prix d'achat maximum).
  Durée à 0 ou section non renseignée = comportement inchangé (revenu locatif nul), pas de
  migration de données nécessaire pour les opérations existantes.
- Refonte UX/UI « pro dense mais coloré » (demande de Dorian, 2026-09-01) du tableau de bord et de
  la page d'une opération : en-tête commun (`components/layout/app-header.tsx`) partagé via un
  layout de groupe de routes (`app/(app)/layout.tsx`, ne change aucune URL —
  `app/dashboard` → `app/(app)/dashboard`, `app/operations` → `app/(app)/operations`), palette
  accent indigo réservée aux actions/branding (distincte du vert/rouge déjà utilisé pour le sens
  financier positif/négatif), mode marchand toujours identifié en ambre. Tableau de bord : liste
  resserrée avec puce colorée par mode et badge de statut. Page d'une opération : score sur 100
  affiché en pastille colorée (vert ≥70, ambre ≥40, rouge <40), points forts/vigilance en puces
  colorées, formulaire réorganisé avec en-têtes de section colorés. Chaque champ du formulaire dont
  le calcul dépend d'une hypothèse automatique (frais de notaire, fiscalité des loyers hors calcul,
  base de calcul des frais de gestion/entretien, ordre d'application de la vacance locative, marge
  pour imprévus travaux, non double-comptage du revenu locatif net en mode marchand avec le coût du
  crédit) affiche maintenant une phrase explicative sous le champ — pour que Dorian sache ce que
  l'algorithme prend déjà en compte sans avoir à lire le code. Vérifié visuellement en conditions
  réelles (pages de test jetables + captures Playwright, thème clair et sombre). Connexion/
  inscription et pages secondaires (scénarios, prix maximum) pas encore retouchées — à faire une
  fois cette première direction validée par Dorian.
- Pas encore : fiscalité des loyers dans le formulaire, page Scénarios pour le mode investisseur
  (le cahier des charges ne précise pas de levier équivalent à la revente — à valider avec
  Dorian avant de câbler quoi que ce soit), Stripe.

## Développement

```bash
npm install
npm run dev          # serveur de développement (http://localhost:3000)
npm run test         # tests du moteur de calcul + validation (Vitest)
npm run build        # build de production
```

`.env.local` (non commité) à créer à partir de `.env.example` une fois le projet Supabase configuré.

## Structure

```
app/                          pages et layouts (App Router)
  (auth)/login|signup|reset-password/   pages d'authentification
  auth/callback/               échange du code PKCE Supabase (confirmation email, reset password)
  (app)/layout.tsx             en-tête commun (groupe de routes, ne change aucune URL)
  (app)/dashboard/             liste des opérations + création
  (app)/operations/[id]/       page d'une opération : formulaire, résultats, projection
lib/calc-engine/               moteur de calcul — fonctions pures, testées, aucune IA (voir son README)
lib/db/supabase/               clients Supabase (browser + server + rafraîchissement de session)
lib/db/operations.ts           CRUD sur la table operations (aucun calcul ici)
lib/auth/                      Server Actions, validation, Data Access Layer (vérification de session)
lib/operations/actions.ts      Server Actions liées aux opérations
lib/pdf/                       export PDF (mise en page uniquement, aucun calcul)
components/layout/             en-tête, éléments de mise en page partagés
components/                    composants UI réutilisables
supabase/migrations/           schéma de base de données versionné (appliqué en production)
scripts/                       scripts ponctuels (ex: test d'intégration RLS — voir son en-tête
                                pour la limitation réseau de l'environnement cloud)
docs/                          documents de référence du projet
proxy.ts                       protection des routes + rafraîchissement de session (racine du projet)
```
