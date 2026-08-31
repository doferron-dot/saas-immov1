# SaaS Analyse d'Opérations Immobilières — Étape 1 : Analyse + Étape 2 : Architecture proposée

Document de référence, rédigé par Claude avant tout code, conformément à la méthode demandée (section 26-28 du cahier des charges). À valider avant de démarrer l'Étape 3 (structure du projet).

---

## 0. Avis direct avant de commencer

Deux points francs, dans l'esprit de nos échanges précédents :

**Dispersion.** Ce projet s'ajoute à JARVIS (Phase 1 livrée), l'outil de gestion locative Excel/Canva, et l'ebook frontalier — en plus de ton poste à temps plein (8h-20h). Ce ne sont pas des petits projets : chacun est un vrai chantier. Je ne te dis pas d'arrêter celui-ci — le cahier des charges est sérieux et cohérent — mais tu ne pourras pas les faire avancer tous à la même vitesse. Si tu veux, dis-moi lequel est réellement prioritaire cette semaine, ça m'évite de te proposer des plans ambitieux sur 4 fronts en parallèle.

**Scope V1.** Contrairement à JARVIS, ton découpage en 18 étapes ici est déjà bien pensé (auth avant dashboard, mode investisseur avant mode marchand, tests avant Stripe). Je ne le simplifie pas — je le suis tel quel. Le seul vrai risque : c'est un chantier de plusieurs semaines de développement effectif (même avec moi qui code), pas de quelques jours comme le cœur minimal de JARVIS. Je le dis pour que l'attente soit calibrée, pas pour te décourager.

---

## 1. Ambiguïtés, risques, choix techniques, éléments manquants

### Ambiguïtés à trancher

