# Journal des décisions et des écarts — DIABACAR

> Créé conformément à `dev.md` §2 : « Consigner le conflit avec ses conséquences dans `docs/decisions.md` ».
> Le schéma `prisma/schema.prisma` est une **proposition de référence non validée** (`dev.md` §2).
> Les écarts documentaires exhaustifs (E01–E31) et les règles de migration/seeds exigées par les documents sont conservés en annexe à la fin de ce fichier.

## Partie A — Décisions techniques prises (réversibles, aucun arbitrage produit requis)

| # | Sujet | Décision | Justification |
| --- | --- | --- | --- |
| T01 | Outil de migration unique | **Prisma Migrate** est la source de vérité du schéma ; les objets que Prisma n'exprime pas (contraintes `CHECK`, index partiels, trigger `auth.users`, RLS, policies, buckets Storage) sont ajoutés dans des **migrations SQL versionnées du même dossier** `prisma/migrations/`, appliquées par le même outil. Le SQL de structure est produit par `prisma migrate diff --from-empty --to-schema-datamodel`, jamais écrit à la main, pour éviter toute dérive schéma/SQL. | `dev.md` §10 impose une seule procédure de migration ; RLS et contraintes sont exigées par les docs 06/07/12 et ne sont pas exprimables en Prisma. |
| T02 | Ordre et découpage des migrations | L'ordre documenté `M01 → M05` (doc 08) est conservé : `M01` extensions/enums/profils/rôles/permissions, `M02` référentiels/véhicules/images/documents, `M03` favoris/recherches/prospects/demandes/commandes/événements, `M04` journaux d'état + audit + contraintes SQL + index et unicités, `M05` RLS + fonctions + buckets Storage. | Les dépendances de clés étrangères respectent déjà cet ordre ; aucune raison de dévier. |
| T03 | Liaison `auth.users` ↔ `profiles` | Trigger SQL `AFTER INSERT ON auth.users` **idempotent** (`ON CONFLICT (auth_user_id) DO NOTHING`) créant `profiles` (`CUSTOMER`, `ACTIVE`) puis `customer_profiles`, plus une fonction de réparation des comptes orphelins. `user_type` et `status` ne sont **jamais** lus depuis `raw_user_meta_data` ni depuis un champ éditable par l'utilisateur. | Doc 06 : création de profil « idempotente via mécanisme serveur ou trigger maîtrisé », « contrôler les comptes orphelins » ; doc 06 et `dev.md` §6 : aucune attribution STAFF/ADMIN depuis des métadonnées éditables. |
| T04 | Vérification des montants | Contraintes `CHECK` : `vehicles.public_price >= 0`, `vehicles.reseller_price >= 0`, `orders.agreed_price >= 0`, `custom_requests.budget_min >= 0`, `budget_max >= 0`, et cohérence `budget_min <= budget_max` lorsque les deux sont renseignés. | Doc 07 : « contraintes CHECK SQL pour montants non négatifs, dates cohérentes et statut ». |
| T05 | Audit append-only | `audit_logs` : `REVOKE UPDATE, DELETE` + trigger `BEFORE UPDATE OR DELETE` levant une exception, en plus de l'absence de toute méthode de modification dans le service. | Doc 07 (« append only »), doc 12 (« audit append-only »). |
| T06 | Index manquants | Ajout des index sur clés étrangères non couvertes (`staff_profiles.role_id`, `leads.customer_id`, `leads.vehicle_id`, `orders.vehicle_id`, `audit_logs.actor_profile_id`, `custom_requests.customer_id`) et d'un index partiel catalogue `vehicles (published_at DESC) WHERE status = 'PUBLISHED'`. | Doc 07 : « index sur clés étrangères, statut, publication, localisation, marque, prix et date de création » ; `dev.md` §9. |
| T07 | Format des migrations | Dossiers horodatés Prisma (`AAAAMMJJHHMMSS_nom`) avec le libellé documentaire en clair (`m01_identite`, `m02_referentiels`, …). | Doc 08 ne fixe aucune convention (E20) ; format imposé par l'outil retenu en T01. |
| T08 | Limitation de fréquence | Limiteur à fenêtre fixe, en mémoire, seuils paramétrés par variables d'environnement (`RATE_LIMIT_*`), désactivé hors production sauf activation explicite. | Doc 12 impose la mesure mais ne chiffre aucun seuil ; valeurs **à valider** (D07). |
| T09 | Durée des URL signées | Paramétrée (`STORAGE_SIGNED_URL_TTL_SECONDS`, 300 s par défaut). | Doc 06 : « URL signée courte durée » sans valeur (D08). |
| T10 | Tests nécessitant une base | Les règles métier sont testées unitairement via des ports (interfaces), sans base. Les tests d'intégration Prisma/RLS/Storage sont écrits mais **non exécutés** faute de base non productive accessible ; ils sont marqués comme tels dans le rapport de lot. | `dev.md` §12 : ne pas annoncer une vérification non exécutée ; `dev.md` §10 : ne pas développer contre la production. |
| T11 | Erreurs fonctionnelles | Codes d'erreur imposés par le doc 05 centralisés dans `lib/errors.ts` (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT`, `RATE_LIMITED`) ; enveloppe de réponse normalisée `data` / `error { code, message, correlationId }` au niveau route/Server Action, jamais au niveau service. Aucun détail SQL ni trace interne renvoyé au client. Un code technique supplémentaire `INTERNAL` (non fonctionnel, non documenté) sert uniquement aux défaillances inattendues : le message reste générique et la cause est conservée côté serveur. | Doc 05 (contrat transversal), doc 02 (« la réponse d'un accès interdit ne doit exposer ni l'existence d'une ressource privée ni aucun détail interne »). |
| T12 | Ordre de contrôle serveur | Toute opération privée suit l'ordre imposé : session → statut du compte → permission → portée/propriété → validation → exécution + audit dans une transaction. Implémenté dans un unique garde `requireStaff` / `requireCustomer` pour empêcher toute divergence entre Server Actions et Route Handlers. | `dev.md` §6 ; doc 05. |
| T13 | Enveloppe unique pour toutes les Server Actions | Les actions d'authentification et celles de My DIABACAR renvoient la même enveloppe `data { message, … }` / `error { code, message, correlationId, fields? }`. Les anciennes formes ad hoc (`{ status, message, fields }`) sont supprimées. | T11 (doc 05) : une seule forme de réponse, un seul endroit où les erreurs sont normalisées ; évite qu'un formulaire affiche un échec comme un succès. |
| T14 | Permission d'entrée du back-office | `/admin` exige `requireStaff(actor, "vehicle.view")` : la plus faible permission opérationnelle, présente chez ADMIN et chez le COMMERCIAL provisoire (D01). Le portail n'affiche que l'état d'attente du lot ; aucun écran d'administration n'est ouvert aux commerciaux. | Doc 02 §Acteurs : « Commercial — back-office opérationnel selon habilitation » ; une porte sur `analytics.view` ou `audit.view` exclurait tout commercial du back-office, ce que les documents n'énoncent pas. |
| T15 | Contrôle anti-dérive de la matrice de droits | `tests/unit/seed-data.test.ts` échoue si un droit du rôle ADMIN ou COMMERCIAL, la liste des 26 permissions ou la correspondance avec `services/permissions.service.ts` changent sans décision mise à jour. | E15/E16 : la matrice provisoire D01 doit rester explicite et vérifiée, jamais modifiée silencieusement. |

