import type { PermissionActor, PermissionCode } from "@/services/permissions.service";
import type { PricingActor, ResellerStatus } from "@/services/pricing.service";
import { AppError } from "@/lib/errors";

/**
 * Identités, profils métier et statuts (doc 06_Supabase_Auth_RLS_Storage).
 *
 * Supabase Auth reste la seule source d'identité : aucune table métier ne duplique le mot de passe.
 * Ce service relie une identité Auth à son profil métier de façon **idempotente** et ne dérive
 * JAMAIS `userType`, `status` ou `resellerStatus` d'une donnée fournie par le navigateur (dev.md §5-§6).
 */
export type UserType = "CUSTOMER" | "STAFF";
export type AccountStatus = "ACTIVE" | "SUSPENDED";

export type ProfileRecord = {
  id: string;
  authUserId: string;
  userType: UserType;
  status: AccountStatus;
  customer: { id: string; resellerStatus: ResellerStatus } | null;
  staff: { id: string; active: boolean; roleCode: string; permissions: PermissionCode[] } | null;
};

export type Actor =
  | { kind: "visitor" }
  | {
      kind: "customer";
      profileId: string;
      customerId: string;
      status: AccountStatus;
      resellerStatus: ResellerStatus;
    }
  | {
      kind: "staff";
      profileId: string;
      staffId: string;
      status: AccountStatus;
      active: boolean;
      roleCode: string;
      permissions: PermissionCode[];
    }
  | { kind: "suspended"; profileId: string; userType: UserType };

export type IdentityRepository = {
  findByAuthUserId(authUserId: string): Promise<ProfileRecord | null>;
  /** Doit être idempotent : une seconde exécution ne crée pas de doublon (contrainte unique auth_user_id). */
  createCustomerProfile(input: { authUserId: string; firstName: string; lastName: string }): Promise<ProfileRecord>;
};

export type SessionLike = {
  authUserId: string | null;
  defaults?: { firstName: string; lastName: string };
};

export function toActor(profile: ProfileRecord): Actor {
  if (profile.status !== "ACTIVE") {
    return { kind: "suspended", profileId: profile.id, userType: profile.userType };
  }

  if (profile.userType === "STAFF" && profile.staff) {
    if (!profile.staff.active) {
      return { kind: "suspended", profileId: profile.id, userType: profile.userType };
    }

    return {
      kind: "staff",
      profileId: profile.id,
      staffId: profile.staff.id,
      status: profile.status,
      active: profile.staff.active,
      roleCode: profile.staff.roleCode,
      permissions: profile.staff.permissions,
    };
  }

  if (profile.userType === "CUSTOMER" && profile.customer) {
    return {
      kind: "customer",
      profileId: profile.id,
      customerId: profile.customer.id,
      status: profile.status,
      resellerStatus: profile.customer.resellerStatus,
    };
  }

  return { kind: "suspended", profileId: profile.id, userType: profile.userType };
}

/**
 * Crée le profil métier d'une identité Auth, une seule fois.
 * Le domaine privilégié (STAFF, statut de compte, statut Revendeur) n'est jamais accepté ici.
 */
export async function ensureCustomerProfile(
  repository: IdentityRepository,
  input: { authUserId: string; firstName: string; lastName: string },
): Promise<ProfileRecord> {
  const authUserId = input.authUserId?.trim();
  if (!authUserId) {
    throw new AppError("VALIDATION", "authUserId is required.");
  }

  const existing = await repository.findByAuthUserId(authUserId);
  if (existing) {
    return existing;
  }

  return repository.createCustomerProfile({
    authUserId,
    firstName: input.firstName ?? "",
    lastName: input.lastName ?? "",
  });
}

/** Résout l'acteur serveur à partir de la session vérifiée, en provisionnant le profil au besoin. */
export async function resolveActor(session: SessionLike, repository: IdentityRepository): Promise<Actor> {
  const authUserId = session.authUserId?.trim();
  if (!authUserId) {
    return { kind: "visitor" };
  }

  const existing = await repository.findByAuthUserId(authUserId);
  const profile =
    existing ??
    (await ensureCustomerProfile(repository, {
      authUserId,
      firstName: session.defaults?.firstName ?? "",
      lastName: session.defaults?.lastName ?? "",
    }));

  return toActor(profile);
}

/** Projette l'acteur vers le contrat du service de permissions existant. */
export function toPermissionActor(actor: Actor): PermissionActor {
  if (actor.kind === "staff") {
    return { kind: "staff", active: actor.active, permissions: actor.permissions };
  }

  if (actor.kind === "customer") {
    return { kind: "customer" };
  }

  return { kind: "visitor" };
}

/** Projette l'acteur vers le contrat du service de prix existant. */
export function toPricingActor(actor: Actor): PricingActor {
  if (actor.kind === "customer") {
    return { kind: "customer", resellerStatus: actor.resellerStatus };
  }

  return { kind: "visitor" };
}
