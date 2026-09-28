-- ============================================================================
-- DIABACAR - M04 : journaux de statut (order_events) et audit (audit_logs)
-- ============================================================================
-- Structure SQL générée par : npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- NE PAS éditer la partie générée à la main : régénérer depuis prisma/schema.prisma (décision T01).

CREATE TABLE "order_events" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorProfileId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_events_orderId_occurredAt_idx" ON "order_events"("orderId", "occurredAt");

CREATE INDEX "audit_logs_entity_entityId_occurredAt_idx" ON "audit_logs"("entity", "entityId", "occurredAt");

ALTER TABLE "order_events" ADD CONSTRAINT "order_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorProfileId_fkey" FOREIGN KEY ("actorProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Complément manuel M04 : contraintes CHECK (T04), index complémentaires (T06)
-- et audit append-only (T05). Objets non exprimables par Prisma.
-- ============================================================================

-- Contraintes CHECK sur les montants (T04) ----------------------------------
ALTER TABLE public.vehicles
  ADD CONSTRAINT "vehicles_publicPrice_non_negative" CHECK ("publicPrice" >= 0),
  ADD CONSTRAINT "vehicles_resellerPrice_non_negative" CHECK ("resellerPrice" IS NULL OR "resellerPrice" >= 0);

ALTER TABLE public.orders
  ADD CONSTRAINT "orders_agreedPrice_non_negative" CHECK ("agreedPrice" >= 0);

ALTER TABLE public.custom_requests
  ADD CONSTRAINT "custom_requests_budgetMin_non_negative" CHECK ("budgetMin" IS NULL OR "budgetMin" >= 0),
  ADD CONSTRAINT "custom_requests_budgetMax_non_negative" CHECK ("budgetMax" IS NULL OR "budgetMax" >= 0),
  ADD CONSTRAINT "custom_requests_budget_range" CHECK ("budgetMin" IS NULL OR "budgetMax" IS NULL OR "budgetMin" <= "budgetMax");

-- Index sur les clés étrangères non couvertes (T06) -------------------------
CREATE INDEX IF NOT EXISTS "staff_profiles_roleId_idx" ON public.staff_profiles ("roleId");
CREATE INDEX IF NOT EXISTS "leads_customerId_idx" ON public.leads ("customerId");
CREATE INDEX IF NOT EXISTS "leads_vehicleId_idx" ON public.leads ("vehicleId");
CREATE INDEX IF NOT EXISTS "orders_vehicleId_idx" ON public.orders ("vehicleId");
CREATE INDEX IF NOT EXISTS "custom_requests_customerId_idx" ON public.custom_requests ("customerId");
CREATE INDEX IF NOT EXISTS "audit_logs_actorProfileId_idx" ON public.audit_logs ("actorProfileId");

-- Index partiel catalogue (T06) --------------------------------------------
CREATE INDEX IF NOT EXISTS "vehicles_publishedAt_idx"
  ON public.vehicles ("publishedAt" DESC)
  WHERE status = 'PUBLISHED';

-- Audit append-only (T05) ---------------------------------------------------
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.audit_logs FROM anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs est append-only : operation % interdite', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS "audit_logs_append_only" ON public.audit_logs;
CREATE TRIGGER "audit_logs_append_only"
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();