## Partie B — Décisions produit en attente (arbitrage DIABACAR requis)

Application provisoire : **la solution la plus restrictive** (refus par défaut). Les travaux qui n'en dépendent pas continuent.

| # | Question | Écart lié | Conséquence si non tranchée | Solution provisoire appliquée |
| --- | --- | --- | --- | --- |
| D01 | **Matrice rôle → permission** : les documents nomment `ADMIN` et `COMMERCIAL` et listent 26 permissions, sans donner la répartition. | E15, E16 | Le seed ne peut pas attribuer un jeu de droits sans arbitrage. | `ADMIN` reçoit les 26 permissions (doc 02 : « Oui » sur toute sa matrice). `COMMERCIAL` reçoit uniquement ce que les documents ne qualifient **pas** de « sur habilitation » : `vehicle.view`, `customer.view`, `lead.view`, `lead.assign`, `lead.update`, `order.view`, `order.create`, `order.update`, `reseller.view`. Les actions « sur habilitation » (création/publication/prix véhicule, `customer.edit`) ne sont **pas** accordées par défaut ; les interdictions explicites (`reseller.approve|reject|suspend`, `user.manage`, `role.manage`, `settings.manage`, `audit.view`) sont respectées. Matrice isolée dans `prisma/seed-data.ts` pour un ajustement en une ligne. |
| D02 | **Correspondance libellés ↔ codes de rôle** (« Commercial »/« Administrateur » vs `COMMERCIAL`/`ADMIN`). | E16 | Incohérence entre habilitations et rôles. | Commercial = `COMMERCIAL`, Administrateur = `ADMIN` (seule lecture compatible avec les deux documents). |
| D03 | **Attribution d'un rôle au personnel** : qui valide, quelles préconditions, révocation. | E16 | Le back-office ne peut pas être outillé. | Gardes `user.manage` / `role.manage` (doc 02) + audit systématique ; le workflow d'approbation reste à définir. |
| D04 | **Amorçage du premier compte STAFF/ADMIN** : doc 08 le prévoit « hors dépôt » sans procédure. | E19 | Blocage du premier accès back-office. | Commande documentée `npm run staff:grant` (serveur, `SUPABASE_SERVICE_ROLE_KEY` requis, aucun mot de passe géré, refuse la production par défaut). |
| D05 | **Champs exacts des formulaires Auth**, politique de mot de passe, vérification e-mail. | — | Contrat des formulaires non figé. | Schémas Zod minimaux (e-mail valide, mot de passe ≥ 8 caractères) ; vérification e-mail laissée à la configuration Supabase Auth. |
| D06 | **Périmètre d'audit** : inscription, connexion et édition du profil personnel ne sont pas listées par les docs 02/12. | — | Sur- ou sous-journalisation. | Sont audités : rôle/permission du personnel, statut de compte, statut Revendeur, prix véhicule, publication/réservation/vente, paramètres. Ne sont **pas** audités : édition du profil personnel, authentification. |
| D07 | **Seuils de limitation de fréquence** (auth, inscription, récupération, endpoints sensibles). | — | Protection anti-abus non calibrée. | Paramètres par défaut conservateurs, surchargeables (T08). |
| D08 | **Durée de l'URL signée** des documents privés. | — | Accès privé trop long ou inexploitable. | 300 s par défaut, paramétrable (T09). |
| D09 | **Plafonds d'upload** (MIME, taille, extension, dimensions, nombre). | — | Uploads non bornés. | Aucune valeur figée (doc 03 les déclare « paramètres à valider ») : à fournir avant le lot Storage. |
| D10 | **Table « prices revendeur »** (doc 06) vs `resellerPrice` sur `Vehicle` (doc 07). | — | Ambiguïté de modèle. | Schéma de référence conservé ; `reseller_price` protégé par RLS et par sélection explicite côté service. |
| D11 | **`fuel`/`transmission` en chaîne libre** alors que `dev.md` §7 exige des listes administrables. | E13 | Filtres catalogue hétérogènes. | Schéma inchangé (conforme au doc 07) ; transformation en référentiel administrable = lot catalogue. |
| D12 | **Caractéristiques automobiles administrables** : aucun modèle de données. | E12 | Fonctionnalité back-office sans support. | Non modélisé ; décision requise avant le lot catalogue. |
| D13 | **`deletedAt` (soft delete)** : évoqué sans être modélisé. | E07 | Politique de conservation non figée. | Non ajouté ; à trancher avant la production (impact migration). |
| D14 | **Liste des marques de départ et paramètres initiaux** (WhatsApp, contact, textes). | E17, E18 | Catalogue et actions de contact non amorçables. | Aucune valeur inventée ; configuration par variables d'environnement fournies par l'exploitant. |
| D15 | **Environnements** : aucune base de développement/préproduction fournie. | E25, E26 | Migrations et RLS non testées sur base réelle. | Migrations vérifiées par génération de diff ; application et tests RLS **non exécutés** (T10). |
| D16 | **Numérotation des lots** : `dev.md` §11 dit « lot 2 », le doc 10 dit « Lot 1 — Identité et sécurité ». | — | Suivi de projet ambigu. | Le contenu prime sur le numéro ; les deux appellations désignent le lot courant. |
| D17 | **Validation du schéma contre le « modèle de données initial complet »**, absent de `docs/`. | E29 | Le schéma reste une proposition. | Aucune validation possible en l'état : le schéma appliqué reste celui du doc 07, révisable par migration. |
| D18 | **Bucket `vehicle-images` public ou privé** : le doc 06 exige une « lecture publique des variantes publiées uniquement », mais un bucket `public = true` sert ses objets sans passer par RLS. | E11 | Sans arbitrage, soit des images non publiées sont accessibles par URL directe, soit toutes les images publiques exigent une URL signée (coût et cache). | Bucket créé **public** (le catalogue public doit rester rapide et cachable), avec les policies Storage qui n'autorisent l'accès authentifié qu'aux variantes `PUBLIC` de fiches `PUBLISHED`. La garantie « publiées uniquement » impose de **ne jamais déposer dans ce bucket une image non destinée au public** : les visuels non publiés restent dans un bucket privé et sont servis par URL signée. Bascule en bucket privé possible par une migration si DIABACAR préfère la garantie au niveau du stockage. |
| D19 | **Lecture client des référentiels `brands` / `vehicle_models`** : aucune policy RLS ne leur est ouverte (hors périmètre du lot identité). | — | Le catalogue public devra les lire côté serveur tant qu'aucune policy n'est décidée. | Refus par défaut conservé ; l'ouverture d'une policy `SELECT` sur les lignes `active = true` sera décidée avec le lot catalogue. |

