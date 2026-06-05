import { afterEach, describe, expect, it } from "vitest";
import { mapRegisteredUsersToAdminList } from "./admin-users";

describe("mapRegisteredUsersToAdminList", () => {
  const origOwnerEmails = process.env.RESTORMEL_SERVICE_OWNER_EMAILS;
  const origAdminIds = process.env.RESTORMEL_SERVICE_ADMIN_USER_IDS;

  afterEach(() => {
    process.env.RESTORMEL_SERVICE_OWNER_EMAILS = origOwnerEmails;
    process.env.RESTORMEL_SERVICE_ADMIN_USER_IDS = origAdminIds;
  });

  it("marks mirror users with operator email grants as service owners", () => {
    process.env.RESTORMEL_SERVICE_OWNER_EMAILS = "";
    process.env.RESTORMEL_SERVICE_ADMIN_USER_IDS = "";
    const rows = mapRegisteredUsersToAdminList(
      [
        {
          id: "u1",
          email: "ops@example.com",
          name: "",
          emailVerified: false,
          createdAt: "1",
        },
      ],
      {
        dbServiceAdminIds: new Set(),
        envAdminUserIds: new Set(),
        grantedEmails: new Set(["ops@example.com"]),
      }
    );
    expect(rows[0]?.isServiceOwner).toBe(true);
    expect(rows[0]?.dbServiceOwner).toBe(false);
  });

  it("reflects service_admins membership in dbServiceOwner", () => {
    process.env.RESTORMEL_SERVICE_OWNER_EMAILS = "";
    process.env.RESTORMEL_SERVICE_ADMIN_USER_IDS = "";
    const rows = mapRegisteredUsersToAdminList(
      [
        {
          id: "u2",
          email: "member@example.com",
          name: "Member",
          emailVerified: true,
          createdAt: "2",
        },
      ],
      {
        dbServiceAdminIds: new Set(["u2"]),
        envAdminUserIds: new Set(),
        grantedEmails: new Set(),
      }
    );
    expect(rows[0]?.isServiceOwner).toBe(true);
    expect(rows[0]?.dbServiceOwner).toBe(true);
  });
});
