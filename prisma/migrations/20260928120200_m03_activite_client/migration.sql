-- ============================================================================
-- DIABACAR - M03 : favoris, recherches enregistrées, prospects, demandes, commandes
-- ============================================================================
-- Structure SQL générée par : npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- NE PAS éditer la partie générée à la main : régénérer depuis prisma/schema.prisma (décision T01).

CREATE TABLE "favorites" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saved_searches" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "filtersJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "customerId" UUID,
    "vehicleId" UUID,
    "assigneeId" UUID,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "custom_requests" (
    "id" UUID NOT NULL,
    "customerId" UUID,
    "criteriaJson" JSONB NOT NULL,
    "budgetMin" DECIMAL(14,2),
    "budgetMax" DECIMAL(14,2),
    "status" "RequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "vehicleId" UUID,
    "agreedPrice" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "favorites_customerId_vehicleId_key" ON "favorites"("customerId", "vehicleId");

CREATE INDEX "saved_searches_customerId_idx" ON "saved_searches"("customerId");

CREATE INDEX "leads_status_assigneeId_idx" ON "leads"("status", "assigneeId");

CREATE INDEX "custom_requests_customerId_status_idx" ON "custom_requests"("customerId", "status");

CREATE UNIQUE INDEX "orders_reference_key" ON "orders"("reference");

CREATE INDEX "orders_customerId_status_idx" ON "orders"("customerId", "status");

ALTER TABLE "favorites" ADD CONSTRAINT "favorites_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "favorites" ADD CONSTRAINT "favorites_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leads" ADD CONSTRAINT "leads_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leads" ADD CONSTRAINT "leads_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leads" ADD CONSTRAINT "leads_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "custom_requests" ADD CONSTRAINT "custom_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orders" ADD CONSTRAINT "orders_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
