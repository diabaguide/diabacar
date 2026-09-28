-- ============================================================================
-- DIABACAR - M01 : extensions, enums techniques, profils, rôles et permissions
-- ============================================================================
-- Structure SQL générée par : npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- NE PAS éditer la partie générée à la main : régénérer depuis prisma/schema.prisma (décision T01).

CREATE TYPE "UserType" AS ENUM ('CUSTOMER', 'STAFF');

CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TYPE "ResellerStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

CREATE TYPE "VehicleStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'RESERVED', 'SOLD', 'WITHDRAWN');

CREATE TYPE "VehicleCondition" AS ENUM ('NEW', 'USED');

CREATE TYPE "VehicleLocation" AS ENUM ('CHINA', 'SENEGAL');

CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'QUALIFIED', 'FOLLOW_UP', 'CONVERTED', 'LOST');

CREATE TYPE "RequestStatus" AS ENUM ('RECEIVED', 'QUALIFIED', 'SEARCHING', 'PROPOSED', 'CLOSED', 'ABANDONED');

CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'CONFIRMED', 'PROCESSING', 'SHIPPING', 'DELIVERED', 'CANCELLED');

CREATE TYPE "AssetVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "userType" "UserType" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_profiles" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "whatsapp" TEXT,
    "city" TEXT,
    "country" TEXT,
    "resellerStatus" "ResellerStatus" NOT NULL DEFAULT 'NONE',

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staff_profiles" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_permissions" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

CREATE UNIQUE INDEX "profiles_auth_user_id_key" ON "profiles"("auth_user_id");

CREATE UNIQUE INDEX "customer_profiles_profileId_key" ON "customer_profiles"("profileId");

CREATE UNIQUE INDEX "staff_profiles_profileId_key" ON "staff_profiles"("profileId");

CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Extensions PostgreSQL
-- gen_random_uuid() est natif depuis PostgreSQL 13, mais pgcrypto est demandé par la décision T01
-- (déjà provisionné par Supabase dans le schéma « extensions » : l'instruction est idempotente).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
