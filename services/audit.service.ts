import { AppError } from "@/lib/errors";

/**
 * Journal d'audit append-only (docs/12_Schema_Prisma_final_propose.docx : `AuditLog` « append only » ;
 * docs/17_Cahier_securite.docx : audit append-only pour prix, publication, réservation, vente,
 * approbation Revendeur, rôles et paramètres ; docs/09_Workflows_machines_a_etats.docx : toute transition sensible
 * enregistre acteur, date UTC, ancien état, nouvel état et motif).
 *
 * Ce service ne construit que des entrées immuables : aucune fonction de modification ou de suppression
 * n'existe, et la base applique en plus un REFUSE UPDATE/DELETE (migration M04).
 */
export const AUDITED_ACTIONS = [
  "staff.role.assign",
  "staff.role.revoke",
  "staff.activate",
  "staff.deactivate",
  "account.status.change",
  "reseller.status.change",
  "vehicle.price.change",
  "vehicle.publish",
  "vehicle.withdraw",
  "vehicle.reserve",
  "vehicle.sell",
  "order.status.change",
  "settings.change",
] as const;

export type AuditAction = (typeof AUDITED_ACTIONS)[number];

/** Transitions sensibles exigeant un motif explicite (doc 09). */
export const sensitiveTransitionsRequiringReason: readonly AuditAction[] = [
  "account.status.change",
  "reseller.status.change",
  "vehicle.withdraw",
  "vehicle.reserve",
  "vehicle.sell",
  "order.status.change",
];

export type AuditInput = {
  actorProfileId: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  occurredAt?: Date;
};

export type AuditLogEntry = {
  readonly actorProfileId: string | null;
  readonly action: AuditAction;
  readonly entity: string;
  readonly entityId: string;
  readonly beforeJson: unknown;
  readonly afterJson: unknown;
  readonly reason: string | null;
  readonly occurredAt: Date;
};

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_PATTERN = /(password|passwd|secret|token|authorization|cookie|api[_-]?key|service[_-]?role|private[_-]?key|credit[_-]?card|cvc)/i;
const PHONE_KEY_PATTERN = /(phone|telephone|tel|whatsapp|mobile)/i;

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) {
    return REDACTED;
  }

  const prefix = value.trim().startsWith("+") ? "+" : "";
  return `${prefix}${digits.slice(0, 4)}****${digits.slice(-3)}`;
}

/** Retire des données d'audit tout secret et masque les numéros complets (doc 17). */
export function sanitizeAuditPayload(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (depth > 6) {
    return REDACTED;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditPayload(item, depth + 1));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== "object") {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = REDACTED;
      continue;
    }

    if (PHONE_KEY_PATTERN.test(key) && typeof item === "string") {
      sanitized[key] = maskPhone(item);
      continue;
    }

    sanitized[key] = sanitizeAuditPayload(item, depth + 1);
  }

  return sanitized;
}

export function buildAuditEntry(input: AuditInput): AuditLogEntry {
  if (!AUDITED_ACTIONS.includes(input.action)) {
    throw new AppError("VALIDATION", `Unknown audit action: ${String(input.action)}`);
  }

  if (typeof input.entity !== "string" || input.entity.trim() === "") {
    throw new AppError("VALIDATION", "Audit entity is required.");
  }

  if (typeof input.entityId !== "string" || input.entityId.trim() === "") {
    throw new AppError("VALIDATION", "Audit entity id is required.");
  }

  const reason = input.reason?.trim() || null;
  if (sensitiveTransitionsRequiringReason.includes(input.action) && !reason) {
    throw new AppError("VALIDATION", "A reason is required for this sensitive transition.");
  }

  return Object.freeze({
    actorProfileId: input.actorProfileId,
    action: input.action,
    entity: input.entity.trim(),
    entityId: input.entityId.trim(),
    beforeJson: sanitizeAuditPayload(input.before ?? null),
    afterJson: sanitizeAuditPayload(input.after ?? null),
    reason,
    occurredAt: input.occurredAt ?? new Date(),
  });
}
