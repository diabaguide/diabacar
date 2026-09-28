#!/usr/bin/env node
/**
 * `npm run staff:grant -- --email <adresse> --role ADMIN|COMMERCIAL`
 *
 * Amorçage du premier compte STAFF/ADMIN (doc 08 §« Seeds » : « Compte administrateur initial créé via
 * Supabase Auth hors dépôt ; lier son auth_user_id au profil STAFF puis attribuer ADMIN. Aucun mot de
 * passe de seed. »). Procédure documentée par la décision D04 de `docs/decisions.md`.
 *
 * Contrat :
 * - refuse d'écrire si `APP_ENV=production` et `ALLOW_PRODUCTION_DATABASE != "true"` ;
 * - exige `SUPABASE_SERVICE_ROLE_KEY` et `DATABASE_URL` (et l'URL du projet Supabase pour l'API admin) ;
 * - ne demande, ne génère et n'écrit AUCUN mot de passe : l'utilisateur Auth doit préexister côté
 *   Supabase (invitation, création manuelle ou parcours d'inscription) ;
 * - idempotent : `Profile` est attaché à l'`auth_user_id` existant (upsert sur sa clé naturelle) et le
 *   `StaffProfile` est créé ou réaligné (upsert sur `profileId`) avec le rôle demandé.
 *
 * Exemple : `npm run staff:grant -- --email admin@example.com --role ADMIN`
 */

import { PrismaClient } from "@prisma/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertNonProductionDatabase, fail, loadLocalEnv, requireEnv } from "./database-guard";
import { ROLE_DEFINITIONS, type RoleCode } from "../prisma/seed-data";

const USAGE =
  "Usage : npm run staff:grant -- --email <adresse> --role ADMIN|COMMERCIAL\n" +
  "  --email  adresse de l'utilisateur existant dans Supabase Auth (jamais de mot de passe)\n" +
  "  --role   rôle à attribuer : ADMIN ou COMMERCIAL";

const VALID_ROLES: readonly RoleCode[] = ROLE_DEFINITIONS.map((role) => role.code);

interface CliOptions {
  email: string;
  role: RoleCode;
}

function parseArgs(argv: string[]): CliOptions {
  const flags = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) continue;

    if (!token.startsWith("--")) {
      throw new Error(`Argument inattendu « ${token} ».\n${USAGE}`);
    }
    if (token === "--help" || token === "-h") {
      console.info(USAGE);
      process.exit(0);
    }

    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Valeur manquante pour ${token}.\n${USAGE}`);
    }
    flags.set(token.slice(2), value.trim());
    index += 1;
  }

  const email = flags.get("email");
  const role = flags.get("role")?.toUpperCase();
  if (!email || !role) {
    throw new Error(`--email et --role sont obligatoires.\n${USAGE}`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`Adresse e-mail invalide : « ${email} ».`);
  }
  if (!VALID_ROLES.includes(role as RoleCode)) {
    throw new Error(`Rôle invalide : « ${role} ». Valeurs acceptées : ${VALID_ROLES.join(", ")}.`);
  }

  return { email, role: role as RoleCode };
}

/** Recherche un utilisateur Auth par e-mail via l'API admin Supabase (pagination complète). */
async function findAuthUserIdByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 1000; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Échec de l'API admin Supabase (listUsers, page ${page}) : ${error.message}`);
    }

    const match = data.users.find((user) => user.email?.trim().toLowerCase() === target);
    if (match) return match.id;

    if (data.users.length < perPage) return null;
  }

  throw new Error("Pagination Supabase dépassée (plus de 1 000 000 d'utilisateurs) : arrêt par sûreté.");
}

async function main(): Promise<void> {
  loadLocalEnv();
  const options = parseArgs(process.argv.slice(2));

  assertNonProductionDatabase("staff:grant");
  requireEnv(
    "DATABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_URL" : "SUPABASE_URL",
  );

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").replace(
    /\/+$/,
    "",
  );
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authUserId = await findAuthUserIdByEmail(supabase, options.email);
  if (!authUserId) {
    throw new Error(
      `Aucun utilisateur Supabase Auth pour « ${options.email} ». ` +
        "Créer ou inviter le compte dans Supabase Auth d'abord (aucun mot de passe n'est géré par ce script).",
    );
  }

  const prisma = new PrismaClient();
  try {
    const role = await prisma.role.findUnique({ where: { code: options.role } });
    if (!role) {
      throw new Error(
        `Rôle « ${options.role} » absent de la base. Exécuter le seed au préalable : npm run seed.`,
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingProfile = await tx.profile.findUnique({ where: { authUserId } });

      const profile = await tx.profile.upsert({
        where: { authUserId },
        // Le profil est rattaché à l'utilisateur Auth existant. Le statut du compte n'est pas forcé :
        // une réactivation/ suspension reste un acte distinct (doc 02, audit des statuts).
        update: { userType: "STAFF" },
        create: { authUserId, userType: "STAFF" },
      });

      const existingStaff = await tx.staffProfile.findUnique({
        where: { profileId: profile.id },
      });

      const staff = await tx.staffProfile.upsert({
        where: { profileId: profile.id },
        update: { roleId: role.id, active: true },
        create: { profileId: profile.id, roleId: role.id },
      });

      return {
        profile,
        staff,
        profileCreated: existingProfile === null,
        staffCreated: existingStaff === null,
        previousUserType: existingProfile?.userType ?? null,
      };
    });

    // Journal sans donnée sensible : ni secret, ni mot de passe, ni jeton.
    console.info(`[staff:grant] Compte : ${options.email}`);
    console.info(`[staff:grant] Profile ${result.profile.id} : ${result.profileCreated ? "créé" : "existant"}${
      result.profileCreated ? "" : ` (userType ${result.previousUserType} → STAFF)`
    }`);
    console.info(
      `[staff:grant] StaffProfile ${result.staff.id} : ${result.staffCreated ? "créé" : "mis à jour"} ` +
        `avec le rôle ${role.code} (${role.name}), active=${result.staff.active}.`,
    );
    console.info("[staff:grant] Aucun mot de passe n'a été créé, demandé ni écrit.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => fail("staff:grant", error));
