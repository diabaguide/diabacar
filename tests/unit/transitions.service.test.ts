import { describe, expect, it } from "vitest";
import { canTransitionVehicleStatus } from "@/services/transitions.service";

describe("canTransitionVehicleStatus", () => {
  it("allows documented vehicle status transitions", () => {
    expect(canTransitionVehicleStatus("DRAFT", "REVIEW")).toBe(true);
    expect(canTransitionVehicleStatus("REVIEW", "PUBLISHED")).toBe(true);
    expect(canTransitionVehicleStatus("PUBLISHED", "RESERVED")).toBe(true);
    expect(canTransitionVehicleStatus("RESERVED", "SOLD")).toBe(true);
    expect(canTransitionVehicleStatus("PUBLISHED", "WITHDRAWN")).toBe(true);
    expect(canTransitionVehicleStatus("RESERVED", "PUBLISHED")).toBe(true);
  });

  it("refuses undocumented or terminal transitions", () => {
    expect(canTransitionVehicleStatus("SOLD", "PUBLISHED")).toBe(false);
    expect(canTransitionVehicleStatus("DRAFT", "SOLD")).toBe(false);
  });
});
