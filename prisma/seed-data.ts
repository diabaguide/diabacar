/**
 * Données de référence du seed DIABACAR.
 *
 * Sources : `docs/02_Roles_et_Permissions.docx` (§« Permissions à implémenter » et §« Matrice de
 * décision ») et `docs/08_Migrations_et_Seeds.docx` (§« Seeds »), arbitrée par la décision D01 de
 * `docs/decisions.md`.
 *
 * Ce fichier ne contient QUE des données de référence : codes, libellés et matrice role → permission.
 * Aucune donnée personnelle, aucun secret, aucune marque automobile ni paramètre commercial inventé :
 * les marques de départ, la devise, le numéro WhatsApp, les textes de contact et les options de
 * publication sont fournis par l'exploitant (doc 08, docs/decisions.md D14).
 */

import type { PermissionCode } from "../services/permissions.service";

/**
 * Les 26 codes de permission officiels (doc 02 §« Permissions à implémenter »).
 *
 * Source unique de vérité partagée avec `services/permissions.service.ts` : le
 * `satisfies readonly PermissionCode[]` ci-dessous échoue à la compilation si un code est ajouté,
 * retiré ou orthographié différemment d'un côté ou de l'autre.
 */
export const PERMISSION_CODES = [
  "vehicle.view",
  "vehicle.create",
  "vehicle.edit",
  "vehicle.publish",
  "vehicle.reserve",
  "vehicle.mark_sold",
  "vehicle.price_edit",
  "customer.view",
  "customer.edit",
  "lead.view",
  "lead.assign",
  "lead.update",
  "order.view",
  "order.create",
  "order.update",
  "reseller.view",
  "reseller.approve",
  "reseller.reject",
  "reseller.suspend",
  "user.manage",
  "role.manage",
  "content.manage",
  "settings.manage",
  "analytics.view",
  "audit.view",
  "storage.private_read",
] as const satisfies readonly PermissionCode[];

/** Garantit aussi l'absence de doublon dans la liste ci-dessus (bug silencieux sinon). */
export type PermissionCodeFromSeed = (typeof PERMISSION_CODES)[number];

/**
 * Libellés français des permissions, à usage humain uniquement (le modèle `Permission` ne stocke que
 * `code`). Formulations alignées sur les libellés d'actions du doc 02 ; elles n'ont aucun effet sur
 * le contrôle d'accès.
 */
export const PERMISSION_LABELS: Record<PermissionCodeFromSeed, string> = {
  "vehicle.view": "Consulter les véhicules",
  "vehicle.create": "Créer un véhicule",
  "vehicle.edit": "Modifier un véhicule",
  "vehicle.publish": "Publier un véhicule",
  "vehicle.reserve": "Réserver un véhicule",
  "vehicle.mark_sold": "Marquer un véhicule comme vendu",
  "vehicle.price_edit": "Modifier le prix d'un véhicule",
  "customer.view": "Consulter les clients",
  "customer.edit": "Modifier les clients",
  "lead.view": "Consulter les prospects",
  "lead.assign": "Attribuer un prospect",
  "lead.update": "Mettre à jour un prospect",
  "order.view": "Consulter les commandes",
  "order.create": "Créer une commande",
  "order.update": "Mettre à jour une commande",
  "reseller.view": "Consulter les revendeurs",
  "reseller.approve": "Approuver un revendeur",
  "reseller.reject": "Refuser un revendeur",
  "reseller.suspend": "Suspendre un revendeur",
  "user.manage": "Gérer le personnel",
  "role.manage": "Gérer les rôles",
  "content.manage": "Gérer le contenu éditorial",
  "settings.manage": "Gérer les paramètres",
  "analytics.view": "Consulter les statistiques",
  "audit.view": "Consulter la piste d'audit",
  "storage.private_read": "Lire les documents privés du stockage",
};

/** Rôles de personnel prévus par les documents (doc 08 §« Seeds »). */
export type RoleCode = "ADMIN" | "COMMERCIAL";

export const ROLE_DEFINITIONS: ReadonlyArray<{ code: RoleCode; name: string }> = [
  // D02 (docs/decisions.md) : « Administrateur » = ADMIN et « Commercial » = COMMERCIAL, seule lecture
  // compatible entre les documents 02 et 08.
  { code: "ADMIN", name: "Administrateur" },
  { code: "COMMERCIAL", name: "Commercial" },
];

/** Une ligne de la matrice rôle → permission. */
export interface RolePermissionRow {
  readonly roleCode: RoleCode;
  readonly permissionCode: PermissionCodeFromSeed;
}

/**
 * Matrice rôle → permission.
 *
 * D01 (docs/decisions.md) : les documents nomment les deux rôles et les 26 permissions sans donner la
 * répartition ; application provisoire de la solution la plus restrictive. Chaque ligne ci-dessous
 * porte la justification de l'octroi. Pour ajuster un droit : ajouter ou retirer une seule ligne,
 * sans toucher au seed.
 */
