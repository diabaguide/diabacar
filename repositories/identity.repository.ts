import { prisma } from "@/lib/prisma/client";
import type { PermissionCode } from "@/services/permissions.service";
import type { IdentityRepository, ProfileRecord } from "@/services/identity.service";

/**
 * Accès aux données des profils (dev.md §7 : « retourner des objets explicitement sélectionnés selon
 * l'acteur. Éviter de sérialiser un modèle Prisma complet »).
 *
 * Cette connexion est privilégiée côté serveur et peut contourner RLS : les contrôles de permission et
 * de propriété restent obligatoires dans les services (doc 11).
 */
const profileSelect = {
  id: true,
  authUserId: true,
  userType: true,
  status: true,
  customer: { select: { id: true, resellerStatus: true } },
  staff: {
    select: {
      id: true,
      active: true,
      role: {
        select: {
          code: true,
          permissions: { select: { permission: { select: { code: true } } } },
        },
      },
    },
  },
} as const;

export type ProfileRow = {
  id: string;
  authUserId: string;
  userType: "CUSTOMER" | "STAFF";
  status: "ACTIVE" | "SUSPENDED";
  customer: { id: string; resellerStatus: ProfileRecord["customer"] extends null ? never : NonNullable<ProfileRecord["customer"]>["resellerStatus"] } | null;
  staff: {
    id: string;
    active: boolean;
    role: { code: string; permissions: { permission: { code: string } }[] };
  } | null;
};

/** Traduction explicite ligne SQL → contrat du domaine (testable sans base). */
export function toProfileRecord(row: ProfileRow): ProfileRecord {
  return {
    id: row.id,
    authUserId: row.authUserId,
    userType: row.userType,
    status: row.status,
    customer: row.customer ? { id: row.customer.id, resellerStatus: row.customer.resellerStatus } : null,
    staff: row.staff
      ? {
          id: row.staff.id,
          active: row.staff.active,
          roleCode: row.staff.role.code,
          permissions: row.staff.role.permissions.map((entry) => entry.permission.code as PermissionCode),
        }
      : null,
  };
}

export function createIdentityRepository(): IdentityRepository {
  return {
    async findByAuthUserId(authUserId: string) {
      const row = await prisma.profile.findUnique({ where: { authUserId }, select: profileSelect });
      return row ? toProfileRecord(row as ProfileRow) : null;
    },

    /**
     * Idempotent : l'unicité `profiles.auth_user_id` et l'`upsert` garantissent l'absence de doublon
     * même en cas d'appels concurrents (doc 11 : « création fiable et idempotente »).
     * Le domaine privilégié n'est jamais fourni par l'appelant : toujours CUSTOMER / ACTIVE ici.
     */
    async createCustomerProfile(input: { authUserId: string; firstName: string; lastName: string }) {
      const row = await prisma.profile.upsert({
        where: { authUserId: input.authUserId },
        create: {
          authUserId: input.authUserId,
          userType: "CUSTOMER",
          status: "ACTIVE",
          customer: {
            create: { firstName: input.firstName, lastName: input.lastName },
          },
        },
        update: {},
        select: profileSelect,
      });

      return toProfileRecord(row as ProfileRow);
    },
  };
}
