# Addendum — fiscalité en V1 (suite à ta demande de l'intégrer dès la V1)

Tu as choisi la fiscalité complète dès la V1 plutôt que de la reporter en V2. Je respecte ce choix,
mais avant de coder `lib/calc-engine/fiscalite.ts`, il faut cadrer précisément ce que "complet" veut dire —
la fiscalité immobilière française a plusieurs niveaux de précision possibles.

## Ce que je propose de couvrir en V1

Régimes du mode investisseur locatif :
- **Location nue, micro-foncier** (abattement forfaitaire 30%)
- **Location nue, régime réel** (charges réelles déductibles + déficit foncier)
- **LMNP (meublé), micro-BIC** (abattement forfaitaire 50%)
- **LMNP (meublé), régime réel simplifié** — amortissement **linéaire global** du bien (hors terrain, non amortissable) et du mobilier, **sans décomposition par composant** (structure/toiture/façade amortis séparément)

Paramètres utilisateur : **tranche marginale d'imposition (TMI)** saisie manuellement (0/11/30/41/45%) plutôt que recalculée à partir d'une simulation complète du foyer fiscal (ça demanderait de connaître tous ses revenus, sa situation familiale, etc. — hors sujet de cet outil). Prélèvements sociaux à 17,2% (taux en vigueur).

## Ce que je propose de NE PAS couvrir en V1 (à ajouter plus tard si besoin réel)

- **LMNP réel avec décomposition par composant** (amortir séparément structure, toiture, façade, agencements...) — c'est ce qu'un expert-comptable fait pour optimiser finement, avec des durées d'amortissement qui varient selon des choix propres à chaque dossier. Le simplifier en une formule générique donnerait un faux sentiment de précision.
- **SCI à l'IS** — fiscalité des sociétés, hors périmètre "investisseur particulier"
- Situations spécifiques (déficit foncier reporté sur plusieurs années, plus-value à la revente, etc.)

Avec cette approche, l'outil donne un **rendement net-net réaliste et défendable** pour la grande majorité des cas (immobilier locatif détenu en nom propre), sans prétendre remplacer un expert-comptable sur les montages avancés — et je le dis clairement dans l'interface ("simulation indicative, ne remplace pas un conseil professionnel personnalisé"), comme toute app de ce type le fait.

## Décision : LMNP réel décomposé par composant, validé

Tu as choisi le LMNP réel décomposé. Voici la décomposition retenue (sourcée, vérifiée aujourd'hui — voir sources en bas), avec des valeurs par défaut **modifiables par opération**, exactement comme les frais de notaire :

| Composant | Part de la valeur du bâti (hors terrain) | Durée d'amortissement par défaut |
|---|---|---|
| Terrain | 15% du prix total (non amortissable, exclu de la base) | — |
| Gros œuvre / structure | 40% | 50 ans |
| Toiture / étanchéité | 20% | 25 ans |
| Installations techniques (élec/plomberie/chauffage) | 20% | 20 ans |
| Agencements / second œuvre (cuisine, sols, peinture...) | 20% | 12 ans |
| Mobilier (ligne séparée, montant réel saisi, pas un %) | — | 7 ans par défaut |

**Règle fiscale importante, implémentée** : en LMNP réel, l'amortissement ne peut jamais créer ou aggraver un déficit — il est plafonné pour ramener le résultat fiscal à 0, et l'excédent non utilisé est reportable sans limite de temps sur les années suivantes.

**Simplification assumée pour la V1** : le calcul est fait "en régime de croisière" (une année type), sans faire tourner une simulation année par année sur toute la durée de détention. Le montant d'amortissement reporté est affiché comme information, mais n'est pas encore réinjecté automatiquement dans le calcul d'une "année suivante" — ça demanderait une vraie simulation pluriannuelle, une fonctionnalité à part entière que je propose de garder pour une itération ultérieure plutôt que de la faire à moitié maintenant. Je le signale clairement dans l'interface.

Même logique côté location nue au réel : le déficit foncier est plafonné à 10 700 €/an imputable sur le revenu global (hors intérêts d'emprunt, qui ne sont déductibles que des revenus fonciers), le surplus est reportable 10 ans — implémenté pour une année type, même limite de simplification que ci-dessus.

## Sources vérifiées aujourd'hui

- [Amortissement LMNP par composants — lmnp.paris](https://lmnp.paris/amortissement-lmnp-par-composants/)
- [Amortissement du gros œuvre LMNP — lmnp.ai](https://lmnp.ai/amortissement-gros-oeuvre-lmnp)
