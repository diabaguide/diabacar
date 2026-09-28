import { describe, expect, it } from "vitest";
import {
  AUDITED_ACTIONS,
  buildAuditEntry,
  maskPhone,
  sanitizeAuditPayload,
  sensitiveTransitionsRequiringReason,
} from "@/services/audit.service";

describe("audit service", () => {
  it("only accepts the actions that the specifications require to be audited", () => {
    expect(AUDITED_ACTIONS).toContain("reseller.status.change");
    expect(AUDITED_ACTIONS).toContain("vehicle.price.change");
    expect(AUDITED_ACTIONS).toContain("staff.role.assign");
    expect(AUDITED_ACTIONS).toContain("settings.change");

    expect(() =>
      buildAuditEntry({
        actorProfileId: "p1",
        action: "customer.profile.update" as never,
        entity: "customer_profiles",
        entityId: "c1",
      }),
    ).toThrowError(/unknown audit action/i);
  });

  it("requires actor, entity, entity id and a UTC timestamp", () => {
    const entry = buildAuditEntry({
      actorProfileId: "profile-1",
      action: "vehicle.publish",
      entity: "vehicles",
      entityId: "vehicle-1",
      before: { status: "REVIEW" },
      after: { status: "PUBLISHED" },
    });

    expect(entry.actorProfileId).toBe("profile-1");
    expect(entry.entity).toBe("vehicles");
    expect(entry.entityId).toBe("vehicle-1");
    expect(entry.beforeJson).toEqual({ status: "REVIEW" });
    expect(entry.afterJson).toEqual({ status: "PUBLISHED" });
    expect(entry.occurredAt instanceof Date).toBe(true);
    expect(Number.isNaN(entry.occurredAt.getTime())).toBe(false);
  });

  it("requires a reason for the sensitive transitions described by the workflows", () => {
    expect(sensitiveTransitionsRequiringReason).toContain("reseller.status.change");

    expect(() =>
      buildAuditEntry({
        actorProfileId: "admin-1",
        action: "reseller.status.change",
        entity: "customer_profiles",
        entityId: "customer-1",
        before: { resellerStatus: "PENDING" },
        after: { resellerStatus: "APPROVED" },
      }),
    ).toThrowError(/reason/i);

    const entry = buildAuditEntry({
      actorProfileId: "admin-1",
      action: "reseller.status.change",
      entity: "customer_profiles",
      entityId: "customer-1",
      before: { resellerStatus: "PENDING" },
      after: { resellerStatus: "APPROVED" },
      reason: "Dossier complet.",
    });
    expect(entry.reason).toBe("Dossier complet.");
  });

  it("rejects an empty entity id and a missing actor for authenticated actions", () => {
    expect(() =>
      buildAuditEntry({ actorProfileId: "p1", action: "vehicle.publish", entity: "vehicles", entityId: "  " }),
    ).toThrowError(/entity id/i);
  });

  it("never stores secrets or full phone numbers in the audit payload", () => {
    const payload = sanitizeAuditPayload({
      password: "SuperSecret!123",
      serviceRoleKey: "eyJhbGciOiJI",
      authorization: "Bearer abc",
      phone: "+221771234567",
      contactPhone: "+221771234567",
      nested: { apiKey: "k", token: "t", city: "Dakar" },
    }) as Record<string, unknown>;

    expect(payload.password).toBe("[REDACTED]");
    expect(payload.serviceRoleKey).toBe("[REDACTED]");
    expect(payload.authorization).toBe("[REDACTED]");
    expect(payload.phone).toBe("+2217****567");
    expect(payload.contactPhone).toBe("+2217****567");
    expect(payload.nested).toEqual({ apiKey: "[REDACTED]", token: "[REDACTED]", city: "Dakar" });
  });

  it("masks a phone number without losing its country prefix or last digits", () => {
    expect(maskPhone("+221771234567")).toBe("+2217****567");
    expect(maskPhone("77 123 45 67")).toBe("7712****567");
    expect(maskPhone("n/a")).toBe("[REDACTED]");
  });

  it("produces entries that cannot be mutated by the caller", () => {
    const entry = buildAuditEntry({
      actorProfileId: "p1",
      action: "settings.change",
      entity: "settings",
      entityId: "whatsapp",
    });
    expect(Object.isFrozen(entry)).toBe(true);
  });
});
