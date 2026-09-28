/**
 * Seed idempotent DIABACAR — rôles ADMIN et COMMERCIAL, 26 permissions officielles et associations.
 *
 * Cadre : `docs/08_Migrations_et_Seeds.docx` §« Seeds » (« Seed idempotent des codes de rôles ADMIN et
 * COMMERCIAL, des permissions et de leurs associations minimales ») et `docs/02_Roles_et_Permissions.docx`.
 * Répartition provisoire : décision D01 de `docs/decisions.md` (matrice dans `prisma/seed-data.ts`).
 *
 * Garanties :
 * - idempotence stricte : uniquement des `upsert` sur les clés naturelles `Role.code`,
 *   `Permission.code` et la paire `(roleId, permissionId)`, plus une réconciliation qui retire du rôle
 *   les associations absentes de la matrice documentée ;
 * - aucun secret, aucun mot de passe, aucune donnée personnelle : seules des données de référence
 *   (voir `prisma/seed-data.ts`) ;
 * - refus d'écrire sur une base de production sans `ALLOW_PRODUCTION_DATABASE="true"` (E25).
 *
 * Exécution : `npm run seed` ou `npx prisma db seed` (configuré dans `package.json > prisma.seed`).
 */

import { PrismaClient } from "@prisma/client";
import { assertNonProductionDatabase, fail, loadLocalEnv } from "../scripts/database-guard";
import {
  PERMISSION_CODES,
  ROLE_DEFINITIONS,
  ROLE_PERMISSION_MATRIX,
  type RoleCode,
} from "./seed-data";

export async function seed(prisma: PrismaClient): Promise<void> {
  // 1. Permissions — clé naturelle : code.
  for (const code of PERMISSION_CODES) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code },
    });
  }

  // 2. Rôles — clé naturelle : code. Le libellé est réaligné s'il a changé.
  for (const role of ROLE_DEFINITIONS) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: { code: role.code, name: role.name },
    });
  }

  const roles = await prisma.role.findMany({
    where: { code: { in: ROLE_DEFINITIONS.map((role) => role.code) } },
  });
  const permissions = await prisma.permission.findMany({
    where: { code: { in: [...PERMISSION_CODES] } },
  });

  const roleIdByCode = new Map<string, string>(roles.map((role) => [role.code, role.id]));
  const permissionIdByCode = new Map<string, string>(
    permissions.map((permission) => [permission.code, permission.id]),
  );

  const missingRoles = ROLE_DEFINITIONS.map((role) => role.code).filter(
    (code) => !roleIdByCode.has(code),
  );
  const missingPermissions = [...PERMISSION_CODES].filter(
    (code) => !permissionIdByCode.has(code),
  );
  if (missingRoles.length > 0 || missingPermissions.length > 0) {
    throw new Error(
      `Upsert incomplet : rôles manquants [${missingRoles.join(", ")}], ` +
        `permissions manquantes [${missingPermissions.join(", ")}].`,
    );
  }

  // 3. Associations rôle → permission — clé naturelle : (roleId, permissionId).
  const desiredByRole = new Map<RoleCode, Set<string>>(
    ROLE_DEFINITIONS.map((role) => [role.code, new Set<string>()]),
  );
  for (const row of ROLE_PERMISSION_MATRIX) {
    const roleId = roleIdByCode.get(row.roleCode);
    const permissionId = permissionIdByCode.get(row.permissionCode);
    if (!roleId || !permissionId) {
      throw new Error(
        `Ligne de matrice invalide : ${row.roleCode} → ${row.permissionCode} (référence inconnue).`,
      );
    }
    desiredByRole.get(row.roleCode)?.add(permissionId);

    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: {},
      create: { roleId, permissionId },
    });
  }

  // 4. Réconciliation : la matrice D01 fait foi, donc toute association hors matrice est retirée des
  //    rôles amorcés. Sans cette étape, un seed « uniquement additif » ne serait pas convergent et
  //    COMMERCIAL pourrait conserver un droit retiré de la documentation.
  for (const role of ROLE_DEFINITIONS) {
    const roleId = roleIdByCode.get(role.code);
    if (!roleId) continue;
    const desired = [...(desiredByRole.get(role.code) ?? new Set<string>())];

    await prisma.rolePermission.deleteMany({
      where: { roleId, permissionId: { notIn: desired } },
    });
  }
}

async function main(): Promise<void> {
  loadLocalEnv();
  assertNonProductionDatabase("le seed DIABACAR");

  const prisma = new PrismaClient();
  try {
    await seed(prisma);

    const roles = await prisma.role.findMany({
      where: { code: { in: ROLE_DEFINITIONS.map((role) => role.code) } },
      include: { permissions: true },
      orderBy: { code: "asc" },
    });
    const permissionCount = await prisma.permission.count({
      where: { code: { in: [...PERMISSION_CODES] } },
    });

    console.info(
      `[seed] DIABACAR : ${permissionCount}/${PERMISSION_CODES.length} permissions, ` +
        `${roles.length}/${ROLE_DEFINITIONS.length} rôles.`,
    );
    for (const role of roles) {
      console.info(`[seed]   ${role.code} (${role.name}) : ${role.permissions.length} permissions`);
    }
    console.info(
      "[seed] Le premier compte administrateur se crée dans Supabase Auth hors dépôt, " +
        "puis se lie avec `npm run staff:grant -- --email <adresse> --role ADMIN`.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution directe uniquement (le module reste importable sans effet de bord).
const invokedDirectly =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("seed.ts") || process.argv[1].endsWith("seed.js"));

if (invokedDirectly) {
  main().catch((error: unknown) => fail("seed", error));
}
