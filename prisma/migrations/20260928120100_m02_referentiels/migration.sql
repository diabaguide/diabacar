-- ============================================================================
-- DIABACAR - M02 : référentiels (marques, modèles) et véhicules (médias, documents)
-- ============================================================================
-- Structure SQL générée par : npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- NE PAS éditer la partie générée à la main : régénérer depuis prisma/schema.prisma (décision T01).

CREATE TYPE "VehicleCondition" AS ENUM ('NEW', 'USED');

CREATE TYPE "LogisticsLocation" AS ENUM ('CHINA', 'IN_TRANSIT', 'SENEGAL');

CREATE TYPE "VehicleCommercialStatus" AS ENUM ('DRAFT', 'AVAILABLE', 'RESERVED', 'SOLD', 'UNAVAILABLE', 'ARCHIVED');

CREATE TYPE "DocumentVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'SHARE_ON_REQUEST');

CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicle_models" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vehicle_models_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brand_id" UUID NOT NULL,
    "model_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "condition" "VehicleCondition" NOT NULL,
    "location" "LogisticsLocation" NOT NULL,
    "commercial_status" "VehicleCommercialStatus" NOT NULL DEFAULT 'DRAFT',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "year" INTEGER NOT NULL,
    "mileage" INTEGER,
    "fuel" TEXT,
    "transmission" TEXT,
    "public_price" DECIMAL(14,2) NOT NULL,
    "reseller_price" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicle_media" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "storage_path" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'PUBLIC',

    CONSTRAINT "vehicle_media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicle_documents" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "storage_path" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'PRIVATE',

    CONSTRAINT "vehicle_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

CREATE UNIQUE INDEX "vehicle_models_brand_id_slug_key" ON "vehicle_models"("brand_id", "slug");

CREATE UNIQUE INDEX "vehicles_reference_key" ON "vehicles"("reference");

CREATE UNIQUE INDEX "vehicles_slug_key" ON "vehicles"("slug");

CREATE INDEX "vehicles_commercial_status_location_published_at_idx" ON "vehicles"("commercial_status", "location", "published_at");

CREATE INDEX "vehicles_brand_id_model_id_public_price_idx" ON "vehicles"("brand_id", "model_id", "public_price");

CREATE UNIQUE INDEX "vehicle_media_storage_path_key" ON "vehicle_media"("storage_path");

CREATE INDEX "vehicle_media_vehicle_id_sort_order_idx" ON "vehicle_media"("vehicle_id", "sort_order");

CREATE UNIQUE INDEX "vehicle_documents_storage_path_key" ON "vehicle_documents"("storage_path");

CREATE INDEX "vehicle_documents_vehicle_id_idx" ON "vehicle_documents"("vehicle_id");

ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "vehicle_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_media" ADD CONSTRAINT "vehicle_media_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