---

# Annexe — Écarts documentaires détaillés (E01–E31) et règles exigées

> Annexe produite lors de la comparaison des documents 07/08 avec le dépôt. Conservée telle quelle comme preuve d'analyse.

## 2026-09-28 — Comparaison du schéma documenté (doc 07) avec le schéma du dépôt

**Constat** : `prisma/schema.prisma` reproduit exactement l'annexe du document 07 (10 enums, 19 modèles,
mêmes `@@unique`, `@@index`, `@@map` et relations). Aucun écart de structure.
Les écarts portent sur le **SQL complémentaire**, l'**outillage de migration** et les **seeds**,
absents du dépôt.

# Écarts entre le schéma/les procédures documentés (docs 07 et 08) et le dépôt DIABACAR

Comparaison effectuée sur `docs/07_Schema_Prisma_de_Reference.docx`, `docs/08_Migrations_et_Seeds.docx` et `prisma/schema.prisma` (Prisma 6.12.0 / `@prisma/client` 6.12.0, Next.js 15.5.26). **31 écarts** identifiés.

Légende de qualification : `à corriger maintenant` (réalisable sans arbitrage produit) — `à valider par le responsable produit` (décision requise) — `sans impact` (constat).

| # | Écart | Source documentaire | État dans le dépôt | Impact | Qualification |
| --- | --- | --- | --- | --- | --- |
| E01 | Annexe Prisma du doc 07 vs `prisma/schema.prisma` | Doc 07, annexe « Schéma Prisma proposé » | Le fichier du dépôt est **identique** à l'annexe (comparaison normalisée : modèles, champs, enums, `@map`, `@db.Uuid`, `@@unique`, `@@index`, relations). Aucun écart de structure. | Aucun. | sans impact |
| E02 | Dossier `prisma/migrations/` absent | Doc 08 §Ordre de migration (M01–M05) ; dev.md §3 et §10 | Aucune migration versionnée n'existe : le schéma n'a jamais été matérialisé en base et rien ne peut être déployé dans l'ordre exigé. | Bloquant pour le lot identité/permissions/audit. | à corriger maintenant — **corrigé (T01/T02)** |
| E03 | Contraintes CHECK SQL absentes | Doc 07, conventions | Aucune CHECK n'existe. Les montants négatifs sont acceptés. | Intégrité métier des prix non garantie. | à corriger maintenant — **corrigé (T04)** |
| E04 | Policies RLS et fonctions SQL absentes | Doc 07 ; doc 08 M05 ; dev.md §6 | Aucun `ENABLE ROW LEVEL SECURITY` ni policy. | Accès croisé possible aux données clients. | à corriger maintenant — **corrigé (M05)** |
| E05 | Liaison `auth.users` ↔ `Profile` non matérialisée | Doc 07 ; dev.md §6 | Aucune clé étrangère ni trigger de création de profil. | Profil métier non garanti à l'inscription. | à corriger maintenant — **corrigé (T03)** |
| E06 | Règle « AuditLog append only » non matérialisée | Doc 07, doc 12 | Rien n'empêche UPDATE/DELETE sur `audit_logs`. | Piste d'audit non opposable. | à corriger maintenant — **corrigé (T05)** |
| E07 | Champ `deletedAt` (soft delete) absent | Doc 07, conventions | Absent du schéma et de l'annexe. | Politique de conservation non tranchée. | à valider — **D13** |
| E08 | Enums techniques SQL de M01 non créés | Doc 08 M01 | Enums présents en Prisma, aucun `CREATE TYPE` versionné. | Ordre M01 non exécutable. | à corriger maintenant — **corrigé (M01)** |
| E09 | Index partiels absents | Doc 07 | Aucun index partiel. | Performance catalogue non garantie. | à corriger maintenant — **corrigé (T06)** |
| E10 | Index de clés étrangères manquants | Doc 07, conventions | FK non indexées : `staff_profiles.role_id`, `leads.customer_id`, `leads.vehicle_id`, `orders.vehicle_id`, `audit_logs.actor_profile_id`. | Scans séquentiels en back-office. | à corriger maintenant — **corrigé (T06)** |
| E11 | Buckets Storage non versionnés | Doc 08 M05 | 4 buckets déclarés en `.env.example`, aucune policy. | Un bucket public mal configuré exposerait des documents privés. | à corriger maintenant — **corrigé (M05)** |
| E12 | Référentiel « caractéristiques administrables » absent | Doc 08 M02 ; dev.md §4 | Aucun modèle de caractéristique. | Lot catalogue sans support. | à valider — **D12** |
| E13 | Carburant/transmission en `String` libre | Doc 07 ; dev.md §7 | Chaînes libres sans contrainte. | Filtres catalogue hétérogènes. | à valider — **D11** |
| E14 | `prisma/seed.ts` non exécutable | Doc 08 §Seeds ; dev.md §10 | Aucune écriture en base. | Rôles/permissions absents. | à corriger maintenant — **corrigé** |
| E15 | Associations rôle → permission non définies | Doc 08 §Seeds | Aucune répartition. | Attribution des droits impossible sans arbitrage. | à valider — **D01** (provisoire appliqué) |
| E16 | Rôles au-delà d'ADMIN et COMMERCIAL non documentés | Doc 08 §Seeds | Aucun rôle ne porte `content.manage`, `settings.manage`, `audit.view`, `storage.private_read`. | Granularité back-office ambiguë. | à valider — **D01/D03** |
| E17 | Liste des marques de départ NON DOCUMENTÉE | Doc 08 | Aucune marque. | Catalogue non amorçable. | à valider — **D14** |
| E18 | Paramètres initiaux NON DOCUMENTÉS | Doc 08 | Variables vides, aucune table `settings`. | Actions de contact inopérantes. | à valider — **D14** |
| E19 | Procédure du compte administrateur initial NON DOCUMENTÉE | Doc 08 | Aucune commande ni mode opératoire. | Blocage du premier accès back-office. | à valider — **D04** (commande fournie) |
| E20 | Convention de nommage des migrations NON DOCUMENTÉE | Doc 08 | Format non fixé. | Risque de migrations divergentes. | à valider — **T07** (décision technique prise) |
| E21 | Outil unique de migration non désigné | dev.md §10 ; doc 08 | Ni Prisma Migrate ni SQL manuel désigné. | Décision structurante. | à valider — **T01** (décision technique prise) |
| E22 | Scripts `prisma migrate` absents, `prisma.seed` non déclaré | Doc 08 ; dev.md §12 | Scripts absents. | Aucune application reproductible des migrations. | à corriger maintenant — **corrigé** |
| E23 | Procédure de rollback absente du dépôt | Doc 08 §Retour arrière ; dev.md §10 | Aucun document de reprise. | Pas de plan de reprise opposable. | à corriger maintenant — **corrigé (docs/exploitation-migrations.md)** |
| E24 | `docs/decisions.md` absent | dev.md §2 | Fichier absent. | Arbitrages implicites. | à corriger maintenant — **corrigé (ce fichier)** |
| E25 | Séparation dev/préproduction/production non outillée | Doc 08 ; dev.md §10 | `APP_ENV`/`ALLOW_PRODUCTION_DATABASE` non exploités par le code. | Une preview pourrait viser la base de production sans blocage. | à corriger maintenant — **corrigé (lib/env.ts, garde de migration)** |
| E26 | Tests de politiques RLS et de données post-migration absents | Doc 08 ; dev.md §12 | Seuls 3 tests unitaires de services. | Exigence doc 08 non vérifiable. | à corriger maintenant — **tests écrits, non exécutés (T10/D15)** |
| E27 | Incohérence de nommage client (`firstName`+`lastName` vs « nom ») | Doc 07 | Schéma du dépôt conforme à l'annexe. | Nommage à figer avant migration. | à valider (impact faible) |
| E28 | `RequestStatus` absent de la liste du doc 07 | Doc 07 | Enum présent et utilisé. | Aucun : écart rédactionnel. | sans impact |
| E29 | Validation du schéma contre le modèle initial impossible | Doc 07 §Validation ; dev.md §2 | Modèle initial absent de `docs/`. | Schéma non validé. | à valider — **D17** |
| E30 | Sauvegarde vérifiée et fenêtre de changement NON DOCUMENTÉES | Doc 08 §Procédure | Aucune procédure. | Prérequis de mise en production. | à valider (production) |
| E31 | `updatedAt` non appliqué uniformément | Doc 07, conventions | `Favorite`, `SavedSearch`, `OrderEvent`, `AuditLog` sans `updatedAt`. | Faible : lignes immuables par nature. | sans impact |