export const ROLE_PERMISSION_MATRIX: ReadonlyArray<RolePermissionRow> = [
  // --- ADMIN — doc 02 §« Matrice de décision », colonne « Administrateur » : « Oui » sur les six
  //     lignes (créer/modifier véhicule, publier/réserver/vendre, changer prix, valider Revendeur,
  //     gérer rôles et personnel, voir audit et paramètres) ; doc 02 §Acteurs : « Gestion globale,
  //     rôles, paramètres, audit ». D01 : ADMIN reçoit les 26 permissions.
  { roleCode: "ADMIN", permissionCode: "vehicle.view" }, // doc 02 ADMIN « Oui » + D01
  { roleCode: "ADMIN", permissionCode: "vehicle.create" }, // doc 02 ADMIN « Oui » (créer/modifier véhicule) + D01
  { roleCode: "ADMIN", permissionCode: "vehicle.edit" }, // doc 02 ADMIN « Oui » (créer/modifier véhicule) + D01
  { roleCode: "ADMIN", permissionCode: "vehicle.publish" }, // doc 02 ADMIN « Oui » (publier, réserver, vendre) + D01
  { roleCode: "ADMIN", permissionCode: "vehicle.reserve" }, // doc 02 ADMIN « Oui » (publier, réserver, vendre) + D01
  { roleCode: "ADMIN", permissionCode: "vehicle.mark_sold" }, // doc 02 ADMIN « Oui » (publier, réserver, vendre) + D01
  { roleCode: "ADMIN", permissionCode: "vehicle.price_edit" }, // doc 02 ADMIN « Oui » (changer prix) + D01
  { roleCode: "ADMIN", permissionCode: "customer.view" }, // doc 02 §Acteurs « Gestion globale » + D01
  { roleCode: "ADMIN", permissionCode: "customer.edit" }, // doc 02 §Acteurs « Gestion globale » + D01
  { roleCode: "ADMIN", permissionCode: "lead.view" }, // doc 02 §Acteurs « Gestion globale » + D01
  { roleCode: "ADMIN", permissionCode: "lead.assign" }, // doc 02 §Acteurs « Gestion globale » + D01
  { roleCode: "ADMIN", permissionCode: "lead.update" }, // doc 02 §Acteurs « Gestion globale » + D01
  { roleCode: "ADMIN", permissionCode: "order.view" }, // doc 02 §Acteurs « Gestion globale » + D01
  { roleCode: "ADMIN", permissionCode: "order.create" }, // doc 02 §Acteurs « Gestion globale » + D01
  { roleCode: "ADMIN", permissionCode: "order.update" }, // doc 02 §Acteurs « Gestion globale » + D01
  { roleCode: "ADMIN", permissionCode: "reseller.view" }, // doc 02 ADMIN « Oui » (valider Revendeur, lecture incluse) + D01
  { roleCode: "ADMIN", permissionCode: "reseller.approve" }, // doc 02 ADMIN « Oui » (valider Revendeur) + D01
  { roleCode: "ADMIN", permissionCode: "reseller.reject" }, // doc 02 ADMIN « Oui » (valider Revendeur) + D01
  { roleCode: "ADMIN", permissionCode: "reseller.suspend" }, // doc 02 ADMIN « Oui » (valider Revendeur) + D01
  { roleCode: "ADMIN", permissionCode: "user.manage" }, // doc 02 ADMIN « Oui » (gérer rôles et personnel) + D01
  { roleCode: "ADMIN", permissionCode: "role.manage" }, // doc 02 ADMIN « Oui » (gérer rôles et personnel) + D01
  { roleCode: "ADMIN", permissionCode: "content.manage" }, // doc 02 ADMIN « Oui » §Acteurs « Gestion globale » + D01
  { roleCode: "ADMIN", permissionCode: "settings.manage" }, // doc 02 ADMIN « Oui » (voir audit et paramètres) + D01
  { roleCode: "ADMIN", permissionCode: "analytics.view" }, // doc 02 ADMIN « Oui » §Acteurs « Gestion globale » + D01
  { roleCode: "ADMIN", permissionCode: "audit.view" }, // doc 02 ADMIN « Oui » (voir audit et paramètres) + D01
  { roleCode: "ADMIN", permissionCode: "storage.private_read" }, // doc 02 §Contrôles : seul un droit explicite ouvre les documents privés ; ADMIN « Gestion globale » + D01

  // --- COMMERCIAL — doc 02 §Acteurs : « Back-office opérationnel selon habilitation », portée
  //     « Données confiées ou équipe ». D01 : seules les permissions que les documents ne qualifient
  //     PAS de « sur habilitation » sont accordées par défaut ; les interdictions explicites
  //     (« Non » / « Non par défaut » : reseller.approve|reject|suspend, user.manage, role.manage,
  //     settings.manage, audit.view) et les habilitations renforcées (vehicle.create|edit|publish|
  //     reserve|mark_sold|price_edit, customer.edit) ne le sont pas.
  { roleCode: "COMMERCIAL", permissionCode: "vehicle.view" }, // doc 02 : lecture du catalogue, non listée « sur habilitation » + D01
  { roleCode: "COMMERCIAL", permissionCode: "customer.view" }, // doc 02 §Contrôles : portée « Données confiées ou équipe » + D01
  { roleCode: "COMMERCIAL", permissionCode: "lead.view" }, // doc 02 §Acteurs : portée « Données confiées ou équipe » + D01
  { roleCode: "COMMERCIAL", permissionCode: "lead.assign" }, // doc 02 §Acteurs : suivi des prospects confiés + D01
  { roleCode: "COMMERCIAL", permissionCode: "lead.update" }, // doc 02 §Acteurs : suivi des prospects confiés + D01
  { roleCode: "COMMERCIAL", permissionCode: "order.view" }, // doc 02 §Acteurs : portée « Données confiées ou équipe » + D01
  { roleCode: "COMMERCIAL", permissionCode: "order.create" }, // doc 02 §Acteurs : portée « Données confiées ou équipe » + D01
  { roleCode: "COMMERCIAL", permissionCode: "order.update" }, // doc 02 §Acteurs : portée « Données confiées ou équipe » + D01
  { roleCode: "COMMERCIAL", permissionCode: "reseller.view" }, // doc 02 §Matrice : « Valider Revendeur » = « Non par défaut » → lecture seule accordée + D01
];
