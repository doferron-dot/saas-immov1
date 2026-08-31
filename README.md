# Analyse Immo — SaaS d'analyse d'opérations immobilières

Outil d'aide à la décision pour investisseurs locatifs et marchands de biens.
Voir `docs/ANALYSE_ET_ARCHITECTURE_V1.md` pour l'architecture complète et les décisions déjà validées.

## État actuel (Étape 3-4 : structure du projet + Git)

- Next.js (App Router) + TypeScript + Tailwind CSS
- Moteur de calcul (`lib/calc-engine/`) : `acquisition.ts` et `travaux.ts` implémentés et testés
- Client Supabase (browser + server) prêt (`lib/db/supabase/`), pas encore connecté à un vrai projet Supabase
- Pas encore d'authentification, de dashboard ni de formulaires — prochaines étapes

## Développement

```bash
npm install
npm run dev        # serveur de développement (http://localhost:3000)
npm run test        # tests du moteur de calcul (Vitest)
npm run build        # build de production
```

`.env.local` (non commité) à créer à partir de `.env.example` une fois le projet Supabase configuré.

## Structure

```
app/                 pages et layouts (App Router)
lib/calc-engine/      moteur de calcul — fonctions pures, testées, aucune IA (voir son README)
lib/db/supabase/     clients Supabase (browser + server)
lib/pdf/              export PDF (à venir)
components/           composants UI réutilisables
supabase/migrations/  schéma de base de données versionné (à venir)
docs/                  documents de référence du projet
```