## Synthèse

- à corriger maintenant : **15** (dont 13 corrigés dans ce lot)
- à valider par le responsable produit : **13**
- sans impact : **3**

## Constat de fond

- `prisma/schema.prisma` **reproduit exactement** l'annexe du document 07. Aucun écart de modèle, champ, enum, contrainte, index ou relation.
- Les écarts réels portent sur le **SQL complémentaire** (CHECK, RLS, index partiels, liaison `auth.users`, Storage), l'**outillage de migration** et les **seeds**.
- Le schéma reste une **proposition de référence non validée** (`dev.md` §2) ; les arbitrages D01, D11, D12, D13, D17 doivent être tranchés avant la première application en préproduction.

## Procédure de migration exigée par les documents

**Ordre unique et identique sur tous les environnements** (doc 08) :

1. **M01** — extensions nécessaires, enums techniques, `profiles`, rôles et permissions.
2. **M02** — référentiels marques, modèles et caractéristiques ; véhicules, images, documents et prix.
3. **M03** — favoris, recherches enregistrées, prospects (`Lead`), demandes personnalisées (`CustomRequest`) et commandes.
4. **M04** — journaux d'état (`OrderEvent`), audit, contraintes SQL, index et unicités.
5. **M05** — RLS, policies, fonctions et buckets Storage ; vérifier les privilèges par rôle.

