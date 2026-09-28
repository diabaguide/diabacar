import { describe, expect, it } from "vitest";
import { toProfileRecord, type ProfileRow } from "@/repositories/identity.repository";

const customerRow: ProfileRow = {
  id: "profile-1",
  authUserId: "auth-1",
  userType: "CUSTOMER",
  status: "ACTIVE",
  customer: { id: "customer-1", resellerStatus: "PENDING" },
  staff: null,
};

const staffRow: ProfileRow = {
  id: "profile-9",
  authUserId: "auth-9",
  userType: "STAFF",
  status: "ACTIVE",
  customer: null,
  staff: {
    id: "staff-1",
    active: true,
    role: {
      code: "ADMIN",
      permissions: [{ permission: { code: "audit.view" } }, { permission: { code: "role.manage" } }],
    },
  },
};

describe("toProfileRecord", () => {
  it("maps a customer profile without leaking unrelated columns", () => {
    expect(toProfileRecord(customerRow)).toEqual({
      id: "profile-1",
      authUserId: "auth-1",
      userType: "CUSTOMER",
      status: "ACTIVE",
      customer: { id: "customer-1", resellerStatus: "PENDING" },
      staff: null,
    });
  });

  it("flattens the role permissions of a staff profile", () => {
    const record = toProfileRecord(staffRow);

    expect(record.staff?.roleCode).toBe("ADMIN");
    expect(record.staff?.permissions).toEqual(["audit.view", "role.manage"]);
  });

  it("keeps an inactive staff member inactive so the actor stays downgraded", () => {
    const record = toProfileRecord({ ...staffRow, staff: { ...staffRow.staff!, active: false } });
    expect(record.staff?.active).toBe(false);
  });
});
