export type VehicleStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "RESERVED" | "SOLD" | "WITHDRAWN";

const allowedVehicleTransitions: Readonly<Record<VehicleStatus, readonly VehicleStatus[]>> = {
  DRAFT: ["REVIEW"],
  REVIEW: ["PUBLISHED"],
  PUBLISHED: ["RESERVED", "WITHDRAWN"],
  RESERVED: ["SOLD", "PUBLISHED"],
  SOLD: [],
  WITHDRAWN: [],
};

export function canTransitionVehicleStatus(from: VehicleStatus, to: VehicleStatus): boolean {
  return allowedVehicleTransitions[from].includes(to);
}
