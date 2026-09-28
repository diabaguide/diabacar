/** Enum canonique `ResellerStatus` (schéma Prisma) : `NOT_APPLICABLE` remplace l'ancien `NONE`. */
export type ResellerStatus = "NOT_APPLICABLE" | "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export type PricingActor =
  | { kind: "visitor" }
  | { kind: "customer"; resellerStatus: ResellerStatus };

export type PriceInput = {
  publicPrice: string;
  resellerPrice?: string | null;
  currency: "XOF" | string;
};

export type ResolvedPrice = {
  amount: string;
  currency: string;
  priceType: "STANDARD" | "RESELLER";
  anomaly?: "MISSING_RESELLER_PRICE";
};

export function resolveVehiclePrice(vehicle: PriceInput, actor: PricingActor): ResolvedPrice {
  const isApprovedReseller = actor.kind === "customer" && actor.resellerStatus === "APPROVED";

  if (!isApprovedReseller) {
    return { amount: vehicle.publicPrice, currency: vehicle.currency, priceType: "STANDARD" };
  }

  if (!vehicle.resellerPrice) {
    return {
      amount: vehicle.publicPrice,
      currency: vehicle.currency,
      priceType: "STANDARD",
      anomaly: "MISSING_RESELLER_PRICE",
    };
  }

  return { amount: vehicle.resellerPrice, currency: vehicle.currency, priceType: "RESELLER" };
}
