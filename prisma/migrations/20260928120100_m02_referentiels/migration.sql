-- ============================================================================
-- DIABACAR - M02 : référentiels (marques, modèles) et véhicules (images, documents)
-- ============================================================================
-- Structure SQL générée par : npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- NE PAS éditer la partie générée à la main : régénérer depuis prisma/schema.prisma (décision T01).

CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicle_models" (
    "id" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vehicle_models_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brandId" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "condition" "VehicleCondition" NOT NULL,
    "location" "VehicleLocation" NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'DRAFT',
    "year" INTEGER NOT NULL,
    "mileage" INTEGER,
    "fuel" TEXT,
    "transmission" TEXT,
    "publicPrice" DECIMAL(14,2) NOT NULL,
    "resellerPrice" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicle_images" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PUBLIC',

    CONSTRAINT "vehicle_images_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicle_documents" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',

    CONSTRAINT "vehicle_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

CREATE UNIQUE INDEX "vehicle_models_brandId_slug_key" ON "vehicle_models"("brandId", "slug");

CREATE UNIQUE INDEX "vehicles_reference_key" ON "vehicles"("reference");

CREATE UNIQUE INDEX "vehicles_slug_key" ON "vehicles"("slug");

CREATE INDEX "vehicles_status_location_publishedAt_idx" ON "vehicles"("status", "location", "publishedAt");

CREATE INDEX "vehicles_brandId_modelId_publicPrice_idx" ON "vehicles"("brandId", "modelId", "publicPrice");

CREATE UNIQUE INDEX "vehicle_images_path_key" ON "vehicle_images"("path");

CREATE INDEX "vehicle_images_vehicleId_sortOrder_idx" ON "vehicle_images"("vehicleId", "sortOrder");

CREATE UNIQUE INDEX "vehicle_documents_path_key" ON "vehicle_documents"("path");

CREATE INDEX "vehicle_documents_vehicleId_idx" ON "vehicle_documents"("vehicleId");

ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "vehicle_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_images" ADD CONSTRAINT "vehicle_images_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