1. **Frais de notaire — ancien vs neuf.** Le formulaire (section 6) liste "type de bien" mais pas explicitement "ancien / neuf / VEFA". Or ça change le calcul du tout au tout : ~7-8 % du prix dans l'ancien contre ~2-3 % dans le neuf (vérifié à l'instant, sources en bas de ce document). **Proposition : ajouter un champ "ancien / neuf" au formulaire**, indispensable pour un calcul correct.
2. **"Rendement net-net" (section 10).** Le sens usuel inclut la fiscalité (impôt sur le revenu + prélèvements sociaux, régime LMNP/nu, micro/réel...). Or la fiscalité avancée est explicitement en V2 (section 23). **Proposition pour la V1 : "net-net" = net de charges + vacance locative + frais de gestion, hors fiscalité**, avec une mention claire "hors impôt, fiscalité disponible en V2" pour ne jamais laisser croire à un chiffre plus précis qu'il ne l'est. À valider — c'est un point sensible pour un outil destiné à de vrais investisseurs.
3. **Différé de prêt (section 9).** Différé "total" (rien n'est payé, intérêts capitalisés) ou "partiel" (seuls les intérêts sont payés) ? Ce sont deux calculs différents. Proposition : gérer les deux via un paramètre simple, avec "aucun" par défaut.
4. **Score (section 14).** Les critères sont listés mais pas les poids. Je propose un barème complet plus bas (section 6 de ce document) — à valider ou ajuster.
5. **Prix d'achat maximum (section 13).** Ce n'est pas une simple formule algébrique inversée : les frais de notaire dépendent du prix, le financement peut dépendre du prix (si l'apport est fixe), etc. **Proposition technique : un solveur numérique (dichotomie)** qui teste des prix jusqu'à trouver celui qui respecte l'objectif — robuste, déterministe, testable, et qui continuera à marcher même quand la fiscalité (V2) complexifiera les formules. Une résolution algébrique "à la main" serait plus fragile à chaque évolution du moteur de calcul.

### Risques

- **Exposition financière réelle.** Si un vrai investisseur base une décision d'achat sur un bug de calcul, c'est un vrai préjudice. Je m'en tiens strictement à ta règle : moteur 100 % déterministe, testé avant chaque mise en prod d'un calcul. Non négociable de mon côté aussi.
- **Précision des barèmes légaux.** Frais de notaire, droits de mutation (DMTO) : je les ai vérifiés aujourd'hui (sources en bas), mais ce sont des taux réglementaires qui varient par département et évoluent par décret. **Je les intègre comme hypothèses par défaut, modifiables** (conforme à ta section 7 : "ne jamais cacher un calcul, l'utilisateur doit pouvoir modifier les hypothèses") plutôt que comme valeurs figées en dur.
- **RGPD / mentions légales.** Un outil "réellement commercialisable" avec comptes utilisateurs et données financières nécessitera, avant d'onboarder de vrais clients (pas pour le développement) : CGU, mentions légales, politique de confidentialité, hébergement des données en UE. Pas bloquant pour coder la V1, mais à ne pas oublier avant la commercialisation réelle.
- **Structure pour encaisser du paiement.** Stripe (même activé plus tard) suppose une structure légale pour toi (auto-entrepreneur ou société) pour percevoir de l'argent. Pas bloquant maintenant (le paiement reste désactivé en V1), mais à anticiper.

### Choix techniques que je propose de trancher maintenant

- **Stack : je valide la tienne sans alternative** (Next.js/TypeScript/Tailwind/Supabase/Vercel/GitHub). C'est un choix cohérent et adapté : Supabase donne Postgres + Auth + RLS en un seul service (moins de pièces à faire tourner), Vercel déploie Next.js sans configuration serveur à gérer — pertinent vu que c'est moi qui maintiens tout et que tu ne veux pas gérer d'infrastructure.
- **Export PDF : `@react-pdf/renderer`** (génération PDF en JS pur). Alternative écartée : Puppeteer/Chrome headless — plus lourd, moins fiable sur l'hébergement serverless de Vercel.
- **Tests : Vitest** pour le moteur de calcul (rapide, standard avec Next.js/TypeScript).
- **Où vit le code : dans mon environnement de travail cloud, pas sur ton PC.** Contrairement à JARVIS (outil local Python), ce projet est nativement pensé pour le cloud (GitHub + Vercel + Supabase) : je développe ici, je pousse sur un dépôt GitHub que tu crées (ou auquel tu me donnes accès), et le déploiement se fait automatiquement sur Vercel à chaque mise à jour. Ça évite complètement le problème rencontré avec JARVIS (Git bloqué sur la connexion à ton PC) — cette architecture n'a pas besoin de ton PC du tout pour fonctionner.

### Éléments manquants dans le cahier des charges

- Nom du produit / nom de domaine → pas bloquant, à définir plus tard
- Devise/marché : je pars sur France/EUR uniquement pour la V1 (pas de Suisse/CHF) sauf indication contraire
- Méthode de connexion : je propose email + mot de passe (Supabase Auth), + lien magique en option — pas d'OAuth (Google...) en V1, ajoutable facilement plus tard
- Logo/branding sur le PDF → différé, un export sobre et propre suffit pour la V1

---

## 2. Architecture technique

```
Frontend + Backend  : Next.js 15 (App Router) + TypeScript, déployé sur Vercel
UI                  : Tailwind CSS + composants accessibles (Radix UI en dessous)
Base de données     : PostgreSQL géré par Supabase
Auth                : Supabase Auth (email/mot de passe + lien magique)
Sécurité données    : Row Level Security (RLS) Postgres — chaque ligne appartient à un user_id, policy stricte
Moteur de calcul    : package TypeScript indépendant (aucune dépendance UI, aucun accès réseau), 100% testable isolément
Export PDF          : @react-pdf/renderer
Tests               : Vitest (moteur de calcul + logique métier), Playwright plus tard pour les tests end-to-end si besoin
Paiement (préparé)  : Stripe, désactivé en V1 (table "plans" avec prix configurables, pas de blocage de fonctionnalité)
Dépôt / CI          : GitHub (déploiement auto Vercel à chaque push sur main)
```

**Séparation stricte des responsabilités** (conforme à ta section 19) :
- `lib/calc-engine/` : uniquement des fonctions pures (entrée → sortie), zéro import UI, zéro accès base de données. Chaque formule est testable seule.
- `app/` : uniquement de l'affichage et de la collecte de données, aucun calcul financier écrit directement dans un composant.
- `lib/db/` : accès Supabase, jamais mélangé avec le moteur de calcul.

**Accès dont j'ai besoin de ta part pour aller jusqu'au déploiement** (pas nécessaire pour commencer à coder, seulement pour pousser en ligne) :
- Un compte GitHub (gratuit) — je peux te guider pour le créer si tu n'en as pas
- Un compte Supabase (gratuit pour démarrer) + création d'un projet
- Un compte Vercel (gratuit pour démarrer), connecté à ton dépôt GitHub

Je peux commencer à développer dans mon environnement sans attendre ces comptes — je n'en ai besoin qu'au moment de connecter la vraie base de données et de déployer en ligne.

---

## 3. Schéma de base de données (proposé)

```sql
profiles
  id (uuid, = auth.users.id)
  email
  plan            -- 'free' | 'pro' | 'business'
  created_at

operations
  id (uuid)
  user_id (uuid, FK profiles) -- RLS : user ne voit que ses lignes
  mode               -- 'investisseur' | 'marchand'
  nom
  statut             -- 'brouillon' | 'actif' | 'archivé'
  favori (bool)
  -- informations du bien
  adresse, ville, code_postal, type_bien, ancien_ou_neuf,
  surface, pieces, chambres, etage, ascenseur, parking, cave, dpe
  -- acquisition
  prix_achat, frais_agence, frais_agence_inclus (bool),
  taux_dmto, taux_emoluments_config, frais_dossier, frais_garantie, autres_frais_acquisition
  created_at, updated_at

travaux_lignes
  id, operation_id (FK)
  categorie          -- gros_oeuvre | technique | interieur | autre
  sous_categorie     -- démolition, électricité, peinture...
  montant

financement
  id, operation_id (FK, unique)
  apport, montant_emprunte, taux, duree_mois, assurance_taux,
  differe_type ('aucun'|'partiel'|'total'), differe_mois, frais_bancaires

operation_investisseur   -- présent seulement si mode = investisseur
  id, operation_id (FK, unique)
  loyer_mensuel, charges_recuperables, charges_non_recuperables,
  taxe_fonciere, assurance_pno, frais_gestion_pct, entretien_pct, vacance_locative_pct, autres_charges

operation_marchand_lots  -- 0..n lignes si mode = marchand
  id, operation_id (FK)
  nom_lot, type_lot, prix_revente_prevu

scenarios              -- 3 lignes générées par opération (pessimiste/réaliste/optimiste)
  id, operation_id (FK)
  type ('pessimiste'|'réaliste'|'optimiste')
  parametres (jsonb)   -- deltas appliqués, modifiables
  resultats (jsonb)    -- snapshot calculé (cache, recalculable)

plans                  -- table de config, prix jamais en dur dans le code
  id, nom, prix_mensuel, prix_annuel, limites (jsonb)
```

---

## 4. Arborescence du projet (proposée)

```
saas-immo/
  app/
    (auth)/login/  (auth)/signup/  (auth)/reset-password/
    dashboard/
    operations/[id]/          # édition d'une opération, par sections (formulaire multi-étapes)
    operations/[id]/pdf/      # génération export
  lib/
    calc-engine/
      acquisition.ts
      travaux.ts
      financement.ts
      investisseur.ts        # rendement, cash-flow
      marchand.ts            # marge, ROI, multi-lots
      scenarios.ts
      prix-max.ts             # solveur
      score.ts
      __tests__/              # un fichier de test par module ci-dessus
    db/
      supabase-client.ts
      operations.ts            # requêtes CRUD, jamais de calcul ici
    pdf/
      rapport.tsx
  components/                 # UI réutilisable (formulaires, cartes résultats, etc.)
  supabase/
    migrations/                # schéma versionné, appliqué via Supabase CLI
  __tests__/
```

---

## 5. Écrans de la V1

1. Connexion / inscription / mot de passe oublié
2. Dashboard (liste des opérations, résumé, bouton "+ Nouvelle opération")
3. Création d'opération — choix du mode (investisseur / marchand)
4. Formulaire "Informations du bien" (par sections, pas 40 champs d'un coup)
5. Formulaire "Acquisition" (hypothèses visibles et modifiables)
6. Formulaire "Travaux" (par catégories, total + imprévus 10 % par défaut)
7. Formulaire "Financement"
8. Formulaire spécifique investisseur (loyers/charges) OU marchand (lots)
9. Page "Scénarios" (comparaison pessimiste/réaliste/optimiste)
10. Page "Prix d'achat maximum" (objectif modifiable + explication)
11. Page "Résultat / synthèse" (le résumé décisionnel, avec score)
12. Export PDF
13. Réglages du compte (suppression de compte incluse, cf. sécurité section 20)

---

## 6. Moteur de calcul — formules

### Acquisition
```
frais_dmto = prix_achat × taux_dmto              # défaut : 5,80665% ancien / ~0,715% neuf (modifiable)
emoluments_ht = barème dégressif du notaire :
   3,870% jusqu'à 6 500 €
   1,596% de 6 500 à 17 000 €
   1,064% de 17 000 à 60 000 €
   0,799% au-delà de 60 000 €
emoluments_ttc = emoluments_ht × 1,20            # TVA 20% sur les émoluments uniquement
frais_notaire_total = frais_dmto + emoluments_ttc + débours (~1% forfaitaire, modifiable)
cout_total_acquisition = prix_achat + frais_notaire_total + frais_agence (si non inclus)
                        + frais_dossier + frais_garantie + autres_frais
```
*(barème et taux vérifiés aujourd'hui, sources en bas de document — configurables dans l'app, pas figés dans le code)*

### Travaux
```
total_travaux = somme des lignes par catégorie
imprévus = total_travaux × taux_imprévus (10% par défaut, modifiable)
total_travaux_avec_imprevus = total_travaux + imprévus
```

### Financement
```
mensualité = montant_emprunté × (taux_mensuel × (1+taux_mensuel)^n) / ((1+taux_mensuel)^n - 1)
  (formule standard d'amortissement ; gestion différé partiel/total en amont du calcul)
cout_total_credit = (mensualité × n) - montant_emprunté  + assurance + frais_bancaires
montant_total_investi = apport + cout_total_credit + frais_bancaires
```

### Mode investisseur
```
rendement_brut = (loyer_mensuel × 12) / cout_total_acquisition
charges_annuelles = charges_non_récupérables + taxe_fonciere + assurance_pno
                   + frais_gestion + entretien + (loyer×12×vacance_locative_pct) + autres
rendement_net = (loyers_annuels - charges_annuelles) / cout_total_acquisition
rendement_net_net = idem net, hors fiscalité (voir ambiguïté #2 ci-dessus)
cash_flow_mensuel = loyer_mensuel - charges_mensuelles - mensualité_credit
cash_flow_annuel = cash_flow_mensuel × 12
```

### Mode marchand de biens
```
chiffre_affaires_total = somme(prix_revente_prevu des lots)
cout_total_operation = cout_total_acquisition + travaux + cout_total_credit + frais_revente
marge = chiffre_affaires_total - cout_total_operation
marge_pct = marge / chiffre_affaires_total
roi = marge / montant_total_investi
```

### Scénarios
```
pessimiste : revente -10% | travaux +15% | durée +6 mois → recalcul complet
réaliste   : valeurs saisies par l'utilisateur
optimiste  : revente +5% | travaux -5% | durée réduite → recalcul complet
```
(deltas par défaut, modifiables — les trois scénarios réutilisent exactement les mêmes fonctions de calcul, juste avec des entrées différentes : aucune duplication de logique)

### Prix d'achat maximum
Solveur par dichotomie sur `prix_achat` : cherche la valeur maximale telle que l'objectif choisi (marge cible %, rendement cible %, ou cash-flow cible) reste respecté, en réutilisant le moteur de calcul principal. Explication générée en langage clair (comme demandé en section 13).

### Score (proposition à valider)
Barème sur 100, poids par mode :

*Investisseur :* rendement net-net (25), cash-flow (25), marge de sécurité/apport (15), niveau d'endettement (15), montant travaux vs budget (10), sensibilité au scénario pessimiste (10)
*Marchand :* marge % (30), ROI (25), marge de sécurité (15), niveau d'endettement (15), montant travaux vs budget (5), sensibilité au scénario pessimiste (10)

Chaque sous-critère a un barème documenté en commentaire dans le code (seuils clairs, ex. "rendement net-net ≥ 6% → 25/25, entre 4-6% → linéaire, <4% → 0"). Points forts/vigilance/risques générés automatiquement à partir des sous-scores.

---

## 7. Sources vérifiées aujourd'hui (barèmes)

- [Barème des frais de notaire 2026 — Pretto](https://www.pretto.fr/notaire-immobilier/frais-de-notaire/bareme-frais-de-notaire/)
- [Frais de notaire dans l'ancien 2026 — Empruntis](https://www.empruntis.com/financement/simulation-frais-notaire/quand-payer-frais-notaire/frais-notaire-ancien/)
- [Droits de mutation (DMTO) 2026 — être propriétaire](https://etreproprietaire.fr/capacite-achat/frais-notaire/droits-mutation-titre-onereux-dmto-calcul-definition-taux)
- [DMTO par département 2026 — CPIM](https://www.cpim.fr/droits-mutation-immobilier-2026/)

*(Ces taux varient par département et par décret — ils sont implémentés comme hypothèses par défaut modifiables dans l'application, jamais comme valeurs figées.)*
