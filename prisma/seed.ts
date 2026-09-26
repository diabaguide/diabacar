const permissions = [
  "vehicle.view", "vehicle.create", "vehicle.edit", "vehicle.publish", "vehicle.reserve", "vehicle.mark_sold", "vehicle.price_edit",
  "customer.view", "customer.edit", "lead.view", "lead.assign", "lead.update", "order.view", "order.create", "order.update",
  "reseller.view", "reseller.approve", "reseller.reject", "reseller.suspend", "user.manage", "role.manage", "content.manage",
  "settings.manage", "analytics.view", "audit.view", "storage.private_read",
] as const;

console.log("DIABACAR seed reference", { permissions: permissions.length, roles: ["ADMIN", "COMMERCIAL"] });
console.log("Create the first administrator in Supabase Auth outside the repository, then link auth_user_id to a STAFF profile.");
