# Guide — création des comptes GitHub, Supabase, Vercel

Trois comptes gratuits à créer, dans cet ordre. Compte 15-20 minutes au total.
Reviens vers moi avec les éléments demandés en gras à chaque étape — je m'occupe du reste.

## 1. GitHub (dépôt du code)

1. Va sur [github.com](https://github.com) → "Sign up" (si tu n'as pas déjà de compte)
2. Une fois connecté, clique sur "+" en haut à droite → "New repository"
3. Nom du dépôt : `saas-immo` (ou ce que tu préfères) — **coche "Private"** (le code ne doit pas être public)
4. Ne coche PAS "Add a README" (le projet existe déjà de mon côté) → "Create repository"
5. Pour que je puisse pousser le code moi-même sans que tu aies à taper une seule commande :
   - Va dans tes paramètres de compte → **Settings → Developer settings → Personal access tokens → Fine-grained tokens**
   - "Generate new token"
   - **Repository access : "Only select repositories"** → sélectionne uniquement `saas-immo`
   - **Permissions → Contents : Read and write** (rien d'autre n'est nécessaire)
   - Génère le token, copie-le (il ne sera affiché qu'une seule fois)

**À me donner :** l'URL du dépôt (ex. `github.com/tonpseudo/saas-immo`) + le token généré.
Le token est limité à ce seul dépôt — tu pourras le révoquer à tout moment depuis cette même page.

## 2. Supabase (base de données + authentification)

1. Va sur [supabase.com](https://supabase.com) → "Start your project" → connecte-toi avec ton compte GitHub (le plus simple)
2. "New project" :
   - Nom : `saas-immo`
   - Mot de passe de base de données : génère-en un fort (bouton dédié), **note-le en lieu sûr** (gestionnaire de mots de passe) — je n'en ai pas besoin, mais toi si un jour tu dois y accéder directement
   - **Region : choisis une région en Europe** (ex. "EU West (Ireland/Paris)") — important pour la conformité RGPD, tes données restent en UE
3. Une fois le projet créé (ça prend ~2 minutes), va dans **Project Settings → API**
4. Tu y trouveras trois valeurs :
   - **Project URL**
   - **anon / public key**
   - **service_role key** (cliquer sur "Reveal" pour l'afficher — à ne jamais rendre publique)

**À me donner :** ces trois valeurs (tu peux me les coller directement ici, cette conversation reste privée).

## 3. Vercel (hébergement / déploiement automatique)

1. Va sur [vercel.com](https://vercel.com) → "Sign up" → connecte-toi avec ton compte GitHub
2. "Add New..." → "Project" → sélectionne le dépôt `saas-immo` (une fois que j'y aurai poussé le code)
3. Vercel détecte automatiquement Next.js — pas besoin de configurer quoi que ce soit
4. Avant de cliquer "Deploy", ajoute les variables d'environnement (section "Environment Variables") avec les mêmes valeurs que Supabase ci-dessus : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
5. "Deploy"

Pas besoin de me donner d'accès Vercel — une fois connecté à GitHub, chaque mise à jour que je pousse se déploie automatiquement, tu n'as plus rien à faire. Je te donnerai un rappel précis pour cette étape 3 une fois que le code sera prêt à être testé en ligne (elle vient après l'étape 2, une fois que j'aurai le dépôt GitHub et la base Supabase).

---

**Pour l'instant** : étape 1 (GitHub) et étape 2 (Supabase) suffisent pour que je puisse pousser le code et connecter la vraie base de données. L'étape 3 (Vercel) peut attendre que j'aie quelque chose de concret à déployer.