**Procédure de livraison** (doc 08) : créer la migration en développement → relire le SQL et le plan de retour → appliquer sur base de test → exécuter les tests de données et de politiques → préproduction → production avec sauvegarde vérifiée et fenêtre de changement.

**Migrations destructives** : deux temps — ajout compatible → bascule applicative → retrait ultérieur.

**Retour arrière** : rollback applicatif indépendant de la base ; une migration appliquée reste compatible avec la version précédente pendant la bascule ; restauration de sauvegarde uniquement sur décision d'incident ; après chaque migration, comparer version attendue, cardinalités, contraintes, politiques et parcours critiques.

**Environnements** : développement, préproduction et production séparés, dans le même ordre ; les previews ne doivent pas accéder à la base de production ; aucune migration de production sans autorisation explicite (`dev.md` §10).

## Règles de seeds exigées par les documents

1. **Répétabilité / idempotence** : `upsert` sur clés naturelles (`Role.code`, `Permission.code`, `RolePermission(roleId, permissionId)`), jamais de `create` nu.
2. **Aucun secret, aucun mot de passe administrateur**, aucune donnée personnelle de production.
3. **Données minimales** : rôles `ADMIN` et `COMMERCIAL`, les 26 permissions et leurs associations (cf. D01) ; marques et paramètres uniquement sur valeurs fournies par l'exploitant (D14).
4. **Compte administrateur initial hors seed** : créé via Supabase Auth, puis rattaché à un profil `STAFF` et rôle `ADMIN` (commande D04).
